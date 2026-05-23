import { db as prismaDb } from "./db"
import { collections as mongoCollections } from "./mongodb"
import { ObjectId } from "mongodb"

const provider = process.env.DATABASE_PROVIDER || "sqlite"
const isMongo = provider === "mongodb"

function toObjectId(id: string): ObjectId {
  if (!id || typeof id !== 'string') {
    throw new Error(`Invalid ObjectId: expected non-empty string, got ${typeof id} (${id})`)
  }
  try {
    return new ObjectId(id)
  } catch (error) {
    throw new Error(`Invalid ObjectId format: ${id}. Error: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function fromObjectId(id: ObjectId | string): string {
  return id.toString()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyArgs = any

export const database = {
  user: {
    findUnique: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.users().then(c => c.findOne(args.where?.email ? { email: args.where.email } : { _id: toObjectId(args.where.id) }))
        : prismaDb.user.findUnique(args),

    findMany: (args?: AnyArgs) =>
      isMongo
        ? mongoCollections.users().then(c => c.find(args?.where || {}).toArray())
        : prismaDb.user.findMany(args),

    create: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.users().then(c => c.insertOne(args.data).then(r => ({ ...args.data, id: fromObjectId(r.insertedId) })))
        : prismaDb.user.create(args),

    update: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.users().then(c => {
            c.updateOne({ _id: toObjectId(args.where.id) }, { $set: args.data })
            return c.findOne({ _id: toObjectId(args.where.id) })
          })
        : prismaDb.user.update(args),

    delete: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.users().then(c => c.deleteOne({ _id: toObjectId(args.where.id) }))
        : prismaDb.user.delete(args),

    count: (args?: AnyArgs) =>
      isMongo
        ? mongoCollections.users().then(c => c.countDocuments(args?.where || {}))
        : prismaDb.user.count(args),
  },

  course: {
    findUnique: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.courses().then(c => c.findOne(args.where?.id ? { _id: toObjectId(args.where.id) } : { slug: args.where.slug }))
        : prismaDb.course.findUnique(args),

    findMany: (args?: AnyArgs) =>
      isMongo
        ? mongoCollections.courses().then(c => {
            let query = c.find(args?.where || {})
            if (args?.skip) query = query.skip(args.skip)
            if (args?.take) query = query.limit(args.take)
            if (args?.orderBy) {
              const [field, dir] = Object.entries(args.orderBy)[0] || []
              if (field) query = query.sort({ [field]: dir === 'desc' ? -1 : 1 })
            }
            return query.toArray()
          })
        : prismaDb.course.findMany(args),

    create: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.courses().then(c => c.insertOne(args.data).then(r => ({ ...args.data, id: fromObjectId(r.insertedId) })))
        : prismaDb.course.create(args),

    update: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.courses().then(c => {
            c.updateOne({ _id: toObjectId(args.where.id) }, { $set: args.data })
            return c.findOne({ _id: toObjectId(args.where.id) })
          })
        : prismaDb.course.update(args),

    delete: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.courses().then(c => c.deleteOne({ _id: toObjectId(args.where.id) }))
        : prismaDb.course.delete(args),

    count: (args?: AnyArgs) =>
      isMongo
        ? mongoCollections.courses().then(c => c.countDocuments(args?.where || {}))
        : prismaDb.course.count(args),
  },

  category: {
    findUnique: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.categories().then(c => c.findOne(args.where?.id ? { _id: toObjectId(args.where.id) } : { slug: args.where.slug }))
        : prismaDb.category.findUnique(args),

    findMany: (args?: AnyArgs) =>
      isMongo
        ? mongoCollections.categories().then(c => c.find(args?.where || {}).toArray())
        : prismaDb.category.findMany(args),

    create: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.categories().then(c => c.insertOne(args.data).then(r => ({ ...args.data, id: fromObjectId(r.insertedId) })))
        : prismaDb.category.create(args),

    update: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.categories().then(c => {
            c.updateOne({ _id: toObjectId(args.where.id) }, { $set: args.data })
            return c.findOne({ _id: toObjectId(args.where.id) })
          })
        : prismaDb.category.update(args),

    delete: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.categories().then(c => c.deleteOne({ _id: toObjectId(args.where.id) }))
        : prismaDb.category.delete(args),
  },

  module: {
    findMany: (args?: AnyArgs) =>
      isMongo
        ? mongoCollections.modules().then(c => c.find(args?.where || {}).toArray())
        : prismaDb.module.findMany(args),

    create: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.modules().then(c => c.insertOne(args.data).then(r => ({ ...args.data, id: fromObjectId(r.insertedId) })))
        : prismaDb.module.create(args),

    update: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.modules().then(c => {
            c.updateOne({ _id: toObjectId(args.where.id) }, { $set: args.data })
            return c.findOne({ _id: toObjectId(args.where.id) })
          })
        : prismaDb.module.update(args),

    delete: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.modules().then(c => c.deleteOne({ _id: toObjectId(args.where.id) }))
        : prismaDb.module.delete(args),
  },

  lesson: {
    findUnique: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.lessons().then(c => c.findOne({ _id: toObjectId(args.where.id) }))
        : prismaDb.lesson.findUnique(args),

    findMany: (args?: AnyArgs) =>
      isMongo
        ? mongoCollections.lessons().then(c => c.find(args?.where || {}).toArray())
        : prismaDb.lesson.findMany(args),

    create: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.lessons().then(c => c.insertOne(args.data).then(r => ({ ...args.data, id: fromObjectId(r.insertedId) })))
        : prismaDb.lesson.create(args),

    update: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.lessons().then(c => {
            c.updateOne({ _id: toObjectId(args.where.id) }, { $set: args.data })
            return c.findOne({ _id: toObjectId(args.where.id) })
          })
        : prismaDb.lesson.update(args),

    delete: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.lessons().then(c => c.deleteOne({ _id: toObjectId(args.where.id) }))
        : prismaDb.lesson.delete(args),
  },

  enrollment: {
    findUnique: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.enrollments().then(c => c.findOne(
            args.where?.userId_courseId
              ? { userId: args.where.userId_courseId.userId, courseId: args.where.userId_courseId.courseId }
              : { _id: toObjectId(args.where.id) }
          ))
        : prismaDb.enrollment.findUnique(args),

    findMany: (args?: AnyArgs) =>
      isMongo
        ? mongoCollections.enrollments().then(c => c.find(args?.where || {}).toArray())
        : prismaDb.enrollment.findMany(args),

    create: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.enrollments().then(c => c.insertOne(args.data).then(r => ({ ...args.data, id: fromObjectId(r.insertedId) })))
        : prismaDb.enrollment.create(args),

    update: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.enrollments().then(c => {
            c.updateOne({ _id: toObjectId(args.where.id) }, { $set: args.data })
            return c.findOne({ _id: toObjectId(args.where.id) })
          })
        : prismaDb.enrollment.update(args),

    delete: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.enrollments().then(c => c.deleteOne({ _id: toObjectId(args.where.id) }))
        : prismaDb.enrollment.delete(args),

    count: (args?: AnyArgs) =>
      isMongo
        ? mongoCollections.enrollments().then(c => c.countDocuments(args?.where || {}))
        : prismaDb.enrollment.count(args),
  },

  progress: {
    findUnique: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.progress().then(c => c.findOne(
            args.where?.userId_lessonId
              ? { userId: args.where.userId_lessonId.userId, lessonId: args.where.userId_lessonId.lessonId }
              : { _id: toObjectId(args.where.id) }
          ))
        : prismaDb.progress.findUnique(args),

    findMany: (args?: AnyArgs) =>
      isMongo
        ? mongoCollections.progress().then(c => c.find(args?.where || {}).toArray())
        : prismaDb.progress.findMany(args),

    create: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.progress().then(c => c.insertOne(args.data).then(r => ({ ...args.data, id: fromObjectId(r.insertedId) })))
        : prismaDb.progress.create(args),

    update: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.progress().then(c => {
            c.updateOne({ _id: toObjectId(args.where.id) }, { $set: args.data })
            return c.findOne({ _id: toObjectId(args.where.id) })
          })
        : prismaDb.progress.update(args),

    upsert: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.progress().then(c => c.updateOne(
            { userId: args.where.userId_lessonId.userId, lessonId: args.where.userId_lessonId.lessonId },
            { $setOnInsert: args.create, $set: args.update },
            { upsert: true }
          ))
        : prismaDb.progress.upsert(args),
  },

  review: {
    findMany: (args?: AnyArgs) =>
      isMongo
        ? mongoCollections.reviews().then(c => c.find(args?.where || {}).toArray())
        : prismaDb.review.findMany(args),

    create: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.reviews().then(c => c.insertOne(args.data).then(r => ({ ...args.data, id: fromObjectId(r.insertedId) })))
        : prismaDb.review.create(args),

    delete: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.reviews().then(c => c.deleteOne({ _id: toObjectId(args.where.id) }))
        : prismaDb.review.delete(args),

    count: (args?: AnyArgs) =>
      isMongo
        ? mongoCollections.reviews().then(c => c.countDocuments(args?.where || {}))
        : prismaDb.review.count(args),
  },

  assignment: {
    findUnique: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.assignments().then(c => c.findOne({ _id: toObjectId(args.where.id) }))
        : prismaDb.assignment.findUnique(args),

    findMany: (args?: AnyArgs) =>
      isMongo
        ? mongoCollections.assignments().then(c => c.find(args?.where || {}).toArray())
        : prismaDb.assignment.findMany(args),

    create: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.assignments().then(c => c.insertOne(args.data).then(r => ({ ...args.data, id: fromObjectId(r.insertedId) })))
        : prismaDb.assignment.create(args),

    update: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.assignments().then(c => {
            c.updateOne({ _id: toObjectId(args.where.id) }, { $set: args.data })
            return c.findOne({ _id: toObjectId(args.where.id) })
          })
        : prismaDb.assignment.update(args),

    delete: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.assignments().then(c => c.deleteOne({ _id: toObjectId(args.where.id) }))
        : prismaDb.assignment.delete(args),
  },

  assignmentSubmission: {
    findMany: (args?: AnyArgs) =>
      isMongo
        ? mongoCollections.assignmentSubmissions().then(c => c.find(args?.where || {}).toArray())
        : prismaDb.assignmentSubmission.findMany(args),

    create: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.assignmentSubmissions().then(c => c.insertOne(args.data).then(r => ({ ...args.data, id: fromObjectId(r.insertedId) })))
        : prismaDb.assignmentSubmission.create(args),

    update: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.assignmentSubmissions().then(c => {
            c.updateOne({ _id: toObjectId(args.where.id) }, { $set: args.data })
            return c.findOne({ _id: toObjectId(args.where.id) })
          })
        : prismaDb.assignmentSubmission.update(args),
  },

  payment: {
    findMany: (args?: AnyArgs) =>
      isMongo
        ? mongoCollections.payments().then(c => c.find(args?.where || {}).toArray())
        : prismaDb.payment.findMany(args),

    findUnique: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.payments().then(c => c.findOne({ _id: toObjectId(args.where.id) }))
        : prismaDb.payment.findUnique(args),

    create: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.payments().then(c => c.insertOne(args.data).then(r => ({ ...args.data, id: fromObjectId(r.insertedId) })))
        : prismaDb.payment.create(args),

    update: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.payments().then(c => {
            c.updateOne({ _id: toObjectId(args.where.id) }, { $set: args.data })
            return c.findOne({ _id: toObjectId(args.where.id) })
          })
        : prismaDb.payment.update(args),

    count: (args?: AnyArgs) =>
      isMongo
        ? mongoCollections.payments().then(c => c.countDocuments(args?.where || {}))
        : prismaDb.payment.count(args),
  },

  notification: {
    findMany: (args?: AnyArgs) =>
      isMongo
        ? mongoCollections.notifications().then(c => c.find(args?.where || {}).toArray())
        : prismaDb.notification.findMany(args),

    create: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.notifications().then(c => c.insertOne(args.data).then(r => ({ ...args.data, id: fromObjectId(r.insertedId) })))
        : prismaDb.notification.create(args),

    update: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.notifications().then(c => {
            c.updateOne({ _id: toObjectId(args.where.id) }, { $set: args.data })
            return c.findOne({ _id: toObjectId(args.where.id) })
          })
        : prismaDb.notification.update(args),

    delete: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.notifications().then(c => c.deleteOne({ _id: toObjectId(args.where.id) }))
        : prismaDb.notification.delete(args),

    count: (args?: AnyArgs) =>
      isMongo
        ? mongoCollections.notifications().then(c => c.countDocuments(args?.where || {}))
        : prismaDb.notification.count(args),
  },

  certificate: {
    findMany: (args?: AnyArgs) =>
      isMongo
        ? mongoCollections.certificates().then(c => c.find(args?.where || {}).toArray())
        : prismaDb.certificate.findMany(args),

    findUnique: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.certificates().then(c => c.findOne(
            args.where?.userId_courseId
              ? { userId: args.where.userId_courseId.userId, courseId: args.where.userId_courseId.courseId }
              : { _id: toObjectId(args.where.id) }
          ))
        : prismaDb.certificate.findUnique(args),

    create: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.certificates().then(c => c.insertOne(args.data).then(r => ({ ...args.data, id: fromObjectId(r.insertedId) })))
        : prismaDb.certificate.create(args),
  },

  account: {
    findMany: (args?: AnyArgs) =>
      isMongo
        ? mongoCollections.accounts().then(c => c.find(args?.where || {}).toArray())
        : prismaDb.account.findMany(args),

    create: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.accounts().then(c => c.insertOne(args.data).then(r => ({ ...args.data, id: fromObjectId(r.insertedId) })))
        : prismaDb.account.create(args),

    delete: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.accounts().then(c => c.deleteOne(args.where))
        : prismaDb.account.delete(args),
  },

  session: {
    findMany: (args?: AnyArgs) =>
      isMongo
        ? mongoCollections.sessions().then(c => c.find(args?.where || {}).toArray())
        : prismaDb.session.findMany(args),

    findUnique: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.sessions().then(c => c.findOne({ sessionToken: args.where.sessionToken }))
        : prismaDb.session.findUnique(args),

    create: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.sessions().then(c => c.insertOne(args.data).then(r => ({ ...args.data, id: fromObjectId(r.insertedId) })))
        : prismaDb.session.create(args),

    update: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.sessions().then(c => {
            c.updateOne({ _id: toObjectId(args.where.id) }, { $set: args.data })
            return c.findOne({ _id: toObjectId(args.where.id) })
          })
        : prismaDb.session.update(args),

    delete: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.sessions().then(c => c.deleteOne({ sessionToken: args.where.sessionToken }))
        : prismaDb.session.delete(args),
  },

  verificationToken: {
    findUnique: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.verificationTokens().then(c => c.findOne(
            args.where?.identifier_token
              ? { identifier: args.where.identifier_token.identifier, token: args.where.identifier_token.token }
              : {}
          ))
        : prismaDb.verificationToken.findUnique(args),

    create: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.verificationTokens().then(c => c.insertOne(args.data).then(r => ({ ...args.data, id: fromObjectId(r.insertedId) })))
        : prismaDb.verificationToken.create(args),

    delete: (args: AnyArgs) =>
      isMongo
        ? mongoCollections.verificationTokens().then(c => c.deleteOne(
            args.where?.identifier_token
              ? { identifier: args.where.identifier_token.identifier, token: args.where.identifier_token.token }
              : {}
          ))
        : prismaDb.verificationToken.delete(args),
  },

  $transaction: async (operations: (() => Promise<unknown>)[]) => {
    if (isMongo) {
      const results = []
      for (const op of operations) {
        results.push(await op())
      }
      return results
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return prismaDb.$transaction(operations as any)
  },

  provider,
  isMongo,
}

export type Database = typeof database
