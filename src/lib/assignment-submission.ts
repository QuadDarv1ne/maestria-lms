import { db, Prisma } from "@/lib/db";

/** Prisma's code for "transaction failed to serialise" (write conflict). */
const SERIALIZATION_FAILURE = "P2034";
const MAX_RETRIES = 3;

export interface CreateSubmissionInput {
  assignmentId: string;
  userId: string;
  /** 0 means unlimited attempts. */
  maxAttempts: number;
  data: { answer: string; status: string; score: number | null };
}

export type CreateSubmissionOutcome =
  | { submission: { id: string; status: string; score: number | null } }
  | { limitExceeded: true; attemptCount: number };

function isSerializationFailure(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === SERIALIZATION_FAILURE;
}

/**
 * Insert a submission while enforcing the attempt limit atomically.
 *
 * The limit used to be checked with a separate `count` before the `create`.
 * Two requests fired together both read "1 of 3" and both inserted, so a
 * student could take any number of attempts by sending the requests in
 * parallel — and the retry button made that a realistic click, not an exotic
 * attack. Counting inside a Serializable transaction makes the second writer
 * abort instead of silently exceeding the limit; the abort is retried a few
 * times, because a conflict with an unrelated write should not surface as an
 * error to the student.
 *
 * Unlimited assignments (`maxAttempts === 0`) skip the transaction entirely —
 * there is no invariant to protect and a plain insert is cheaper.
 */
export async function createSubmissionWithinAttemptLimit(
  input: CreateSubmissionInput,
): Promise<CreateSubmissionOutcome> {
  const { assignmentId, userId, maxAttempts, data } = input;

  const buildData = () => ({
    assignmentId,
    userId,
    answer: data.answer,
    status: data.status,
    score: data.score,
    maxScore: 100,
  });

  if (maxAttempts <= 0) {
    const submission = await db.assignmentSubmission.create({
      data: buildData(),
      select: { id: true, status: true, score: true },
    });
    return { submission };
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await db.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const attemptCount = await tx.assignmentSubmission.count({
            where: { assignmentId, userId },
          });

          if (attemptCount >= maxAttempts) {
            return { limitExceeded: true as const, attemptCount };
          }

          const submission = await tx.assignmentSubmission.create({
            data: buildData(),
            select: { id: true, status: true, score: true },
          });
          return { submission };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      // A serialisation conflict means a competing write won the race; re-reading
      // the count is exactly what resolves it, so retry rather than fail.
      if (!isSerializationFailure(error)) throw error;
      lastError = error;
    }
  }

  throw lastError;
}
