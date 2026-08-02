import { APP_NAME } from "@/lib/constants";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const BRAND_COLOR = "#1e40af";
const BG_LIGHT = "#f8fafc";
const CARD_BG = "#ffffff";

function layout(title: string, bodyHtml: string): string {
  return `
<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background-color:${BG_LIGHT};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
<tr><td style="background:${BRAND_COLOR};padding:24px 32px;border-radius:12px 12px 0 0;text-align:center">
<h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">${escapeHtml(APP_NAME)}</h1>
</td></tr>
<tr><td style="background:${CARD_BG};padding:32px;border-radius:0 0 12px 12px">
${bodyHtml}
</td></tr>
<tr><td style="padding:16px 32px 0;text-align:center">
<p style="margin:0;font-size:12px;color:#94a3b8">${escapeHtml(APP_NAME)} &copy; ${new Date().getFullYear()}</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`.trim();
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="background:${BRAND_COLOR};border-radius:8px;padding:0"><a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">${escapeHtml(label)}</a></td></tr></table>`;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export function welcomeEmail(name: string, dashboardUrl: string): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(dashboardUrl);
  return {
    subject: `Добро пожаловать в ${APP_NAME}!`,
    html: layout("Добро пожаловать!", `
      <h2 style="margin:0 0 16px;font-size:20px;color:#1e293b">Здравствуйте, ${safeName}!</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">Благодарим вас за регистрацию на платформе ${APP_NAME}.</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">Теперь вам доступны все курсы, тесты и интерактивные задания. Начните обучение прямо сейчас!</p>
      ${button(safeUrl, "Перейти к обучению")}
      <p style="margin:16px 0 0;font-size:13px;color:#94a3b8">Если вы не регистрировались на ${APP_NAME}, просто проигнорируйте это письмо.</p>
    `),
    text: `Здравствуйте, ${name}!\n\nБлагодарим вас за регистрацию на платформе ${APP_NAME}.\n\nТеперь вам доступны все курсы, тесты и интерактивные задания.\n\nПерейти к обучению: ${dashboardUrl}\n\nЕсли вы не регистрировались, просто проигнорируйте это письмо.`,
  };
}

export function verifyEmailEmail(name: string, verifyUrl: string): EmailTemplate {
  const safeName = escapeHtml(name || "пользователь");
  return {
    subject: `Подтверждение email — ${APP_NAME}`,
    html: layout("Подтверждение email", `
      <h2 style="margin:0 0 16px;font-size:20px;color:#1e293b">Подтвердите ваш email</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">Здравствуйте, ${safeName}!</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">Для подтверждения email перейдите по ссылке ниже:</p>
      ${button(verifyUrl, "Подтвердить email")}
      <p style="margin:16px 0 0;font-size:13px;color:#94a3b8">Ссылка действительна 24 часа.</p>
    `),
    text: `Здравствуйте, ${name || "пользователь"}!\n\nДля подтверждения email перейдите по ссылке: ${verifyUrl}\n\nСсылка действительна 24 часа.`,
  };
}

export function passwordResetEmail(resetUrl: string): EmailTemplate {
  return {
    subject: `Сброс пароля — ${APP_NAME}`,
    html: layout("Сброс пароля", `
      <h2 style="margin:0 0 16px;font-size:20px;color:#1e293b">Сброс пароля</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">Вы запросили сброс пароля для аккаунта ${APP_NAME}.</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">Перейдите по ссылке ниже для сброса пароля:</p>
      ${button(resetUrl, "Сбросить пароль")}
      <p style="margin:16px 0 0;font-size:13px;color:#94a3b8">Ссылка действительна в течение 1 часа.</p>
      <p style="margin:4px 0 0;font-size:13px;color:#94a3b8">Если вы не запрашивали сброс пароля, проигнорируйте это письмо.</p>
    `),
    text: `Вы запросили сброс пароля для аккаунта ${APP_NAME}.\n\nПерейдите по ссылке для сброса: ${resetUrl}\n\nСсылка действительна в течение 1 часа.\n\nЕсли вы не запрашивали сброс пароля, проигнорируйте это письмо.`,
  };
}

export function coursePurchaseEmail(name: string, courseName: string, courseUrl: string): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeCourse = escapeHtml(courseName);
  return {
    subject: `Доступ к курсу «${courseName}» открыт — ${APP_NAME}`,
    html: layout("Доступ к курсу открыт", `
      <h2 style="margin:0 0 16px;font-size:20px;color:#1e293b">Доступ к курсу открыт!</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">Здравствуйте, ${safeName}!</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">Вам открыт доступ к курсу <strong>«${safeCourse}»</strong>.</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">Приступайте к обучению прямо сейчас!</p>
      ${button(courseUrl, "Начать обучение")}
    `),
    text: `Здравствуйте, ${name}!\n\nВам открыт доступ к курсу «${courseName}».\n\nПриступайте к обучению: ${courseUrl}`,
  };
}

export function certificateEmail(name: string, courseName: string, certificateUrl: string): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeCourse = escapeHtml(courseName);
  return {
    subject: `Сертификат за курс «${courseName}» — ${APP_NAME}`,
    html: layout("Сертификат получен", `
      <h2 style="margin:0 0 16px;font-size:20px;color:#1e293b">Поздравляем с завершением курса!</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">Здравствуйте, ${safeName}!</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">Вы успешно завершили курс <strong>«${safeCourse}»</strong>.</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">Ваш сертификат доступен по ссылке ниже:</p>
      ${button(certificateUrl, "Посмотреть сертификат")}
      <p style="margin:16px 0 0;font-size:13px;color:#94a3b8">Сертификат также доступен в вашем профиле.</p>
    `),
    text: `Здравствуйте, ${name}!\n\nВы успешно завершили курс «${courseName}».\n\nВаш сертификат: ${certificateUrl}\n\nСертификат также доступен в вашем профиле.`,
  };
}

export function reviewNotificationEmail(name: string, courseName: string, reviewUrl: string): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeCourse = escapeHtml(courseName);
  return {
    subject: `Новая оценка за курс «${courseName}» — ${APP_NAME}`,
    html: layout("Новая оценка", `
      <h2 style="margin:0 0 16px;font-size:20px;color:#1e293b">Новая оценка</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">Здравствуйте, ${safeName}!</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">Студент оставил новую оценку и отзыв по вашему курсу <strong>«${safeCourse}»</strong>.</p>
      ${button(reviewUrl, "Посмотреть отзыв")}
    `),
    text: `Здравствуйте, ${name}!\n\nСтудент оставил новую оценку и отзыв по вашему курсу «${courseName}».\n\nПосмотреть отзыв: ${reviewUrl}`,
  };
}

export function lessonReminderEmail(name: string, courseName: string, courseUrl: string, lessonTitle: string): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeCourse = escapeHtml(courseName);
  const safeLesson = escapeHtml(lessonTitle);
  return {
    subject: `Продолжите обучение: «${lessonTitle}» — ${APP_NAME}`,
    html: layout("Продолжите обучение", `
      <h2 style="margin:0 0 16px;font-size:20px;color:#1e293b">Продолжите обучение</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">Здравствуйте, ${safeName}!</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">На курсе <strong>«${safeCourse}»</strong> вас ждёт урок <strong>«${safeLesson}»</strong>.</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">Продолжайте обучение, чтобы достичь новых вершин!</p>
      ${button(courseUrl, "Продолжить обучение")}
    `),
    text: `Здравствуйте, ${name}!\n\nНа курсе «${courseName}» вас ждёт урок «${lessonTitle}».\n\nПродолжайте обучение: ${courseUrl}`,
  };
}

export function achievementEmail(name: string, achievementName: string, achievementUrl: string): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeAchievement = escapeHtml(achievementName);
  return {
    subject: `Достижение разблокировано: «${achievementName}» — ${APP_NAME}`,
    html: layout("Новое достижение!", `
      <h2 style="margin:0 0 16px;font-size:20px;color:#1e293b">Новое достижение разблокировано!</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">Здравствуйте, ${safeName}!</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">Вы получили достижение <strong>«${safeAchievement}»</strong>!</p>
      ${button(achievementUrl, "Посмотреть достижения")}
    `),
    text: `Здравствуйте, ${name}!\n\nВы получили достижение «${achievementName}»!\n\nПосмотреть достижения: ${achievementUrl}`,
  };
}

export function paymentNotificationEmail(name: string, courseName: string, amount: string, paymentUrl: string): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeCourse = escapeHtml(courseName);
  return {
    subject: `Оплата курса «${courseName}» подтверждена — ${APP_NAME}`,
    html: layout("Оплата подтверждена", `
      <h2 style="margin:0 0 16px;font-size:20px;color:#1e293b">Оплата подтверждена</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">Здравствуйте, ${safeName}!</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">Оплата курса <strong>«${safeCourse}»</strong> на сумму <strong>${escapeHtml(amount)}</strong> подтверждена.</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">Доступ к курсу открыт. Приятного обучения!</p>
      ${button(paymentUrl, "Перейти к курсу")}
    `),
    text: `Здравствуйте, ${name}!\n\nОплата курса «${courseName}» на сумму ${amount} подтверждена.\n\nДоступ к курсу открыт: ${paymentUrl}`,
  };
}
