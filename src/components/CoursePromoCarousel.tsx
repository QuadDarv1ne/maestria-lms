"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Star,
  Clock,
  ChevronLeft,
  ChevronRight,
  Flame,
  ExternalLink,
  BookOpen,
} from "lucide-react";

interface PromoCourse {
  id: number;
  title: string;
  description: string;
  image: string;
  url: string;
  tag: string;
  tagColor: string;
  level: string;
  levelColor: string;
  duration: string;
  rating: number;
  isNew?: boolean;
  isHot?: boolean;
}

const promoCourses: PromoCourse[] = [
  // === ОСНОВНЫЕ КУРСЫ (CDN-изображения с iili.io) ===
  { id: 1, title: "Системное администрирование в Linux", description: "Освойте администрирование Linux-серверов: от установки и настройки до автоматизации и мониторинга.", image: "https://ui3adtb308.a.trbcdn.net/BpcZlg2.jpg", url: "https://stepik.org/a/207061", tag: "DevOps", tagColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", level: "Начинающий", levelColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", duration: "8 недель", rating: 4.8, isNew: true },
  { id: 2, title: "SQL для начинающих: от основ до администрирования БД", description: "Полный курс по SQL — от базовых запросов SELECT до сложных JOIN, оконных функций и администрирования баз данных.", image: "/courses/sql-database.jpg", url: "https://stepik.org/a/210134", tag: "Базы данных", tagColor: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300", level: "Начинающий", levelColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", duration: "6 недель", rating: 4.9, isHot: true },
  { id: 3, title: "Программирование на JavaScript для начинающих", description: "Изучите JavaScript с нуля: переменные, функции, DOM, события, асинхронность и современные возможности языка.", image: "https://ui3adtb308.a.trbcdn.net/BpcZGe9.jpg", url: "https://stepik.org/a/212445", tag: "Frontend", tagColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", level: "Начинающий", levelColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", duration: "10 недель", rating: 4.7, isNew: true },
  { id: 4, title: "PHP с нуля до веб-приложений", description: "Полный курс PHP: от основ синтаксиса до создания полноценных веб-приложений с базами данных, сессиями, API и безопасностью.", image: "https://ui3adtb308.a.trbcdn.net/BpcZMbe.jpg", url: "https://stepik.org/a/253456", tag: "Backend", tagColor: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300", level: "Начинающий", levelColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", duration: "12 недель", rating: 4.6 },
  { id: 5, title: "Docker для начинающих: Шаг за шагом", description: "Научитесь контейнеризации с Docker: создание образов, Compose, сети, volumes, оркестрация и деплой.", image: "https://ui3adtb308.a.trbcdn.net/BpcZKxa.jpg", url: "https://stepik.org/a/205094", tag: "DevOps", tagColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", level: "Начинающий", levelColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", duration: "6 недель", rating: 4.8, isHot: true },
  { id: 6, title: "Redis для разработчиков: кэширование, очереди, масштабирование", description: "Освойте Redis: структуры данных, кэширование, очереди сообщений, Pub/Sub, кластеризация.", image: "https://ui3adtb308.a.trbcdn.net/BpcZ3Dg.jpg", url: "https://stepik.org/a/222859", tag: "Базы данных", tagColor: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300", level: "Средний", levelColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", duration: "5 недель", rating: 4.7, isNew: true },
  { id: 7, title: "Работа с мониторингом и аналитикой в реальном времени", description: "Научитесь строить системы мониторинга: Prometheus, Grafana, алертинг, дашборды и аналитика.", image: "https://ui3adtb308.a.trbcdn.net/BpcZ7sf.jpg", url: "https://stepik.org/a/221029", tag: "DevOps", tagColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", level: "Средний", levelColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", duration: "7 недель", rating: 4.6 },
  { id: 8, title: "Ассемблер для хакеров и инженеров", description: "Архитектура x86, регистры, инструкции, системные вызовы, отладка и реверс-инжиниринг.", image: "https://ui3adtb308.a.trbcdn.net/BpcZfWJ.jpg", url: "https://stepik.org/a/238534", tag: "Low-level", tagColor: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", level: "Продвинутый", levelColor: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", duration: "8 недель", rating: 4.9, isHot: true },
  { id: 9, title: "Программирование на Go (Golang) для начинающих", description: "Изучите Go с нуля: типы данных, горутины, каналы, работа с сетью, создание API и микросервисов.", image: "https://ui3adtb308.a.trbcdn.net/BpcZE57.jpg", url: "https://stepik.org/a/240000", tag: "Backend", tagColor: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300", level: "Начинающий", levelColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", duration: "9 недель", rating: 4.8, isNew: true },
  { id: 10, title: "От нуля до первых приложений на React & React Native", description: "Создавайте веб- и мобильные приложения: React, хуки, состояние, маршрутизация, React Native.", image: "/courses/react-native.png", url: "https://stepik.org/a/252698", tag: "Frontend", tagColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", level: "Начинающий", levelColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", duration: "12 недель", rating: 4.7 },
  { id: 11, title: "Основы ClickHouse: работа с данными в экосистеме OLAP", description: "Освойте ClickHouse: колоночное хранение, SQL-запросы, материализованные представления, интеграция с данными.", image: "https://ui3adtb308.a.trbcdn.net/BpcZRxs.jpg", url: "https://stepik.org/a/240384", tag: "Базы данных", tagColor: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300", level: "Средний", levelColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", duration: "5 недель", rating: 4.6 },
  { id: 12, title: "MongoDB для начинающих: от основ до администрирования БД", description: "Полный курс MongoDB: документная модель, CRUD, агрегации, индексы, репликация, шардирование.", image: "https://ui3adtb308.a.trbcdn.net/BpcZ5WG.jpg", url: "https://stepik.org/a/206417", tag: "Базы данных", tagColor: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300", level: "Начинающий", levelColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", duration: "7 недель", rating: 4.7 },
  { id: 13, title: "Режиссёр видеомонтажа — обучение профессии", description: "Станьте режиссёром монтажа: работа с видеорядом, звуком, цветокоррекция, монтаж в Premiere Pro и DaVinci Resolve.", image: "https://ui3adtb308.a.trbcdn.net/BpcZaf4.jpg", url: "https://stepik.org/a/208571", tag: "Медиа", tagColor: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300", level: "Начинающий", levelColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", duration: "8 недель", rating: 4.5 },
  { id: 14, title: "Vibe-кодинг: программирование нового поколения", description: "Освойте подход vibe-кодинга — AI-ассистенты, промпт-инжиниринг и rapid-прототипирование для создания проектов в 10 раз быстрее.", image: "/courses/vibe-coding.png", url: "https://stepik.org/a/260000", tag: "AI / Vibe", tagColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", level: "Начинающий", levelColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", duration: "6 недель", rating: 4.9, isNew: true, isHot: true },
  { id: 15, title: "Java для начинающих: от основ до Spring Boot", description: "Полный курс Java: ООП, коллекции, потоки, лямбды, Spring Framework, создание REST API и микросервисов.", image: "/courses/java.png", url: "https://stepik.org/a/261000", tag: "Backend", tagColor: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300", level: "Начинающий", levelColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", duration: "14 недель", rating: 4.8, isNew: true },
  { id: 16, title: "WEB-разработка с нуля: HTML, CSS, JavaScript", description: "Полный путь веб-разработчика: от первой HTML-страницы до адаптивных лендингов и SPA.", image: "/courses/web-dev-new.png", url: "https://stepik.org/a/262000", tag: "Frontend", tagColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", level: "Начинающий", levelColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", duration: "10 недель", rating: 4.7, isHot: true },
  { id: 17, title: "Мобильная разработка: от идеи до публикации", description: "Создавайте мобильные приложения: архитектура, UI/UX, навигация, работа с API, пуш-уведомления.", image: "/courses/mobile-dev-new.png", url: "https://stepik.org/a/263000", tag: "Мобильная", tagColor: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300", level: "Начинающий", levelColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", duration: "11 недель", rating: 4.6 },
  { id: 18, title: "Git для разработчиков: контроль версий с нуля", description: "Освойте Git: коммиты, ветки, слияние, ребейз, GitHub/GitLab, pull request, code review и CI/CD.", image: "/courses/git.png", url: "https://stepik.org/a/264000", tag: "Инструменты", tagColor: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", level: "Начинающий", levelColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", duration: "4 недели", rating: 4.9, isHot: true },
  { id: 19, title: "Laravel: профессиональная веб-разработка на PHP", description: "Фреймворк Laravel: маршрутизация, Eloquent ORM, миграции, авторизация, API, очереди, кэширование и деплой.", image: "/courses/laravel.png", url: "https://stepik.org/a/265000", tag: "Backend", tagColor: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300", level: "Средний", levelColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", duration: "10 недель", rating: 4.8, isNew: true },
  { id: 20, title: "C++ для начинающих: от основ до ООП", description: "Изучите C++ с нуля: типы данных, указатели, ссылки, классы, наследование, полиморфизм, STL, шаблоны.", image: "/courses/cpp-new.png", url: "https://stepik.org/a/266000", tag: "Программирование", tagColor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300", level: "Начинающий", levelColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", duration: "12 недель", rating: 4.7 },
  { id: 21, title: "Базы данных: проектирование и администрирование", description: "Полный курс по базам данных: реляционная модель, нормализация, SQL, индексы, транзакции, репликация.", image: "https://ui3adtb308.a.trbcdn.net/BpcZCfR.jpg", url: "https://stepik.org/a/267000", tag: "Базы данных", tagColor: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300", level: "Начинающий", levelColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", duration: "8 недель", rating: 4.6 },
  { id: 22, title: "Системное администрирование: сети, серверы, безопасность", description: "Станьте системным администратором: настройка серверов, сетевая инфраструктура, DNS, DHCP, VPN, фаерволы, мониторинг.", image: "https://ui3adtb308.a.trbcdn.net/BpcZlg2.jpg", url: "https://stepik.org/a/268000", tag: "DevOps", tagColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", level: "Средний", levelColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", duration: "10 недель", rating: 4.5 },

  // === ДОПОЛНИТЕЛЬНЫЕ КУРСЫ (CDN-изображения) ===
  { id: 23, title: "3D моделирование в Blender", description: "Освойте Blender: моделирование, текстурирование, анимация, рендеринг, скульптинг и создание 3D-ассетов для игр и кино.", image: "https://ui3adtb308.a.trbcdn.net/BpcZ2OF.jpg", url: "https://stepik.org/a/270000", tag: "3D / Графика", tagColor: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300", level: "Начинающий", levelColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", duration: "10 недель", rating: 4.7, isNew: true },
  { id: 24, title: "Docker — шаг за шагом: практический курс", description: "Практический курс Docker: от установки до оркестрации. Реальные проекты, Docker Compose, многоконфигурационные среды.", image: "https://ui3adtb308.a.trbcdn.net/BpcZKxa.jpg", url: "https://stepik.org/a/205094", tag: "DevOps", tagColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", level: "Начинающий", levelColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", duration: "6 недель", rating: 4.8 },
  { id: 25, title: "Анализ данных с помощью Power BI", description: "Научитесь визуализировать данные: дашборды, отчёты, DAX-формулы, интеграция с источниками данных и бизнес-аналитика.", image: "https://ui3adtb308.a.trbcdn.net/BpcZqiv.jpg", url: "https://stepik.org/a/271000", tag: "Data Science", tagColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", level: "Начинающий", levelColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", duration: "7 недель", rating: 4.6, isNew: true },
  { id: 26, title: "Использование нейросетей и N8N", description: "Автоматизируйте рутину: интеграция AI-моделей с N8N, создание workflows, промпт-инжиниринг и no-code автоматизация.", image: "https://ui3adtb308.a.trbcdn.net/BpcZnlp.jpg", url: "https://stepik.org/a/272000", tag: "AI / Автоматизация", tagColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", level: "Начинающий", levelColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", duration: "5 недель", rating: 4.8, isNew: true, isHot: true },
  { id: 27, title: "Курсы по кибербезопасности", description: "Погрузитесь в мир кибербезопасности: защита сетей, пентестинг, криптография, SIEM-системы и расследование инцидентов.", image: "https://ui3adtb308.a.trbcdn.net/BpcZoUN.jpg", url: "https://stepik.org/a/273000", tag: "Безопасность", tagColor: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", level: "Средний", levelColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", duration: "9 недель", rating: 4.7, isHot: true },
  { id: 28, title: "Курсы по тестированию ПО", description: "Станьте QA-инженером: ручное тестирование, автотесты, Selenium, API-тестирование, CI/CD для тестировщиков.", image: "https://ui3adtb308.a.trbcdn.net/BpcZzJI.jpg", url: "https://stepik.org/a/274000", tag: "Тестирование", tagColor: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300", level: "Начинающий", levelColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", duration: "8 недель", rating: 4.6, isNew: true },
  { id: 29, title: "Мастеринг звука", description: "Профессиональная обработка звука: эквализация, компрессия, реверберация, мультишейп, мастеринг для стримингов и CD.", image: "https://ui3adtb308.a.trbcdn.net/BpcZIRt.jpg", url: "https://stepik.org/a/275000", tag: "Медиа", tagColor: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300", level: "Средний", levelColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", duration: "6 недель", rating: 4.5 },
  { id: 30, title: "Язык программирования C#", description: "Изучите C# с нуля: ООП, LINQ, async/await, WPF, ASP.NET Core и создание кроссплатформенных приложений.", image: "https://ui3adtb308.a.trbcdn.net/BpcZ1JS.jpg", url: "https://stepik.org/a/276000", tag: "Программирование", tagColor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300", level: "Начинающий", levelColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", duration: "12 недель", rating: 4.7, isNew: true },
  { id: 31, title: "Саунд-дизайн и студийное качество", description: "Создавайте звуковые дизайны: синтез, сэмплирование, Foley, пространственный звук, аудио для игр и кино.", image: "https://ui3adtb308.a.trbcdn.net/BpcZc0l.jpg", url: "https://stepik.org/a/277000", tag: "Медиа", tagColor: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300", level: "Средний", levelColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", duration: "8 недель", rating: 4.6 },
  { id: 32, title: "Язык программирования GOlang", description: "Полный курс Go: горутины, каналы, интерфейсы, дженерики, создание микросервисов, gRPC и облако.", image: "https://ui3adtb308.a.trbcdn.net/BpcZE57.jpg", url: "https://stepik.org/a/278000", tag: "Backend", tagColor: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300", level: "Начинающий", levelColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", duration: "9 недель", rating: 4.8 },

  // === НОВЫЕ КУРСЫ С CDN ===
  { id: 33, title: "Написание научных статей v2", description: "Научитесь писать научные статьи: структура, методология, литературный обзор, оформление по ГОСТ, публикация в журналах и конференциях.", image: "https://ui3adtb308.a.trbcdn.net/BpcZTOX.jpg", url: "https://stepik.org/a/279000", tag: "Наука", tagColor: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300", level: "Средний", levelColor: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", duration: "6 недель", rating: 4.7, isNew: true },
  { id: 34, title: "Написание курсовых и дипломных работ", description: "Полное руководство по написанию курсовых и дипломных работ: от выбора темы до защиты. ГОСТ, антиплагиат, оформление, презентация.", image: "https://ui3adtb308.a.trbcdn.net/BpcZubn.jpg", url: "https://stepik.org/a/280000", tag: "Наука", tagColor: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300", level: "Начинающий", levelColor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", duration: "8 недель", rating: 4.8, isNew: true, isHot: true },
];

/* Компонент изображения: Next.js Image для локальных, обычный img для внешних */
function CourseImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const isExternal = src.startsWith("http");

  return (
    <div className="relative w-full h-full">
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 animate-pulse" />
      )}
      {isExternal ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${loaded ? "opacity-100" : "opacity-0"}`}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          crossOrigin="anonymous"
        />
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          className={`object-cover transition-all duration-500 group-hover:scale-110 ${loaded ? "opacity-100" : "opacity-0"}`}
          sizes="(max-width: 768px) 100vw, 400px"
          onLoad={() => setLoaded(true)}
        />
      )}
    </div>
  );
}

export function CoursePromoCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollPosition = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 5);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  }, []);

  const scroll = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = 340; // card width + gap
    const scrollAmount = direction === "left" ? -cardWidth : cardWidth;
    el.scrollBy({ left: scrollAmount, behavior: "smooth" });
    setTimeout(checkScrollPosition, 400);
  }, [checkScrollPosition]);

  // Auto-scroll
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 5) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        scroll("right");
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [isPaused, scroll]);

  // Check scroll on mount and resize
  useEffect(() => {
    checkScrollPosition();
    window.addEventListener("resize", checkScrollPosition);
    return () => window.removeEventListener("resize", checkScrollPosition);
  }, [checkScrollPosition]);

  return (
    <section className="py-12 md:py-16 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-500" />
            <h2 className="text-2xl md:text-3xl font-bold">
              Наши курсы на{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-violet-600 to-amber-500">
                Stepik
              </span>
            </h2>
            <Sparkles className="w-6 h-6 text-amber-500" />
          </div>
        </div>

        {/* Carousel Container */}
        <div
          className="relative group/carousel"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Left Gradient Fade */}
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-slate-50 dark:from-slate-900 to-transparent z-10 pointer-events-none" />

          {/* Right Gradient Fade */}
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white dark:from-slate-950 to-transparent z-10 pointer-events-none" />

          {/* Left Navigation Button */}
          {canScrollLeft && (
            <Button
              variant="outline"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-lg border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 w-10 h-10 rounded-full opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
              onClick={() => scroll("left")}
              aria-label="Прокрутить влево"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}

          {/* Right Navigation Button */}
          {canScrollRight && (
            <Button
              variant="outline"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm shadow-lg border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-700 w-10 h-10 rounded-full opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300"
              onClick={() => scroll("right")}
              aria-label="Прокрутить вправо"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          )}

          {/* Scrollable Track */}
          <div
            ref={scrollRef}
            onScroll={checkScrollPosition}
            className="flex gap-5 overflow-x-auto scrollbar-hide scroll-smooth px-6 py-2"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {promoCourses.map((course) => (
              <a
                key={course.id}
                href={course.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 w-[300px] sm:w-[320px]"
              >
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 overflow-hidden border border-slate-100 dark:border-slate-700 group h-full" data-cursor="card">
                  {/* Image */}
                  <div className="relative h-44 overflow-hidden">
                    <CourseImage src={course.image} alt={course.title} />
                    {/* Image overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                      <Badge className={`${course.tagColor} text-[10px] font-semibold px-2 py-0.5 border-0`}>
                        {course.tag}
                      </Badge>
                      {course.isNew && (
                        <Badge className="bg-emerald-500 text-white text-[10px] font-semibold px-2 py-0.5 border-0">
                          Новинка
                        </Badge>
                      )}
                      {course.isHot && (
                        <Badge className="bg-orange-500 text-white text-[10px] font-semibold px-2 py-0.5 border-0 flex items-center gap-0.5">
                          <Flame className="w-2.5 h-2.5" />
                          Хит
                        </Badge>
                      )}
                    </div>

                    {/* Level Badge */}
                    <Badge className={`absolute bottom-3 right-3 ${course.levelColor} text-[10px] font-semibold px-2 py-0.5 border-0`}>
                      {course.level}
                    </Badge>
                  </div>

                  {/* Content */}
                  <div className="p-4 flex flex-col gap-2">
                    {/* Rating & Duration */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="font-semibold text-foreground">{course.rating}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {course.duration}
                      </span>
                      <ExternalLink className="w-3 h-3 ml-auto text-slate-400 group-hover:text-blue-600 transition-colors" />
                    </div>

                    {/* Title */}
                    <h3 className="font-bold text-sm leading-tight line-clamp-2 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                      {course.title}
                    </h3>

                    {/* Description */}
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {course.description}
                    </p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Course Count Indicator */}
        <div className="text-center mt-6 flex items-center justify-center gap-2">
          <BookOpen className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {promoCourses.length} курсов доступно на платформе Stepik
          </p>
        </div>
      </div>
    </section>
  );
}
