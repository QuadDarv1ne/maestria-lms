'use client'

import React, { useEffect } from "react";
import dynamic from "next/dynamic";
import { useAppStore } from "@/lib/store";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthDialogs } from "@/components/AuthDialogs";
import { PageTransition } from "@/components/PageTransition";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const HomePage = dynamic(() => import("@/components/HomePage").then(m => ({ default: m.HomePage })));
const CatalogPage = dynamic(() => import("@/components/CatalogPage").then(m => ({ default: m.CatalogPage })));
const CourseDetailPage = dynamic(() => import("@/components/CourseDetailPage").then(m => ({ default: m.CourseDetailPage })));
const StepViewerPage = dynamic(() => import("@/components/StepViewerPage").then(m => ({ default: m.StepViewerPage })));
const LessonPage = dynamic(() => import("@/components/LessonPage").then(m => ({ default: m.LessonPage })));
const ProfilePage = dynamic(() => import("@/components/ProfilePage").then(m => ({ default: m.ProfilePage })));
const AdminPage = dynamic(() => import("@/components/AdminPage").then(m => ({ default: m.AdminPage })));
const AboutPage = dynamic(() => import("@/components/AboutPage").then(m => ({ default: m.AboutPage })));
const AchievementsPage = dynamic(() => import("@/components/AchievementsPage").then(m => ({ default: m.AchievementsPage })));
const CertificatePage = dynamic(() => import("@/components/CertificatePage").then(m => ({ default: m.CertificatePage })));
const NotificationsPage = dynamic(() => import("@/components/NotificationsPage").then(m => ({ default: m.NotificationsPage })));
const CourseEditorPage = dynamic(() => import("@/components/CourseEditorPage").then(m => ({ default: m.CourseEditorPage })));
const CustomCursor = dynamic(() => import("@/components/CustomCursor").then(m => ({ default: m.CustomCursor })));
const GlobalScrollToTop = dynamic(() => import("@/components/GlobalScrollToTop").then(m => ({ default: m.GlobalScrollToTop })));
const TermsPage = dynamic(() => import("@/components/TermsPage").then(m => ({ default: m.TermsPage })));
const PrivacyPage = dynamic(() => import("@/components/PrivacyPage").then(m => ({ default: m.PrivacyPage })));
const PersonalDataConsentPage = dynamic(() => import("@/components/PersonalDataConsentPage").then(m => ({ default: m.PersonalDataConsentPage })));
const OfferPage = dynamic(() => import("@/components/OfferPage").then(m => ({ default: m.OfferPage })));
const RefundPage = dynamic(() => import("@/components/RefundPage").then(m => ({ default: m.RefundPage })));
const EduInfoPage = dynamic(() => import("@/components/EduInfoPage").then(m => ({ default: m.EduInfoPage })));
const RulesPage = dynamic(() => import("@/components/RulesPage").then(m => ({ default: m.RulesPage })));
const LicensePage = dynamic(() => import("@/components/LicensePage").then(m => ({ default: m.LicensePage })));
const AgeRatingPage = dynamic(() => import("@/components/AgeRatingPage").then(m => ({ default: m.AgeRatingPage })));
const CookiePage = dynamic(() => import("@/components/CookiePage").then(m => ({ default: m.CookiePage })));
const HelpPage = dynamic(() => import("@/components/HelpPage").then(m => ({ default: m.HelpPage })));

// Главный SPA-роутер для образовательной платформы Maestria by Maestro7IT
function AppRouter() {
  const { currentPage, theme } = useAppStore();

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

      case 'lesson-simple':
        if (segments.length >= 3) {
          return <LessonPage courseId={segments[1]} lessonId={segments[2]} />;
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
              id: session.user.id || "",
              email: session.user.email || "",
              name: session.user.name || null,
              image: session.user.image || null,
              role: session.user.role || "student",
            });
          }
        }
      } catch {
        // Сессия не найдена — пользователь не авторизован
      }
    };

    loadSession();

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [navigate, setUser]);

  return <AppRouter />;
}
