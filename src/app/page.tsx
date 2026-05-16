'use client'

import React, { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { HomePage } from "@/components/HomePage";
import { CatalogPage } from "@/components/CatalogPage";
import { CourseDetailPage } from "@/components/CourseDetailPage";
import { StepViewerPage } from "@/components/StepViewerPage";
import { ProfilePage } from "@/components/ProfilePage";
import { AdminPage } from "@/components/AdminPage";
import { AboutPage } from "@/components/AboutPage";
import { AchievementsPage } from "@/components/AchievementsPage";
import { CertificatePage } from "@/components/CertificatePage";
import { NotificationsPage } from "@/components/NotificationsPage";
import { CourseEditorPage } from "@/components/CourseEditorPage";
import { AuthDialogs } from "@/components/AuthDialogs";
import { CustomCursor } from "@/components/CustomCursor";
import { GlobalScrollToTop } from "@/components/GlobalScrollToTop";
import { PageTransition } from "@/components/PageTransition";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TermsPage } from "@/components/TermsPage";
import { PrivacyPage } from "@/components/PrivacyPage";
import { PersonalDataConsentPage } from "@/components/PersonalDataConsentPage";
import { OfferPage } from "@/components/OfferPage";
import { RefundPage } from "@/components/RefundPage";
import { EduInfoPage } from "@/components/EduInfoPage";
import { RulesPage } from "@/components/RulesPage";
import { LicensePage } from "@/components/LicensePage";
import { AgeRatingPage } from "@/components/AgeRatingPage";
import { CookiePage } from "@/components/CookiePage";
import { HelpPage } from "@/components/HelpPage";

// Главный SPA-роутер для образовательной платформы Maestria by Maestro7IT
function AppRouter() {
  const { currentPage, navigate, theme } = useAppStore();

  // Применяем тему к <html> элементу глобально
  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove("dark", "amber", "light");
    if (theme === "dark") {
      html.classList.add("dark");
    } else if (theme === "amber") {
      html.classList.add("amber");
    }
    // light theme = no class needed (uses :root)
  }, [theme]);

  // Парсинг хеш-роутов: #home, #catalog, #course/ID, #course/ID/lesson/LESSON_ID, #profile, #admin
  const renderPage = () => {
    // Parse route segments
    const segments = currentPage.split('/');
    const mainRoute = segments[0];

    switch (mainRoute) {
      case 'catalog':
        return <CatalogPage />;

      case 'course':
        if (segments.length >= 4 && segments[2] === 'lesson') {
          return <StepViewerPage courseId={segments[1]} lessonId={segments[3]} />;
        }
        if (segments.length >= 2 && segments[1]) {
          return <CourseDetailPage courseId={segments[1]} />;
        }
        return <CatalogPage />;

      case 'profile':
        return <ProfilePage />;

      case 'admin':
        return <AdminPage />;

      case 'about':
        return <AboutPage />;

      case 'achievements':
        return <AchievementsPage />;

      case 'notifications':
        return <NotificationsPage />;

      case 'certificate':
        if (segments.length >= 2 && segments[1]) {
          return <CertificatePage courseId={segments[1]} />;
        }
        return <CatalogPage />;

      case 'course-editor':
        return <CourseEditorPage />;

      case 'terms':
        return <TermsPage />;

      case 'privacy':
        return <PrivacyPage />;

      case 'personal-data':
        return <PersonalDataConsentPage />;

      case 'offer':
        return <OfferPage />;

      case 'refund':
        return <RefundPage />;

      case 'edu-info':
        return <EduInfoPage />;

      case 'rules':
        return <RulesPage />;

      case 'license':
        return <LicensePage />;

      case 'age-rating':
        return <AgeRatingPage />;

      case 'cookies':
        return <CookiePage />;

      case 'help':
        return <HelpPage />;

      case 'home':
      default:
        return <HomePage />;
    }
  };

  const themeClass = theme === 'dark' ? 'dark' : theme === 'amber' ? 'amber' : '';
  const isAdminPage = currentPage === 'admin';

  return (
    <div className={`min-h-screen flex flex-col bg-background text-foreground ${themeClass}`}>
      <CustomCursor />
      {!isAdminPage && <GlobalScrollToTop />}
      {!isAdminPage && <Header />}
      <main className="flex-1">
        <ErrorBoundary>
          <PageTransition pageKey={currentPage}>
            {renderPage()}
          </PageTransition>
        </ErrorBoundary>
      </main>
      {!isAdminPage && <Footer />}
      <AuthDialogs />
    </div>
  );
}

export default function Home() {
  const { navigate, setUser } = useAppStore();

  // Инициализация: синхронизация с URL-хешем и загрузка сессии
  useEffect(() => {
    // Синхронизация с текущим хешем
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash) {
        navigate(hash);
      }
    };

    handleHashChange();
    window.addEventListener("hashchange", handleHashChange);

    // Загрузка сессии пользователя
    const loadSession = async () => {
      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const session = await res.json();
          if (session?.user) {
            setUser({
              id: (session.user as any).id || "",
              email: session.user.email || "",
              name: session.user.name || null,
              image: session.user.image || null,
              role: (session.user as any).role || "student",
            });
          }
        }
      } catch (e) {
        // Сессия не найдена — пользователь не авторизован
      }
    };

    loadSession();

    // Автоматический сид БД при первом запуске
    const seedDatabase = async () => {
      try {
        const res = await fetch("/api/seed", { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          console.log("✅ База данных заполнена:", data.message);
        }
      } catch (e) {
        // БД уже заполнена или ошибка — не критично
      }
    };

    seedDatabase();

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [navigate, setUser]);

  return <AppRouter />;
}
