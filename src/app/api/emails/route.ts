import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { enqueueEmail } from "@/lib/email-queue";
import {
  welcomeEmail,
  verifyEmailEmail,
  passwordResetEmail,
  coursePurchaseEmail,
  certificateEmail,
  reviewNotificationEmail,
  lessonReminderEmail,
  achievementEmail,
  paymentNotificationEmail,
  enrollmentNotificationEmail,
  refundNotificationEmail,
} from "@/lib/emails";
import { getRedisClient } from "@/lib/redis";

export const runtime = "nodejs";

// ==================== SECURITY ====================

const checkRateLimit = rateLimit("emailQueue", {
  windowMs: 60_000,
  maxRequests: 10,
});

/** Constant-time string comparison — the secret must not leak via timing. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function extractSecret(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }
  return request.headers.get("x-email-secret");
}

function checkAuth(request: NextRequest): NextResponse | null {
  const configuredSecret = env.emailQueueSecret;
  if (!configuredSecret) {
    log.warn("Email queue endpoint called but EMAIL_QUEUE_SECRET is not set");
    return NextResponse.json(
      { error: "Email queue is not configured" },
      { status: 503 },
    );
  }

  const providedSecret = extractSecret(request);
  if (!providedSecret || !safeEqual(providedSecret, configuredSecret)) {
    log.warn("Email queue: unauthorized attempt", {
      hasAuthorization: request.headers.has("authorization"),
      hasSecretHeader: request.headers.has("x-email-secret"),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

// ==================== SCHEMAS ====================

const SendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  html: z.string().min(1),
  text: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});

const TemplateEmailSchema = z.object({
  template: z.enum([
    "welcome",
    "verify",
    "reset",
    "purchase",
    "certificate",
    "review",
    "reminder",
    "achievement",
    "payment",
    "enrollment",
    "refund",
  ]),
  to: z.string().email(),
  data: z.record(z.string(), z.unknown()),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
});

// ==================== TEMPLATE MAP ====================

/**
 * Render one of the transactional templates into subject/html/text.
 * `to` is unused for rendering but kept in the signature for call-site clarity.
 */
function buildEmailFromTemplate(
  template: string,
  data: Record<string, unknown>,
): { subject: string; html: string; text?: string } {
  const { name, courseName, lang } = data as {
    name?: string;
    courseName?: string;
    lang?: string;
  };

  const baseUrl = env.siteUrl;
  const emailLang = lang ?? "ru";

  switch (template) {
    case "welcome": {
      const email = welcomeEmail(name || "пользователь", `${baseUrl}/catalog`, emailLang);
      return { subject: email.subject, html: email.html, text: email.text };
    }
    case "verify": {
      const email = verifyEmailEmail(
        name || "пользователь",
        `${baseUrl}/api/auth/verify-email?token=${String(data.token ?? "")}`,
        emailLang,
      );
      return { subject: email.subject, html: email.html, text: email.text };
    }
    case "reset": {
      const email = passwordResetEmail(
        `${baseUrl}/reset-password?token=${String(data.token ?? "")}`,
        emailLang,
      );
      return { subject: email.subject, html: email.html, text: email.text };
    }
    case "purchase": {
      const email = coursePurchaseEmail(
        name || "пользователь",
        courseName || "курс",
        `${baseUrl}/my-courses`,
        emailLang,
      );
      return { subject: email.subject, html: email.html, text: email.text };
    }
    case "certificate": {
      const email = certificateEmail(
        name || "пользователь",
        courseName || "курс",
        `${baseUrl}/certificate/${String(data.certificateId ?? "")}`,
        emailLang,
      );
      return { subject: email.subject, html: email.html, text: email.text };
    }
    case "review": {
      const email = reviewNotificationEmail(
        name || "пользователь",
        courseName || "курс",
        `${baseUrl}/course/${String(data.courseId ?? "")}`,
        emailLang,
      );
      return { subject: email.subject, html: email.html, text: email.text };
    }
    case "reminder": {
      const email = lessonReminderEmail(
        name || "пользователь",
        courseName || "курс",
        `${baseUrl}/my-courses`,
        String(data.lessonTitle ?? "урок"),
        emailLang,
      );
      return { subject: email.subject, html: email.html, text: email.text };
    }
    case "achievement": {
      const email = achievementEmail(
        name || "пользователь",
        String(data.achievementName ?? "достижение"),
        `${baseUrl}/achievements`,
        emailLang,
      );
      return { subject: email.subject, html: email.html, text: email.text };
    }
    case "payment": {
      const email = paymentNotificationEmail(
        name || "пользователь",
        courseName || "курс",
        String(data.amount ?? "0 ₽"),
        `${baseUrl}/profile`,
        emailLang,
      );
      return { subject: email.subject, html: email.html, text: email.text };
    }
    case "enrollment": {
      const email = enrollmentNotificationEmail(
        name || "преподаватель",
        String(data.studentName ?? "студент"),
        courseName || "курс",
        `${baseUrl}/course/${String(data.courseId ?? "")}`,
        emailLang,
      );
      return { subject: email.subject, html: email.html, text: email.text };
    }
    case "refund": {
      const email = refundNotificationEmail(
        name || "пользователь",
        courseName || "курс",
        String(data.amount ?? "0 ₽"),
        `${baseUrl}/profile`,
        emailLang,
      );
      return { subject: email.subject, html: email.html, text: email.text };
    }
    default:
      throw new Error(`Unknown email template: ${template}`);
  }
}

// ==================== POST: enqueue ====================

/**
 * POST /api/emails
 *
 * Put an email into the Redis-backed queue instead of sending it inline.
 * Accepts either a rendered message ({ to, subject, html }) or a template
 * reference ({ template, to, data }). Protected by EMAIL_QUEUE_SECRET —
 * without it anyone could use the platform's Resend quota to send mail.
 */
export async function POST(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  const authError = checkAuth(request);
  if (authError) return authError;

  if (!getRedisClient()) {
    return NextResponse.json(
      { error: "Email queue is offline (Redis not available)" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const isTemplate = typeof body === "object" && body !== null && "template" in body;

  if (isTemplate) {
    const parsed = TemplateEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid template request" },
        { status: 400 },
      );
    }

    const { template, to, data, priority } = parsed.data;

    let rendered: { subject: string; html: string; text?: string };
    try {
      rendered = buildEmailFromTemplate(template, data);
    } catch (error) {
      log.error("Email template build failed", {
        template,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: "Failed to build email template" }, { status: 500 });
    }

    try {
      const job = await enqueueEmail({ to, ...rendered, priority });
      return NextResponse.json(
        { jobId: job.id, priority: job.priority, queued: true },
        { status: 202 },
      );
    } catch (error) {
      log.error("Failed to enqueue templated email", {
        template,
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: "Failed to enqueue email" }, { status: 500 });
    }
  }

  const parsed = SendEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  try {
    const job = await enqueueEmail(parsed.data);
    return NextResponse.json(
      { jobId: job.id, priority: job.priority, queued: true },
      { status: 202 },
    );
  } catch (error) {
    log.error("Failed to enqueue email", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to enqueue email" }, { status: 500 });
  }
}
