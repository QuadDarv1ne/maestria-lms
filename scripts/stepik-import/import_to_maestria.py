#!/usr/bin/env python3
"""
Импорт курса Stepik в Maestria LMS (SQLite).

Читает downloads/stepik_course_207061/course.json и создаёт:
  Course → Modules → Lessons → Assignments (для choice/free-answer)

Использование:
    py scripts/stepik-import/import_to_maestria.py
"""
import json
import sys
import uuid
import html
import re
import time
from pathlib import Path

# UTF-8 для Windows console
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[2]
COURSE_JSON = ROOT / "downloads" / "stepik_course_207061" / "course.json"


def safe_uuid():
    return str(uuid.uuid4())


def html_to_clean(html_str):
    if not html_str:
        return ""
    text = re.sub(r'<[^>]+>', '', html_str)
    text = html.unescape(text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def extract_text_from_html(html_str):
    if not html_str:
        return ""
    text = re.sub(r'<br\s*/?>', '\n', html_str)
    text = re.sub(r'</p>', '\n\n', html_str)
    text = re.sub(r'</div>', '\n', html_str)
    text = re.sub(r'</li>', '\n- ', html_str)
    text = re.sub(r'<h[1-6][^>]*>', '\n## ', html_str)
    text = re.sub(r'</h[1-6]>', '', html_str)
    text = re.sub(r'<[^>]+>', '', text)
    text = html.unescape(text)
    text = re.sub(r'\n{3,}', '\n\n', text).strip()
    return text


def parse_choice_options(source, html_content):
    options = source.get("options", [])
    is_multiple = source.get("is_multiple_choice", False)
    correct_indices = []
    parsed_options = []
    for i, opt in enumerate(options):
        text = opt.get("text", "")
        text = html.unescape(text)
        text = re.sub(r'<[^>]+>', '', text).strip()
        is_correct = bool(opt.get("is_correct", False))
        feedback = html.unescape(opt.get("feedback", ""))
        feedback = re.sub(r'<[^>]+>', '', feedback).strip()
        parsed_options.append({
            "id": str(i + 1),
            "text": text,
            "isCorrect": is_correct,
            "feedback": feedback
        })
        if is_correct:
            correct_indices.append(str(i + 1))
    return {
        "type": "multiple-choice" if is_multiple else "single-choice",
        "options": parsed_options,
        "correctAnswers": correct_indices if is_multiple else (correct_indices[0] if correct_indices else None),
        "shuffle": source.get("preserve_order", False) is False
    }


def parse_free_answer(source, html_content):
    return {
        "type": "text",
        "expectedAnswer": "",
        "allowAttachments": source.get("is_attachments_enabled", False)
    }


def sq(s):
    """Экранирует одинарные кавычки для SQL."""
    if not s:
        return "''"
    return "'" + str(s).replace("'", "''") + "'"


def now_iso():
    """ISO-8601 в том же формате, что пишет Prisma: 2026-08-02T17:13:41.825+00:00"""
    ms = int(time.time() * 1000)
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(ms / 1000)) + f".{ms % 1000:03d}+00:00"


def import_course():
    if not COURSE_JSON.is_file():
        print(f"ERROR: {COURSE_JSON} not found")
        return 1

    course_data = json.loads(COURSE_JSON.read_text(encoding="utf-8"))
    course_info = course_data["course"]

    print(f"Импорт курса: {course_info.get('title', 'Unknown')}")
    print(f"  Секций: {len(course_data['sections'])}")
    print(f"  Уроков: {sum(len(s['units']) for s in course_data['sections'])}")
    print(f"  Шагов: {sum(len(u['steps']) for s in course_data['sections'] for u in s['units'])}")

    # --- Создаём Course ---
    course_id = safe_uuid()
    title = course_info.get("title", "Без названия")
    slug = re.sub(r'[^a-zа-яё0-9]', '-', title.lower()).strip('-').replace('--', '-')[:80]
    description = html_to_clean(course_info.get("description", "") or course_info.get("summary", ""))
    short_desc = html_to_clean(course_info.get("summary", "") or description[:200])

    requirements_raw = course_info.get("requirements")
    what_you_learn = course_info.get("whatYouLearn")
    if isinstance(requirements_raw, list):
        requirements = json.dumps(requirements_raw, ensure_ascii=False)
    else:
        requirements = json.dumps([r.strip() for r in str(requirements_raw or "").split('\n') if r.strip()], ensure_ascii=False)

    if isinstance(what_you_learn, list):
        what_you_learn_json = json.dumps(what_you_learn, ensure_ascii=False)
    else:
        what_you_learn_json = json.dumps([w.strip() for w in str(what_you_learn or "").split('\n') if w.strip()], ensure_ascii=False)

    course_record = {
        "id": course_id,
        "title": title,
        "slug": slug,
        "description": description[:2000],
        "shortDesc": short_desc[:500],
        "image": course_info.get("cover", ""),
        "price": 0,
        "level": "beginner",
        "language": course_info.get("language", "ru") or "ru",
        "isPublished": False,
        "requirements": requirements,
        "whatYouLearn": what_you_learn_json,
        "teacherId": None,
        "categoryId": None,
    }

    print(f"\n[1/4] Course: {course_id}")
    print(f"  title: {title[:60]}")
    print(f"  slug: {slug}")

    # --- Создаём Modules и Lessons ---
    modules = []
    lessons = []
    assignments = []

    for sec_idx, section in enumerate(course_data["sections"], 1):
        module_id = safe_uuid()
        module_title = section.get("title", f"Модуль {sec_idx}")
        module_desc = html_to_clean(section.get("description", ""))

        module_record = {
            "id": module_id,
            "title": module_title,
            "description": module_desc[:1000],
            "sortOrder": sec_idx,
            "courseId": course_id,
        }
        modules.append(module_record)
        print(f"\n[2/4] Module {sec_idx}: {module_title}")

        for unit_idx, unit in enumerate(section.get("units", []), 1):
            lesson_id = safe_uuid()
            lesson_title = unit.get("title", f"Урок {unit_idx}")
            lesson_content = ""
            lesson_type = "text"

            steps = unit.get("steps", [])
            assignment_steps = []

            for step in steps:
                block_name = step.get("block_name", "text")
                position = step.get("position", 0)

                if block_name == "text":
                    step_html = step.get("html", "")
                    step_text = extract_text_from_html(step_html)
                    if step_text:
                        lesson_content += f"\n\n### Шаг {position}: {block_name}\n\n{step_text}"

                elif block_name in ("choice", "free-answer"):
                    assignment_id = safe_uuid()
                    assignment_title = f"Вопрос {len(assignment_steps) + 1}: {html_to_clean(step.get('html', '')[:50])}"

                    source = step.get("source") or {}
                    if block_name == "choice":
                        options_json = parse_choice_options(source, step.get("html", ""))
                        assignment_type = "quiz"
                    else:
                        options_json = parse_free_answer(source, step.get("html", ""))
                        assignment_type = "text"

                    assignment_record = {
                        "id": assignment_id,
                        "title": assignment_title[:200],
                        "description": html_to_clean(step.get("html", ""))[:1000],
                        "type": assignment_type,
                        "options": json.dumps(options_json, ensure_ascii=False),
                        "points": 10,
                        "maxAttempts": 0,
                        "lessonId": lesson_id,
                    }
                    assignments.append(assignment_record)
                    assignment_steps.append({
                        "step_id": step["id"],
                        "assignment_id": assignment_id,
                        "block_name": block_name,
                    })

            if not lesson_content:
                lesson_content = "(без текста)"

            lesson_record = {
                "id": lesson_id,
                "title": lesson_title,
                "type": lesson_type,
                "content": lesson_content.strip(),
                "sortOrder": unit_idx,
                "isFree": True,
                "moduleId": module_id,
            }
            lessons.append(lesson_record)

            if assignment_steps:
                print(f"    Урок {unit_idx}: {len(assignment_steps)} assignment(s)")

    print(f"\n[3/4] Modules: {len(modules)}")
    print(f"       Lessons: {len(lessons)}")
    print(f"       Assignments: {len(assignments)}")

    # --- Сохраняем SQL в файл ---
    sql_path = ROOT / "downloads" / "stepik_course_207061" / "import.sql"
    sql_lines = []
    ts = now_iso()

    # Course
    sql_lines.append("-- Course")
    sql_lines.append("INSERT OR IGNORE INTO Course (id, title, slug, description, shortDesc, image, price, level, language, isPublished, requirements, whatYouLearn, createdAt, updatedAt) VALUES ("
          + sq(course_record['id']) + ", "
          + sq(course_record['title']) + ", "
          + sq(course_record['slug']) + ", "
          + sq(course_record['description'][:500]) + ", "
          + sq(course_record['shortDesc'][:200]) + ", "
          + sq(course_record['image']) + ", "
          + str(course_record['price']) + ", "
          + sq(course_record['level']) + ", "
          + sq(course_record['language']) + ", "
          + str(int(course_record['isPublished'])) + ", "
          + sq(course_record['requirements']) + ", "
          + sq(course_record['whatYouLearn']) + ", "
          + sq(ts) + ", "
          + sq(ts) + ");")

    # Modules
    for m in modules:
        sql_lines.append(f"\n-- Module: {m['title']}")
        sql_lines.append("INSERT OR IGNORE INTO Module (id, title, description, sortOrder, courseId, createdAt, updatedAt) VALUES ("
              + sq(m['id']) + ", "
              + sq(m['title']) + ", "
              + sq(m['description'][:300] if m['description'] else '') + ", "
              + str(m['sortOrder']) + ", "
              + sq(m['courseId']) + ", "
              + sq(ts) + ", "
              + sq(ts) + ");")

    # Lessons
    for l in lessons:
        sql_lines.append(f"\n-- Lesson: {l['title']}")
        content_escaped = l['content'][:5000]
        sql_lines.append("INSERT OR IGNORE INTO Lesson (id, title, type, content, sortOrder, isFree, moduleId, createdAt, updatedAt) VALUES ("
              + sq(l['id']) + ", "
              + sq(l['title']) + ", "
              + sq(l['type']) + ", "
              + sq(content_escaped) + ", "
              + str(l['sortOrder']) + ", "
              + str(int(l['isFree'])) + ", "
              + sq(l['moduleId']) + ", "
              + sq(ts) + ", "
              + sq(ts) + ");")

    # Assignments
    for a in assignments:
        sql_lines.append(f"\n-- Assignment: {a['title']}")
        options_escaped = a['options']
        sql_lines.append("INSERT OR IGNORE INTO Assignment (id, title, description, type, options, points, maxAttempts, lessonId, createdAt, updatedAt) VALUES ("
              + sq(a['id']) + ", "
              + sq(a['title'][:150]) + ", "
              + sq(a['description'][:300]) + ", "
              + sq(a['type']) + ", "
              + sq(options_escaped) + ", "
              + str(a['points']) + ", "
              + str(a['maxAttempts']) + ", "
              + sq(a['lessonId']) + ", "
              + sq(ts) + ", "
              + sq(ts) + ");")

    sql_content = "\n".join(sql_lines)
    sql_path.write_text(sql_content, encoding="utf-8")
    print(f"\nSQL saved to: {sql_path}")

    print(f"\nПервые строки SQL:")
    print("\n".join(sql_lines[:5]))
    print(f"\n... и ещё {len(sql_lines) - 5} строк в {sql_path}")

    # --- Сохраняем mapping JSON ---
    mapping = {
        "course_id": course_id,
        "course_title": title,
        "modules": [],
    }
    for m in modules:
        m_lessons = [l for l in lessons if l["moduleId"] == m["id"]]
        m_assignments = [a for a in assignments if any(l["id"] == a["lessonId"] for l in m_lessons)]
        mapping["modules"].append({
            "module_id": m["id"],
            "module_title": m["title"],
            "lesson_count": len(m_lessons),
            "assignment_count": len(m_assignments),
        })

    mapping_path = ROOT / "downloads" / "stepik_course_207061" / "import_mapping.json"
    mapping_path.write_text(json.dumps(mapping, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nMapping saved to: {mapping_path}")

    print(f"\nГотово! Вставьте SQL в SQLite:")
    print(f"  sqlite3 prisma/data.db < {sql_path}")
    return 0


if __name__ == "__main__":
    sys.exit(import_course())