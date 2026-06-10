<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.1.1-black?style=flat-square&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06b6d4?style=flat-square&logo=tailwindcss" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/License-CC_BY--SA_4.0-green?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/version-3.1.3-blueviolet?style=flat-square" alt="Version">
</p>

<h1 align="center">Maestria — LMS Platform</h1>

<p align="center">
  <strong>by Maestro7IT / MentorHUB</strong><br>
  A Stepik alternative with a modern interface, admin dashboard, and full i18n support
</p>

<p align="center">
  <a href="#english">English</a> · <a href="#русский">Русский</a> · <a href="#中文">中文</a>
</p>

---

<a id="english"></a>

## About

**Maestria** is a full-featured LMS (Learning Management System) platform built on Next.js 16 + React 19 + TypeScript + Tailwind CSS 4. The platform provides tools for creating and taking online courses, managing the educational process, tracking progress, and analytics.

The project was created by **Maestro7IT** under the direction of **Dupley Maxim Igorevich** and is designed for use in the Russian Federation with full compliance with RF legislation on education and personal data protection.

## Key Features

### For Students
- **34 courses** in programming, web development, Data Science, game dev, and more
- Step-by-step lesson viewer (Step Viewer)
- Tests and assignments with result tracking
- Learning progress and completion certificates
- Achievement system and notifications
- Favorite courses

### For Teachers
- Course creation and editing (Course Editor)
- Module and lesson management
- Student statistics
- Review moderation

### For Administrators
- **Secured admin panel** with password protection
- **9 sections**: Dashboard, Users, Tests, Materials, Finance, Courses, Reports, Logs, Settings
- **4 SVG chart types**: Line, Bar, Donut, Sparkline
- User management (roles, blocking, 2FA)
- Test completion and material reading statistics
- Financial analytics (revenue, categories, free/paid)
- Platform activity log
- Report management and moderation

### Platform Features
- **3 themes**: Light, Dark, Amber
- **3 languages**: Russian, English, Chinese
- **Custom cursor** (dot + outline with smooth follow, pointer:fine only)
- **GlobalScrollToTop** with SVG progress ring
- **10 legal pages** compliant with RF legislation
- **App Store / Google Play / RuStore** buttons in Footer
- CDN images via freeimage.host
- Responsive design (mobile, tablet, desktop)

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.1.1 | Framework (App Router, SSR, API Routes) |
| React | 19 | UI library |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 4 | Styling (oklch color space) |
| Zustand | 5.0.6 | State management |
| Prisma | latest | ORM (SQLite) |
| NextAuth.js | 4 | Authentication |
| shadcn/ui | 40+ components | UI primitives |
| Sonner | — | Toast notifications |
| Lucide React | — | Icons |

## Installation & Setup

### Prerequisites
- **Node.js** >= 18.17
- **npm** >= 9 or **bun** >= 1.0

### Installation

```bash
# Clone the repository
git clone https://github.com/Maestro7IT/Maestria.git
cd Maestria

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Start dev server
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

The SQLite database is created and seeded automatically on first run.

## Routing

The project uses **hash-based SPA routing** (`#home`, `#catalog`, `#admin`). All pages rendered through a single `page.tsx`.

| Route | Component | Description |
|---|---|---|
| `#home` | `HomePage` | Landing page |
| `#catalog` | `CatalogPage` | Course catalog |
| `#course/ID` | `CourseDetailPage` | Course page |
| `#course/ID/lesson/LESSON_ID` | `StepViewerPage` | Lesson viewer |
| `#profile` | `ProfilePage` | User profile |
| `#admin` | `AdminPage` | Admin dashboard |
| `#about` | `AboutPage` | About platform |
| `#achievements` | `AchievementsPage` | Achievements |
| `#notifications` | `NotificationsPage` | Notifications |
| `#certificate/ID` | `CertificatePage` | Certificate |
| `#course-editor` | `CourseEditorPage` | Course editor |
| `#terms` | `TermsPage` | Terms of Service |
| `#privacy` | `PrivacyPage` | Privacy Policy |
| `#personal-data` | `PersonalDataConsentPage` | Personal Data Consent |
| `#offer` | `OfferPage` | Public Offer |
| `#refund` | `RefundPage` | Refund Policy |
| `#edu-info` | `EduInfoPage` | Education Info |
| `#rules` | `RulesPage` | Platform Rules |
| `#license` | `LicensePage` | CC BY-SA 4.0 License |
| `#age-rating` | `AgeRatingPage` | Age Rating |
| `#cookies` | `CookiePage` | Cookie Policy |
| `#help` | `HelpPage` | Help |

## Admin Panel

Accessible via `#admin` route (admin role only).

**Login password**: `admin` or `Maestria2026`

### Sections:
1. **Dashboard** — KPI cards with sparklines, registration and enrollment charts, category distribution, recent activity, server status
2. **Users** — Search, role filter, avatar table, role/status management, growth and activity charts
3. **Tests** — Completion stats, pass rate, average score, per-course results, difficulty distribution
4. **Materials** — Reading sessions, average time, reading progress, engagement dynamics
5. **Finance** — 12-month revenue, category revenue, free vs paid
6. **Courses** — Full course table, top courses by enrollment
7. **Reports** — Report statuses, moderation
8. **Logs** — Typed activity log
9. **Settings** — Platform, system, danger zone

## Themes

Three themes with oklch colors and CSS custom properties:

| Theme | Class | Accent |
|---|---|---|
| Light | `:root` | Blue-violet `oklch(0.45 0.2 265)` |
| Dark | `.dark` | Bright violet `oklch(0.65 0.2 265)` |
| Amber | `.amber` | Warm gold `oklch(0.55 0.18 55)` |

Each theme includes separate CSS custom properties for the custom cursor.

## Internationalization

3 languages with full coverage (400+ keys each):

| Code | Language | Flag |
|---|---|---|
| `ru` | Русский | 🇷🇺 |
| `en` | English | 🇬🇧 |
| `zh` | 中文 | 🇨🇳 |

Translation file: [`src/lib/i18n.ts`](src/lib/i18n.ts)

## Project Structure

```
src/
├── app/
│   ├── globals.css           # Themes, cursor, prose styles
│   ├── layout.tsx            # Root layout + JSON-LD
│   ├── page.tsx              # SPA hash router
│   └── api/                  # API Routes
│       ├── admin/            # Admin API (courses, users)
│       ├── auth/             # NextAuth (2FA, register, forgot-password)
│       ├── courses/          # Courses (CRUD, reviews, enroll, lessons)
│       ├── payments/         # Payments
│       ├── achievements/     # Achievements
│       ├── seed/             # DB auto-seed
│       └── user/             # User data
├── components/
│   ├── AdminPage.tsx         # Admin panel (9 sections + SVG charts)
│   ├── Header.tsx            # Navigation + theme + language
│   ├── Footer.tsx            # Contacts + legal + store buttons
│   ├── HomePage.tsx          # Landing page
│   ├── CatalogPage.tsx       # Catalog with filters
│   ├── CourseDetailPage.tsx  # Course page
│   ├── StepViewerPage.tsx    # Lesson viewer
│   ├── ProfilePage.tsx       # Profile
│   ├── CourseEditorPage.tsx  # Course editor
│   ├── AuthDialogs.tsx       # Auth dialogs
│   ├── CustomCursor.tsx      # Custom cursor
│   ├── GlobalScrollToTop.tsx # Scroll-to-top + progress ring
│   ├── CoursePromoCarousel.tsx # Course carousel
│   ├── DocumentPageLayout.tsx # Legal page template
│   ├── AnimatedCounter.tsx   # Animated counter
│   ├── PageTransition.tsx    # Page transitions
│   ├── ErrorBoundary.tsx     # Error handling
│   ├── Providers.tsx         # React Query + providers
│   └── ui/                   # 40+ shadcn/ui components
├── lib/
│   ├── store.ts              # Zustand store
│   ├── i18n.ts               # Localization (ru/en/zh)
│   ├── auth.ts               # NextAuth config
│   ├── db.ts                 # Prisma client
│   └── utils.ts              # cn() utility
└── hooks/                    # Custom hooks
```

## Database

**SQLite** via Prisma ORM. 14 models:

`User` → `Account` / `Session` / `Enrollment` → `Progress` / `Review` / `Certificate` / `Payment`
`Course` → `Module` → `Lesson` → `Assignment`
`Category` → `Course`
`VerificationToken`

Schema file: [`prisma/schema.prisma`](prisma/schema.prisma)

The schema is automatically created and seeded with demo data on first run.

## Legal Compliance

All legal pages comply with Russian Federation legislation:

- Federal Law No. 152-FZ "On Personal Data"
- RF Law No. 2300-1 "On Consumer Rights Protection"
- Civil Code of RF (Art. 437 — Public Offer)
- Government Decree No. 1724 (Remote Sales)
- Roskomnadzor requirements for data storage in the RF

## Team

| Member | Role |
|---|---|
| **Dupley Maxim Igorevich** | Director, Fullstack Developer |
| **Maestro7IT** | Development Company |
| **MentorHUB** | Project Group |

## Contacts

- **Email**: maksimqwe42@mail.ru
- **Address**: Moscow, Russian Federation
- **VK**: Maestro7IT community
- **Rutube**: Maestro7IT channel

## License

User content is available under the **Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)** license.

Platform source code is the property of Maestro7IT.

---

## Performance & Optimization

### Image Optimization
- Automatic WebP/AVIF format conversion
- Responsive images with device size detection
- Lazy loading for all images
- CDN integration (freeimage.host, Cloudflare)

### Bundle Optimization
- SWC minification enabled
- Code splitting by route
- Tree-shaking and dead code elimination
- Console removal in production
- Optimized chunk splitting (polyfills, react, UI)

### Database Optimization
- Prisma query optimization
- Strategic indexes on frequently queried fields
- Connection pooling
- N+1 query prevention with `include`

### Caching
- Redis caching for API responses (with in-memory fallback)
- HTTP caching headers for static assets
- Stale-while-revalidate strategy
- Tag-based cache invalidation
- **Service Worker** for offline support and caching

### PWA (Progressive Web App)
- **Installable** on mobile devices
- **Offline mode** for cached content
- **Push notifications** support
- **App shortcuts** (Catalog, Profile)
- Custom app icons and theme colors

### SEO & Analytics
- **Dynamic sitemap.xml** with courses and articles
- **robots.txt** with crawl directives
- **Enhanced Open Graph** tags for social sharing
- **Twitter Cards** support
- **Schema.org** structured data (JSON-LD)
- **Breadcrumbs** navigation
- **Social media images** (og-image)
- Multi-language SEO (ru/en/zh)

### Security Headers
- Content Security Policy (CSP)
- HSTS in production
- X-Frame-Options, X-Content-Type-Options
- CSRF protection for state-changing requests
- Permissions-Policy restrictions

### Configuration
See [`next.config.ts`](next.config.ts) for detailed optimization settings.

---

## Documentation

- [English README](README_EN.md)
- [Russian README](README_RU.md)
- [Architecture](ARCHITECTURE.md)
- [API Documentation](API.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

<p align="center">
  <strong>Maestria v3.1.3</strong> · May 15, 2026 · Maestro7IT
</p>
