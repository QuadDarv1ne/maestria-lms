import type { ReportItem } from "@/data/demo-data";
import type { Locale } from "@/lib/stores/ui";
import type { UserRole, AdminCourse, AdminUser } from "@/hooks/useAdmin";

export interface AdminTabProps {
  locale: Locale;
  courses: AdminCourse[];
  users: AdminUser[];
  monthLabels: string[];
  dayLabels: string[];
  totalStudents: number;
  totalTeachers: number;
  totalEnrollments: number;
  avgRating: string;
  totalRevenue: number;
  pendingReports: number;
  activeUsers: number;
  userSearch: string;
  userRoleFilter: string;
  userPage: number;
  userPageSize: number;
  filteredUsers: AdminUser[];
  totalUserPages: number;
  paginatedUsers: AdminUser[];
  reports: ReportItem[];
  handleUserSearch: (value: string) => void;
  handleRoleFilter: (value: string) => void;
  handleUserRoleChange: (userId: string, role: UserRole) => Promise<void>;
  handleUserStatusChange: (userId: string, isActive: boolean) => Promise<void>;
  setUserPage: (fn: (p: number) => number) => void;
}
