// Client-facing projection of `Assignment.options`.
//
// The course editor stores the answer key inside `options` for three types:
// matching writes the correct pairs, ordering the correct sequence, drag_drop
// the correct group of every item. `correctAnswer` gets the same content, so
// the lesson endpoint handed the answers to the browser verbatim — the key was
// readable in the network tab before the first attempt. This module rewrites
// the payload into something the UI can render without revealing which choice
// is right; `correctAnswer` stays on the server where grading needs it.

export interface PublicMatchingOptions {
  left: string[];
  right: string[];
}

export interface PublicDragDropOptions {
  items: { id: string; text: string }[];
  groups: string[];
}

/**
 * Order of indices that keeps no element in its original position.
 *
 * A plain shuffle is not enough: with probability ~1/e at least one item stays
 * put, and for ordering that means the correct position of that step is still
 * visible in the payload. Falls back to a rotation, which is a derangement by
 * construction, so a run of unlucky shuffles cannot loop forever.
 */
function derangedIndices(length: number): number[] {
  const identity = Array.from({ length }, (_, i) => i);
  if (length < 2) return identity;

  for (let attempt = 0; attempt < 20; attempt++) {
    const indices = [...identity];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    if (indices.every((value, position) => value !== position)) return indices;
  }

  return [...identity.slice(1), identity[0]];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOptions(options: string): unknown {
  try {
    return JSON.parse(options);
  } catch {
    return undefined;
  }
}

function publicMatching(options: string): string | null {
  const parsed = parseOptions(options);
  if (!Array.isArray(parsed) || parsed.length === 0) return null;

  const pairs = parsed.filter(
    (pair): pair is { left: unknown; right: unknown } => isRecord(pair),
  );
  if (pairs.length !== parsed.length) return null;

  const projection: PublicMatchingOptions = {
    left: pairs.map((pair) => String(pair.left ?? "")),
    right: derangedIndices(pairs.length).map((source) => String(pairs[source].right ?? "")),
  };
  return JSON.stringify(projection);
}

function publicOrdering(options: string): string | null {
  const parsed = parseOptions(options);
  if (!Array.isArray(parsed) || parsed.length === 0) return null;

  const items = parsed.map((item) => String(item));
  return JSON.stringify(derangedIndices(items.length).map((source) => items[source]));
}

function publicDragDrop(options: string): string | null {
  const parsed = parseOptions(options);
  if (!Array.isArray(parsed) || parsed.length === 0) return null;

  const items = parsed.filter(
    (item): item is { id: unknown; text: unknown; group?: unknown } => isRecord(item),
  );
  if (items.length !== parsed.length) return null;

  // `group` is the answer: the item's bucket is exactly what the student has to
  // work out. Only the bucket names survive, as a set the UI can render.
  const projection: PublicDragDropOptions = {
    items: derangedIndices(items.length).map((source) => ({
      id: String(items[source].id ?? ""),
      text: String(items[source].text ?? ""),
    })),
    groups: [...new Set(items.map((item) => String(item.group ?? "")))].sort(() => Math.random() - 0.5),
  };
  return JSON.stringify(projection);
}

/**
 * Rewrite a stored `options` payload into the shape the step viewer needs.
 *
 * Types whose `options` are already public (quiz option texts, free-form
 * answers) are returned unchanged. A payload that cannot be parsed returns
 * `null` so the UI shows its "nothing to answer" state instead of rendering
 * a broken exercise.
 */
export function publicAssignmentOptions(type: string, options: string | null): string | null {
  if (!options) return null;

  switch (type) {
    case "matching":
      return publicMatching(options);
    case "ordering":
      return publicOrdering(options);
    case "drag_drop":
      return publicDragDrop(options);
    default:
      return options;
  }
}
