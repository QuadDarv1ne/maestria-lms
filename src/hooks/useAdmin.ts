import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface AdminCourse {
  id: string;
  title: string;
  isPublished: boolean;
  price: number;
  rating: number;
  teacher: { name: string | null };
  category: { name: string } | null;
  _count: { enrollments: number; reviews: number; modules: number };
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
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
  activeToday: number;
  serverUptime: string;
  dbSize: string;
}

export function useAdminCourses() {
  return useQuery<{ courses: AdminCourse[] }>({
    queryKey: ["admin", "courses"],
    queryFn: async () => {
      const res = await fetch("/api/admin/courses?limit=50");
      if (!res.ok) throw new Error("Failed to fetch admin courses");
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
      if (!res.ok) throw new Error("Failed to fetch admin users");
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
      if (!res.ok) throw new Error("Failed to fetch admin stats");
      return res.json();
    },
    staleTime: 15_000,
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
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
