import argparse
import base64
import json
import os
import re
import sys
import time
import unicodedata
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import unquote, urlsplit
from urllib.request import Request, urlopen


API_URL = "https://stepik.org/api"
REQUEST_TIMEOUT = 30
MAX_RETRIES = 5
RETRYABLE_STATUSES = {429, 500, 502, 503, 504}
BLOCK_TAGS = {
    "address", "article", "blockquote", "dd", "div", "dl", "dt",
    "h1", "h2", "h3", "h4", "h5", "h6", "li", "ol", "p", "pre",
    "section", "table", "tr", "ul",
}


class PlainTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.ignored_tag: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if self.ignored_tag:
            return
        if tag in {"script", "style", "noscript"}:
            self.ignored_tag = tag
        elif tag == "br" or tag in BLOCK_TAGS:
            self.parts.append("\n")
            if tag == "li":
                self.parts.append("- ")
        elif tag == "img":
            alt = next((value for key, value in attrs if key == "alt"), None)
            if alt:
                self.parts.append(alt)

    def handle_endtag(self, tag: str) -> None:
        if self.ignored_tag:
            if tag == self.ignored_tag:
                self.ignored_tag = None
            return
        if tag in BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self.ignored_tag:
            self.parts.append(data)


def clean_html(value: str) -> str:
    parser = PlainTextParser()
    parser.feed(value)
    parser.close()
    text = "".join(parser.parts)
    lines = [line.strip() for line in text.splitlines()]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def safe_name(value: str, limit: int) -> str:
    normalized = unicodedata.normalize("NFKC", value)
    cleaned = "".join(
        character if character.isalnum() or character in " ._-" else "_"
        for character in normalized
    ).strip(" .")
    cleaned = cleaned[:limit].rstrip(" .")
    if not cleaned or cleaned in {".", ".."}:
        cleaned = "untitled"
    if cleaned.split(".", 1)[0].upper() in {
        "CON", "PRN", "AUX", "NUL",
        *(f"COM{number}" for number in range(1, 10)),
        *(f"LPT{number}" for number in range(1, 10)),
    }:
        cleaned = f"_{cleaned}"
    return cleaned


class StepikApi:
    def __init__(self, client_id: str, client_secret: str) -> None:
        credentials = base64.b64encode(
            f"{client_id}:{client_secret}".encode("utf-8")
        ).decode("ascii")
        token_request = Request(
            f"{API_URL}/oauth2/token/",
            data=b"grant_type=client_credentials",
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Maestria Stepik course exporter",
            },
            method="POST",
        )
        with urlopen(token_request, timeout=REQUEST_TIMEOUT) as response:
            token_data = json.load(response)
        token = token_data.get("access_token")
        if not token:
            raise RuntimeError("Stepik OAuth response did not include an access token.")
        self.headers = {
            "Authorization": f"Bearer {token}",
            "User-Agent": "Maestria Stepik course exporter",
        }

    def get(self, path: str) -> dict:
        url = f"{API_URL}/{path.lstrip('/')}"
        for attempt in range(MAX_RETRIES + 1):
            request = Request(url, headers=self.headers)
            try:
                with urlopen(request, timeout=REQUEST_TIMEOUT) as response:
                    return json.load(response)
            except HTTPError as error:
                if error.code not in RETRYABLE_STATUSES or attempt == MAX_RETRIES:
                    detail = error.read().decode("utf-8", errors="replace")[:500]
                    raise RuntimeError(
                        f"Stepik API request failed ({error.code}) for {path}: {detail}"
                    ) from error
                retry_after = error.headers.get("Retry-After")
                try:
                    delay = float(retry_after) if retry_after else 2**attempt
                except ValueError:
                    delay = 2**attempt
                time.sleep(min(max(delay, 1), 60))
        raise RuntimeError(f"Stepik API request exhausted retries for {path}.")


def download_attachment(url: str, destination: Path) -> None:
    parsed_url = urlsplit(url)
    if parsed_url.scheme != "https" or not parsed_url.hostname:
        raise ValueError(f"Refusing to download attachment from an invalid URL: {url}")

    request = Request(url, headers={"User-Agent": "Maestria Stepik course exporter"})
    with urlopen(request, timeout=REQUEST_TIMEOUT) as response:
        with destination.open("wb") as output:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)


def export_course(course_id: int, output_dir: Path, api: StepikApi) -> None:
    course_response = api.get(f"courses/{course_id}")
    course = course_response["courses"][0]
    sections = course["sections"]
    print(f"Sections: {len(sections)}")

    for section_index, section_id in enumerate(sections):
        section = api.get(f"sections/{section_id}")["sections"][0]
        section_name = safe_name(section.get("title") or f"section_{section_id}", 60)
        section_dir = output_dir / f"{section_index:02d}_{section_name}"
        section_dir.mkdir(parents=True, exist_ok=True)

        for unit_id in section["units"]:
            unit = api.get(f"units/{unit_id}")["units"][0]
            lesson = api.get(f"lessons/{unit['lesson']}")["lessons"][0]
            lesson_name = safe_name(lesson.get("title") or f"lesson_{unit_id}", 80)
            lesson_dir = section_dir / lesson_name
            lesson_dir.mkdir(parents=True, exist_ok=True)

            for step_index, step_id in enumerate(lesson["steps"], start=1):
                step = api.get(f"steps/{step_id}")["steps"][0]
                block = step.get("block") or {}
                position = int(step.get("position") or step_index)
                block_name = safe_name(block.get("name") or "step", 40)
                markdown_path = lesson_dir / f"{position:02d}_{block_name}.md"
                text = clean_html(block.get("text") or "")
                markdown_path.write_text(
                    f"# {lesson.get('title', 'Lesson')} — step {position}\n\n{text}\n",
                    encoding="utf-8",
                )

                attachments = block.get("source", {}).get("attachments", [])
                for attachment in attachments:
                    url = attachment["url"]
                    filename = attachment.get("filename")
                    if not filename:
                        filename = unquote(Path(urlsplit(url).path).name)
                    if not filename:
                        raise ValueError(f"Attachment has no filename or usable URL: {url}")
                    destination = lesson_dir / safe_name(filename, 160)
                    download_attachment(url, destination)

    print(f"Done. Course exported to: {output_dir}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Export a Stepik course and its attachments as Markdown files."
    )
    parser.add_argument(
        "--course-id",
        type=int,
        default=os.environ.get("STEPIK_COURSE_ID", "207061"),
        help="Stepik course ID (default: STEPIK_COURSE_ID or 207061).",
    )
    parser.add_argument(
        "--output-dir",
        default=os.environ.get("STEPIK_OUTPUT_DIR"),
        help="Output directory (default: downloads/stepik_course_<course-id>).",
    )
    args = parser.parse_args()

    client_id = os.environ.get("STEPIK_CLIENT_ID")
    client_secret = os.environ.get("STEPIK_CLIENT_SECRET")
    if not client_id or not client_secret:
        parser.error(
            "Set STEPIK_CLIENT_ID and STEPIK_CLIENT_SECRET environment variables."
        )

    project_root = Path(__file__).resolve().parents[2]
    output_dir = (
        Path(args.output_dir).expanduser()
        if args.output_dir
        else project_root / "downloads" / f"stepik_course_{args.course_id}"
    )
    output_dir.mkdir(parents=True, exist_ok=True)

    api = StepikApi(client_id, client_secret)
    export_course(args.course_id, output_dir, api)
    return 0


if __name__ == "__main__":
    sys.exit(main())
