import { useQuery } from "@tanstack/react-query";

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  bio: string | null;
  phone: string | null;
  twoFactorEnabled: boolean;
  createdAt: string;
  _count: { enrollments: number; reviews: number; certificates: number; teacherCourses: number };
}

interface Enrollment {
  id: string;
  status: string;
  progress: number;
  enrolledAt: string;
  course: { id: string; title: string; image: string | null; level: string };
}

interface Certificate {
  id: string;
  issuedAt: string;
  course: { id: string; title: string };
}

interface UserResponse {
  user: UserProfile;
  enrollments: Enrollment[];
  certificates: Certificate[];
}

export function useProfile() {
  return useQuery<UserResponse>({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/user");
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    staleTime: 30_000,
  });
}
