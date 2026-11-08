import { db } from "@/lib/db";

/**
 * Derive a lesson score from the assignments the student actually submitted.
 *
 * `Progress.score` used to be accepted straight from the request body, so any
 * student could post `{"score": 100}` and have it stored as their result — the
 * teacher dashboard, the profile averages and the admin student card all read
 * that column. The client never had a legitimate reason to send it either: it
 * does not know the answer key.
 *
 * Returns `null` when nothing has been graded yet (no assignments, only
 * manually-reviewed work, or all submissions still awaiting review), which is
 * what the UI renders as "—" rather than as a zero.
 */
export async function computeLessonScore(
  userId: string,
  lessonId: string,
): Promise<number | null> {
  const assignments = await db.assignment.findMany({
    where: { lessonId },
    select: { id: true },
  });
  if (assignments.length === 0) return null;

  const graded = await db.assignmentSubmission.findMany({
    where: {
      userId,
      assignmentId: { in: assignments.map((a) => a.id) },
      status: "graded",
      score: { not: null },
    },
    select: { assignmentId: true, score: true, submittedAt: true },
    orderBy: { submittedAt: "desc" },
  });
  if (graded.length === 0) return null;

  // Best attempt per assignment: a retry must not lower the stored result, and
  // a newer failing attempt must not overwrite an earlier passing one.
  const bestByAssignment = new Map<string, number>();
  for (const submission of graded) {
    const score = submission.score ?? 0;
    const current = bestByAssignment.get(submission.assignmentId);
    if (current === undefined || score > current) {
      bestByAssignment.set(submission.assignmentId, score);
    }
  }

  const scores = [...bestByAssignment.values()];
  if (scores.length === 0) return null;

  return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
}
