import type { ObjectId } from "mongodb"

type DocId = ObjectId | string

export interface UserDoc {
  _id?: DocId
  email: string
  name?: string
  passwordHash?: string
  image?: string
  role: string
  bio?: string
  phone?: string
  twoFactorEnabled: boolean
  twoFactorSecret?: string
  emailVerified?: Date
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AccountDoc {
  _id?: DocId
  userId: string
  type: string
  provider: string
  providerAccountId: string
  refresh_token?: string
  access_token?: string
  expires_at?: number
  token_type?: string
  scope?: string
  id_token?: string
  session_state?: string
}

export interface SessionDoc {
  _id?: DocId
  sessionToken: string
  userId: string
  expires: Date
}

export interface VerificationTokenDoc {
  _id?: DocId
  identifier: string
  token: string
  expires: Date
}

export interface CategoryDoc {
  _id?: DocId
  name: string
  slug: string
  description?: string
  icon?: string
  color?: string
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export interface CourseDoc {
  _id?: DocId
  title: string
  slug: string
  description: string
  shortDesc?: string
  image?: string
  price: number
  oldPrice?: number
  currency: string
  level: string
  duration?: string
  language: string
  isPublished: boolean
  isFeatured: boolean
  hasCertificate: boolean
  rating: number
  reviewCount: number
  studentCount: number
  tags?: string
  requirements?: string
  whatYouLearn?: string
  startDate?: Date
  endDate?: Date
  visibility: string
  maxStudents?: number
  prerequisites?: string
  categoryId?: string
  teacherId?: string
  createdAt: Date
  updatedAt: Date
}

export interface ModuleDoc {
  _id?: DocId
  title: string
  description?: string
  sortOrder: number
  courseId: string
  createdAt: Date
  updatedAt: Date
}

export interface LessonDoc {
  _id?: DocId
  title: string
  type: string
  content?: string
  videoUrl?: string
  duration: number
  sortOrder: number
  isFree: boolean
  moduleId: string
  createdAt: Date
  updatedAt: Date
}

export interface AssignmentDoc {
  _id?: DocId
  title: string
  description: string
  type: string
  options?: string
  correctAnswer?: string
  points: number
  maxAttempts: number
  lessonId: string
  createdAt: Date
  updatedAt: Date
}

export interface AssignmentSubmissionDoc {
  _id?: DocId
  assignmentId: string
  userId: string
  answer: string
  score?: number
  maxScore: number
  grade?: string
  feedback?: string
  status: string
  submittedAt: Date
  gradedAt?: Date
  gradedBy?: string
  createdAt: Date
  updatedAt: Date
}

export interface EnrollmentDoc {
  _id?: DocId
  userId: string
  courseId: string
  status: string
  progress: number
  enrolledAt: Date
  completedAt?: Date
}

export interface ProgressDoc {
  _id?: DocId
  userId: string
  lessonId: string
  completed: boolean
  score?: number
  timeSpent: number
  lastAccessed: Date
}

export interface ReviewDoc {
  _id?: DocId
  rating: number
  comment?: string
  userId: string
  courseId: string
  createdAt: Date
  updatedAt: Date
}

export interface PaymentDoc {
  _id?: DocId
  userId: string
  courseId: string
  amount: number
  currency: string
  status: string
  paymentMethod: string
  paymentProvider?: string
  transactionId?: string
  paymentData?: string
  createdAt: Date
  updatedAt: Date
}

export interface NotificationDoc {
  _id?: DocId
  userId: string
  type: string
  title: string
  message: string
  read: boolean
  link?: string
  createdAt: Date
}

export interface CertificateDoc {
  _id?: DocId
  userId: string
  courseId: string
  certificateNumber: string
  issuedAt: Date
}
