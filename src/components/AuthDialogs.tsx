"use client";

import React, { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
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
import { toast } from "sonner";

export function AuthDialogs() {
  const { setUser } = useAppStore();
  const [dialogType, setDialogType] = useState<string | null>(null);
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

  // Слушаем хеш для открытия диалогов
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash === "login" || hash === "register" || hash === "forgot-password") {
        setDialogType(hash);
      } else {
        setDialogType(null);
      }
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const closeDialog = () => {
    setDialogType(null);
    window.location.hash = "";
    setRequire2FA(false);
    setForgotSent(false);
  };

  const switchToRegister = () => {
    window.location.hash = "register";
  };

  const switchToLogin = () => {
    window.location.hash = "login";
  };

  const switchToForgot = () => {
    window.location.hash = "forgot-password";
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
          toast.info("Введите код двухфакторной аутентификации");
        } else {
          toast.error(result.error || "Неверный email или пароль");
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
              `Добро пожаловать, ${sessionData.user.name || "пользователь"}!`
            );
          }
        }
        closeDialog();
      }
    } catch {
      toast.error("Ошибка входа. Попробуйте ещё раз.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (registerForm.password !== registerForm.confirmPassword) {
      toast.error("Пароли не совпадают");
      return;
    }

    if (registerForm.password.length < 6) {
      toast.error("Пароль должен быть не менее 6 символов");
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
        toast.success("Регистрация успешна! Теперь вы можете войти.");
        switchToLogin();
        setLoginForm({
          ...loginForm,
          email: registerForm.email,
        });
      } else {
        toast.error(data.error || "Ошибка регистрации");
      }
    } catch {
      toast.error("Ошибка регистрации");
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
        toast.error(data.error || "Ошибка");
      }
    } catch {
      toast.error("Ошибка отправки запроса");
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
                <DialogTitle>Вход в аккаунт</DialogTitle>
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
              <Label htmlFor="login-password">Пароль</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Введите пароль"
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
                <Label htmlFor="2fa-code">Код двухфакторной аутентификации</Label>
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
                Забыли пароль?
              </button>
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-700 hover:bg-blue-800 text-white"
              disabled={loginLoading}
            >
              {loginLoading ? "Вход..." : "Войти"}
            </Button>

            <div className="text-center">
              <span className="text-sm text-muted-foreground">
                Нет аккаунта?{" "}
                <button
                  type="button"
                  className="text-blue-700 hover:underline font-medium"
                  onClick={switchToRegister}
                >
                  Зарегистрироваться
                </button>
              </span>
            </div>
          </form>

          {/* Демо-аккаунты */}
          <div className="border-t pt-3 mt-2">
            <p className="text-xs text-muted-foreground mb-2">
              Демо-аккаунты для тестирования:
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
                Администратор: admin@maestro7it.ru / admin123
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
                Преподаватель: teacher@maestro7it.ru / teacher123
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
                <DialogTitle>Регистрация</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Создайте аккаунт на Maestria
                </p>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <Label htmlFor="reg-name">Имя</Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="reg-name"
                  type="text"
                  placeholder="Ваше имя"
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
              <Label htmlFor="reg-password">Пароль</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Минимум 6 символов"
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
              <Label htmlFor="reg-confirm">Подтвердите пароль</Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="reg-confirm"
                  type="password"
                  placeholder="Повторите пароль"
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
              {registerLoading ? "Регистрация..." : "Зарегистрироваться"}
            </Button>

            <div className="text-center">
              <span className="text-sm text-muted-foreground">
                Уже есть аккаунт?{" "}
                <button
                  type="button"
                  className="text-blue-700 hover:underline font-medium"
                  onClick={switchToLogin}
                >
                  Войти
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
            <DialogTitle>Восстановление пароля</DialogTitle>
          </DialogHeader>

          {forgotSent ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Mail className="w-8 h-8 text-blue-700" />
              </div>
              <h3 className="font-semibold mb-2">Письмо отправлено</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Если аккаунт с таким email существует, вы получите инструкции по
                сбросу пароля.
              </p>
              <Button variant="outline" onClick={switchToLogin}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Вернуться ко входу
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Введите email, указанный при регистрации, и мы отправим вам
                инструкцию по восстановлению пароля.
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
                {forgotLoading ? "Отправка..." : "Отправить инструкцию"}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-blue-700 hover:underline"
                  onClick={switchToLogin}
                >
                  <ArrowLeft className="w-4 h-4 inline mr-1" />
                  Вернуться ко входу
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
