"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type UserRole = "admin" | "teacher" | "student";

export interface AdminCourse {
  id: string;
  title: string;
  isPublished: boolean;
  price: number;
  rating: number;
  teacher: { name: string | null } | null;
  category: { name: string } | null;
  _count: { enrollments: number; reviews: number; modules: number };
  createdAt?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  isActive: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  _count: { enrollments: number; teacherCourses: number; reviews: number };
}

export interface AdminStats {
  totalUsers: number;
  totalStudents: number;
  totalTeachers: number;
  totalAdmins: number;
  totalCourses: number;
  totalPublishedCourses: number;
  totalEnrollments: number;
  totalRevenue: number;
  totalPayments: number;
  activeToday: number;
  activeThisWeek: number;
  activeThisMonth: number;
  serverUptime: string;
  dbSize: string;
}

export function useAdminCourses() {
  return useQuery<{ courses: AdminCourse[] }>({
    queryKey: ["admin", "courses"],
    queryFn: async () => {
      const res = await fetch("/api/admin/courses?limit=50");
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: null }));
        throw new Error(error?.error || `Failed to fetch admin courses (${res.status})`);
      }
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useAdminUsers() {
  return useQuery<{ users: AdminUser[] }>({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users?limit=50");
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: null }));
        throw new Error(error?.error || `Failed to fetch admin users (${res.status})`);
      }
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useAdminStats() {
  return useQuery<AdminStats>({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: null }));
        throw new Error(error?.error || `Failed to fetch admin stats (${res.status})`);
      }
      return res.json();
    },
    staleTime: 15_000,
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update role");
      }
      return { userId, role };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export interface StudentStats {
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    role: string;
    bio: string | null;
    phone: string | null;
    isActive: boolean;
    twoFactorEnabled: boolean;
    createdAt: string;
    _count: {
      enrollments: number;
      reviews: number;
      certificates: number;
      progress: number;
    };
  };
  enrollments: Array<{
    id: string;
    status: string;
    progress: number;
    enrolledAt: string;
    completedAt: string | null;
    course: {
      id: string;
      title: string;
      image: string | null;
      level: string;
      category: { name: string } | null;
      teacher: { name: string | null } | null;
      _count: { modules: number };
    };
    totalLessons: number;
    completedLessons: number;
    totalTimeSpent: number;
    lastAccessed: string | null;
    avgScore: number | null;
    lessonCompletionRate: number;
  }>;
  reviews: Array<{
    id: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    course: { id: string; title: string };
  }>;
  certificates: Array<{
    id: string;
    certificateNumber: string;
    issuedAt: string;
    course: { id: string; title: string };
  }>;
  payments: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    paymentMethod: string;
    createdAt: string;
    course: { id: string; title: string };
  }>;
  stats: {
    totalCoursesEnrolled: number;
    completedCourses: number;
    inProgressCourses: number;
    notStartedCourses: number;
    totalLessonsCompleted: number;
    totalLessonsAvailable: number;
    totalTimeSpent: number;
    overallAvgScore: number;
    recentProgress: number;
    avgProgress: number;
  };
}

export function useStudentStats(userId: string) {
  return useQuery<StudentStats>({
    queryKey: ["admin", "student-stats", userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/student-stats?userId=${userId}`);
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: null }));
        throw new Error(error?.error || `Failed to fetch student stats (${res.status})`);
      }
      return res.json();
    },
    enabled: !!userId,
    staleTime: 10_000,
  });
}

export function useToggleUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, isActive }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update status");
      }
      return { userId, isActive };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}
