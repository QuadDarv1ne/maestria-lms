"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { log } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

/**
 * Account erasure (GDPR art. 17 / 152-ФЗ).
 *
 * Two-step by design: the destructive action sits behind a dialog that requires
 * typing the current password, because a stolen session alone must not be
 * enough to destroy an account.
 *
 * The copy states explicitly that the payment ledger survives — the user is
 * told what actually happens instead of a blanket "everything is deleted".
 */
export function DeleteAccountSection() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = password.length > 0 && !submitting;

  async function handleDelete() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/user/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, confirm: "DELETE" }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : t("profile.deleteAccountError", locale));
        return;
      }

      // The account is anonymized and the session is gone: reload the root so
      // the app picks up the signed-out state instead of showing a profile of
      // a user that no longer exists.
      setOpen(false);
      router.push("/");
      router.refresh();
    } catch (e: unknown) {
      log.error("Account deletion failed", {
        error: e instanceof Error ? e.message : String(e),
      });
      setError(t("profile.deleteAccountError", locale));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="border-destructive/40 mt-6">
      <CardContent className="p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-destructive">
              {t("profile.deleteAccountTitle", locale)}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t("profile.deleteAccountDesc", locale)}
            </p>
            <Button
              variant="destructive"
              size="sm"
              className="mt-3"
              onClick={() => {
                setPassword("");
                setError(null);
                setOpen(true);
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t("profile.deleteAccountButton", locale)}
            </Button>
          </div>
        </div>
      </CardContent>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!submitting) setOpen(next);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("profile.deleteAccountConfirmTitle", locale)}</DialogTitle>
            <DialogDescription>
              {t("profile.deleteAccountConfirmDesc", locale)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="delete-account-password" className="text-sm font-medium">
              {t("profile.deleteAccountPasswordLabel", locale)}
            </label>
            <Input
              id="delete-account-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              placeholder={t("profile.deleteAccountPasswordPlaceholder", locale)}
            />
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              {t("profile.cancel", locale)}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={!canSubmit}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("profile.deleteAccountDeleting", locale)}
                </>
              ) : (
                t("profile.deleteAccountConfirmButton", locale)
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
