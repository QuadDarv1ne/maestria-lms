/**
 * Account erasure (GDPR art. 17 / 152-ФЗ «право на удаление»).
 *
 * The privacy policy (section 5.1d) promises the user can demand deletion of
 * their personal data, and the consent page (section 1.3) promises the consent
 * can be withdrawn at any time. Until now there was no way to act on either.
 *
 * A hard `DELETE FROM "User"` is not acceptable: `Payment.userId` cascades, so
 * removing the row would also erase the payment ledger, which Russian
 * bookkeeping law (402-ФЗ) requires to be kept for five years. Erasure is
 * therefore implemented as **anonymization**:
 *
 * - every directly identifying field is overwritten (email, name, phone, bio,
 *   avatar, password hash, 2FA secret, OAuth accounts, sessions, reset tokens);
 * - the row itself stays, so the payments/certificates keep a valid foreign
 *   key and the numbers stay auditable;
 * - the account is deactivated, which already blocks sign-in (both in
 *   `authorize()` and in the JWT callback) and drops existing sessions.
 *
 * The anonymized email is derived from the user id so it stays unique (the
 * column has a UNIQUE constraint) and is not reversible to the original.
 */

import { db } from "@/lib/db";
import { log } from "@/lib/logger";

export interface EraseAccountResult {
  erased: boolean;
  /** Reason when nothing was erased, for logging/monitoring. */
  reason?: "not_found" | "already_erased" | "last_admin";
}

/** Marker put into `name` so support can recognize an anonymized account. */
export const ERASED_NAME = "Удалённый пользователь";

/** Local part of the replacement email address. */
export function anonymizedEmail(userId: string): string {
  // The id is a UUID; strip dashes to keep the local part compact and valid.
  const compact = userId.replace(/-/g, "").slice(0, 16).toLowerCase();
  return `deleted-${compact}@deleted.invalid`;
}

function isAlreadyErased(user: { email: string; isActive: boolean }): boolean {
  return !user.isActive && user.email.endsWith("@deleted.invalid");
}

/**
 * Erase personal data of the given user.
 *
 * Everything runs in one interactive transaction so a half-erased account (for
 * example, an email already replaced but the password hash still present)
 * cannot exist.
 *
 * Refuses to erase the last active admin: losing the only administrator would
 * make the platform unmanageable, and that is not what the right to erasure is
 * meant to achieve.
 */
export async function eraseAccount(userId: string): Promise<EraseAccountResult> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user) return { erased: false, reason: "not_found" };
    if (isAlreadyErased(user)) return { erased: false, reason: "already_erased" };

    if (user.role === "admin") {
      const otherAdmins = await db.user.count({
        where: { role: "admin", isActive: true, id: { not: userId } },
      });
      if (otherAdmins === 0) return { erased: false, reason: "last_admin" };
    }

    await db.$transaction(async (tx) => {
      // Sessions and OAuth links are pure authentication material: drop them
      // rather than overwrite, so nothing can be used to sign in again.
      await tx.session.deleteMany({ where: { userId } });
      await tx.account.deleteMany({ where: { userId } });

      // Outstanding email-verification / password-reset tokens are keyed by
      // the old address; they must not survive the erasure.
      await tx.verificationToken.deleteMany({
        where: { identifier: { contains: user.email } },
      });

      // Notifications are the user's own inbox and reference content that may
      // be personal; remove them instead of leaving orphans.
      await tx.notification.deleteMany({ where: { userId } });

      await tx.user.update({
        where: { id: userId },
        data: {
          email: anonymizedEmail(userId),
          name: ERASED_NAME,
          passwordHash: null,
          phone: null,
          bio: null,
          image: null,
          twoFactorEnabled: false,
          twoFactorSecret: null,
          pendingTwoFactorSecret: null,
          emailVerified: null,
          isActive: false,
        },
      });
    });

    log.info("Account erased (anonymized)", { userId, previousRole: user.role });
    return { erased: true };
  } catch (error: unknown) {
    log.error("Failed to erase account", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
