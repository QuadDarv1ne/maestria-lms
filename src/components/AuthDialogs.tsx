"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  GraduationCap,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowLeft,
  KeyRound,
} from "lucide-react";
import { t } from "@/lib/i18n";
import { toast } from "sonner";

export function AuthDialogs() {
  const { setUser, locale } = useAppStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  // Форма входа
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
    twoFactorCode: "",
  });
  const [loginLoading, setLoginLoading] = useState(false);
  const [require2FA, setRequire2FA] = useState(false);

  // Форма регистрации
  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [registerLoading, setRegisterLoading] = useState(false);

  // Форма сброса пароля
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  // Определяем тип диалога из search params
  const dialogParam = searchParams.get("dialog");
  const dialogType =
    dialogParam === "login" ||
    dialogParam === "register" ||
    dialogParam === "forgot-password"
      ? dialogParam
      : null;

  const closeDialog = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("dialog");
    const query = params.toString();
    router.replace(query ? `?${query}` : window.location.pathname, { scroll: false });
    setRequire2FA(false);
    setForgotSent(false);
  };

  const switchToRegister = () => {
    router.push("?dialog=register");
  };

  const switchToLogin = () => {
    router.push("?dialog=login");
  };

  const switchToForgot = () => {
    router.push("?dialog=forgot-password");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);

    try {
      // Используем официальный NextAuth signIn для корректной обработки CSRF
      const result = await signIn("credentials", {
        redirect: false,
        email: loginForm.email,
        password: loginForm.password,
        twoFactorCode: loginForm.twoFactorCode || undefined,
      });

      if (result?.error) {
        if (result.error === "ТРЕБУЕТСЯ_2FA") {
          setRequire2FA(true);
          toast.info(t("auth.twoFactorInfo", locale));
        } else {
          toast.error(result.error || t("auth.invalidCredentials", locale));
        }
      } else if (result?.ok) {
        // Получаем обновлённую сессию
        const sessionRes = await fetch("/api/auth/session");
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          if (sessionData?.user) {
            setUser({
              id: (sessionData.user as { id?: string }).id || "",
              email: sessionData.user.email || "",
              name: sessionData.user.name || null,
              image: sessionData.user.image || null,
              role: (sessionData.user as { role?: string }).role || "student",
            });
            toast.success(
              `${t("auth.welcome", locale)}, ${sessionData.user.name || t("auth.user", locale)}!`
            );
          }
        }
        closeDialog();
      }
    } catch {
      toast.error(t("auth.loginError", locale));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (registerForm.password !== registerForm.confirmPassword) {
      toast.error(t("auth.passwordsNoMatch", locale));
      return;
    }

    if (registerForm.password.length < 6) {
      toast.error(t("auth.passwordMinLength", locale));
      return;
    }

    setRegisterLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: registerForm.email,
          password: registerForm.password,
          name: registerForm.name,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(t("auth.registerSuccess", locale));
        switchToLogin();
        setLoginForm({
          ...loginForm,
          email: registerForm.email,
        });
      } else {
        toast.error(data.error || t("auth.registerError", locale));
      }
    } catch {
      toast.error(t("auth.registerError", locale));
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setForgotSent(true);
        toast.success(data.message);
      } else {
        toast.error(data.error || t("common.error", locale));
      }
    } catch {
      toast.error(t("auth.forgotError", locale));
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <>
      {/* Диалог входа */}
      <Dialog open={dialogType === "login"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-violet-600 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle>{t("auth.login", locale)}</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Maestria
                </p>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="login-email">Email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="login-email"
                  type="email"
                  placeholder="email@example.com"
                  value={loginForm.email}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, email: e.target.value })
                  }
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="login-password">{t("auth.password", locale)}</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("auth.enterPassword", locale)}
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm({ ...loginForm, password: e.target.value })
                  }
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {require2FA && (
              <div>
                <Label htmlFor="2fa-code">{t("auth.twoFactorCode", locale)}</Label>
                <div className="relative mt-1">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="2fa-code"
                    type="text"
                    placeholder="000000"
                    value={loginForm.twoFactorCode}
                    onChange={(e) =>
                      setLoginForm({
                        ...loginForm,
                        twoFactorCode: e.target.value,
                      })
                    }
                    className="pl-10"
                    maxLength={6}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <button
                type="button"
                className="text-sm text-blue-700 hover:underline"
                onClick={switchToForgot}
              >
                {t("auth.forgotPassword", locale)}
              </button>
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-700 hover:bg-blue-800 text-white"
              disabled={loginLoading}
            >
              {loginLoading ? t("auth.loggingIn", locale) : t("auth.loginBtn", locale)}
            </Button>

            <div className="text-center">
              <span className="text-sm text-muted-foreground">
                {t("auth.noAccount", locale)}{" "}
                <button
                  type="button"
                  className="text-blue-700 hover:underline font-medium"
                  onClick={switchToRegister}
                >
                  {t("auth.registerBtn", locale)}
                </button>
              </span>
            </div>
          </form>

          {/* Демо-аккаунты */}
          <div className="border-t pt-3 mt-2">
            <p className="text-xs text-muted-foreground mb-2">
              {t("auth.demoHint", locale)}
            </p>
            <div className="space-y-1">
              <button
                type="button"
                className="text-xs text-blue-700 hover:underline block"
                onClick={() => {
                  setLoginForm({
                    email: "admin@maestro7it.ru",
                    password: "admin123",
                    twoFactorCode: "",
                  });
                }}
              >
                {t("auth.demoAdmin", locale)}
              </button>
              <button
                type="button"
                className="text-xs text-blue-700 hover:underline block"
                onClick={() => {
                  setLoginForm({
                    email: "teacher@maestro7it.ru",
                    password: "teacher123",
                    twoFactorCode: "",
                  });
                }}
              >
                {t("auth.demoTeacher", locale)}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог регистрации */}
      <Dialog open={dialogType === "register"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-violet-600 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <DialogTitle>{t("auth.registration", locale)}</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {t("auth.createAccount", locale)}
                </p>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <Label htmlFor="reg-name">{t("auth.name", locale)}</Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="reg-name"
                  type="text"
                  placeholder={t("auth.yourName", locale)}
                  value={registerForm.name}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, name: e.target.value })
                  }
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="reg-email">Email</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="email@example.com"
                  value={registerForm.email}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, email: e.target.value })
                  }
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="reg-password">{t("auth.password", locale)}</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("auth.min6Chars", locale)}
                  value={registerForm.password}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      password: e.target.value,
                    })
                  }
                  className="pl-10"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="reg-confirm">{t("auth.confirmPassword", locale)}</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="reg-confirm"
                  type="password"
                  placeholder={t("auth.repeatPassword", locale)}
                  value={registerForm.confirmPassword}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-700 hover:bg-blue-800 text-white"
              disabled={registerLoading}
            >
              {registerLoading ? t("auth.registering", locale) : t("auth.registerBtn", locale)}
            </Button>

            <div className="text-center">
              <span className="text-sm text-muted-foreground">
                {t("auth.hasAccount", locale)}{" "}
                <button
                  type="button"
                  className="text-blue-700 hover:underline font-medium"
                  onClick={switchToLogin}
                >
                  {t("auth.loginBtn2", locale)}
                </button>
              </span>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Диалог сброса пароля */}
      <Dialog
        open={dialogType === "forgot-password"}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("auth.recovery", locale)}</DialogTitle>
          </DialogHeader>

          {forgotSent ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Mail className="w-8 h-8 text-blue-700" />
              </div>
              <h3 className="font-semibold mb-2">{t("auth.emailSent", locale)}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("auth.emailInstructions", locale)}
              </p>
              <Button variant="outline" onClick={switchToLogin}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t("auth.backToLogin", locale)}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("auth.recoveryInstructions", locale)}
              </p>
              <div>
                <Label htmlFor="forgot-email">Email</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="email@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-700 hover:bg-blue-800 text-white"
                disabled={forgotLoading}
              >
                {forgotLoading ? t("auth.sending", locale) : t("auth.sendInstruction", locale)}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-blue-700 hover:underline"
                  onClick={switchToLogin}
                >
                  {t("auth.backToLogin", locale)}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
