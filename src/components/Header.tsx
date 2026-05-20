"use client";

import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  Menu,
  X,
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Theme, Locale } from "@/lib/store";

const themeOptions: { value: Theme; icon: string; labelKey: string }[] = [
  { value: "light", icon: "☀️", labelKey: "theme.light" },
  { value: "dark", icon: "🌙", labelKey: "theme.dark" },
  { value: "amber", icon: "🍂", labelKey: "theme.amber" },
];

export function Header() {
  const { user, sidebarOpen, setSidebarOpen, navigate, logout, unreadNotificationsCount, theme, setTheme, locale, setLocale } = useAppStore();

  const localeOptions: { value: Locale; flag: string; label: string }[] = [
    { value: "ru", flag: "🇷🇺", label: t("locale.ru", locale) },
    { value: "en", flag: "🇬🇧", label: t("locale.en", locale) },
    { value: "zh", flag: "🇨🇳", label: t("locale.zh", locale) },
  ];
  const unreadCount = unreadNotificationsCount();

  const handleLogout = async () => {
    await signOut({ redirect: false });
    logout();
  };

  const userInitials = user?.name
    ? user.name
        .trim()
        .split(/\s+/)
        .map((n) => n[0])
        .filter(Boolean)
        .join("")
        .toUpperCase()
        .slice(0, 2) || "??"
    : "??";

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Логотип */}
        <button
          type="button"
          aria-label={t("nav.home", locale)}
          className="flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-lg"
          onClick={() => navigate("home")}
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
        </button>

        {/* Навигация (десктоп) */}
        <nav className="hidden md:flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("home")}
            className="text-sm"
          >
            {t("nav.home", locale)}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("catalog")}
            className="text-sm"
          >
            <BookOpen className="w-4 h-4 mr-1" />
            {t("nav.catalog", locale)}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("about")}
            className="text-sm"
          >
            {t("nav.about", locale)}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("help")}
            className="text-sm"
          >
            <HelpCircle className="w-4 h-4 mr-1" />
            {t("nav.help", locale)}
          </Button>
          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("profile")}
              className="text-sm"
            >
              {t("nav.myCourses", locale)}
            </Button>
          )}
          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("achievements")}
              className="text-sm"
            >
              <Trophy className="w-4 h-4 mr-1" />
              {t("nav.achievements", locale)}
            </Button>
          )}
          {user?.role === "admin" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("admin")}
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
              onClick={() => navigate("notifications")}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1">
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
              onClick={() => navigate("profile")}
            >
              <Heart className="h-5 w-5" />
            </Button>
          )}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user.image || ""} alt={user.name || ""} />
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-semibold">
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
                <DropdownMenuItem onClick={() => navigate("profile")}>
                  <User className="mr-2 h-4 w-4" />
                  {t("nav.profile", locale)}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("catalog")}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  {t("nav.catalog", locale)}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("notifications")}>
                  <Bell className="mr-2 h-4 w-4" />
                  {t("nav.notifications", locale)}
                  {unreadCount > 0 && (
                    <span className="ml-auto bg-red-100 text-red-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </DropdownMenuItem>
                {user.role === "admin" && (
                  <DropdownMenuItem onClick={() => navigate("admin")}>
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
              onClick={() => navigate("login")}
            >
              {t("nav.login", locale)}
            </Button>
          )}

          {/* Мобильное меню */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={sidebarOpen ? t("nav.closeMenu", locale) : t("nav.openMenu", locale)}
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Мобильное меню */}
      {sidebarOpen && (
        <div className="md:hidden border-t bg-background p-4 space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              navigate("home");
              setSidebarOpen(false);
            }}
          >
            {t("nav.home", locale)}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              navigate("catalog");
              setSidebarOpen(false);
            }}
          >
            <BookOpen className="w-4 h-4 mr-2" />
            {t("nav.catalog", locale)}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              navigate("about");
              setSidebarOpen(false);
            }}
          >
            {t("nav.about", locale)}
          </Button>
          {user && (
            <>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  navigate("profile");
                  setSidebarOpen(false);
                }}
              >
                {t("nav.myCourses", locale)}
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  navigate("achievements");
                  setSidebarOpen(false);
                }}
              >
                <Trophy className="w-4 h-4 mr-2" />
                {t("nav.achievements", locale)}
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  navigate("notifications");
                  setSidebarOpen(false);
                }}
              >
                <Bell className="w-4 h-4 mr-2" />
                {t("nav.notifications", locale)}
                {unreadCount > 0 && (
                  <span className="ml-auto bg-red-100 text-red-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </Button>
              {user.role === "admin" && (
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    navigate("admin");
                    setSidebarOpen(false);
                  }}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  {t("nav.admin", locale)}
                </Button>
              )}
            </>
          )}
          {/* Мобильные переключатели темы и языка */}
          <div className="border-t pt-3 mt-3 flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 gap-1">
                  <Palette className="w-4 h-4" />
                  {themeOptions.find(o => o.value === theme)?.icon} {t(themeOptions.find(o => o.value === theme)?.labelKey || "theme.light", locale)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-40">
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1 gap-1">
                  <Globe className="w-4 h-4" />
                  {localeOptions.find(o => o.value === locale)?.flag} {localeOptions.find(o => o.value === locale)?.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-40">
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
          </div>
          {!user && (
            <Button
              className="w-full bg-blue-700 hover:bg-blue-800 text-white"
              aria-label={t("nav.login", locale)}
              onClick={() => {
                navigate("login");
                setSidebarOpen(false);
              }}
            >
              {t("nav.login", locale)}
            </Button>
          )}
        </div>
      )}
    </header>
  );
}
