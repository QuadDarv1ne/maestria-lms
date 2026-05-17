import { useQuery } from "@tanstack/react-query";

interface CourseCard {
  id: string;
  title: string;
  slug: string;
  shortDesc: string | null;
  image: string | null;
  price: number;
  oldPrice: number | null;
  level: string;
  duration: string | null;
  isFeatured: boolean;
  rating: number;
  studentCount: number;
  totalLessons: number;
  totalDuration: number;
  teacher: { id: string; name: string | null; image: string | null };
  category: { id: string; name: string; slug: string; icon: string | null; color: string | null };
}

interface CoursesResponse {
  courses: CourseCard[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
}

export function useCourses(filters?: {
  category?: string;
  search?: string;
  level?: string;
  sortBy?: string;
  freeOnly?: boolean;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.limit) params.set("limit", String(filters.limit));
  if (filters?.category) params.set("category", filters.category);
  if (filters?.search) params.set("search", filters.search);
  if (filters?.level) params.set("level", filters.level);
  if (filters?.sortBy) params.set("sortBy", filters.sortBy);
  if (filters?.freeOnly) params.set("freeOnly", "true");

  const qs = params.toString();

  return useQuery<CoursesResponse>({
    queryKey: ["courses", qs],
    queryFn: async () => {
      const res = await fetch(`/api/courses${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch courses");
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useCourse(id: string | undefined) {
  return useQuery<{ course: unknown }>({
    queryKey: ["course", id],
    queryFn: async () => {
      const res = await fetch(`/api/courses/${id}`);
      if (!res.ok) throw new Error("Failed to fetch course");
      return res.json();
    },
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useCourseReviews(courseId: string | undefined, page = 1) {
  return useQuery<{ reviews: unknown[]; pagination: { page: number; total: number; totalPages: number } }>({
    queryKey: ["course-reviews", courseId, page],
    queryFn: async () => {
      const res = await fetch(`/api/courses/${courseId}/reviews?page=${page}&limit=10`);
      if (!res.ok) throw new Error("Failed to fetch reviews");
      return res.json();
    },
    enabled: !!courseId,
    staleTime: 30_000,
  });
}
