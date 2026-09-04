import { t } from "./i18n";
import type { Locale } from "./store";

/**
 * Catalog of user-facing API error messages.
 *
 * The API returns `{ error: string }` (Russian, server-side default) and,
 * for newer endpoints, a stable `code` field. The client resolves the
 * message in the user's locale via `apiErrorMessage()`:
 *   1. by explicit `code`,
 *   2. by exact match of the Russian `error` text (legacy endpoints),
 *   3. falling back to the raw server message or a client i18n key.
 */

export interface ApiErrorEntry {
  code: string;
  ru: string;
  en: string;
  zh: string;
}

const entries: ApiErrorEntry[] = [
  // --- Validation ---
  { code: "validation_failed", ru: "Ошибка валидации", en: "Validation failed", zh: "校验失败" },
  { code: "invalid_email", ru: "Введите корректный email", en: "Please enter a valid email", zh: "请输入有效的邮箱地址" },
  { code: "name_too_short", ru: "Имя должно быть не менее 2 символов", en: "Name must be at least 2 characters", zh: "姓名至少需要2个字符" },
  { code: "name_too_long", ru: "Имя слишком длинное", en: "Name is too long", zh: "姓名过长" },
  { code: "title_length", ru: "Название должно быть от 2 до 100 символов", en: "Title must be between 2 and 100 characters", zh: "标题长度必须在2到100个字符之间" },
  { code: "title_required", ru: "Заголовок обязателен", en: "Title is required", zh: "标题为必填项" },
  { code: "invalid_image_url", ru: "Неверный URL изображения", en: "Invalid image URL", zh: "图片URL无效" },
  { code: "invalid_phone", ru: "Неверный формат телефона", en: "Invalid phone number format", zh: "电话号码格式无效" },
  { code: "bio_too_long", ru: "Биография слишком длинная", en: "Bio is too long", zh: "个人简介过长" },
  { code: "invalid_parameter", ru: "Неверный параметр", en: "Invalid parameter", zh: "参数无效" },

  // --- Auth / account ---
  { code: "email_taken", ru: "Пользователь с таким email уже существует", en: "A user with this email already exists", zh: "该邮箱已被注册" },
  { code: "user_not_found", ru: "Пользователь не найден", en: "User not found", zh: "用户不存在" },
  { code: "wrong_password", ru: "Неверный пароль", en: "Incorrect password", zh: "密码错误" },
  { code: "invalid_code", ru: "Неверный код подтверждения", en: "Invalid confirmation code", zh: "验证码错误" },
  { code: "code_6_digits", ru: "Код должен содержать 6 цифр", en: "The code must contain 6 digits", zh: "验证码必须为6位数字" },
  { code: "current_password_required", ru: "Введите текущий пароль", en: "Please enter your current password", zh: "请输入当前密码" },
  { code: "token_required", ru: "Токен обязателен", en: "Token is required", zh: "令牌为必填项" },
  { code: "invalid_token", ru: "Недействительный токен", en: "Invalid token", zh: "无效的令牌" },
  { code: "token_expired", ru: "Токен истёк. Запросите новый", en: "The token has expired. Please request a new one", zh: "令牌已过期，请重新申请" },
  { code: "twofa_not_setup", ru: "Сначала запросите настройку 2FA (POST /api/auth/2fa)", en: "Set up 2FA first (POST /api/auth/2fa)", zh: "请先设置双因素认证" },
  { code: "config_error", ru: "Ошибка конфигурации. Обратитесь в поддержку.", en: "Configuration error. Please contact support.", zh: "配置错误，请联系支持团队。" },
  { code: "cannot_block_self", ru: "Нельзя заблокировать самого себя", en: "You cannot block yourself", zh: "无法封禁自己" },
  { code: "cannot_demote_self", ru: "Нельзя понизить свою роль", en: "You cannot lower your own role", zh: "无法降低自己的角色" },

  // --- Access ---
  { code: "forbidden", ru: "Доступ запрещён", en: "Access denied", zh: "无权访问" },
  { code: "forbidden_admin_teacher", ru: "Доступ запрещён. Требуются права администратора или преподавателя", en: "Access denied. Admin or teacher rights are required", zh: "无权访问，需要管理员或教师权限" },

  // --- Courses / steps ---
  { code: "course_not_found", ru: "Курс не найден", en: "Course not found", zh: "课程不存在" },
  { code: "course_slug_taken", ru: "Курс с таким URL-идентификатором уже существует", en: "A course with this slug already exists", zh: "该URL标识符的课程已存在" },
  { code: "step_not_found", ru: "Шаг не найден", en: "Step not found", zh: "步骤不存在" },
  { code: "enroll_required_step", ru: "Запишитесь на курс для доступа к этому шагу", en: "Enroll in the course to access this step", zh: "请报名课程以访问此步骤" },
  { code: "enrollment_required", ru: "Необходимо записаться на курс", en: "You need to enroll in the course first", zh: "请先报名课程" },
  { code: "not_enrolled", ru: "Вы не записаны на этот курс", en: "You are not enrolled in this course", zh: "您尚未报名此课程" },
  { code: "assignment_not_found", ru: "Задание не найдено", en: "Assignment not found", zh: "作业不存在" },
  { code: "attempt_limit_exceeded", ru: "Превышен лимит попыток для этого задания", en: "Attempt limit exceeded for this assignment", zh: "已超过此作业的尝试次数上限" },

  // --- Payments ---
  { code: "course_already_paid", ru: "Курс уже оплачен", en: "This course is already paid for", zh: "该课程已支付" },
  { code: "course_is_free", ru: "Этот курс бесплатный — оплата не требуется", en: "This course is free — no payment required", zh: "该课程免费，无需支付" },
  { code: "pending_payment_exists", ru: "У вас уже есть ожидающий платёж", en: "You already have a pending payment", zh: "您已有一笔待处理的付款" },
  { code: "certificate_not_found", ru: "Сертификат для этого курса не найден", en: "Certificate for this course was not found", zh: "未找到该课程的证书" },

  // --- Content management ---
  { code: "category_not_found", ru: "Категория не найдена", en: "Category not found", zh: "分类不存在" },
  { code: "category_taken", ru: "Категория с таким названием или URL-идентификатором уже существует", en: "A category with this name or slug already exists", zh: "该名称或URL标识符的分类已存在" },
  { code: "category_has_courses", ru: "Невозможно удалить категорию с существующими курсами", en: "Cannot delete a category that still has courses", zh: "无法删除仍有课程的分类" },

  // --- Files ---
  { code: "file_required", ru: "Файл не выбран", en: "No file selected", zh: "未选择文件" },
  { code: "invalid_folder_name", ru: "Недопустимое имя папки", en: "Invalid folder name", zh: "文件夹名称无效" },

  // --- Generic / infrastructure ---
  { code: "record_exists", ru: "Такая запись уже существует", en: "This record already exists", zh: "记录已存在" },
  { code: "record_not_found", ru: "Запись не найдена", en: "Record not found", zh: "记录不存在" },
  { code: "internal_error", ru: "Внутренняя ошибка сервера", en: "Internal server error", zh: "服务器内部错误" },
  { code: "unknown_error", ru: "Произошла ошибка", en: "An error occurred", zh: "发生错误" },
];

export const API_ERROR_MESSAGES: Record<string, ApiErrorEntry> = Object.fromEntries(
  entries.map((e) => [e.code, e]),
);

// Exact-match index: Russian server message -> localized entry (legacy endpoints without codes)
const BY_RU_MESSAGE: Record<string, ApiErrorEntry> = Object.fromEntries(
  entries.map((e) => [e.ru, e]),
);

function pick(entry: ApiErrorEntry, locale: Locale): string {
  switch (locale) {
    case "en":
      return entry.en;
    case "zh":
      return entry.zh;
    default:
      return entry.ru;
  }
}

/**
 * Resolve a user-facing error message from an API response body.
 * Falls back to the raw server message, then to a client i18n key.
 */
export function apiErrorMessage(data: unknown, locale: Locale, fallbackKey?: string): string {
  const body = (data && typeof data === "object" ? data : {}) as { error?: unknown; code?: unknown };

  if (typeof body.code === "string" && API_ERROR_MESSAGES[body.code]) {
    return pick(API_ERROR_MESSAGES[body.code], locale);
  }

  if (typeof body.error === "string" && body.error) {
    const byMessage = BY_RU_MESSAGE[body.error];
    if (byMessage) return pick(byMessage, locale);
    return body.error;
  }

  return t(fallbackKey || "common.error", locale);
}

/**
 * Whether an API response body carries a recognized error code.
 * Useful to branch logic (e.g. REQUIRES_2FA) without string matching.
 */
export function apiErrorCode(data: unknown): string | null {
  const body = (data && typeof data === "object" ? data : {}) as { code?: unknown };
  return typeof body.code === "string" ? body.code : null;
}