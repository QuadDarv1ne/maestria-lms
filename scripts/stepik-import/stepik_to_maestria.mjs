#!/usr/bin/env node
/**
 * Stepik -> Maestria LMS: конвертер и импортёр курса.
 *
 * Вход: downloads/stepik_course_<id>/course.json (результат stepik_dump.py).
 *
 * Маппинг:
 *   Stepik section  -> Module
 *   Stepik lesson   -> Lesson
 *   step text       -> HTML-контент урока (шаги склеиваются)
 *   step choice     -> Assignment (quiz)  options/correctAnswer в формате Maestria
 *   step free-answer-> Assignment (essay) ручная проверка
 *
 * Режимы:
 *   --dry-run   (по умолчанию) собрать payload и записать в maestria-payload.json
 *   --apply     создать курс в БД через Prisma
 *   --publish   опубликовать курс (иначе черновик)
 *
 * Пример:
 *   node scripts/stepik-import/stepik_to_maestria.mjs --dry-run
 *   node scripts/stepik-import/stepik_to_maestria.mjs --apply
 */

import fs from "node:fs";
import path from "node:path";
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

// --------------------------------------------------------------------------- //
// CLI
// --------------------------------------------------------------------------- //
function parseArgs(argv) {
  const args = { apply: false, publish: false, dump: null, slug: null, keepPrice: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") args.apply = true;
    else if (arg === "--publish") args.publish = true;
    else if (arg === "--keep-price") args.keepPrice = true;
    else if (arg === "--dump") args.dump = argv[++i];
    else if (arg === "--slug") args.slug = argv[++i];
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (!arg.startsWith("-")) args.dump = arg;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`Использование: node scripts/stepik-import/stepik_to_maestria.mjs [опции]

  <путь>            каталог выгрузки (по умолчанию downloads/stepik_course_<STEPIK_COURSE_ID>)
  --dump <путь>     то же самое
  --slug <slug>     переопределить slug курса
  --keep-price      сохранить цену Stepik (по умолчанию курс бесплатный)
  --apply           записать в базу (по умолчанию только собрать JSON)
  --publish         опубликовать курс`);
  process.exit(0);
}

const ROOT = path.resolve(import.meta.dirname, "../..");
const COURSE_ID = Number(process.env.STEPIK_COURSE_ID || 207061);
const dumpDir = args.dump
  ? path.resolve(ROOT, args.dump)
  : path.join(ROOT, "downloads", `stepik_course_${COURSE_ID}`);
const courseFile = path.join(dumpDir, "course.json");

if (!fs.existsSync(courseFile)) {
  console.error(`Не найден ${courseFile}\nСначала выполните: python scripts/stepik-import/stepik_dump.py`);
  process.exit(1);
}

const source = JSON.parse(fs.readFileSync(courseFile, "utf8"));

// --------------------------------------------------------------------------- //
// helpers
// --------------------------------------------------------------------------- //
const TRANSLIT = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .split("")
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

/** Убирает эмодзи и служебные префиксы из названий секций Stepik. */
function cleanTitle(value, fallback) {
  const cleaned = String(value || "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Плоский текст из HTML (для shortDesc и описаний заданий). */
function htmlToText(html) {
  return String(html || "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|pre)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncate(value, limit) {
  const text = String(value || "");
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trimEnd()}…`;
}

/**
 * Из шага choice делает Maestria-assignment.
 * Формат (см. src/lib/assignment-grading.ts):
 *   одиночный выбор -> correctAnswer = JSON-число
 *   множественный   -> correctAnswer = JSON-массив индексов
 *   options         -> JSON-массив строк
 */
function quizFromStep(step, index) {
  const source = step.source || {};
  const rawOptions = Array.isArray(source.options) ? source.options : [];
  const options = rawOptions.map((opt) => htmlToText(opt.text ?? opt)).filter(Boolean);
  if (options.length === 0) return null;

  const correct = rawOptions
    .map((opt, i) => (opt && opt.is_correct ? i : -1))
    .filter((i) => i >= 0);
  if (correct.length === 0) return null;

  const multiple = Boolean(source.is_multiple_choice);
  const correctAnswer = multiple ? JSON.stringify(correct) : JSON.stringify(correct[0]);
  const question = htmlToText(step.html) || `Вопрос ${index}`;

  // Пояснения Stepik содержат правильный ответ — студенту их не показываем.
  return {
    title: truncate(question, 180),
    description: multiple
      ? `${question}\n\nВыберите все верные варианты.`
      : question,
    type: "quiz",
    options: JSON.stringify(options),
    correctAnswer,
    points: 10,
    maxAttempts: 0,
    timeLimit: null,
  };
}

/** free-answer -> essay (проверяется преподавателем). */
function essayFromStep(step, index) {
  const question = htmlToText(step.html);
  return {
    title: truncate(question, 180) || `Задание ${index}`,
    description: question,
    type: "essay",
    points: 10,
    maxAttempts: 0,
    timeLimit: null,
  };
}

// --------------------------------------------------------------------------- //
// build payload
// --------------------------------------------------------------------------- //
function buildPayload() {
  const course = source.course || {};
  const title = cleanTitle(course.title, `Курс Stepik ${source.course_id}`);
  const descriptionHtml =
    (course.summary || course.description || "").trim() ||
    `<p>${escapeHtml(title)}</p>`;

  const levelMap = { easy: "beginner", medium: "intermediate", hard: "advanced" };
  const modules = [];
  const stats = { sections: 0, lessons: 0, textSteps: 0, quizzes: 0, essays: 0, skipped: [] };

  for (const section of source.sections || []) {
    stats.sections += 1;
    const sectionTitle = cleanTitle(section.title, `Модуль ${stats.sections}`);
    const lessons = [];

    for (const unit of section.units || []) {
      stats.lessons += 1;
      const lessonTitle = cleanTitle(unit.title, `Урок ${stats.lessons}`);
      const htmlParts = [];
      const assignments = [];
      let order = 0;

      for (const step of unit.steps || []) {
        order += 1;
        const kind = step.block_name;

        if (kind === "text") {
          if (step.html && step.html.trim()) {
            htmlParts.push(`<div class="stepik-step">${step.html}</div>`);
            stats.textSteps += 1;
          }
          continue;
        }

        if (kind === "choice") {
          const quiz = quizFromStep(step, order);
          if (quiz) {
            assignments.push(quiz);
            stats.quizzes += 1;
          } else {
            // вариантов нет в публичном API — оставляем как текст вопроса
            if (step.html) htmlParts.push(`<div class="stepik-step">${step.html}</div>`);
            stats.skipped.push(`choice step ${step.id}: нет вариантов ответа`);
          }
          continue;
        }

        if (kind === "free-answer") {
          assignments.push(essayFromStep(step, order));
          stats.essays += 1;
          continue;
        }

        // прочие типы (video, number, math, code, ...) — сохраняем как контент
        if (step.html) {
          htmlParts.push(`<div class="stepik-step">${step.html}</div>`);
        } else if (step.text) {
          htmlParts.push(`<div class="stepik-step"><p>${escapeHtml(step.text)}</p></div>`);
        }
        stats.skipped.push(`step ${step.id}: тип "${kind}" импортирован как текст`);
      }

      if (htmlParts.length === 0 && assignments.length === 0) {
        continue; // пустой юнит — пропускаем
      }

      const content = htmlParts.join("\n");
      const hasQuiz = assignments.some((a) => a.type === "quiz");
      const onlyEssay = assignments.length > 0 && !hasQuiz;

      lessons.push({
        title: truncate(lessonTitle, 200),
        type: hasQuiz ? "quiz" : onlyEssay ? "assignment" : "text",
        content: content || undefined,
        duration: 0,
        sortOrder: lessons.length + 1,
        isFree: lessons.length === 0,
        assignments: assignments.length > 0 ? assignments : undefined,
      });
    }

    if (lessons.length > 0) {
      modules.push({
        title: truncate(sectionTitle, 200),
        description: htmlToText(section.description) || undefined,
        sortOrder: modules.length + 1,
        lessons,
      });
    }
  }

  const requirements = Array.isArray(course.requirements)
    ? course.requirements
    : course.requirements
      ? [String(course.requirements)]
      : [];
  const skills = Array.isArray(course.acquired_skills)
    ? course.acquired_skills
    : course.acquired_skills
      ? [String(course.acquired_skills)]
      : [];

  const payload = {
    title: truncate(title, 200),
    slug: args.slug || slugify(`${title}-${source.course_id}`) || `stepik-${source.course_id}`,
    description: truncate(descriptionHtml, 5000),
    shortDesc: truncate(htmlToText(course.summary || course.description || title), 500),
    price: args.keepPrice ? Number(course.price) || 0 : 0,
    level: levelMap[course.difficulty] || "beginner",
    duration: course.time_to_complete
      ? `${Math.round(course.time_to_complete / 3600)} ч`
      : undefined,
    isPublished: args.publish,
    isFeatured: false,
    hasCertificate: Boolean(course.with_certificate),
    tags: Array.isArray(course.tags)
      ? course.tags.map((tag) => tag.title || tag.name || tag).join(",").slice(0, 500)
      : undefined,
    requirements: JSON.stringify(requirements.filter(Boolean)),
    whatYouLearn: JSON.stringify(skills.filter(Boolean)),
    language: course.language === "en" ? "en" : "ru",
    visibility: "public",
    modules,
  };

  return { payload, stats };
}

// --------------------------------------------------------------------------- //
// apply to DB
// --------------------------------------------------------------------------- //
function createPrisma() {
  const url = process.env.DATABASE_URL || "file:./prisma/data.db";
  const isPg = url.startsWith("postgresql") || url.startsWith("postgres");
  const adapter = isPg
    ? new PrismaPg({ connectionString: url })
    : new PrismaBetterSqlite3({ url: path.resolve(ROOT, url.replace(/^file:/, "")) });
  return new PrismaClient({ adapter });
}

async function apply(payload) {
  const prisma = createPrisma();
  try {
    const existing = await prisma.course.findUnique({ where: { slug: payload.slug } });
    if (existing) {
      throw new Error(
        `Курс со slug "${payload.slug}" уже существует (id ${existing.id}). ` +
        `Укажите другой --slug или удалите существующий курс.`,
      );
    }

    let teacher = await prisma.user.findFirst({ where: { role: "teacher" } });
    if (!teacher) teacher = await prisma.user.findFirst({ where: { role: "admin" } });
    if (!teacher) {
      throw new Error("В базе нет пользователя с ролью teacher/admin — назначить автора курса некому.");
    }

    const course = await prisma.course.create({
      data: {
        title: payload.title,
        slug: payload.slug,
        description: payload.description,
        shortDesc: payload.shortDesc,
        price: payload.price,
        level: payload.level,
        duration: payload.duration ?? null,
        language: payload.language,
        isPublished: payload.isPublished,
        isFeatured: payload.isFeatured,
        hasCertificate: payload.hasCertificate,
        tags: payload.tags ?? null,
        requirements: payload.requirements,
        whatYouLearn: payload.whatYouLearn,
        visibility: payload.visibility,
        teacherId: teacher.id,
        modules: {
          create: payload.modules.map((mod, mIdx) => ({
            title: mod.title,
            description: mod.description ?? null,
            sortOrder: mod.sortOrder ?? mIdx + 1,
            lessons: {
              create: mod.lessons.map((lesson, lIdx) => ({
                title: lesson.title,
                type: lesson.type,
                content: lesson.content ?? null,
                duration: lesson.duration ?? 0,
                sortOrder: lesson.sortOrder ?? lIdx + 1,
                isFree: Boolean(lesson.isFree),
                assignments: lesson.assignments?.length
                  ? {
                      create: lesson.assignments.map((a) => ({
                        title: a.title,
                        description: a.description ?? "",
                        type: a.type,
                        options: a.options ?? null,
                        correctAnswer: a.correctAnswer ?? null,
                        points: a.points ?? 10,
                        maxAttempts: a.maxAttempts ?? 0,
                        timeLimit: a.timeLimit ?? null,
                      })),
                    }
                  : undefined,
              })),
            },
          })),
        },
      },
      include: { modules: { include: { lessons: { include: { assignments: true } } } } },
    });

    const lessons = course.modules.flatMap((m) => m.lessons);
    const assignments = lessons.flatMap((l) => l.assignments);
    console.log(`\nКурс создан: ${course.id}`);
    console.log(`  модулей: ${course.modules.length}`);
    console.log(`  уроков: ${lessons.length}`);
    console.log(`  заданий: ${assignments.length}`);
    console.log(`  опубликован: ${course.isPublished ? "да" : "нет (черновик)"}`);
    console.log(`  автор: ${teacher.email}`);
    console.log(`  ссылка: /#course/${course.id}`);
    return course;
  } finally {
    await prisma.$disconnect();
  }
}

// --------------------------------------------------------------------------- //
// main
// --------------------------------------------------------------------------- //
const { payload, stats } = buildPayload();

console.log(`Источник: ${courseFile}`);
console.log(`Курс: ${payload.title}`);
console.log(`Модулей: ${payload.modules.length}`);
console.log(`Уроков: ${payload.modules.reduce((n, m) => n + m.lessons.length, 0)}`);
console.log(`Заданий: ${payload.modules.reduce((n, m) => n + m.lessons.reduce((k, l) => k + (l.assignments?.length || 0), 0), 0)}`);
console.log(`Шагов-текстов: ${stats.textSteps}, квизов: ${stats.quizzes}, эссе: ${stats.essays}`);
if (stats.skipped.length) {
  console.log(`\nПредупреждения (${stats.skipped.length}):`);
  for (const note of stats.skipped.slice(0, 20)) console.log(`  - ${note}`);
  if (stats.skipped.length > 20) console.log(`  ... и ещё ${stats.skipped.length - 20}`);
}

const outFile = path.join(dumpDir, "maestria-payload.json");
fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), "utf8");
console.log(`\nPayload: ${outFile}`);

if (!args.apply) {
  console.log("\nРежим проверки. Чтобы записать курс в базу, запустите с --apply");
  process.exit(0);
}

try {
  await apply(payload);
} catch (error) {
  console.error(`\nОшибка импорта: ${error.message}`);
  process.exit(1);
}
