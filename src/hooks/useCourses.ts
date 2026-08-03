"use client";

import { useQuery } from "@tanstack/react-query";

async function fetchJson<T>(url: string, signal?: AbortSignal, timeoutMs = 30_000): Promise<T> {
  // AbortController with a timeout as a safety net — prevents requests
  // from hanging indefinitely if the server is slow.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: signal || controller.signal });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: null }));
      throw new Error(error?.error || `Failed to fetch (${res.status})`);
    }
    return res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

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
  teacher: { id: string; name: string | null; image: string | null } | null;
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
    queryFn: ({ signal }) => fetchJson<CoursesResponse>(`/api/courses${qs ? `?${qs}` : ""}`, signal),
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });
}

export interface CourseDetail {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  shortDesc: string | null;
  image: string | null;
  price: number;
  oldPrice: number | null;
  currency: string;
  level: string;
  duration: string | null;
  language: string;
  isPublished: boolean;
  isFeatured: boolean;
  hasCertificate: boolean;
  rating: number;
  reviewCount: number;
  studentCount: number;
  tags: string | null;
  requirements: string | null;
  whatYouLearn: string | null;
  totalLessons: number;
  totalDuration: number;
  freeLessons: number;
  isEnrolled: boolean;
  teacher: {
    id: string;
    name: string | null;
    image: string | null;
    bio: string | null;
  } | null;
  category: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    color: string | null;
  } | null;
  modules: Array<{
    id: string;
    title: string;
    sortOrder: number;
    lessons: Array<{
      id: string;
      title: string;
      type: string;
      duration: number;
      isFree: boolean;
      sortOrder: number;
      completed: boolean;
    }>;
  }>;
}

export function useCourse(id: string | undefined) {
  return useQuery<{ course: CourseDetail }>({
    queryKey: ["course", id],
    queryFn: ({ signal }) => fetchJson<{ course: CourseDetail }>(`/api/courses/${id}`, signal),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  courseId: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

export interface ReviewsResponse {
  reviews: Review[];
  distribution?: Record<number, number>;
  pagination: { page: number; total: number; totalPages: number };
}

export function useCourseReviews(courseId: string | undefined, page = 1, limit = 10) {
  return useQuery<ReviewsResponse>({
    queryKey: ["course-reviews", courseId, page, limit],
    queryFn: ({ signal }) =>
      fetchJson<ReviewsResponse>(
        `/api/courses/${courseId}/reviews?page=${page}&limit=${limit}`,
        signal,
      ),
    enabled: !!courseId,
    staleTime: 30_000,
  });
}
