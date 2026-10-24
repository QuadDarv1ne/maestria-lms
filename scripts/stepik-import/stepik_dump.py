#!/usr/bin/env python3
"""
Stepik -> Maestria LMS exporter (шаг 1 из 2).

Выгружает публичный курс Stepik в сырой JSON + нормализованное дерево,
готовое для `stepik_to_maestria.mjs`.

Особенности (учтены реальные проблемы Stepik API):
  * токен: https://stepik.org/oauth2/token/ (НЕ /api/oauth2/token)
  * /api/sections отвечает медленно (до 20 c) -> запросы идут параллельно,
    таймаут щедрый, есть ретраи с backoff;
  * /api/courses?ids= не поддерживает батч -> курс берётся поштучно;
  * контент шага лежит в block.html / block.text, а НЕ в block.text всегда;
  * вложения — ссылки /downloads/... внутри html (block.source — строка, не dict);
  * видео — block.video[].urls[].url.

Использование (PowerShell):
    py scripts\\stepik-import\\stepik_dump.py --course-id 207061 --md

Ключи берутся из .env (STEPIK_CLIENT_ID / STEPIK_CLIENT_SECRET).
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import shutil
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from pathlib import Path

API = "https://stepik.org/api"
TOKEN_URL = "https://stepik.org/oauth2/token/"
UA = "maestria-lms-stepik-import/1.0"
TIMEOUT = 120          # sections реально отвечают до 20 c, даём запас
MAX_RETRIES = 5
WORKERS = 8

RESOURCE_KEY = {
    "courses": "courses",
    "sections": "sections",
    "units": "units",
    "lessons": "lessons",
    "steps": "steps",
    "step-sources": "step-sources",
}
# ресурсы, у которых батч ?ids= реально работает и быстрый
BATCHABLE = {"lessons", "steps"}

DOWNLOAD_RE = re.compile(r'https://stepik\.org/downloads/[^"\'\s<>]+')
BLOCK_TAGS = {
    "address", "article", "blockquote", "dd", "div", "dl", "dt", "h1", "h2",
    "h3", "h4", "h5", "h6", "li", "ol", "p", "pre", "section", "table",
    "tr", "ul",
}


# --------------------------------------------------------------------------- #
# env
# --------------------------------------------------------------------------- #
def load_env(root: Path) -> None:
    for name in (".env", ".env.stepik"):
        path = root / name
        if not path.is_file():
            continue
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key, value = key.strip(), value.strip().strip("\"'")
            if key and key not in os.environ:
                os.environ[key] = value


def get_token(client_id: str, client_secret: str) -> str:
    basic = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    req = urllib.request.Request(
        TOKEN_URL,
        data=b"grant_type=client_credentials",
        headers={
            "Authorization": f"Basic {basic}",
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "User-Agent": UA,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        payload = json.load(resp)
    token = payload.get("access_token")
    if not token:
        raise SystemExit(f"OAuth error: keys={sorted(payload)}")
    return token


# --------------------------------------------------------------------------- #
# API client
# --------------------------------------------------------------------------- #
class StepikApi:
    def __init__(self, token: str | None) -> None:
        self.token = token
        self.calls = 0

    def _headers(self) -> dict:
        headers = {"Accept": "application/json", "User-Agent": UA}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def get(self, path: str) -> dict:
        url = f"{API}/{path.lstrip('/')}"
        last: Exception | None = None
        for attempt in range(MAX_RETRIES):
            try:
                req = urllib.request.Request(url, headers=self._headers())
                with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                    self.calls += 1
                    return json.load(resp)
            except urllib.error.HTTPError as exc:
                last = exc
                if exc.code in (401, 403):
                    raise SystemExit(
                        f"HTTP {exc.code} для {path}: проверьте доступ к курсу")
                if exc.code == 404:
                    return {}
                if exc.code in (429, 500, 502, 503, 504):
                    time.sleep(min(3 * (attempt + 1), 30))
                    continue
                raise
            except Exception as exc:  # noqa: BLE001 - таймауты Stepik
                last = exc
                time.sleep(min(3 * (attempt + 1), 30))
        raise RuntimeError(f"Не удалось получить {path} за {MAX_RETRIES} попыток: {last}")

    def one(self, resource: str, entity_id: int, soft: bool = False) -> dict | None:
        try:
            data = self.get(f"{resource}/{entity_id}")
        except (SystemExit, RuntimeError) as exc:
            if soft:
                print(f"  ! {resource} {entity_id}: {exc}", file=sys.stderr)
                return None
            raise
        items = data.get(RESOURCE_KEY[resource]) or []
        return items[0] if items else None

    def many(self, resource: str, ids: list[int], label: str = "") -> dict[int, dict]:
        """Параллельная загрузка по id (батч только там, где он быстрый)."""
        ids = [i for i in dict.fromkeys(ids) if i]
        if not ids:
            return {}
        out: dict[int, dict] = {}

        if resource in BATCHABLE:
            chunk_size = 20
            chunks = [ids[i:i + chunk_size] for i in range(0, len(ids), chunk_size)]
            for chunk in chunks:
                query = urllib.parse.urlencode({"ids": ",".join(map(str, chunk))})
                try:
                    data = self.get(f"{resource}?{query}")
                    for item in data.get(RESOURCE_KEY[resource]) or []:
                        out[item["id"]] = item
                except Exception:  # noqa: BLE001 - упадём на поштучную загрузку
                    pass
            missing = [i for i in ids if i not in out]
        else:
            missing = ids

        if missing:
            done = 0
            with ThreadPoolExecutor(max_workers=WORKERS) as pool:
                futures = {pool.submit(self.one, resource, i): i for i in missing}
                for future in as_completed(futures):
                    entity_id = futures[future]
                    try:
                        item = future.result()
                    except Exception as exc:  # noqa: BLE001
                        print(f"  ! {resource} {entity_id}: {exc}", file=sys.stderr)
                        continue
                    if item:
                        out[entity_id] = item
                    done += 1
                    if label and done % 25 == 0:
                        print(f"  ... {label}: {done}/{len(missing)}")
        return out

    def sources(self, step_ids: list[int], label: str = "sources") -> dict[int, dict]:
        """block.source шага: варианты ответов и флаги is_correct.

        Публичный /steps отдаёт block без source (для choice-шагов там только
        is_multiple_choice), поэтому варианты берём из /step-sources/{id}.
        Stepik троттлит этот эндпоинт (403 при параллельных запросах),
        поэтому идём последовательно с паузой и повторами.
        """
        out: dict[int, dict] = {}
        for index, step_id in enumerate(step_ids, start=1):
            item = None
            for attempt in range(4):
                try:
                    data = self.get(f"step-sources/{step_id}")
                except (SystemExit, RuntimeError):
                    time.sleep(2 * (attempt + 1))
                    continue
                items = data.get("step-sources") or []
                item = items[0] if items else None
                break
            source = ((item or {}).get("block") or {}).get("source")
            if isinstance(source, dict):
                out[step_id] = source
            else:
                print(f"  ! step-source {step_id}: нет данных", file=sys.stderr)
            if index % 10 == 0:
                print(f"  ... {label}: {index}/{len(step_ids)}")
            time.sleep(0.4)
        return out

    def download(self, url: str, dest: Path) -> bool:
        if dest.is_file() and dest.stat().st_size > 0:
            return False
        dest.parent.mkdir(parents=True, exist_ok=True)
        absolute = url if url.startswith("http") else f"https://stepik.org{url}"
        for attempt in range(3):
            try:
                req = urllib.request.Request(absolute, headers=self._headers())
                with urllib.request.urlopen(req, timeout=TIMEOUT) as resp, dest.open("wb") as fh:
                    shutil.copyfileobj(resp, fh)
                return True
            except Exception:  # noqa: BLE001 - медиа не критично
                time.sleep(2 * (attempt + 1))
        print(f"  ! не скачано: {absolute}", file=sys.stderr)
        return False


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
class _Text(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.skip: str | None = None

    def handle_starttag(self, tag, attrs):
        if self.skip:
            return
        if tag in {"script", "style", "noscript"}:
            self.skip = tag
        elif tag == "br" or tag in BLOCK_TAGS:
            self.parts.append("\n")
            if tag == "li":
                self.parts.append("- ")
        elif tag == "img":
            alt = next((v for k, v in attrs if k == "alt"), None)
            if alt:
                self.parts.append(f"[{alt}]")

    def handle_endtag(self, tag):
        if self.skip:
            if tag == self.skip:
                self.skip = None
            return
        if tag in BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def html_to_text(value: str) -> str:
    parser = _Text()
    parser.feed(value or "")
    parser.close()
    lines = [line.strip() for line in "".join(parser.parts).splitlines()]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def safe_name(value: str, limit: int = 70) -> str:
    normalized = unicodedata.normalize("NFKC", value or "")
    cleaned = "".join(
        ch if ch.isalnum() or ch in " ._-" else "_" for ch in normalized
    ).strip(" .")
    cleaned = re.sub(r"_{2,}", "_", cleaned)[:limit].rstrip(" .")
    if not cleaned or cleaned in {".", ".."}:
        cleaned = "untitled"
    if cleaned.split(".", 1)[0].upper() in {"CON", "PRN", "AUX", "NUL"}:
        cleaned = f"_{cleaned}"
    return cleaned


def block_content(block: dict) -> str:
    """HTML шага: html -> text -> source(строка)."""
    for key in ("html", "text"):
        value = block.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    source = block.get("source")
    return source.strip() if isinstance(source, str) else ""


def video_urls(block: dict) -> list[str]:
    urls: list[str] = []
    for video in block.get("video") or []:
        if not isinstance(video, dict):
            continue
        entries = [e for e in (video.get("urls") or []) if isinstance(e, dict) and e.get("url")]
        entries.sort(key=lambda e: e.get("quality") or "", reverse=True)
        urls.extend(e["url"] for e in entries)
        if not entries and video.get("youtube"):
            urls.append(f"https://www.youtube.com/watch?v={video['youtube']}")
    return urls


def attachments_in(html: str) -> list[str]:
    return DOWNLOAD_RE.findall(html or "")


# --------------------------------------------------------------------------- #
# export
# --------------------------------------------------------------------------- #
def export(course_id: int, out_dir: Path, api: StepikApi, want_md: bool,
           want_files: bool, from_raw: bool = False) -> dict:
    warnings: list[str] = []
    raw = out_dir / "raw"

    if from_raw and (raw / "steps.json").is_file():
        print("[--from-raw] читаю локальную выгрузку, API не вызывается")
        course = json.loads((raw / "course.json").read_text(encoding="utf-8"))
        sections = json.loads((raw / "sections.json").read_text(encoding="utf-8"))
        units = json.loads((raw / "units.json").read_text(encoding="utf-8"))
        lessons = json.loads((raw / "lessons.json").read_text(encoding="utf-8"))
        steps = json.loads((raw / "steps.json").read_text(encoding="utf-8"))
        sections_map = {s["id"]: s for s in sections}
        units_map = {u["id"]: u for u in units}
        lessons_map = {l["id"]: l for l in lessons}
        steps_map = {s["id"]: s for s in steps}
        unit_ids = [u for sec in sections for u in (sec.get("units") or [])]
        lesson_ids = sorted({u["lesson"] for u in units if u.get("lesson")})
        step_ids = sorted(steps_map)
    else:
        print(f"[1/5] Курс {course_id} ...")
        course = api.one("courses", course_id)
        if not course:
            raise SystemExit(f"Курс {course_id} не найден")

        section_ids = course.get("sections") or []
        print(f"[2/5] Секции: {len(section_ids)}")
        sections_map = api.many("sections", section_ids, "sections")
        sections = [sections_map[i] for i in section_ids if i in sections_map]
        if len(sections) != len(section_ids):
            warnings.append(f"секций получено {len(sections)} из {len(section_ids)}")

        unit_ids = [u for sec in sections for u in (sec.get("units") or [])]
        print(f"[3/5] Юниты: {len(unit_ids)}")
        units_map = api.many("units", unit_ids, "units")

        lesson_ids = sorted({u["lesson"] for u in units_map.values() if u.get("lesson")})
        print(f"[4/5] Уроки: {len(lesson_ids)}")
        lessons_map = api.many("lessons", lesson_ids, "lessons")

        step_ids = sorted({s for lesson in lessons_map.values() for s in (lesson.get("steps") or [])})
        print(f"[5/5] Шаги: {len(step_ids)}")
        steps_map = api.many("steps", step_ids, "steps")

    # ---------- варианты ответов (choice и др.) ----------
    interactive = [
        sid for sid in step_ids
        if (steps_map.get(sid, {}).get("block") or {}).get("name") not in (None, "text")
    ]
    sources_path = raw / "step-sources.json"
    if from_raw and sources_path.is_file():
        sources = json.loads(sources_path.read_text(encoding="utf-8"))
        sources_map = {int(k): v for k, v in sources.items()}
    elif interactive:
        print(f"[+] Варианты ответов: {len(interactive)} шагов")
        sources_map = api.sources(interactive)
    else:
        sources_map = {}

    # ---------- raw ----------
    raw.mkdir(parents=True, exist_ok=True)
    payloads = {
        "course": course,
        "sections": sections,
        "units": [units_map[i] for i in unit_ids if i in units_map],
        "lessons": [lessons_map[i] for i in lesson_ids if i in lessons_map],
        "steps": [steps_map[i] for i in step_ids if i in steps_map],
    }
    for name, payload in payloads.items():
        (raw / f"{name}.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    if sources_map:
        (sources_path).write_text(
            json.dumps({str(k): v for k, v in sources_map.items()},
                       ensure_ascii=False, indent=2), encoding="utf-8")


    # ---------- normalized tree ----------
    tree = {
        "source": "stepik",
        "course_id": course_id,
        "fetched_at": int(time.time()),
        "course": {
            key: course.get(key)
            for key in (
                "title", "slug", "summary", "description", "requirements",
                "acquired_skills", "acquired_assets", "tags", "language",
                "difficulty", "cover", "intro_video", "is_paid", "price",
                "currency_code", "learners_count", "time_to_complete",
                "workload", "with_certificate", "certificate", "instructors",
                "lessons_count", "quizzes_count", "challenges_count",
            )
        },
        "sections": [],
    }

    for sec in sections:
        node = {
            "id": sec["id"],
            "title": sec.get("title"),
            "position": sec.get("position"),
            "description": sec.get("description"),
            "is_exam": bool(sec.get("is_exam")),
            "units": [],
        }
        for unit_id in sec.get("units") or []:
            unit = units_map.get(unit_id)
            if not unit:
                warnings.append(f"unit {unit_id} не получен")
                continue
            lesson = lessons_map.get(unit.get("lesson"))
            if not lesson:
                warnings.append(f"lesson {unit.get('lesson')} не получен")
                continue
            lesson_node = {
                "id": lesson["id"],
                "unit_id": unit_id,
                "position": unit.get("position"),
                "title": lesson.get("title"),
                "slug": lesson.get("slug"),
                "step_type": lesson.get("step_type"),
                "tags": lesson.get("tags"),
                "time_to_complete": lesson.get("time_to_complete"),
                "is_public": lesson.get("is_public"),
                "steps": [],
            }
            for step_id in lesson.get("steps") or []:
                step = steps_map.get(step_id)
                if not step:
                    warnings.append(f"step {step_id} не получен")
                    continue
                block = step.get("block") or {}
                html = block_content(block)
                source = sources_map.get(step_id) or {}
                lesson_node["steps"].append({
                    "id": step_id,
                    "position": step.get("position"),
                    "block_name": block.get("name"),
                    "html": html,
                    "text": html_to_text(html),
                    "solution": block.get("solution") or "",
                    "options": block.get("options"),
                    "source": source,
                    "video_urls": video_urls(block),
                    "attachments": attachments_in(html),
                    "actions": step.get("actions"),
                    "meta": step.get("meta"),
                    "status": step.get("status"),
                })
            node["units"].append(lesson_node)
        tree["sections"].append(node)

    (out_dir / "course.json").write_text(
        json.dumps(tree, ensure_ascii=False, indent=2), encoding="utf-8")

    # ---------- markdown ----------
    if want_md:
        md_dir = out_dir / "lessons"
        md_dir.mkdir(exist_ok=True)
        for s_idx, section in enumerate(tree["sections"], start=1):
            for u_idx, lesson in enumerate(section["units"], start=1):
                lines = [
                    f"# {lesson['title']}",
                    f"\n> Модуль {s_idx}. {section['title']} / юнит {u_idx}\n",
                ]
                for step in lesson["steps"]:
                    lines.append(
                        f"\n## Шаг {step['position']} — {step['block_name']}\n")
                    lines.append(step["text"] or "*(без текста)*")
                    if step["solution"]:
                        lines.append("\n**Решение:**\n")
                        lines.append(html_to_text(step["solution"]))
                name = f"{s_idx:02d}_{u_idx:02d}_{safe_name(lesson['title'])}.md"
                (md_dir / name).write_text("\n".join(lines), encoding="utf-8")

    # ---------- media ----------
    if want_files:
        files_dir = out_dir / "files"
        files_dir.mkdir(exist_ok=True)
        urls: set[str] = set()
        for lesson in lessons_map.values():
            for step in steps_map.values():
                pass
        for step in steps_map.values():
            block = step.get("block") or {}
            urls.update(attachments_in(block_content(block)))
            urls.update(video_urls(block))
        print(f"Медиа: {len(urls)} ссылок")
        saved = 0
        for url in sorted(urls):
            name = urllib.parse.unquote(url.rstrip("/").split("/")[-1].split("?")[0])
            if api.download(url, files_dir / safe_name(name, 120)):
                saved += 1
        print(f"Скачано файлов: {saved}")

    manifest = {
        "course_id": course_id,
        "title": tree["course"]["title"],
        "sections": len(tree["sections"]),
        "lessons": sum(len(s["units"]) for s in tree["sections"]),
        "steps": sum(len(u["steps"]) for s in tree["sections"] for u in s["units"]),
        "api_calls": api.calls,
        "warnings": warnings,
        "out_dir": str(out_dir),
    }
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return manifest


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    load_env(root)

    parser = argparse.ArgumentParser(description="Экспорт курса Stepik для Maestria LMS")
    parser.add_argument("--course-id", type=int,
                        default=int(os.environ.get("STEPIK_COURSE_ID", "207061")))
    parser.add_argument("--output-dir", default=os.environ.get("STEPIK_OUTPUT_DIR"))
    parser.add_argument("--md", action="store_true", help="писать читаемый markdown")
    parser.add_argument("--no-files", action="store_true", help="не качать вложения и видео")
    parser.add_argument("--no-auth", action="store_true", help="без OAuth (публичный курс)")
    parser.add_argument("--from-raw", action="store_true",
                        help="пересобрать course.json из raw/*.json без запросов к API")
    args = parser.parse_args()

    out_dir = (Path(args.output_dir).expanduser() if args.output_dir
               else root / "downloads" / f"stepik_course_{args.course_id}")
    out_dir.mkdir(parents=True, exist_ok=True)

    token = None
    if not args.no_auth:
        client_id = os.environ.get("STEPIK_CLIENT_ID", "")
        client_secret = os.environ.get("STEPIK_CLIENT_SECRET", "")
        if client_id and client_secret:
            print("OAuth2 client_credentials ...")
            token = get_token(client_id, client_secret)
        else:
            print("STEPIK_CLIENT_ID/SECRET не заданы — анонимный режим", file=sys.stderr)

    started = time.time()
    manifest = export(args.course_id, out_dir, StepikApi(token), args.md,
                      not args.no_files, args.from_raw)
    manifest["seconds"] = round(time.time() - started, 1)
    print("\nГотово.")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
