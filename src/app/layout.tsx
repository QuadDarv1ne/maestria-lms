import { cookies } from "next/headers";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/Providers";
import { log } from "@/lib/logger";
import { env } from "@/lib/env";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = env.siteUrl;

const SUPPORTED_LOCALES = ["ru", "en", "zh"] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const LOCALE_MAP: Record<string, string> = {
  ru: "ru_RU",
  en: "en_US",
  zh: "zh_CN",
};

async function getLocaleFromCookie(): Promise<SupportedLocale> {
  try {
    const cookieStore = await cookies();
    const locale = cookieStore.get("maestria-locale")?.value;
    if (locale && SUPPORTED_LOCALES.includes(locale as SupportedLocale)) {
      return locale as SupportedLocale;
    }
  } catch (error) {
    log.debug("Locale cookie read failed during static generation", { error: error instanceof Error ? error.message : String(error) });
  }
  return "ru";
}

function buildJsonLd(locale: SupportedLocale) {
  const descriptions: Record<SupportedLocale, string> = {
    ru: "Интерактивные курсы по программированию, веб-разработке, созданию игр и Data Science.",
    en: "Interactive courses in programming, web development, game creation, and Data Science.",
    zh: "编程、网页开发、游戏制作和数据科学的互动课程。",
  };

  return {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: "Maestria",
    alternateName: "Maestria by Maestro7IT",
    url: siteUrl,
    logo: `${siteUrl}/maestro7it-logo.png`,
    description: descriptions[locale],
    address: {
      "@type": "PostalAddress",
      addressLocality: "Москва",
      addressCountry: "RU",
    },
    foundingDate: "2024",
    sameAs: [],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: locale === "ru" ? "Курсы программирования" : locale === "zh" ? "编程课程" : "Programming Courses",
      numberOfItems: 34,
      itemListElement: [
        {
          "@type": "Course",
          name: locale === "ru" ? "Программирование на Python" : locale === "zh" ? "Python 编程" : "Python Programming",
          description: locale === "ru" ? "Освойте Python с нуля до профессионала" : locale === "zh" ? "从零到专业掌握 Python" : "Learn Python from zero to professional",
          provider: { "@type": "Organization", name: "Maestria" },
        },
        {
          "@type": "Course",
          name: locale === "ru" ? "Веб-разработка" : locale === "zh" ? "网页开发" : "Web Development",
          description: locale === "ru" ? "HTML, CSS, JavaScript и современные фреймворки" : locale === "zh" ? "HTML, CSS, JavaScript 和现代框架" : "HTML, CSS, JavaScript and modern frameworks",
          provider: { "@type": "Organization", name: "Maestria" },
        },
        {
          "@type": "Course",
          name: locale === "ru" ? "Создание игр в Roblox" : locale === "zh" ? "Roblox 游戏开发" : "Roblox Game Development",
          description: locale === "ru" ? "Roblox Studio и программирование на Lua" : locale === "zh" ? "Roblox Studio 和 Lua 编程" : "Roblox Studio and Lua programming",
          provider: { "@type": "Organization", name: "Maestria" },
        },
      ],
    },
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocaleFromCookie();
  const localeTag = LOCALE_MAP[locale] ?? "ru_RU";

  const titles: Record<SupportedLocale, string> = {
    ru: "Maestria — Обучающая платформа программирования",
    en: "Maestria — Interactive Programming Learning Platform",
    zh: "Maestria — 互动编程学习平台",
  };

  const descriptions: Record<SupportedLocale, string> = {
    ru: "Интерактивные курсы по программированию, веб-разработке, созданию игр в Roblox, Data Science. Учитесь в своём темпе с лучшими преподавателями.",
    en: "Interactive courses in programming, web development, Roblox game creation, Data Science. Learn at your own pace with the best instructors.",
    zh: "编程、网页开发、Roblox 游戏制作、数据科学的互动课程。以你自己的节奏向最优秀的导师学习。",
  };

  return {
    metadataBase: new URL(siteUrl),
    title: titles[locale],
    description: descriptions[locale],
    alternates: {
      canonical: siteUrl,
      languages: {
        ru: `${siteUrl}/ru`,
        en: `${siteUrl}/en`,
        zh: `${siteUrl}/zh`,
      },
    },
    keywords: [
      "Maestria",
      "Maestro7IT",
      "MentorHUB",
      "programming",
      "courses",
      "Python",
      "web development",
      "Roblox",
      "Data Science",
      "learning",
      "online courses",
      "JavaScript",
      "Docker",
      "Go",
      "C++",
      "C#",
      "Java",
      "SQL",
      "cybersecurity",
      "software testing",
    ],
    authors: [{ name: "Maestro7IT", url: "https://maestro7it.com" }],
    creator: "Maestro7IT",
    publisher: "Maestro7IT",
    icons: {
      icon: "/maestro7it-logo.png",
    },
    openGraph: {
      title: titles[locale],
      description: descriptions[locale],
      siteName: "Maestria",
      type: "website",
      locale: localeTag,
      images: [
        {
          url: "/maestro7it-logo.png",
          width: 512,
          height: 512,
          alt: "Maestria — Learning Platform",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: titles[locale],
      description:
        locale === "ru"
          ? "Интерактивные курсы по программированию с нуля до профи. 34+ курсов, 12 000+ студентов."
          : locale === "zh"
            ? "从零到专业的互动编程课程。34+ 门课程，12,000+ 名学生。"
            : "Interactive programming courses from zero to pro. 34+ courses, 12,000+ students.",
      images: ["/maestro7it-logo.png"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const locale = await getLocaleFromCookie();
  const jsonLd = buildJsonLd(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* JSON-LD для поисковых систем */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Theme color для мобильных браузеров */}
        <meta name="theme-color" content="#1e40af" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          {children}
          <Toaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  );
}
