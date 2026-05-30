import { MongoClient, type MongoClientOptions } from "mongodb"
import { logger } from "./logger"
import { env } from "@/lib/env"

const MONGODB_URI = env.databaseUrl || "mongodb://localhost:27017/maestria_lms"
const DB_NAME = "maestria_lms"

if (!MONGODB_URI) {
  throw new Error("Please define the DATABASE_URL environment variable")
}

const options: MongoClientOptions = {
  maxPoolSize: 10,
  minPoolSize: 1,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
}

const globalForMongo = globalThis as unknown as {
  _mongoClient: MongoClient | undefined
  _mongoDb: ReturnType<MongoClient["db"]> | undefined
}

async function connectMongo() {
  if (globalForMongo._mongoClient && globalForMongo._mongoDb) {
    return { client: globalForMongo._mongoClient, db: globalForMongo._mongoDb }
  }

  const client = new MongoClient(MONGODB_URI, options)
  await client.connect()
  const db = client.db(DB_NAME)

  if (!env.isProduction) {
    globalForMongo._mongoClient = client
    globalForMongo._mongoDb = db
  }

  logger("info", "MongoDB connected")
  return { client, db }
}

export async function getMongoDb() {
  const { db } = await connectMongo()
  return db
}

export async function getMongoClient() {
  const { client } = await connectMongo()
  return client
}

export const collections = {
  users: () => getMongoDb().then(db => db.collection<UserDoc>("users")),
  accounts: () => getMongoDb().then(db => db.collection<AccountDoc>("accounts")),
  sessions: () => getMongoDb().then(db => db.collection<SessionDoc>("sessions")),
  verificationTokens: () => getMongoDb().then(db => db.collection<VerificationTokenDoc>("verificationTokens")),
  categories: () => getMongoDb().then(db => db.collection<CategoryDoc>("categories")),
  courses: () => getMongoDb().then(db => db.collection<CourseDoc>("courses")),
  modules: () => getMongoDb().then(db => db.collection<ModuleDoc>("modules")),
  lessons: () => getMongoDb().then(db => db.collection<LessonDoc>("lessons")),
  assignments: () => getMongoDb().then(db => db.collection<AssignmentDoc>("assignments")),
  assignmentSubmissions: () => getMongoDb().then(db => db.collection<AssignmentSubmissionDoc>("assignmentSubmissions")),
  enrollments: () => getMongoDb().then(db => db.collection<EnrollmentDoc>("enrollments")),
  progress: () => getMongoDb().then(db => db.collection<ProgressDoc>("progress")),
  reviews: () => getMongoDb().then(db => db.collection<ReviewDoc>("reviews")),
  payments: () => getMongoDb().then(db => db.collection<PaymentDoc>("payments")),
  notifications: () => getMongoDb().then(db => db.collection<NotificationDoc>("notifications")),
  certificates: () => getMongoDb().then(db => db.collection<CertificateDoc>("certificates")),
}

import type {
  UserDoc, AccountDoc, SessionDoc, VerificationTokenDoc,
  CategoryDoc, CourseDoc, ModuleDoc, LessonDoc,
  AssignmentDoc, AssignmentSubmissionDoc, EnrollmentDoc,
  ProgressDoc, ReviewDoc, PaymentDoc, NotificationDoc, CertificateDoc
} from "./mongodb-schema"
