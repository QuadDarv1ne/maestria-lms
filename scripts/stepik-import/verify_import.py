#!/usr/bin/env python3
"""
Проверка качества импортированного курса в базе Maestria LMS.

Проверяет то, что реально ломает интерфейс:
  * Assignment.options — JSON-массив строк (формат StepQuiz и assignment-grading);
  * Assignment.correctAnswer — JSON-число или массив индексов в пределах options;
  * Lesson.type входит в набор, поддерживаемый StepViewerPage;
  * контент уроков не пуст и не обрезан;
  * связи Course -> Module -> Lesson -> Assignment целы, FK не нарушены;
  * у автора курса есть пароль (иначе вход по email невозможен).

Использование:
    python scripts/stepik-import/verify_import.py
    python scripts/stepik-import/verify_import.py --slug system-administration-linux
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DB = ROOT / "prisma" / "data.db"

SUPPORTED_LESSON_TYPES = {
    "video", "text", "coding", "quiz", "assignment",
    "matching", "ordering", "essay", "file_upload", "drag_drop",
}
SUPPORTED_ASSIGNMENT_TYPES = {
    "quiz", "coding", "text", "matching", "ordering",
    "file_upload", "essay", "drag_drop",
}

problems: list[str] = []
warnings: list[str] = []


def fail(message: str) -> None:
    problems.append(message)


def warn(message: str) -> None:
    warnings.append(message)


def check_assignments(con: sqlite3.Connection, course_id: str) -> int:
    rows = con.execute(
        "SELECT a.type, a.options, a.correctAnswer, l.title AS lesson"
        " FROM Assignment a"
        " JOIN Lesson l ON l.id = a.lessonId"
        " JOIN Module m ON m.id = l.moduleId"
        " WHERE m.courseId = ?",
        (course_id,),
    ).fetchall()

    for row in rows:
        label = f"задание «{(row['lesson'] or '')[:40]}» ({row['type']})"

        if row["type"] not in SUPPORTED_ASSIGNMENT_TYPES:
            fail(f"{label}: неизвестный тип {row['type']}")

        if row["type"] != "quiz":
            continue

        try:
            options = json.loads(row["options"] or "null")
        except json.JSONDecodeError as exc:
            fail(f"{label}: options не JSON ({exc})")
            continue

        if not isinstance(options, list) or not options:
            fail(f"{label}: options должен быть непустым массивом")
            continue
        if not all(isinstance(item, str) for item in options):
            fail(f"{label}: options содержит не строки")
            continue
        if len(set(options)) != len(options):
            warn(f"{label}: дубликаты вариантов ответа")

        try:
            correct = json.loads(row["correctAnswer"] or "null")
        except json.JSONDecodeError:
            fail(f"{label}: correctAnswer не JSON")
            continue

        indices = correct if isinstance(correct, list) else [correct]
        if not indices or any(not isinstance(index, int) for index in indices):
            fail(f"{label}: correctAnswer должен быть числом или массивом чисел")
            continue
        if any(index < 0 or index >= len(options) for index in indices):
            fail(f"{label}: correctAnswer {indices} вне диапазона options")
        if isinstance(correct, list) and len(set(indices)) != len(indices):
            warn(f"{label}: повторяющиеся индексы в correctAnswer")

    return len(rows)


def check_lessons(con: sqlite3.Connection, course_id: str) -> tuple[int, int]:
    rows = con.execute(
        "SELECT l.id, l.title, l.type, l.content FROM Lesson l"
        " JOIN Module m ON m.id = l.moduleId WHERE m.courseId = ?",
        (course_id,),
    ).fetchall()

    empty = 0
    for row in rows:
        title = (row["title"] or "")[:40]
        if row["type"] not in SUPPORTED_LESSON_TYPES:
            fail(f"урок «{title}»: тип {row['type']} не поддерживается фронтендом")

        assignments = con.execute(
            "SELECT COUNT(1) FROM Assignment WHERE lessonId = ?", (row["id"],)
        ).fetchone()[0]
        content = (row["content"] or "").strip()

        if not content and assignments == 0:
            empty += 1
            fail(f"урок «{title}»: ни контента, ни заданий")
        if row["type"] == "text" and not content:
            fail(f"урок «{title}»: текстовый урок без контента")
        if row["type"] in {"quiz", "essay"} and assignments == 0:
            fail(f"урок «{title}»: тип {row['type']} без заданий")
        if len(content) in {1000, 2000, 5000}:
            warn(f"урок «{title}»: контент ровно {len(content)} симв. — возможно, обрезан")

    return len(rows), empty


def check_structure(con: sqlite3.Connection, course_id: str) -> None:
    modules = con.execute(
        "SELECT id, title FROM Module WHERE courseId = ? ORDER BY sortOrder", (course_id,)
    ).fetchall()
    if not modules:
        fail("у курса нет модулей")

    for module in modules:
        lessons = con.execute(
            "SELECT COUNT(1) FROM Lesson WHERE moduleId = ?", (module["id"],)
        ).fetchone()[0]
        if lessons == 0:
            fail(f"модуль «{(module['title'] or '')[:40]}» без уроков")

    orphans = con.execute(
        "SELECT COUNT(1) FROM Lesson l LEFT JOIN Module m ON m.id = l.moduleId WHERE m.id IS NULL"
    ).fetchone()[0]
    if orphans:
        fail(f"{orphans} уроков без модуля")

    violations = con.execute("PRAGMA foreign_key_check").fetchall()
    if violations:
        fail(f"нарушено внешних ключей: {len(violations)}")


def check_course_fields(con: sqlite3.Connection, course: sqlite3.Row) -> None:
    if course["price"] < 0:
        fail("цена отрицательная")
    if course["level"] not in {"beginner", "intermediate", "advanced"}:
        fail(f"level «{course['level']}» не поддерживается")
    if course["language"] not in {"ru", "en", "zh"}:
        fail(f"language «{course['language']}» не поддерживается")
    if not course["description"] or len(course["description"]) < 10:
        fail("описание курса пустое или слишком короткое")
    if course["slug"] and not all(ch.isascii() for ch in course["slug"]):
        fail(f"slug «{course['slug']}» содержит не-ASCII символы")

    for field in ("requirements", "whatYouLearn"):
        value = course[field]
        if not value:
            continue
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            fail(f"{field}: невалидный JSON")
            continue
        if not isinstance(parsed, list):
            fail(f"{field}: ожидался JSON-массив")
            continue
        if any("<" in str(item) for item in parsed):
            warn(f"{field}: содержит HTML-теги (выводится как текст)")

    image = course["image"] or ""
    if image.startswith("/") and not (ROOT / "public" / image.lstrip("/")).is_file():
        fail(f"обложка {image} отсутствует в public/")

    if not course["teacherId"]:
        warn("у курса не указан автор")
        return

    teacher = con.execute(
        "SELECT name, email, role, passwordHash, isActive FROM User WHERE id = ?",
        (course["teacherId"],),
    ).fetchone()
    if teacher is None:
        fail("автор курса не найден в базе")
        return
    if teacher["role"] not in {"teacher", "admin"}:
        fail(f"автор курса имеет роль {teacher['role']}")
    if not teacher["isActive"]:
        fail("автор курса деактивирован")
    if not teacher["passwordHash"]:
        warn(f"у автора {teacher['email']} нет пароля — вход по email/паролю невозможен")


def main() -> int:
    parser = argparse.ArgumentParser(description="Проверка импортированного курса в Maestria")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--slug", default=None, help="slug курса (иначе последний созданный)")
    parser.add_argument("--course-id", default=None, help="id курса")
    args = parser.parse_args()

    db_path = args.db if args.db.is_absolute() else ROOT / args.db
    if not db_path.is_file():
        print(f"База не найдена: {db_path}", file=sys.stderr)
        return 1

    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    try:
        if args.course_id:
            course = con.execute("SELECT * FROM Course WHERE id = ?", (args.course_id,)).fetchone()
        elif args.slug:
            course = con.execute("SELECT * FROM Course WHERE slug = ?", (args.slug,)).fetchone()
        else:
            course = con.execute("SELECT * FROM Course ORDER BY createdAt DESC LIMIT 1").fetchone()

        if course is None:
            print("Курс не найден", file=sys.stderr)
            return 1

        print(f"Курс: {course['title']}")
        print(f"  id:     {course['id']}")
        print(f"  slug:   {course['slug']}")
        print(f"  статус: {'опубликован' if course['isPublished'] else 'черновик'}")

        check_course_fields(con, course)
        check_structure(con, course["id"])
        lessons, empty = check_lessons(con, course["id"])
        assignments = check_assignments(con, course["id"])

        modules = con.execute(
            "SELECT COUNT(1) FROM Module WHERE courseId = ?", (course["id"],)
        ).fetchone()[0]
        total_chars, longest = con.execute(
            "SELECT COALESCE(SUM(LENGTH(l.content)), 0), COALESCE(MAX(LENGTH(l.content)), 0)"
            " FROM Lesson l JOIN Module m ON m.id = l.moduleId WHERE m.courseId = ?",
            (course["id"],),
        ).fetchone()

        print(f"\n  модулей: {modules}")
        print(f"  уроков:  {lessons} (пустых {empty})")
        print(f"  заданий: {assignments}")
        print(f"  контент: {total_chars} симв., самый длинный урок {longest} симв.")
    finally:
        con.close()

    if warnings:
        print(f"\nПредупреждения ({len(warnings)}):")
        for message in warnings:
            print(f"  ! {message}")

    if problems:
        print(f"\nОшибки ({len(problems)}):")
        for message in problems:
            print(f"  x {message}")
        return 1

    print("\nПроверка пройдена: данные пригодны для отображения и автопроверки.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
