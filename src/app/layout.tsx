import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://maestria.edu"),
  title: "Maestria — Обучающая платформа программирования",
  description:
    "Интерактивные курсы по программированию, веб-разработке, созданию игр в Roblox, Data Science. Учитесь в своём темпе с лучшими преподавателями.",
  keywords: [
    "Maestria",
    "Maestro7IT",
    "MentorHUB",
    "программирование",
    "курсы",
    "Python",
    "веб-разработка",
    "Roblox",
    "Data Science",
    "обучение",
    "онлайн-курсы",
    "JavaScript",
    "Docker",
    "Go",
    "C++",
    "C#",
    "Java",
    "SQL",
    "кибербезопасность",
    "тестирование ПО",
  ],
  authors: [{ name: "Maestro7IT", url: "https://maestro7it.com" }],
  creator: "Maestro7IT",
  publisher: "Maestro7IT",
  icons: {
    icon: "/maestro7it-logo.png",
  },
  openGraph: {
    title: "Maestria — Обучающая платформа программирования",
    description:
      "Научись программировать с нуля до профи. Интерактивные курсы по Python, веб-разработке, Roblox и Data Science.",
    siteName: "Maestria",
    type: "website",
    locale: "ru_RU",
    images: [
      {
        url: "/maestro7it-logo.png",
        width: 512,
        height: 512,
        alt: "Maestria — Обучающая платформа",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Maestria — Обучающая платформа программирования",
    description:
      "Интерактивные курсы по программированию с нуля до профи. 34+ курсов, 12 000+ студентов.",
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

// JSON-LD структурированные данные для SEO
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  name: "Maestria",
  alternateName: "Maestria by Maestro7IT",
  url: "https://maestria.edu",
  logo: "https://maestria.edu/maestro7it-logo.png",
  description:
    "Интерактивные курсы по программированию, веб-разработке, созданию игр и Data Science.",
  email: "maksimqwe42@mail.ru",
  telephone: "+7-915-048-02-49",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Москва",
    addressCountry: "RU",
  },
  foundingDate: "2024",
  founder: {
    "@type": "Person",
    name: "Дуплей Максим Игоревич",
    jobTitle: "Основатель и руководитель",
    worksFor: {
      "@type": "Organization",
      name: "Maestro7IT",
    },
  },
  sameAs: [],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Курсы программирования",
    numberOfItems: 34,
    itemListElement: [
      {
        "@type": "Course",
        name: "Программирование на Python",
        description: "Освойте Python с нуля до профессионала",
        provider: { "@type": "Organization", name: "Maestria" },
      },
      {
        "@type": "Course",
        name: "Веб-разработка",
        description: "HTML, CSS, JavaScript и современные фреймворки",
        provider: { "@type": "Organization", name: "Maestria" },
      },
      {
        "@type": "Course",
        name: "Создание игр в Roblox",
        description: "Roblox Studio и программирование на Lua",
        provider: { "@type": "Organization", name: "Maestria" },
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
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
