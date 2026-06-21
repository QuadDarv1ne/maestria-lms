"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { getInitials } from "@/lib/utils";
import { signOut } from "next-auth/react";
import { log } from "@/lib/logger";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  GraduationCap,
  Menu,
  LogOut,
  User,
  Shield,
  BookOpen,
  LayoutDashboard,
  Trophy,
  Bell,
  Heart,
  Palette,
  Globe,
  Check,
  HelpCircle,
  FileText,
  Home,
  Info,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import type { Theme, Locale } from "@/lib/store";

const themeOptions: { value: Theme; icon: string; labelKey: string }[] = [
  { value: "light", icon: "☀️", labelKey: "theme.light" },
  { value: "dark", icon: "🌙", labelKey: "theme.dark" },
  { value: "amber", icon: "🍂", labelKey: "theme.amber" },
];

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);

  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const localeOptions = useMemo<{ value: Locale; flag: string; label: string }[]>(() => [
    { value: "ru", flag: "🇷🇺", label: t("locale.ru", locale) },
    { value: "en", flag: "🇬🇧", label: t("locale.en", locale) },
    { value: "zh", flag: "🇨🇳", label: t("locale.zh", locale) },
  ], [locale]);

  const unreadCount = useAppStore((s) => s.notifications.filter((n) => !n.read).length);

  const handleLogout = async () => {
    try {
      await signOut({ redirect: false });
    } catch (e: unknown) {
      log.error("Logout failed", { error: e instanceof Error ? e.message : String(e) });
    }
    logout();
  };

  const userInitials = getInitials(user?.name, "??");

  const navItems = useMemo(() => [
    { href: "/", label: t("nav.home", locale), icon: Home, show: true as const },
    { href: "/catalog", label: t("nav.catalog", locale), icon: BookOpen, show: true as const },
    { href: "/blog", label: t("nav.blog", locale), icon: FileText, show: true as const },
    { href: "/about", label: t("nav.about", locale), icon: Info, show: true as const },
    { href: "/help", label: t("nav.help", locale), icon: HelpCircle, show: true as const },
    { href: "/profile", label: t("nav.myCourses", locale), icon: BookOpen, show: !!user },
    { href: "/achievements", label: t("nav.achievements", locale), icon: Trophy, show: !!user },
    { href: "/teacher", label: t("nav.teacher", locale), icon: GraduationCap, show: user?.role === "teacher" },
    { href: "/admin", label: t("nav.admin", locale), icon: Shield, show: user?.role === "admin" },
  ], [locale, user]);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Логотип */}
        <Link
          href="/"
          aria-label={t("nav.home", locale)}
          className="flex items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
           <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-violet-600 rounded-lg flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div className="hidden sm:block">
            <span className="text-lg font-bold text-foreground leading-tight">
              Maestria
            </span>
            <p className="text-[10px] text-muted-foreground leading-none -mt-0.5">
              by Maestro7IT
            </p>
          </div>
        </Link>

        {/* Навигация (десктоп) */}
        <nav className="hidden md:flex items-center gap-1" aria-label={t("nav.mainNav", locale)}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className={`text-sm${pathname === "/" ? " bg-accent font-medium" : ""}`}
            aria-current={pathname === "/" ? "page" : undefined}
          >
            {t("nav.home", locale)}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/catalog")}
            className={`text-sm${pathname.startsWith("/catalog") ? " bg-accent font-medium" : ""}`}
            aria-current={pathname.startsWith("/catalog") ? "page" : undefined}
          >
            <BookOpen className="w-4 h-4 mr-1" />
            {t("nav.catalog", locale)}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/blog")}
            className={`text-sm${pathname.startsWith("/blog") ? " bg-accent font-medium" : ""}`}
            aria-current={pathname.startsWith("/blog") ? "page" : undefined}
          >
            <FileText className="w-4 h-4 mr-1" />
            {t("nav.blog", locale)}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/about")}
            className={`text-sm${pathname.startsWith("/about") ? " bg-accent font-medium" : ""}`}
            aria-current={pathname.startsWith("/about") ? "page" : undefined}
          >
            {t("nav.about", locale)}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/help")}
            className={`text-sm${pathname.startsWith("/help") ? " bg-accent font-medium" : ""}`}
            aria-current={pathname.startsWith("/help") ? "page" : undefined}
          >
            <HelpCircle className="w-4 h-4 mr-1" />
            {t("nav.help", locale)}
          </Button>
          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/profile")}
              className="text-sm"
            >
              {t("nav.myCourses", locale)}
            </Button>
          )}
          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/achievements")}
              className="text-sm"
            >
              <Trophy className="w-4 h-4 mr-1" />
              {t("nav.achievements", locale)}
            </Button>
          )}
          {user?.role === "teacher" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/teacher")}
              className="text-sm"
            >
              <GraduationCap className="w-4 h-4 mr-1" />
              {t("nav.teacher", locale)}
            </Button>
          )}
          {user?.role === "admin" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/admin")}
              className="text-sm"
            >
              <Shield className="w-4 h-4 mr-1" />
              {t("nav.admin", locale)}
            </Button>
          )}
        </nav>

        {/* Правая часть */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Переключатель языка */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" aria-label={t("nav.language", locale)}>
                <Globe className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {localeOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setLocale(opt.value)}
                  className="flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <span>{opt.flag}</span>
                    <span>{opt.label}</span>
                  </span>
                  {locale === opt.value && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Переключатель темы */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" aria-label={t("nav.theme", locale)}>
                <Palette className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {themeOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className="flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <span>{opt.icon}</span>
                    <span>{t(opt.labelKey, locale)}</span>
                  </span>
                  {theme === opt.value && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Колокольчик уведомлений */}
          {user && (
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label={t("nav.notifications", locale)}
              onClick={() => router.push("/notifications")}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1" aria-live="polite">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          )}

          {/* Кнопка избранного */}
          {user && (
            <Button
              variant="ghost"
              size="icon"
              className="relative hidden sm:flex"
              aria-label={t("nav.favorites", locale)}
              onClick={() => router.push("/profile")}
            >
              <Heart className="h-5 w-5" />
            </Button>
          )}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  aria-label={t("nav.profile", locale)}
                  className="relative h-9 w-9 rounded-full"
                >
                  <Avatar className="h-9 w-9">
                    {user.image && <AvatarImage src={user.image} alt={user.name || ""} />}
                    <AvatarFallback className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-semibold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                  <p className="text-xs text-primary mt-1">
                    {user.role === "admin"
                      ? t("role.admin", locale)
                      : user.role === "teacher"
                      ? t("role.teacher", locale)
                      : t("role.student", locale)}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push("/profile")}>
                  <User className="mr-2 h-4 w-4" />
                  {t("nav.profile", locale)}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/catalog")}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  {t("nav.catalog", locale)}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/notifications")}>
                  <Bell className="mr-2 h-4 w-4" />
                  {t("nav.notifications", locale)}
                  {unreadCount > 0 && (
                    <span className="ml-auto bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </DropdownMenuItem>
                {user.role === "teacher" && (
                  <DropdownMenuItem onClick={() => router.push("/teacher")}>
                    <GraduationCap className="mr-2 h-4 w-4" />
                    {t("nav.teacher", locale)}
                  </DropdownMenuItem>
                )}
                {user.role === "admin" && (
                  <DropdownMenuItem onClick={() => router.push("/admin")}>
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    {t("admin.panel", locale)}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("nav.logout", locale)}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              size="sm"
              className="bg-blue-700 hover:bg-blue-800 text-white"
              aria-label={t("nav.login", locale)}
              onClick={() => router.push("?dialog=login")}
            >
              {t("nav.login", locale)}
            </Button>
          )}

          {/* Мобильное меню: Sheet-панель */}
          <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label={t("nav.openMenu", locale)}
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] sm:w-[320px] p-0">
              <SheetHeader className="p-4 border-b">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-violet-600 rounded-lg flex items-center justify-center">
                    <GraduationCap className="w-4 h-4 text-white" />
                  </div>
                  <SheetTitle className="text-left">Maestria</SheetTitle>
                </div>
              </SheetHeader>
              <ScrollArea className="flex-1 h-[calc(100vh-80px)]">
                <div className="p-4 space-y-1">
                  {/* Профиль (если авторизован) */}
                  {user && (
                    <div className="flex items-center gap-3 p-3 mb-2 rounded-lg bg-muted/50">
                      <Avatar className="h-10 w-10">
                        {user.image && <AvatarImage src={user.image} alt={user.name || ""} />}
                        <AvatarFallback className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-semibold">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                  )}

                  {/* Навигационные ссылки */}
                  {navItems.filter(item => item.show).map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                    return (
                      <SheetClose key={item.href} asChild>
                        <Button
                          variant={isActive ? "secondary" : "ghost"}
                          className="w-full justify-start gap-3"
                          onClick={() => { router.push(item.href); setMobileSheetOpen(false); }}
                        >
                          <Icon className="w-4 h-4" />
                          {item.label}
                        </Button>
                      </SheetClose>
                    );
                  })}
                </div>

                <Separator className="my-2" />

                {/* Переключатели темы и языка */}
                <div className="px-4 py-2 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {t("nav.settings", locale)}
                  </p>
                  <div className="grid grid-cols-3 gap-1">
                    {themeOptions.map((opt) => (
                      <Button
                        key={opt.value}
                        variant={theme === opt.value ? "default" : "outline"}
                        size="sm"
                        className="gap-1"
                        onClick={() => setTheme(opt.value)}
                      >
                        <span>{opt.icon}</span>
                      </Button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {localeOptions.map((opt) => (
                      <Button
                        key={opt.value}
                        variant={locale === opt.value ? "default" : "outline"}
                        size="sm"
                        className="gap-1 text-xs"
                        onClick={() => setLocale(opt.value)}
                      >
                        <span>{opt.flag}</span>
                        <span>{opt.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                <Separator className="my-2" />

                {/* Выход / Вход */}
                <div className="px-4 pb-4">
                  {user ? (
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                      onClick={() => { handleLogout(); setMobileSheetOpen(false); }}
                    >
                      <LogOut className="w-4 h-4" />
                      {t("nav.logout", locale)}
                    </Button>
                  ) : (
                    <SheetClose asChild>
                      <Button
                        className="w-full bg-blue-700 hover:bg-blue-800 text-white"
                        onClick={() => router.push("?dialog=login")}
                      >
                        {t("nav.login", locale)}
                      </Button>
                    </SheetClose>
                  )}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
