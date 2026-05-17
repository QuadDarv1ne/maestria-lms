# TODO: Локализация Maestria LMS

## Статус: Выполнено

### Темы оформления
- [x] Fix theme switching — CSS класс применяется к document.documentElement
- [x] `<html lang>` динамический на основе выбранного языка
- [x] next-themes в sonner.tsx заменён на Zustand store

### Локализация компонентов
- [x] Header, Footer, ProfilePage
- [x] Providers, sonner
- [x] HomePage, AboutPage, HelpPage, ErrorBoundary
- [x] AuthDialogs (вход/регистрация/восстановление пароля)
- [x] NotificationsPage, AchievementsPage, ReviewForm
- [x] CertificatePage, CoursePromoCarousel, GlobalScrollToTop
- [x] CourseDetailPage, CourseCard, AnimatedCounter
- [x] CatalogPage, StepViewerPage
- [x] Student detail page (admin/student/[id]/page.tsx)

### Locale файлы
- [x] ~650+ ключей в ru.json, en.json, zh.json

---

## Осталось сделать

### Локализация компонентов
- [ ] LessonPage — страница урока (захардкожены: типы шагов, toast, кнопки, лейблы)
- [ ] CourseEditorPage — редактор курсов (очень большой, ~100+ строк: формы, табы, toast, превью)
- [ ] AdminPage — админ-панель (огромный файл, ~200+ строк: дашборд, пользователи, тесты, материалы, финансы, курсы, жалобы, логи, настройки)
- [ ] TermsPage — пользовательское соглашение (большой текстовый контент)
- [ ] PrivacyPage — политика конфиденциальности (большой текстовый контент)
- [ ] Остальные legal pages: offer, refund, license, rules, edu-info, cookies, age-rating, personal-data

### Форматирование дат и чисел
- [ ] Заменить `toLocaleDateString("ru-RU")` на locale-aware во всех компонентах
  - AdminPage (строки 876, 1186, 1189, 1248, 1328)
  - CertificatePage (строка 34)
  - CourseDetailPage (строка 747)
  - ProfilePage (строки 374, 799, 932)
  - Student detail page (строки 151, 333, 385, 425, 464, 486)
- [ ] Создать утилиту `formatDate(date, locale)` для единого форматирования
- [ ] Создать утилиту `formatNumber(value, locale)` для единого форматирования чисел/цен

### API ответы
- [ ] API route файлы с русскими error messages (~18 файлов в src/app/api/)
  - Это серверные ответы, можно оставить на потом или перевести на английский

### Демо-данные
- [ ] src/data/demo-data.ts — захардкоженные русские названия, описания курсов, метки месяцев/дней
  - Это демо-данные, можно оставить как есть или сделать locale-aware

### Прочее
- [ ] layout.tsx — SEO мета-теги на русском (title, description, keywords, JSON-LD)
  - Можно сделать динамическими на основе locale
- [ ] Курсор (globals.css) — комментарии на русском (не критично)
- [ ] Комментарии в коде на русском (не критично)
