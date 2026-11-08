"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { log } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { KeyRound, Loader2 } from "lucide-react";

/**
 * Password change (PUT /api/user/password).
 *
 * Rotating the password bumps `sessionVersion` server-side, which retires every
 * token issued before the change — including this browser's. The dialog therefore
 * signs the user out on success: pretending the session survived would leave the
 * next request failing with a 401 and no explanation.
 */
export function ChangePasswordSection() {
  const locale = useAppStore((s) => s.locale);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit =
    currentPassword.length > 0 && newPassword.length > 0 && repeatPassword.length > 0 && !submitting;

  async function handleChangePassword() {
    if (!canSubmit) return;

    if (newPassword !== repeatPassword) {
      setError(t("profile.passwordMismatch", locale));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/user/password", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : t("profile.passwordChangeError", locale));
        return;
      }

      setDone(true);
      setCurrentPassword("");
      setNewPassword("");
      setRepeatPassword("");

      // The old token is already dead — send the user to sign in with the new
      // password instead of letting them browse on a session that 401s.
      setTimeout(() => {
        void signOut({ callbackUrl: "/" });
      }, 2500);
    } catch (e: unknown) {
      log.error("Password change failed", {
        error: e instanceof Error ? e.message : String(e),
      });
      setError(t("profile.passwordChangeError", locale));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mt-6">
      <CardContent className="p-6">
        <div className="flex items-start gap-3">
          <KeyRound className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">{t("profile.changePasswordTitle", locale)}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t("profile.changePasswordDesc", locale)}
            </p>

            {done ? (
              <p className="text-sm text-green-600 mt-3" role="status">
                {t("profile.passwordChanged", locale)}
              </p>
            ) : (
              <div className="mt-3 grid gap-3 max-w-sm">
                <div className="space-y-1">
                  <label htmlFor="current-password" className="text-sm font-medium">
                    {t("profile.currentPassword", locale)}
                  </label>
                  <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="new-password" className="text-sm font-medium">
                    {t("profile.newPassword", locale)}
                  </label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={submitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("profile.passwordHint", locale)}
                  </p>
                </div>
                <div className="space-y-1">
                  <label htmlFor="repeat-password" className="text-sm font-medium">
                    {t("profile.repeatPassword", locale)}
                  </label>
                  <Input
                    id="repeat-password"
                    type="password"
                    autoComplete="new-password"
                    value={repeatPassword}
                    onChange={(e) => setRepeatPassword(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}
                <Button
                  size="sm"
                  className="w-fit"
                  onClick={() => void handleChangePassword()}
                  disabled={!canSubmit}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t("profile.passwordChanging", locale)}
                    </>
                  ) : (
                    t("profile.changePasswordButton", locale)
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
