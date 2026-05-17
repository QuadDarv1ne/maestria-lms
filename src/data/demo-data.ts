export interface ReportItem {
  id: string;
  type: "content" | "user" | "bug" | "other";
  status: "pending" | "reviewed" | "resolved";
  userName: string;
  description: string;
  createdAt: string;
}

export interface ActivityLogItem {
  id: string;
  type: "user_register" | "course_create" | "course_publish" | "enrollment" | "payment" | "report" | "settings_change";
  description: string;
  userName: string;
  timestamp: string;
}

export interface CategoryDistribution {
  label: string;
  value: number;
  color: string;
}

export interface TestResult {
  course: string;
  passRate: number;
  avgScore: number;
  attempts: number;
  completions: number;
}

export interface MaterialProgress {
  course: string;
  readPercent: number;
  avgTime: string;
  totalReaders: number;
  completed: number;
}

export const demoReports: ReportItem[] = [
  { id: "r1", type: "content", status: "pending", userName: "Иван П.", description: "Некорректный код в уроке 5 курса Python", createdAt: "2026-05-15" },
  { id: "r2", type: "user", status: "pending", userName: "Анна К.", description: "Нарушение правил в комментариях курса Веб-разработка", createdAt: "2026-05-14" },
  { id: "r3", type: "bug", status: "reviewed", userName: "Пётр С.", description: "Не загружается видео в уроке 3 курса Data Science", createdAt: "2026-05-13" },
  { id: "r4", type: "content", status: "resolved", userName: "Мария Л.", description: "Устаревшая информация в курсе C++", createdAt: "2026-05-10" },
  { id: "r5", type: "bug", status: "pending", userName: "Дмитрий В.", description: "Ошибка расчёта прогресса в курсе Алгоритмы", createdAt: "2026-05-09" },
];

export const demoActivityLog: ActivityLogItem[] = [
  { id: "al1", type: "user_register", description: "Зарегистрирован новый пользователь", userName: "Алексей М.", timestamp: "5 мин назад" },
  { id: "al2", type: "enrollment", description: "Запись на курс «Python для начинающих»", userName: "Екатерина С.", timestamp: "12 мин назад" },
  { id: "al3", type: "payment", description: "Оплата курса «Веб-разработка» — 1 799 ₽", userName: "Дмитрий К.", timestamp: "28 мин назад" },
  { id: "al4", type: "course_create", description: "Создан новый курс «Алгоритмы и структуры данных»", userName: "Дуплей М.И.", timestamp: "1 час назад" },
  { id: "al5", type: "course_publish", description: "Курс «Linux Admin» опубликован", userName: "Дуплей М.И.", timestamp: "2 часа назад" },
  { id: "al6", type: "report", description: "Новая жалоба на контент курса Data Science", userName: "Иван П.", timestamp: "3 часа назад" },
  { id: "al7", type: "user_register", description: "Зарегистрирован новый пользователь", userName: "Ольга Н.", timestamp: "4 часа назад" },
  { id: "al8", type: "enrollment", description: "Запись на курс «SQL Mastery»", userName: "Сергей В.", timestamp: "5 часов назад" },
  { id: "al9", type: "payment", description: "Оплата курса «React App» — 1 699 ₽", userName: "Наталья Р.", timestamp: "6 часов назад" },
  { id: "al10", type: "settings_change", description: "Обновлены правила платформы", userName: "Дуплей М.И.", timestamp: "1 день назад" },
  { id: "al11", type: "enrollment", description: "Запись на курс «Machine Learning»", userName: "Виктор Б.", timestamp: "1 день назад" },
  { id: "al12", type: "payment", description: "Оплата курса «Python Pro» — 2 499 ₽", userName: "Алина Т.", timestamp: "1 день назад" },
];

export const monthLabels = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
export const demoMonthlyRegistrations = [45, 62, 78, 95, 110, 128, 142, 155, 168, 185, 203, 218];
export const demoMonthlyRevenue = [32000, 45000, 58000, 72000, 85000, 98000, 112000, 125000, 138000, 152000, 168000, 185000];
export const demoMonthlyEnrollments = [120, 165, 210, 255, 298, 340, 385, 420, 460, 510, 565, 620];

export const dayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
export const demoTestCompletions = [42, 58, 35, 67, 52, 28, 31];
export const demoTestPassRate = [78, 82, 75, 88, 85, 72, 80];

export const demoReadingSessions = [156, 198, 142, 225, 188, 95, 72];
export const demoAvgReadingTime = [24, 28, 22, 32, 27, 18, 15];

export const demoCategoryDistribution: CategoryDistribution[] = [
  { label: "Программирование", value: 35, color: "#4f46e5" },
  { label: "Веб-разработка", value: 25, color: "#7c3aed" },
  { label: "Data Science", value: 18, color: "#f59e0b" },
  { label: "Игры", value: 12, color: "#10b981" },
  { label: "Другое", value: 10, color: "#6b7280" },
];

export const demoTestResults: TestResult[] = [
  { course: "Python для начинающих", passRate: 87, avgScore: 78, attempts: 342, completions: 298 },
  { course: "Веб-разработка", passRate: 72, avgScore: 65, attempts: 256, completions: 184 },
  { course: "Data Science", passRate: 65, avgScore: 58, attempts: 198, completions: 129 },
  { course: "React App", passRate: 80, avgScore: 72, attempts: 178, completions: 142 },
  { course: "SQL Mastery", passRate: 76, avgScore: 68, attempts: 156, completions: 119 },
  { course: "Алгоритмы", passRate: 58, avgScore: 52, attempts: 289, completions: 168 },
  { course: "Linux Admin", passRate: 82, avgScore: 74, attempts: 134, completions: 110 },
  { course: "Machine Learning", passRate: 55, avgScore: 48, attempts: 167, completions: 92 },
];

export const demoMaterialProgress: MaterialProgress[] = [
  { course: "Python для начинающих", readPercent: 78, avgTime: "32 мин", totalReaders: 267, completed: 208 },
  { course: "Веб-разработка", readPercent: 65, avgTime: "45 мин", totalReaders: 198, completed: 129 },
  { course: "Data Science", readPercent: 52, avgTime: "55 мин", totalReaders: 156, completed: 81 },
  { course: "React App", readPercent: 71, avgTime: "38 мин", totalReaders: 142, completed: 101 },
  { course: "SQL Mastery", readPercent: 68, avgTime: "28 мин", totalReaders: 118, completed: 80 },
  { course: "Алгоритмы", readPercent: 45, avgTime: "62 мин", totalReaders: 189, completed: 85 },
  { course: "Linux Admin", readPercent: 73, avgTime: "35 мин", totalReaders: 98, completed: 72 },
  { course: "Machine Learning", readPercent: 41, avgTime: "68 мин", totalReaders: 134, completed: 55 },
];
