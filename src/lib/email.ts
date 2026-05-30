import { Resend } from "resend";
import { log } from "./logger";
import { env } from "./env";

function getResendClient(): Resend | null {
  if (!env.resendApiKey) return null;
  return new Resend(env.resendApiKey);
}

function getFromEmail(): string {
  return env.emailFrom;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  if (error && typeof error === "object") {
    const resendError = error as Record<string, unknown>;
    const statusCode = resendError.statusCode as number | undefined;
    // Retry on 429 (rate limit), 5xx (server errors), and network failures
    if (statusCode === 429 || (statusCode && statusCode >= 500)) return true;
    if (resendError.name === "FetchError" || resendError.name === "AbortError") return true;
    // Default to retrying unknown errors (likely transient)
    if (!statusCode) return true;
    // 4xx errors (except 429) are client errors — not retryable
    if (statusCode >= 400 && statusCode < 500) return false;
  }
  return true;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  retries = MAX_RETRIES,
}: SendEmailOptions & { retries?: number }): Promise<boolean> {
  const resend = getResendClient();

  if (!resend) {
    log.warn("Email not sent: RESEND_API_KEY not configured", { to, subject });
    return false;
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
        log.info(`Retrying email send (attempt ${attempt}/${retries})`, { to, subject, delay });
        await sleep(delay);
      }

      await resend.emails.send({
        from: getFromEmail(),
        to,
        subject,
        html,
        text: text ?? html.replace(/<[^>]*>/g, ""),
      });

      if (attempt > 0) {
        log.info("Email sent successfully after retry", { to, subject, attempt });
      } else {
        log.info("Email sent successfully", { to, subject });
      }
      return true;
    } catch (error: unknown) {
      lastError = error;

      if (!isRetryableError(error)) {
        log.error("Non-retryable email send error", { to, subject, error: String(error) });
        return false;
      }

      if (attempt === retries) {
        log.error("Email send failed after all retries", { to, subject, error: String(error), attempts: retries + 1 });
        return false;
      }
    }
  }

  // Should not reach here, but TypeScript requires it
  log.error("Email send failed unexpectedly", { to, subject, error: String(lastError) });
  return false;
}
