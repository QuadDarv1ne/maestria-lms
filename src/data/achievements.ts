import { Footprints, BookOpen, GraduationCap, Zap, Play, TrendingUp, Trophy, Flame, UserPlus, MessageSquare, Code2, Terminal, Star, Crown, Award, Target, Sparkles } from "lucide-react";

export interface AchievementData {
  completedCodingAssignments: number;
  completedLessonsCount: number;
  totalUsers: number;
  userRegistrationOrder: number;
}

export type AchievementStatus = "earned" | "in_progress" | "locked";

export interface Achievement {
  id: string;
  titleKey: string;
  descriptionKey: string;
  icon: React.ElementType;
  color: string;
  colorBg: string;
  colorBorder: string;
  colorText: string;
  category: string;
  categoryLabelKey: string;
  check: (data: AchievementCheckData) => {
    status: AchievementStatus;
    current: number;
    target: number;
  };
}

export interface AchievementCheckData {
  enrollmentsCount: number;
  uniqueCategories: number;
  completedLessonsCount: number;
  has50Progress: boolean;
  completedCoursesCount: number;
  reviewsCount: number;
  codingAssignments: number;
  userRegistrationOrder: number;
  totalUsers: number;
  isTeacherOrAdmin: boolean;
  isRegistered: boolean;
  anyProgress: boolean;
}

export function getAchievements(): Achievement[] {
  return [
    // Learning
    {
      id: "first-step",
      titleKey: "achievements.ach.firstStep.title",
      descriptionKey: "achievements.ach.firstStep.desc",
      icon: Footprints,
      color: "blue",
      colorBg: "bg-blue-100",
      colorBorder: "border-blue-400",
      colorText: "text-blue-700",
      category: "learning",
      categoryLabelKey: "achievements.cat.learning",
      check: (d) => ({
        status: d.enrollmentsCount >= 1 ? "earned" : "locked",
        current: Math.min(d.enrollmentsCount, 1),
        target: 1,
      }),
    },
    {
      id: "student",
      titleKey: "achievements.ach.student.title",
      descriptionKey: "achievements.ach.student.desc",
      icon: BookOpen,
      color: "violet",
      colorBg: "bg-violet-100",
      colorBorder: "border-violet-400",
      colorText: "text-violet-700",
      category: "learning",
      categoryLabelKey: "achievements.cat.learning",
      check: (d) => ({
        status:
          d.enrollmentsCount >= 3
            ? "earned"
            : d.enrollmentsCount >= 1
              ? "in_progress"
              : "locked",
        current: Math.min(d.enrollmentsCount, 3),
        target: 3,
      }),
    },
    {
      id: "excellent",
      titleKey: "achievements.ach.excellent.title",
      descriptionKey: "achievements.ach.excellent.desc",
      icon: GraduationCap,
      color: "amber",
      colorBg: "bg-amber-100",
      colorBorder: "border-amber-400",
      colorText: "text-amber-700",
      category: "learning",
      categoryLabelKey: "achievements.cat.learning",
      check: (d) => ({
        status:
          d.enrollmentsCount >= 5
            ? "earned"
            : d.enrollmentsCount >= 1
              ? "in_progress"
              : "locked",
        current: Math.min(d.enrollmentsCount, 5),
        target: 5,
      }),
    },
    {
      id: "multitalented",
      titleKey: "achievements.ach.multitalented.title",
      descriptionKey: "achievements.ach.multitalented.desc",
      icon: Zap,
      color: "orange",
      colorBg: "bg-orange-100",
      colorBorder: "border-orange-400",
      colorText: "text-orange-700",
      category: "learning",
      categoryLabelKey: "achievements.cat.learning",
      check: (d) => ({
        status:
          d.uniqueCategories >= 3
            ? "earned"
            : d.uniqueCategories >= 1
              ? "in_progress"
              : "locked",
        current: Math.min(d.uniqueCategories, 3),
        target: 3,
      }),
    },
    // Progress
    {
      id: "start",
      titleKey: "achievements.ach.start.title",
      descriptionKey: "achievements.ach.start.desc",
      icon: Play,
      color: "blue",
      colorBg: "bg-blue-100",
      colorBorder: "border-blue-400",
      colorText: "text-blue-700",
      category: "progress",
      categoryLabelKey: "achievements.cat.progress",
      check: (d) => ({
        status:
          d.completedLessonsCount >= 1
            ? "earned"
            : d.anyProgress
              ? "in_progress"
              : "locked",
        current: Math.min(d.completedLessonsCount, 1),
        target: 1,
      }),
    },
    {
      id: "halfway",
      titleKey: "achievements.ach.halfway.title",
      descriptionKey: "achievements.ach.halfway.desc",
      icon: TrendingUp,
      color: "violet",
      colorBg: "bg-violet-100",
      colorBorder: "border-violet-400",
      colorText: "text-violet-700",
      category: "progress",
      categoryLabelKey: "achievements.cat.progress",
      check: (d) => ({
        status: d.has50Progress ? "earned" : d.anyProgress ? "in_progress" : "locked",
        current: d.has50Progress ? 1 : d.anyProgress ? 0 : 0,
        target: 1,
      }),
    },
    {
      id: "finish-line",
      titleKey: "achievements.ach.finishLine.title",
      descriptionKey: "achievements.ach.finishLine.desc",
      icon: Trophy,
      color: "amber",
      colorBg: "bg-amber-100",
      colorBorder: "border-amber-400",
      colorText: "text-amber-700",
      category: "progress",
      categoryLabelKey: "achievements.cat.progress",
      check: (d) => ({
        status:
          d.completedCoursesCount >= 1
            ? "earned"
            : d.anyProgress
              ? "in_progress"
              : "locked",
        current: Math.min(d.completedCoursesCount, 1),
        target: 1,
      }),
    },
    {
      id: "marathoner",
      titleKey: "achievements.ach.marathoner.title",
      descriptionKey: "achievements.ach.marathoner.desc",
      icon: Flame,
      color: "orange",
      colorBg: "bg-orange-100",
      colorBorder: "border-orange-400",
      colorText: "text-orange-700",
      category: "progress",
      categoryLabelKey: "achievements.cat.progress",
      check: (d) => ({
        status:
          d.completedCoursesCount >= 3
            ? "earned"
            : d.completedCoursesCount >= 1
              ? "in_progress"
              : "locked",
        current: Math.min(d.completedCoursesCount, 3),
        target: 3,
      }),
    },
    // Social
    {
      id: "networker",
      titleKey: "achievements.ach.networker.title",
      descriptionKey: "achievements.ach.networker.desc",
      icon: UserPlus,
      color: "green",
      colorBg: "bg-green-100",
      colorBorder: "border-green-400",
      colorText: "text-green-700",
      category: "social",
      categoryLabelKey: "achievements.cat.social",
      check: (d) => ({
        status: d.totalUsers > 1 ? "earned" : "locked",
        current: d.totalUsers > 1 ? 1 : 0,
        target: 1,
      }),
    },
    {
      id: "mentor",
      titleKey: "achievements.ach.mentor.title",
      descriptionKey: "achievements.ach.mentor.desc",
      icon: MessageSquare,
      color: "teal",
      colorBg: "bg-teal-100",
      colorBorder: "border-teal-400",
      colorText: "text-teal-700",
      category: "social",
      categoryLabelKey: "achievements.cat.social",
      check: (d) => ({
        status:
          d.reviewsCount >= 5
            ? "earned"
            : d.reviewsCount >= 1
              ? "in_progress"
              : "locked",
        current: Math.min(d.reviewsCount, 5),
        target: 5,
      }),
    },
    // Coding
    {
      id: "coder",
      titleKey: "achievements.ach.coder.title",
      descriptionKey: "achievements.ach.coder.desc",
      icon: Code2,
      color: "blue",
      colorBg: "bg-blue-100",
      colorBorder: "border-blue-400",
      colorText: "text-blue-700",
      category: "coding",
      categoryLabelKey: "achievements.cat.coding",
      check: (d) => ({
        status:
          d.codingAssignments >= 5
            ? "earned"
            : d.codingAssignments >= 1
              ? "in_progress"
              : "locked",
        current: Math.min(d.codingAssignments, 5),
        target: 5,
      }),
    },
    {
      id: "hacker",
      titleKey: "achievements.ach.hacker.title",
      descriptionKey: "achievements.ach.hacker.desc",
      icon: Terminal,
      color: "violet",
      colorBg: "bg-violet-100",
      colorBorder: "border-violet-400",
      colorText: "text-violet-700",
      category: "coding",
      categoryLabelKey: "achievements.cat.coding",
      check: (d) => ({
        status:
          d.codingAssignments >= 15
            ? "earned"
            : d.codingAssignments >= 1
              ? "in_progress"
              : "locked",
        current: Math.min(d.codingAssignments, 15),
        target: 15,
      }),
    },
    // Special
    {
      id: "early-bird",
      titleKey: "achievements.ach.earlyBird.title",
      descriptionKey: "achievements.ach.earlyBird.desc",
      icon: Star,
      color: "blue",
      colorBg: "bg-blue-100",
      colorBorder: "border-blue-400",
      colorText: "text-blue-700",
      category: "special",
      categoryLabelKey: "achievements.cat.special",
      check: (d) => ({
        status:
          d.userRegistrationOrder > 0 && d.userRegistrationOrder <= 100
            ? "earned"
            : "locked",
        current: d.userRegistrationOrder > 0 && d.userRegistrationOrder <= 100 ? 1 : 0,
        target: 1,
      }),
    },
    {
      id: "veteran",
      titleKey: "achievements.ach.veteran.title",
      descriptionKey: "achievements.ach.veteran.desc",
      icon: Crown,
      color: "amber",
      colorBg: "bg-amber-100",
      colorBorder: "border-amber-400",
      colorText: "text-amber-700",
      category: "special",
      categoryLabelKey: "achievements.cat.special",
      check: (d) => ({
        status:
          d.isRegistered
            ? d.enrollmentsCount >= 10
              ? "earned"
              : "in_progress"
            : "locked",
        current: Math.min(d.enrollmentsCount, 10),
        target: 10,
      }),
    },
    {
      id: "completionist",
      titleKey: "achievements.ach.completionist.title",
      descriptionKey: "achievements.ach.completionist.desc",
      icon: Award,
      color: "green",
      colorBg: "bg-green-100",
      colorBorder: "border-green-400",
      colorText: "text-green-700",
      category: "special",
      categoryLabelKey: "achievements.cat.special",
      check: (d) => ({
        status:
          d.completedCoursesCount >= 5
            ? "earned"
            : d.completedCoursesCount >= 1
              ? "in_progress"
              : "locked",
        current: Math.min(d.completedCoursesCount, 5),
        target: 5,
      }),
    },
    {
      id: "problem-solver",
      titleKey: "achievements.ach.problemSolver.title",
      descriptionKey: "achievements.ach.problemSolver.desc",
      icon: Target,
      color: "violet",
      colorBg: "bg-violet-100",
      colorBorder: "border-violet-400",
      colorText: "text-violet-700",
      category: "special",
      categoryLabelKey: "achievements.cat.special",
      check: (d) => ({
        status:
          d.codingAssignments >= 30
            ? "earned"
            : d.codingAssignments >= 1
              ? "in_progress"
              : "locked",
        current: Math.min(d.codingAssignments, 30),
        target: 30,
      }),
    },
    {
      id: "bright-mind",
      titleKey: "achievements.ach.brightMind.title",
      descriptionKey: "achievements.ach.brightMind.desc",
      icon: Sparkles,
      color: "orange",
      colorBg: "bg-orange-100",
      colorBorder: "border-orange-400",
      colorText: "text-orange-700",
      category: "special",
      categoryLabelKey: "achievements.cat.special",
      check: (d) => ({
        status:
          d.completedLessonsCount >= 100
            ? "earned"
            : d.completedLessonsCount >= 1
              ? "in_progress"
              : "locked",
        current: Math.min(d.completedLessonsCount, 100),
        target: 100,
      }),
    },
    {
      id: "teacher",
      titleKey: "achievements.ach.teacher.title",
      descriptionKey: "achievements.ach.teacher.desc",
      icon: Award,
      color: "green",
      colorBg: "bg-green-100",
      colorBorder: "border-green-400",
      colorText: "text-green-700",
      category: "special",
      categoryLabelKey: "achievements.cat.special",
      check: (d) => ({
        status: d.isTeacherOrAdmin ? "earned" : "locked",
        current: d.isTeacherOrAdmin ? 1 : 0,
        target: 1,
      }),
    },
  ];
}
