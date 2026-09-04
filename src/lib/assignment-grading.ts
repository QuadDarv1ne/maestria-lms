// Pure assignment auto-grading logic, shared by the submission API route.
// Every function returns a GradingResult and never throws: malformed input
// falls back to "submitted" with no score (manual review).

export type SubmissionStatus = "submitted" | "graded";

export interface GradingResult {
  status: SubmissionStatus;
  score: number | null;
}

const NOT_GRADED: GradingResult = { status: "submitted", score: null };

function parseJson(value: unknown): unknown {
  if (typeof value === "string") {
    return JSON.parse(value);
  }
  return value;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

// quiz: correctAnswer is either a number (single choice) or an array of ids (multiple choice)
function gradeQuiz(answer: unknown, correctAnswer: string | null): GradingResult {
  if (!correctAnswer) return NOT_GRADED;
  const userAnswer = parseJson(answer);
  const correctParsed = JSON.parse(correctAnswer);

  if (typeof correctParsed === "number") {
    const userSingleAnswer = Array.isArray(userAnswer) ? userAnswer[0] : userAnswer;
    return { status: "graded", score: userSingleAnswer === correctParsed ? 100 : 0 };
  }

  if (Array.isArray(correctParsed) && Array.isArray(userAnswer)) {
    const correctSet = new Set(correctParsed);
    const userSet = new Set(userAnswer);

    const exactMatch = userSet.size === correctSet.size && [...userSet].every((a) => correctSet.has(a));

    if (exactMatch) {
      return { status: "graded", score: 100 };
    }
    if (correctSet.size > 0) {
      const correctCount = [...userSet].filter((a) => correctSet.has(a)).length;
      const wrongCount = userSet.size - correctCount;
      return { status: "graded", score: clampScore(((correctCount - wrongCount) / correctSet.size) * 100) };
    }
  }

  return NOT_GRADED;
}

// matching: correctAnswer is an array of { left, right } pairs, compared by index
function gradeMatching(answer: unknown, correctAnswer: string | null): GradingResult {
  if (!correctAnswer) return NOT_GRADED;
  const userAnswer = parseJson(answer);
  const correctParsed = JSON.parse(correctAnswer);

  if (Array.isArray(userAnswer) && Array.isArray(correctParsed) && correctParsed.length > 0) {
    const isCorrect = userAnswer.every(
      (pair: { left: string; right: string }, idx: number) =>
        pair.left === correctParsed[idx]?.left && pair.right === correctParsed[idx]?.right,
    );
    if (isCorrect) {
      return { status: "graded", score: 100 };
    }
    const correctCount = userAnswer.filter(
      (pair: { left: string; right: string }, idx: number) =>
        pair.left === correctParsed[idx]?.left && pair.right === correctParsed[idx]?.right,
    ).length;
    return { status: "graded", score: clampScore((correctCount / correctParsed.length) * 100) };
  }

  return NOT_GRADED;
}

// ordering: correctAnswer is an array of item ids in the correct order
function gradeOrdering(answer: unknown, correctAnswer: string | null): GradingResult {
  if (!correctAnswer) return NOT_GRADED;
  const userAnswer = parseJson(answer);
  const correctParsed = JSON.parse(correctAnswer);

  if (Array.isArray(userAnswer) && Array.isArray(correctParsed) && correctParsed.length > 0) {
    const isCorrect = userAnswer.every((item: string, idx: number) => item === correctParsed[idx]);
    if (isCorrect) {
      return { status: "graded", score: 100 };
    }
    // Partial credit for correct positions
    const correctCount = userAnswer.filter((item: string, idx: number) => item === correctParsed[idx]).length;
    return { status: "graded", score: clampScore((correctCount / correctParsed.length) * 100) };
  }

  return NOT_GRADED;
}

// drag_drop: correctAnswer is a map { itemId: groupId }
function gradeDragDrop(answer: unknown, correctAnswer: string | null): GradingResult {
  if (!correctAnswer) return NOT_GRADED;
  const userAnswer = parseJson(answer);
  const correctParsed = JSON.parse(correctAnswer);

  if (
    userAnswer && typeof userAnswer === "object" && !Array.isArray(userAnswer) &&
    correctParsed && typeof correctParsed === "object" && !Array.isArray(correctParsed)
  ) {
    const totalItems = Object.keys(correctParsed).length;
    if (totalItems > 0) {
      const correctCount = Object.keys(correctParsed).filter(
        (key) => (userAnswer as Record<string, unknown>)[key] === correctParsed[key],
      ).length;
      return { status: "graded", score: clampScore((correctCount / totalItems) * 100) };
    }
  }

  return NOT_GRADED;
}

// Grades an assignment answer by type. Unknown types and malformed input
// are returned as "submitted" without a score (pending manual review).
export function gradeAssignment(type: string, answer: unknown, correctAnswer: string | null): GradingResult {
  try {
    switch (type) {
      case "quiz":
        return gradeQuiz(answer, correctAnswer);
      case "matching":
        return gradeMatching(answer, correctAnswer);
      case "ordering":
        return gradeOrdering(answer, correctAnswer);
      case "drag_drop":
        return gradeDragDrop(answer, correctAnswer);
      default:
        return NOT_GRADED;
    }
  } catch {
    return NOT_GRADED;
  }
}
