import { APP_NAME } from "@/lib/constants";
import type { Locale } from "@/lib/store";
import { t } from "@/lib/i18n";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const BRAND_COLOR = "#1e40af";
const BG_LIGHT = "#f8fafc";
const CARD_BG = "#ffffff";

function layout(title: string, bodyHtml: string, lang: string = "ru"): string {
  return `
<!DOCTYPE html>
<html lang="${lang}">
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

function getLocaleFromLang(lang: string): Locale {
  if (lang === "en") return "en";
  if (lang === "zh") return "zh";
  return "ru";
}

export function welcomeEmail(name: string, dashboardUrl: string, lang: string = "ru"): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(dashboardUrl);
  const locale = getLocaleFromLang(lang);
  return {
    subject: t("emails.welcome.subject", locale).replace("{appName}", APP_NAME),
    html: layout(t("emails.welcome.title", locale), `
      <h2 style="margin:0 0 16px;font-size:20px;color:#1e293b">${t("emails.welcome.greeting", locale).replace("{name}", safeName)}!</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">${t("emails.welcome.body1", locale).replace("{appName}", APP_NAME)}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">${t("emails.welcome.body2", locale)}</p>
      ${button(safeUrl, t("emails.welcome.cta", locale))}
      <p style="margin:16px 0 0;font-size:13px;color:#94a3b8">${t("emails.welcome.footer", locale).replace("{appName}", APP_NAME)}</p>
    `, lang),
    text: `${t("emails.welcome.textGreeting", locale).replace("{name}", name)}\n\n${t("emails.welcome.textBody", locale).replace("{appName}", APP_NAME)}\n\n${t("emails.welcome.textCta", locale)}: ${dashboardUrl}\n\n${t("emails.welcome.textFooter", locale)}`,
  };
}

export function verifyEmailEmail(name: string, verifyUrl: string, lang: string = "ru"): EmailTemplate {
  const safeName = escapeHtml(name || t("emails.verify.defaultName", getLocaleFromLang(lang)));
  const locale = getLocaleFromLang(lang);
  return {
    subject: t("emails.verify.subject", locale).replace("{appName}", APP_NAME),
    html: layout(t("emails.verify.title", locale), `
      <h2 style="margin:0 0 16px;font-size:20px;color:#1e293b">${t("emails.verify.heading", locale)}</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">${t("emails.verify.greeting", locale).replace("{name}", safeName)}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">${t("emails.verify.body", locale)}</p>
      ${button(verifyUrl, t("emails.verify.cta", locale))}
      <p style="margin:16px 0 0;font-size:13px;color:#94a3b8">${t("emails.verify.expiry", locale)}</p>
    `, lang),
    text: `${t("emails.verify.textGreeting", locale).replace("{name}", name || t("emails.verify.defaultName", locale))}\n\n${t("emails.verify.textBody", locale)}: ${verifyUrl}\n\n${t("emails.verify.textExpiry", locale)}`,
  };
}

export function passwordResetEmail(resetUrl: string, lang: string = "ru"): EmailTemplate {
  const locale = getLocaleFromLang(lang);
  return {
    subject: t("emails.reset.subject", locale).replace("{appName}", APP_NAME),
    html: layout(t("emails.reset.title", locale), `
      <h2 style="margin:0 0 16px;font-size:20px;color:#1e293b">${t("emails.reset.heading", locale)}</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">${t("emails.reset.body1", locale).replace("{appName}", APP_NAME)}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">${t("emails.reset.body2", locale)}</p>
      ${button(resetUrl, t("emails.reset.cta", locale))}
      <p style="margin:16px 0 0;font-size:13px;color:#94a3b8">${t("emails.reset.expiry", locale)}</p>
      <p style="margin:4px 0 0;font-size:13px;color:#94a3b8">${t("emails.reset.ignore", locale)}</p>
    `, lang),
    text: `${t("emails.reset.textBody", locale).replace("{appName}", APP_NAME)}\n\n${t("emails.reset.textCta", locale)}: ${resetUrl}\n\n${t("emails.reset.textExpiry", locale)}\n\n${t("emails.reset.textIgnore", locale)}`,
  };
}

export function coursePurchaseEmail(name: string, courseName: string, courseUrl: string, lang: string = "ru"): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeCourse = escapeHtml(courseName);
  const locale = getLocaleFromLang(lang);
  return {
    subject: t("emails.purchase.subject", locale).replace("{courseName}", safeCourse).replace("{appName}", APP_NAME),
    html: layout(t("emails.purchase.title", locale), `
      <h2 style="margin:0 0 16px;font-size:20px;color:#1e293b">${t("emails.purchase.heading", locale)}</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">${t("emails.purchase.greeting", locale).replace("{name}", safeName)}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">${t("emails.purchase.body1", locale).replace("{courseName}", safeCourse)}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">${t("emails.purchase.body2", locale)}</p>
      ${button(courseUrl, t("emails.purchase.cta", locale))}
    `, lang),
    text: `${t("emails.purchase.textGreeting", locale).replace("{name}", name)}\n\n${t("emails.purchase.textBody", locale).replace("{courseName}", courseName)}\n\n${t("emails.purchase.textCta", locale)}: ${courseUrl}`,
  };
}

export function certificateEmail(name: string, courseName: string, certificateUrl: string, lang: string = "ru"): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeCourse = escapeHtml(courseName);
  const locale = getLocaleFromLang(lang);
  return {
    subject: t("emails.certificate.subject", locale).replace("{courseName}", safeCourse).replace("{appName}", APP_NAME),
    html: layout(t("emails.certificate.title", locale), `
      <h2 style="margin:0 0 16px;font-size:20px;color:#1e293b">${t("emails.certificate.heading", locale)}</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">${t("emails.certificate.greeting", locale).replace("{name}", safeName)}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">${t("emails.certificate.body1", locale).replace("{courseName}", safeCourse)}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">${t("emails.certificate.body2", locale)}</p>
      ${button(certificateUrl, t("emails.certificate.cta", locale))}
      <p style="margin:16px 0 0;font-size:13px;color:#94a3b8">${t("emails.certificate.footer", locale)}</p>
    `, lang),
    text: `${t("emails.certificate.textGreeting", locale).replace("{name}", name)}\n\n${t("emails.certificate.textBody", locale).replace("{courseName}", courseName)}\n\n${t("emails.certificate.textCta", locale)}: ${certificateUrl}\n\n${t("emails.certificate.textFooter", locale)}`,
  };
}

export function reviewNotificationEmail(name: string, courseName: string, reviewUrl: string, lang: string = "ru"): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeCourse = escapeHtml(courseName);
  const locale = getLocaleFromLang(lang);
  return {
    subject: t("emails.review.subject", locale).replace("{courseName}", safeCourse).replace("{appName}", APP_NAME),
    html: layout(t("emails.review.title", locale), `
      <h2 style="margin:0 0 16px;font-size:20px;color:#1e293b">${t("emails.review.heading", locale)}</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">${t("emails.review.greeting", locale).replace("{name}", safeName)}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">${t("emails.review.body", locale).replace("{courseName}", safeCourse)}</p>
      ${button(reviewUrl, t("emails.review.cta", locale))}
    `, lang),
    text: `${t("emails.review.textGreeting", locale).replace("{name}", name)}\n\n${t("emails.review.textBody", locale).replace("{courseName}", courseName)}\n\n${t("emails.review.textCta", locale)}: ${reviewUrl}`,
  };
}

export function lessonReminderEmail(name: string, courseName: string, courseUrl: string, lessonTitle: string, lang: string = "ru"): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeCourse = escapeHtml(courseName);
  const safeLesson = escapeHtml(lessonTitle);
  const locale = getLocaleFromLang(lang);
  return {
    subject: t("emails.reminder.subject", locale).replace("{lessonTitle}", safeLesson).replace("{appName}", APP_NAME),
    html: layout(t("emails.reminder.title", locale), `
      <h2 style="margin:0 0 16px;font-size:20px;color:#1e293b">${t("emails.reminder.heading", locale)}</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">${t("emails.reminder.greeting", locale).replace("{name}", safeName)}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">${t("emails.reminder.body1", locale).replace("{courseName}", safeCourse).replace("{lessonTitle}", safeLesson)}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">${t("emails.reminder.body2", locale)}</p>
      ${button(courseUrl, t("emails.reminder.cta", locale))}
    `, lang),
    text: `${t("emails.reminder.textGreeting", locale).replace("{name}", name)}\n\n${t("emails.reminder.textBody", locale).replace("{courseName}", courseName).replace("{lessonTitle}", lessonTitle)}\n\n${t("emails.reminder.textCta", locale)}: ${courseUrl}`,
  };
}

export function achievementEmail(name: string, achievementName: string, achievementUrl: string, lang: string = "ru"): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeAchievement = escapeHtml(achievementName);
  const locale = getLocaleFromLang(lang);
  return {
    subject: t("emails.achievement.subject", locale).replace("{achievementName}", safeAchievement).replace("{appName}", APP_NAME),
    html: layout(t("emails.achievement.title", locale), `
      <h2 style="margin:0 0 16px;font-size:20px;color:#1e293b">${t("emails.achievement.heading", locale)}</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">${t("emails.achievement.greeting", locale).replace("{name}", safeName)}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">${t("emails.achievement.body", locale).replace("{achievementName}", safeAchievement)}</p>
      ${button(achievementUrl, t("emails.achievement.cta", locale))}
    `, lang),
    text: `${t("emails.achievement.textGreeting", locale).replace("{name}", name)}\n\n${t("emails.achievement.textBody", locale).replace("{achievementName}", achievementName)}\n\n${t("emails.achievement.textCta", locale)}: ${achievementUrl}`,
  };
}

export function paymentNotificationEmail(name: string, courseName: string, amount: string, paymentUrl: string, lang: string = "ru"): EmailTemplate {
  const safeName = escapeHtml(name);
  const safeCourse = escapeHtml(courseName);
  const locale = getLocaleFromLang(lang);
  return {
    subject: t("emails.payment.subject", locale).replace("{courseName}", safeCourse).replace("{appName}", APP_NAME),
    html: layout(t("emails.payment.title", locale), `
      <h2 style="margin:0 0 16px;font-size:20px;color:#1e293b">${t("emails.payment.heading", locale)}</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">${t("emails.payment.greeting", locale).replace("{name}", safeName)}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">${t("emails.payment.body", locale).replace("{courseName}", safeCourse).replace("{amount}", escapeHtml(amount))}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">${t("emails.payment.footer", locale)}</p>
      ${button(paymentUrl, t("emails.payment.cta", locale))}
    `, lang),
    text: `${t("emails.payment.textGreeting", locale).replace("{name}", name)}\n\n${t("emails.payment.textBody", locale).replace("{courseName}", courseName).replace("{amount}", amount)}\n\n${t("emails.payment.textCta", locale)}: ${paymentUrl}`,
  };
}

/** New: enrollment notification for teachers when a student enrolls in their course */
export function enrollmentNotificationEmail(
  teacherName: string,
  studentName: string,
  courseName: string,
  courseUrl: string,
  lang: string = "ru"
): EmailTemplate {
  const safeTeacher = escapeHtml(teacherName);
  const safeStudent = escapeHtml(studentName);
  const safeCourse = escapeHtml(courseName);
  const safeUrl = escapeHtml(courseUrl);
  const locale = getLocaleFromLang(lang);
  return {
    subject: t("emails.enrollment.subject", locale).replace("{courseName}", safeCourse).replace("{appName}", APP_NAME),
    html: layout(t("emails.enrollment.title", locale), `
      <h2 style="margin:0 0 16px;font-size:20px;color:#1e293b">${t("emails.enrollment.heading", locale)}</h2>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">${t("emails.enrollment.greeting", locale).replace("{name}", safeTeacher)}</p>
      <p style="margin:0 0 12px;font-size:15px;color:#475569;line-height:1.6">${t("emails.enrollment.body", locale).replace("{studentName}", safeStudent).replace("{courseName}", safeCourse)}</p>
      ${button(safeUrl, t("emails.enrollment.cta", locale))}
    `, lang),
    text: `${t("emails.enrollment.textGreeting", locale).replace("{name}", teacherName)}\n\n${t("emails.enrollment.textBody", locale).replace("{studentName}", studentName).replace("{courseName}", courseName)}\n\n${t("emails.enrollment.textCta", locale)}: ${courseUrl}`,
  };
}
