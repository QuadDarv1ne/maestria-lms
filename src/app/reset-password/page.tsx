"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, CheckCircle2, AlertCircle } from "lucide-react";
import { passwordStrengthSchema } from "@/lib/password-strength";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useAppStore((s) => s.locale);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const passwordStrength = {
    hasLength: password.length >= 8,
    hasUpper: /[A-ZА-ЯЁ]/.test(password),
    hasLower: /[a-zа-яё]/.test(password),
    hasDigit: /[0-9]/.test(password),
  };
  const passwordScore = Object.values(passwordStrength).filter(Boolean).length;
  const strengthLabel =
    passwordScore === 0 ? "" :
    passwordScore <= 1 ? t("auth.strengthWeak", locale) :
    passwordScore <= 2 ? t("auth.strengthMedium", locale) :
    passwordScore <= 3 ? t("auth.strengthGood", locale) : t("auth.strengthStrong", locale);
  const strengthColor =
    passwordScore <= 1 ? "text-red-500" :
    passwordScore <= 2 ? "text-yellow-500" :
    passwordScore <= 3 ? "text-blue-500" : "text-green-500";

  useEffect(() => {
    // Try sessionStorage first (persists across refreshes)
    let storedToken = sessionStorage.getItem("reset-token");

    if (!storedToken) {
      // Fall back to URL parameter (first visit from email link)
      const rawToken = searchParams.get("code");
      if (rawToken) {
        storedToken = rawToken;
        sessionStorage.setItem("reset-token", rawToken);
        // Clear URL parameter immediately
        window.history.replaceState({}, "", window.location.pathname);
      }
    }

    if (storedToken) {
      setToken(storedToken);
    } else {
      setError(t("auth.noResetToken", locale));
    }
  }, [searchParams, locale]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch", locale));
      return;
    }
    const passwordValidation = passwordStrengthSchema.safeParse(password);
    if (!passwordValidation.success) {
      setError(passwordValidation.error.issues[0]?.message ?? t("auth.passwordWeak", locale));
      return;
    }
    if (!token) {
      setError(t("auth.noResetToken", locale));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("auth.resetError", locale));
        return;
      }

      // Clear stored token after successful reset
      sessionStorage.removeItem("reset-token");
      setSuccess(true);
    } catch {
      setError(t("auth.networkError", locale));
    } finally {
      setLoading(false);
    }
  };

  // Redirect after success with proper cleanup on unmount
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => router.push("/"), 3000);
      return () => clearTimeout(timer);
    }
  }, [success, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            {t("auth.recovery", locale)}
          </CardTitle>
          <CardDescription>
            {t("auth.enterNewPassword", locale)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">{t("auth.passwordChanged", locale)}</h3>
              <p className="text-muted-foreground mb-4">
                {t("auth.passwordChangedDesc", locale)}
              </p>
              <Button onClick={() => router.push("/")}>
                {t("auth.goHome", locale)}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.newPassword", locale)}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Минимум 8 символов"
                  required
                  minLength={8}
                />
                {password.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Надёжность пароля:</span>
                      <span className={strengthColor}>{strengthLabel}</span>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            passwordScore >= level
                              ? passwordScore <= 1 ? "bg-red-500"
                                : passwordScore <= 2 ? "bg-yellow-500"
                                : passwordScore <= 3 ? "bg-blue-500"
                                : "bg-green-500"
                              : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                    <ul className="text-xs text-muted-foreground space-y-0.5 mt-2">
                      <li className={passwordStrength.hasLength ? "text-green-600" : ""}>
                        {passwordStrength.hasLength ? "✓" : "○"} Минимум 8 символов
                      </li>
                      <li className={passwordStrength.hasUpper ? "text-green-600" : ""}>
                        {passwordStrength.hasUpper ? "✓" : "○"} Заглавная буква
                      </li>
                      <li className={passwordStrength.hasLower ? "text-green-600" : ""}>
                        {passwordStrength.hasLower ? "✓" : "○"} Строчная буква
                      </li>
                      <li className={passwordStrength.hasDigit ? "text-green-600" : ""}>
                        {passwordStrength.hasDigit ? "✓" : "○"} Цифра
                      </li>
                    </ul>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t("auth.confirmPassword", locale)}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("auth.repeatPassword", locale)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || token === null}>
                {loading ? t("common.saving", locale) : t("auth.changePassword", locale)}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Загрузка...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
