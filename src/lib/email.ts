import { Resend } from "resend";
import { log } from "./logger";

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

function getFromEmail(): string {
  return process.env.EMAIL_FROM || "Maestria LMS <onboarding@resend.dev>";
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<boolean> {
  const resend = getResendClient();

  if (!resend) {
    log.warn("Email not sent: RESEND_API_KEY not configured", { to, subject });
    return false;
  }

  try {
    await resend.emails.send({
      from: getFromEmail(),
      to,
      subject,
      html,
      text: text ?? html.replace(/<[^>]*>/g, ""),
    });

    log.info("Email sent successfully", { to, subject });
    return true;
  } catch (error) {
    log.error("Failed to send email", { to, subject, error: String(error) });
    return false;
  }
}
