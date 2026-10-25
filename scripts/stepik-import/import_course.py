#!/usr/bin/env python3
"""
Импорт курса Stepik в Maestria LMS (SQLite).

Читает нормализованное дерево из `downloads/stepik_course_<id>/course.json`
(результат `stepik_dump.py`) и создаёт в базе Maestria:

    Section Stepik  -> Module
    Lesson Stepik   -> Lesson
    шаг text        -> текст урока
    шаг choice      -> Assignment(type=quiz)   с вариантами и правильным ответом
    шаг free-answer -> Assignment(type=essay)  (проверяется преподавателем)

Форматы полей соответствуют тому, что ожидает фронтенд:
    Assignment.options       = JSON-массив строк
    Assignment.correctAnswer = JSON-число (один ответ) или JSON-массив индексов

Использование (Windows):
    .venv-stepik\\Scripts\\python.exe scripts/stepik-import/import_course.py --dry-run
    .venv-stepik\\Scripts\\python.exe scripts/stepik-import/import_course.py --apply
    .venv-stepik\\Scripts\\python.exe scripts/stepik-import/import_course.py --apply --replace

Ключи API не нужны: скрипт работает только с локальной выгрузкой и SQLite.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sqlite3
import sys
import time
import uuid
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB = ROOT / "prisma" / "data.db"

BLOCK_TAGS = {
    "p", "div", "section", "article", "header", "footer", "blockquote",
    "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "pre",
    "table", "thead", "tbody", "tfoot", "tr", "hr", "figure", "figcaption",
    "details", "summary",
}


# --------------------------------------------------------------------------- #
# HTML -> текст (контент уроков в Maestria рендерится как plain text)
# --------------------------------------------------------------------------- #
class HtmlToText(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.skip_tag: str | None = None
        self.skip_depth = 0
        self.in_pre = False
        self.list_depth = 0
        self.cell_index = 0
        self.pending_link: str | None = None

    # -- helpers ------------------------------------------------------------
    def _newline(self, count: int = 1) -> None:
        if not "".join(self.parts).endswith("\n" * count):
            self.parts.append("\n" * count)

    # -- callbacks ----------------------------------------------------------
    def handle_starttag(self, tag: str, attrs) -> None:
        attributes = dict(attrs)

        if self.skip_tag:
            if tag == self.skip_tag:
                self.skip_depth += 1
            return

        if tag in {"script", "style", "noscript", "svg", "iframe"}:
            self.skip_tag = tag
            self.skip_depth = 1
            return

        if tag == "br":
            self.parts.append("\n")
        elif tag == "hr":
            self._newline(2)
            self.parts.append("—" * 20)
            self._newline(2)
        elif tag in {"h1", "h2", "h3", "h4", "h5", "h6", "p"}:
            self._newline(2)
        elif tag in {"ul", "ol"}:
            self._newline(1)
            self.list_depth += 1
        elif tag == "li":
            self._newline(1)
            indent = "  " * max(0, self.list_depth - 1)
            self.parts.append(f"{indent}• ")
        elif tag == "pre":
            self._newline(2)
            self.in_pre = True
        elif tag == "blockquote":
            self._newline(2)
            self.parts.append("> ")
        elif tag == "tr":
            self._newline(1)
            self.cell_index = 0
        elif tag in {"td", "th"}:
            if self.cell_index > 0:
                self.parts.append(" | ")
            self.cell_index += 1
        elif tag == "a":
            href = attributes.get("href") or ""
            if href and not href.startswith("#"):
                self.pending_link = href
        elif tag == "img":
            alt = (attributes.get("alt") or "").strip()
            src = (attributes.get("src") or "").strip()
            if src:
                label = f"изображение: {alt}" if alt else "изображение"
                self._newline(1)
                self.parts.append(f"[{label}] {src}")
                self._newline(1)

    def handle_endtag(self, tag: str) -> None:
        if self.skip_tag:
            if tag == self.skip_tag:
                self.skip_depth -= 1
                if self.skip_depth <= 0:
                    self.skip_tag = None
            return

        if tag in {"h1", "h2", "h3", "h4", "h5", "h6", "p"}:
            self._newline(2)
        elif tag in {"ul", "ol"}:
            self.list_depth = max(0, self.list_depth - 1)
            self._newline(1)
        elif tag == "li":
            self._newline(1)
        elif tag == "pre":
            self.in_pre = False
            self._newline(2)
        elif tag == "blockquote":
            self._newline(2)
        elif tag == "tr":
            self._newline(1)
        elif tag == "a":
            if self.pending_link:
                self.parts.append(f" ({self.pending_link})")
                self.pending_link = None
        elif tag in BLOCK_TAGS:
            self._newline(1)

    def handle_data(self, data: str) -> None:
        if self.skip_tag:
            return
        if self.in_pre:
            self.parts.append(data)
            return
        text = re.sub(r"[ \t\r\f\v]+", " ", data)
        if not text.strip():
            if self.parts and not "".join(self.parts).endswith((" ", "\n")):
                self.parts.append(" ")
            return
        self.parts.append(text)

    def result(self) -> str:
        text = "".join(self.parts).replace("\u00a0", " ")
        text = re.sub(r"[ \t]+\n", "\n", text)
        text = re.sub(r"\n[ \t]+", "\n", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r" {2,}", " ", text)
        return text.strip()


def html_to_text(html: str) -> str:
    if not html:
        return ""
    parser = HtmlToText()
    parser.feed(html)
    parser.close()
    return parser.result()


# --------------------------------------------------------------------------- #
# Сохраняем HTML для LessonContent (теперь поддерживает HTML/Markdown)
# --------------------------------------------------------------------------- #
def html_to_maestria_content(html: str) -> str | None:
    """Очищаем HTML от служебных тегов Stepik, но сохраняем разметку.

    Stepik добавляет обёртки <div class="stepik-step">, <p>, <br> —
    всё это поддерживается sanitize-html и CSS-классом .lesson-content.
    """
    if not html:
        return None

    cleaned = html

    # Удаляем служебные атрибуты Stepik
    for attr in ["data-stepik-block-id", "data-stepik-step-id"]:
        cleaned = re.sub(rf'\s{re.escape(attr)}="[^"]*"', "", cleaned)

    # Удаляем обёртки stepik-step (содержимое оставляем)
    cleaned = re.sub(r'<div\s+class="stepik-step"\s*>', "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"</div\s*>", "", cleaned, count=0)
    # Возвращаем закрывающий тег только если он был
    cleaned = re.sub(r"</div\s*>$", "", cleaned)

    # Нормализуем переносы
    cleaned = re.sub(r">\s*<", ">\n<", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

    return cleaned.strip() or None


def html_to_oneline(html: str) -> str:
    return re.sub(r"\s+", " ", html_to_text(html)).strip()


BLOCK_SPLIT_RE = re.compile(
    r"<\s*(?:/)?\s*(?:p|li|div|br|tr|h[1-6])\b[^>]*>", re.IGNORECASE
)


def html_to_items(value: object) -> list[str]:
    """HTML-список (или строка с <p>/<li>) -> массив чистых пунктов.

    Stepik отдаёт `requirements` одной HTML-строкой, а Maestria хранит
    JSON-массив строк и выводит его как текст — теги там недопустимы.
    """
    if value is None:
        return []

    if isinstance(value, list):
        items: list[str] = []
        for entry in value:
            if isinstance(entry, dict):
                entry = entry.get("text") or entry.get("title") or ""
            items.extend(html_to_items(entry))
        return items

    text = str(value).strip()
    if not text:
        return []

    # Разбиваем по блочным тегам, затем чистим каждый кусок от остатков разметки.
    chunks = BLOCK_SPLIT_RE.split(text)
    items = []
    for chunk in chunks:
        cleaned = html_to_oneline(chunk)
        cleaned = cleaned.lstrip("–—-•*· ").strip()
        if cleaned:
            items.append(cleaned)
    return items


# --------------------------------------------------------------------------- #
# Транслитерация и slug
# --------------------------------------------------------------------------- #
TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "h", "ц": "c", "ч": "ch", "ш": "sh", "щ": "sch",
    "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}


def slugify(value: str, limit: int = 90) -> str:
    transliterated = "".join(TRANSLIT.get(ch, ch) for ch in (value or "").lower())
    slug = re.sub(r"[^a-z0-9]+", "-", transliterated).strip("-")
    return slug[:limit].strip("-") or "course"


EMOJI_RE = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF"
    "\U0000FE0F\U0000200D\U00002B00-\U00002BFF]+"
)


def clean_title(value: str, fallback: str) -> str:
    text = EMOJI_RE.sub("", value or "")
    text = re.sub(r"\s+", " ", text).strip(" -—")
    return (text or fallback)[:200]


def truncate(value: str, limit: int) -> str:
    text = (value or "").strip()
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


# --------------------------------------------------------------------------- #
# Модель данных
# --------------------------------------------------------------------------- #
@dataclass
class AssignmentDraft:
    title: str
    description: str
    type: str
    options: str | None = None
    correct_answer: str | None = None
    points: int = 10


@dataclass
class LessonDraft:
    title: str
    type: str
    content: str | None
    sort_order: int
    is_free: bool
    assignments: list[AssignmentDraft] = field(default_factory=list)


@dataclass
class ModuleDraft:
    title: str
    description: str | None
    sort_order: int
    lessons: list[LessonDraft] = field(default_factory=list)


@dataclass
class CourseDraft:
    title: str
    slug: str
    description: str
    short_desc: str
    level: str
    language: str
    price: float
    duration: str | None
    has_certificate: bool
    tags: str | None
    requirements: str
    what_you_learn: str
    image: str | None
    modules: list[ModuleDraft] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


# --------------------------------------------------------------------------- #
# Сборка черновика из выгрузки
# --------------------------------------------------------------------------- #
LEVELS = {"easy": "beginner", "medium": "intermediate", "hard": "advanced"}


def build_quiz(step: dict, number: int) -> AssignmentDraft | None:
    source = step.get("source") or {}
    raw_options = source.get("options")
    if not isinstance(raw_options, list):
        return None

    texts: list[str] = []
    correct: list[int] = []
    for option in raw_options:
        if not isinstance(option, dict):
            continue
        text = html_to_oneline(str(option.get("text") or ""))
        if not text:
            continue
        if option.get("is_correct"):
            correct.append(len(texts))
        texts.append(text)

    if not texts or not correct:
        return None

    multiple = bool(source.get("is_multiple_choice"))
    question_html = step.get("html") or ""
    question_plain = html_to_text(question_html)
    description = html_to_oneline(question_plain) + ("\n\nВыберите все верные варианты." if multiple else "")

    return AssignmentDraft(
        title=truncate(html_to_oneline(question_plain), 180),
        description=description,
        type="quiz",
        options=json.dumps(texts, ensure_ascii=False),
        correct_answer=json.dumps(correct if multiple else correct[0]),
    )


def build_essay(step: dict, number: int) -> AssignmentDraft:
    question = html_to_maestria_content(step.get("html") or "") or ""
    question_plain = html_to_text(step.get("html") or "")
    return AssignmentDraft(
        title=truncate(html_to_oneline(question_plain), 180) or f"Задание {number}",
        description=question,
        type="essay",
    )


def build_course(source: dict, slug_override: str | None, keep_price: bool) -> CourseDraft:
    info = source.get("course") or {}
    title = clean_title(str(info.get("title") or ""), f"Курс Stepik {source.get('course_id')}")

    description_html = (info.get("description") or "").strip()
    summary = (info.get("summary") or "").strip()
    if not description_html:
        description_html = f"<p>{summary or title}</p>"

    requirements = info.get("requirements")
    requirements_list = (
        [html_to_oneline(str(item)) for item in requirements]
        if isinstance(requirements, list)
        else [line.strip() for line in str(requirements or "").splitlines() if line.strip()]
    )

    skills = info.get("acquired_skills")
    skills_list = (
        [html_to_oneline(str(item)) for item in skills]
        if isinstance(skills, list)
        else [line.strip() for line in str(skills or "").splitlines() if line.strip()]
    )

    tags = info.get("tags")
    tags_value = None
    if isinstance(tags, list):
        names = [
            str(tag.get("title") or tag.get("name") or tag) if isinstance(tag, dict) else str(tag)
            for tag in tags
        ]
        tags_value = ",".join(name for name in names if name)[:500]

    cover = info.get("cover")
    image = cover if isinstance(cover, str) and cover.startswith("http") else None

    time_to_complete = info.get("time_to_complete")
    duration = None
    if isinstance(time_to_complete, (int, float)) and time_to_complete > 0:
        hours = round(time_to_complete / 3600)
        duration = f"{hours} ч" if hours >= 1 else f"{round(time_to_complete / 60)} мин"

    course = CourseDraft(
        title=title,
        slug=slug_override or slugify(f"{title} {source.get('course_id')}"),
        description=truncate(description_html, 5000),
        short_desc=truncate(html_to_oneline(summary or description_html), 500),
        level=LEVELS.get(str(info.get("difficulty") or ""), "beginner"),
        language="en" if info.get("language") == "en" else "ru",
        price=float(info.get("price") or 0) if keep_price else 0.0,
        duration=duration,
        has_certificate=bool(info.get("with_certificate")),
        tags=tags_value,
        requirements=json.dumps([item for item in requirements_list if item], ensure_ascii=False),
        what_you_learn=json.dumps([item for item in skills_list if item], ensure_ascii=False),
        image=image,
    )

    for section in source.get("sections") or []:
        module = ModuleDraft(
            title=clean_title(str(section.get("title") or ""), f"Модуль {len(course.modules) + 1}"),
            description=html_to_oneline(section.get("description") or "") or None,
            sort_order=len(course.modules) + 1,
        )

        for unit in section.get("units") or []:
            lesson_title = clean_title(str(unit.get("title") or ""), f"Урок {len(module.lessons) + 1}")
            text_parts: list[str] = []
            quizzes: list[AssignmentDraft] = []
            essays: list[AssignmentDraft] = []

            for step in unit.get("steps") or []:
                block = step.get("block_name")
                if block == "text":
                    text = html_to_maestria_content(step.get("html") or "")
                    if text:
                        text_parts.append(text)
                elif block == "choice":
                    quiz = build_quiz(step, len(quizzes) + 1)
                    if quiz:
                        quizzes.append(quiz)
                    else:
                        text = html_to_maestria_content(step.get("html") or "")
                        if text:
                            text_parts.append(text)
                        course.notes.append(
                            f"step {step.get('id')}: choice без вариантов — добавлен как текст"
                        )
                elif block == "free-answer":
                    essays.append(build_essay(step, len(essays) + 1))
                else:
                    text = html_to_maestria_content(step.get("html") or "")
                    if text:
                        text_parts.append(text)
                    course.notes.append(f"step {step.get('id')}: тип «{block}» добавлен как текст")

            content = "\n\n".join(text_parts).strip() or None

            if quizzes:
                lesson_type = "quiz"
                assignments = quizzes
            elif essays:
                lesson_type = "essay"
                assignments = essays
            else:
                lesson_type = "text"
                assignments = []

            if not content and not assignments:
                course.notes.append(f"урок «{lesson_title}»: пустой, пропущен")
                continue

            module.lessons.append(
                LessonDraft(
                    title=lesson_title,
                    type=lesson_type,
                    content=content,
                    sort_order=len(module.lessons) + 1,
                    is_free=False,
                    assignments=assignments,
                )
            )

            # Эссе в одном уроке с квизом нельзя смешивать: StepQuiz ожидает
            # только quiz-задания. Выносим их в отдельный урок-практикум.
            if quizzes and essays:
                module.lessons.append(
                    LessonDraft(
                        title=truncate(f"{lesson_title} — практика", 200),
                        type="essay",
                        content=None,
                        sort_order=len(module.lessons) + 1,
                        is_free=False,
                        assignments=essays,
                    )
                )

        if module.lessons:
            course.modules.append(module)
        else:
            course.notes.append(f"модуль «{module.title}»: без уроков, пропущен")

    if course.modules and course.modules[0].lessons:
        course.modules[0].lessons[0].is_free = True

    return course


# --------------------------------------------------------------------------- #
# Запись в SQLite
# --------------------------------------------------------------------------- #
def iso_now() -> str:
    ms = int(time.time() * 1000)
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(ms / 1000)) + f".{ms % 1000:03d}+00:00"


def resolve_teacher(con: sqlite3.Connection, preferred: str | None) -> sqlite3.Row:
    if preferred:
        row = con.execute("SELECT id, email, role FROM User WHERE email = ?", (preferred,)).fetchone()
        if row:
            return row
        raise SystemExit(f"Пользователь {preferred} не найден")
    for role in ("teacher", "admin"):
        row = con.execute(
            "SELECT id, email, role FROM User WHERE role = ? AND isActive = 1 ORDER BY createdAt LIMIT 1",
            (role,),
        ).fetchone()
        if row:
            return row
    raise SystemExit("В базе нет активного пользователя с ролью teacher/admin")


def find_existing(con: sqlite3.Connection, course: CourseDraft) -> sqlite3.Row | None:
    row = con.execute("SELECT id, title, slug FROM Course WHERE slug = ?", (course.slug,)).fetchone()
    if row:
        return row
    return con.execute("SELECT id, title, slug FROM Course WHERE title = ?", (course.title,)).fetchone()


def delete_course(con: sqlite3.Connection, course_id: str) -> None:
    """Ручной каскад: PRAGMA foreign_keys в файле базы может быть выключена."""
    lesson_ids = [
        row[0]
        for row in con.execute(
            "SELECT l.id FROM Lesson l JOIN Module m ON m.id = l.moduleId WHERE m.courseId = ?",
            (course_id,),
        )
    ]

    if lesson_ids:
        placeholders = ",".join("?" * len(lesson_ids))
        assignment_ids = [
            row[0]
            for row in con.execute(
                f"SELECT id FROM Assignment WHERE lessonId IN ({placeholders})", lesson_ids
            )
        ]
        if assignment_ids:
            assignment_placeholders = ",".join("?" * len(assignment_ids))
            con.execute(
                f"DELETE FROM AssignmentSubmission WHERE assignmentId IN ({assignment_placeholders})",
                assignment_ids,
            )
        for table in ("Progress", "LessonComment", "LessonAttachment"):
            con.execute(f"DELETE FROM {table} WHERE lessonId IN ({placeholders})", lesson_ids)
        con.execute(f"DELETE FROM Assignment WHERE lessonId IN ({placeholders})", lesson_ids)
        con.execute(f"DELETE FROM Lesson WHERE id IN ({placeholders})", lesson_ids)

    for table in ("Enrollment", "Review", "Payment", "Certificate", "PromoCode"):
        con.execute(f"DELETE FROM {table} WHERE courseId = ?", (course_id,))

    con.execute("DELETE FROM Module WHERE courseId = ?", (course_id,))
    con.execute("DELETE FROM Course WHERE id = ?", (course_id,))


def resolve_category(con: sqlite3.Connection, value: str | None) -> str | None:
    """Находит категорию по slug или названию; создаёт, если её нет."""
    if not value:
        return None
    row = con.execute(
        "SELECT id FROM Category WHERE slug = ? OR name = ?", (value, value)
    ).fetchone()
    if row:
        return row["id"]

    slug = slugify(value, limit=60)
    existing_slug = con.execute("SELECT id FROM Category WHERE slug = ?", (slug,)).fetchone()
    if existing_slug:
        return existing_slug["id"]

    category_id = str(uuid.uuid4())
    timestamp = iso_now()
    con.execute(
        "INSERT INTO Category (id, name, slug, sortOrder, createdAt, updatedAt)"
        " VALUES (?,?,?,?,?,?)",
        (category_id, value, slug, 0, timestamp, timestamp),
    )
    print(f"Создана категория: {value} ({slug})")
    return category_id


def insert_course(
    con: sqlite3.Connection,
    course: CourseDraft,
    teacher_id: str,
    publish: bool,
    category_id: str | None = None,
) -> str:
    course_id = str(uuid.uuid4())
    timestamp = iso_now()

    con.execute(
        """
        INSERT INTO Course (
            id, title, slug, description, shortDesc, image, price, currency, level,
            duration, language, isPublished, isFeatured, hasCertificate, tags,
            requirements, whatYouLearn, visibility, categoryId, teacherId,
            createdAt, updatedAt
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """,
        (
            course_id, course.title, course.slug, course.description, course.short_desc,
            course.image, course.price, "RUB", course.level, course.duration,
            course.language, 1 if publish else 0, 0, 1 if course.has_certificate else 0,
            course.tags, course.requirements, course.what_you_learn, "public",
            category_id, teacher_id, timestamp, timestamp,
        ),
    )

    for module in course.modules:
        module_id = str(uuid.uuid4())
        con.execute(
            "INSERT INTO Module (id, title, description, sortOrder, courseId, createdAt, updatedAt)"
            " VALUES (?,?,?,?,?,?,?)",
            (module_id, module.title, module.description, module.sort_order,
             course_id, timestamp, timestamp),
        )

        for lesson in module.lessons:
            lesson_id = str(uuid.uuid4())
            con.execute(
                "INSERT INTO Lesson (id, title, type, content, duration, sortOrder, isFree, moduleId, createdAt, updatedAt)"
                " VALUES (?,?,?,?,?,?,?,?,?,?)",
                (lesson_id, lesson.title, lesson.type, lesson.content, 0,
                 lesson.sort_order, 1 if lesson.is_free else 0, module_id, timestamp, timestamp),
            )

            for assignment in lesson.assignments:
                con.execute(
                    "INSERT INTO Assignment (id, title, description, type, options, correctAnswer,"
                    " points, maxAttempts, lessonId, timeLimit, createdAt, updatedAt)"
                    " VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                    (str(uuid.uuid4()), assignment.title, assignment.description,
                     assignment.type, assignment.options, assignment.correct_answer,
                     assignment.points, 0, lesson_id, None, timestamp, timestamp),
                )

    return course_id


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def summarize(course: CourseDraft) -> dict[str, int]:
    lessons = [lesson for module in course.modules for lesson in module.lessons]
    assignments = [a for lesson in lessons for a in lesson.assignments]
    return {
        "modules": len(course.modules),
        "lessons": len(lessons),
        "assignments": len(assignments),
        "quizzes": sum(1 for a in assignments if a.type == "quiz"),
        "essays": sum(1 for a in assignments if a.type == "essay"),
        "text_lessons": sum(1 for lesson in lessons if lesson.type == "text"),
    }


def print_course(course: CourseDraft) -> None:
    stats = summarize(course)
    print(f"Курс:      {course.title}")
    print(f"Slug:      {course.slug}")
    print(f"Модулей:   {stats['modules']}")
    print(f"Уроков:    {stats['lessons']} (текстовых {stats['text_lessons']})")
    print(f"Заданий:   {stats['assignments']} (квизов {stats['quizzes']}, эссе {stats['essays']})")
    print()
    for module in course.modules:
        print(f"  [{module.sort_order:02d}] {module.title}")
        for lesson in module.lessons:
            suffix = f"  ({len(lesson.assignments)} зад.)" if lesson.assignments else ""
            print(f"        · {lesson.title} [{lesson.type}]{suffix}")


def dump_payload(course: CourseDraft, path: Path) -> None:
    payload = {
        "title": course.title,
        "slug": course.slug,
        "description": course.description,
        "shortDesc": course.short_desc,
        "level": course.level,
        "language": course.language,
        "price": course.price,
        "duration": course.duration,
        "tags": course.tags,
        "requirements": course.requirements,
        "whatYouLearn": course.what_you_learn,
        "modules": [
            {
                "title": module.title,
                "description": module.description,
                "sortOrder": module.sort_order,
                "lessons": [
                    {
                        "title": lesson.title,
                        "type": lesson.type,
                        "content": lesson.content,
                        "sortOrder": lesson.sort_order,
                        "isFree": lesson.is_free,
                        "assignments": [
                            {
                                "title": a.title,
                                "description": a.description,
                                "type": a.type,
                                "options": a.options,
                                "correctAnswer": a.correct_answer,
                                "points": a.points,
                            }
                            for a in lesson.assignments
                        ],
                    }
                    for lesson in module.lessons
                ],
            }
            for module in course.modules
        ],
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Импорт выгруженного курса Stepik в Maestria LMS (SQLite)"
    )
    parser.add_argument("--dump", type=Path, default=None,
                        help="каталог выгрузки (по умолчанию downloads/stepik_course_<id>)")
    parser.add_argument("--course-id", type=int,
                        default=int(os.environ.get("STEPIK_COURSE_ID", "207061")))
    parser.add_argument("--db", type=Path, default=DEFAULT_DB, help="путь к SQLite базе")
    parser.add_argument("--slug", default=None, help="переопределить slug курса")
    parser.add_argument("--teacher", default=None, help="email автора курса")
    parser.add_argument("--category", default=None,
                        help="slug или название категории (создаётся, если нет)")
    parser.add_argument("--image", default=None,
                        help="обложка курса: URL или путь вида /courses/file.jpg")
    parser.add_argument("--duration", default=None, help="длительность, например «12 ч»")
    parser.add_argument("--keep-price", action="store_true", help="сохранить цену Stepik")
    parser.add_argument("--publish", action="store_true", help="опубликовать курс")
    parser.add_argument("--replace", action="store_true",
                        help="удалить существующий курс с тем же slug/названием и импортировать заново")
    parser.add_argument("--apply", action="store_true", help="записать в базу (иначе только показать)")
    parser.add_argument("--no-backup", action="store_true", help="не делать резервную копию базы")
    args = parser.parse_args(list(argv) if argv is not None else None)

    dump_dir = args.dump or ROOT / "downloads" / f"stepik_course_{args.course_id}"
    course_file = dump_dir / "course.json"
    if not course_file.is_file():
        print(f"Не найдена выгрузка: {course_file}", file=sys.stderr)
        print("Сначала выполните: python scripts/stepik-import/stepik_dump.py", file=sys.stderr)
        return 1

    source = json.loads(course_file.read_text(encoding="utf-8"))
    course = build_course(source, args.slug, args.keep_price)
    if args.image:
        course.image = args.image
    if args.duration:
        course.duration = args.duration

    print_course(course)
    if course.notes:
        print(f"\nПредупреждения ({len(course.notes)}):")
        for note in course.notes[:15]:
            print(f"  - {note}")
        if len(course.notes) > 15:
            print(f"  ... и ещё {len(course.notes) - 15}")

    payload_file = dump_dir / "maestria-payload.json"
    dump_payload(course, payload_file)
    print(f"\nPayload: {payload_file}")

    if not args.apply:
        print("\nРежим проверки. Для записи в базу добавьте --apply")
        return 0

    db_path = args.db if args.db.is_absolute() else (ROOT / args.db)
    if not db_path.is_file():
        print(f"База не найдена: {db_path}", file=sys.stderr)
        return 1

    if not args.no_backup:
        stamp = time.strftime("%Y%m%d-%H%M%S")
        backup = db_path.with_name(f"{db_path.stem}.backup-{stamp}{db_path.suffix}")
        shutil.copy2(db_path, backup)
        print(f"Резервная копия: {backup}")

    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    try:
        con.execute("PRAGMA foreign_keys = ON")
        teacher = resolve_teacher(con, args.teacher)
        existing = find_existing(con, course)

        if existing:
            if not args.replace:
                print(
                    f"\nКурс уже есть в базе: «{existing['title']}» "
                    f"(id {existing['id']}, slug {existing['slug']}).\n"
                    f"Добавьте --replace, чтобы удалить его и импортировать заново.",
                    file=sys.stderr,
                )
                return 2

        # Удаление старого курса и вставка нового — одна транзакция,
        # чтобы сбой посередине не оставил базу в половинчатом состоянии.
        with con:
            if existing:
                print(f"\nУдаляю существующий курс {existing['id']} …")
                delete_course(con, existing["id"])
            category_id = resolve_category(con, args.category)
            course_id = insert_course(con, course, teacher["id"], args.publish, category_id)

        stats = summarize(course)
        print("\nИмпорт завершён.")
        print(f"  course id: {course_id}")
        print(f"  модулей:   {stats['modules']}")
        print(f"  уроков:    {stats['lessons']}")
        print(f"  заданий:   {stats['assignments']}")
        print(f"  автор:     {teacher['email']} ({teacher['role']})")
        print(f"  статус:    {'опубликован' if args.publish else 'черновик'}")
        print(f"  ссылка:    /#course/{course_id}")
        return 0
    finally:
        con.close()


if __name__ == "__main__":
    sys.exit(main())
