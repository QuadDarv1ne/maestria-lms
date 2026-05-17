import { useQuery } from "@tanstack/react-query";

interface AdminCourse {
  id: string;
  title: string;
  isPublished: boolean;
  price: number;
  rating: number;
  teacher: { name: string | null };
  category: { name: string } | null;
  _count: { enrollments: number; reviews: number; modules: number };
}

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  _count: { enrollments: number; teacherCourses: number; reviews: number };
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
