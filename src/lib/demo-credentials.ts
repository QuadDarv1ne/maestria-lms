import { randomInt } from "node:crypto";
import { passwordStrengthSchema } from "./password-strength";

/**
 * Credentials for the seeded demo accounts.
 *
 * Why this module exists: the seed scripts used a hardcoded password
 * ("demo123") and the API seed used `crypto.randomUUID().slice(0, 12)`. The
 * hardcoded value is public in this repository's history and on any deployment
 * that ran the seed; the UUID slice has no uppercase letters, so it violates the
 * project's own password policy and carries less entropy than its length
 * suggests. Both are replaced by one generator so every seeded account gets a
 * credential that actually satisfies the policy enforced at registration.
 */

/** Default length for generated seed passwords. */
export const GENERATED_PASSWORD_LENGTH = 20;

/** Shortest generated password this module will produce. */
export const MIN_GENERATED_PASSWORD_LENGTH = 16;

// Ambiguous characters (I, l, O, 0, 1) are omitted so a password copied from a
// terminal or read over the phone does not fail on the first attempt.
const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*-_=+";

const ALL_CHARACTERS = UPPERCASE + LOWERCASE + DIGITS + SYMBOLS;

/**
 * Passwords that must never reach a seeded account, even if someone sets them
 * in SEED_*_PASSWORD. The list covers the values this repository used before.
 */
const FORBIDDEN_PASSWORDS = new Set([
  "demo123",
  "demo1234",
  "password",
  "password123",
  "admin123",
  "teacher123",
  "qwerty123",
  "maestria",
  "maestria123",
]);

function pick(alphabet: string): string {
  return alphabet[randomInt(0, alphabet.length)];
}

/** Fisher-Yates shuffle backed by a CSPRNG (Math.random is not acceptable here). */
function shuffle(chars: string[]): string[] {
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars;
}

/**
 * Generate a cryptographically strong password that satisfies
 * passwordStrengthSchema and contains a symbol as well.
 */
export function generateStrongPassword(length = GENERATED_PASSWORD_LENGTH): string {
  if (!Number.isInteger(length) || length < MIN_GENERATED_PASSWORD_LENGTH) {
    throw new Error(
      `Generated seed passwords must be at least ${MIN_GENERATED_PASSWORD_LENGTH} characters (got ${length})`,
    );
  }

  // One character from every required class, then fill up from the whole set,
  // then shuffle so the required characters are not in a predictable prefix.
  const required = [pick(UPPERCASE), pick(LOWERCASE), pick(DIGITS), pick(SYMBOLS)];
  const rest = Array.from({ length: length - required.length }, () => pick(ALL_CHARACTERS));

  return shuffle([...required, ...rest]).join("");
}

/**
 * Validate a password against the registration policy plus the extra rules that
 * matter for a seeded account (length, known-bad values).
 *
 * @returns a human-readable problem, or null when the password is acceptable.
 */
export function checkSeedPasswordStrength(password: string): string | null {
  if (FORBIDDEN_PASSWORDS.has(password.trim().toLowerCase())) {
    return "Этот пароль широко известен и не может использоваться для демо-доступа";
  }

  if (password.length < MIN_GENERATED_PASSWORD_LENGTH) {
    return `Пароль должен быть не менее ${MIN_GENERATED_PASSWORD_LENGTH} символов`;
  }

  const parsed = passwordStrengthSchema.safeParse(password);
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Пароль не соответствует требованиям";
  }

  return null;
}

export type SeedPasswordSource = "env" | "generated";

export interface ResolvedSeedPassword {
  password: string;
  /** Where the password came from — used to decide whether to log it once. */
  source: SeedPasswordSource;
}

/**
 * Resolve the password for a seeded account.
 *
 * A password supplied through the environment is validated and rejected when
 * weak: silently accepting it would put a guessable credential on a public
 * deployment, which is the exact problem this module is meant to remove.
 */
export function resolveSeedPassword(options: {
  envValue?: string | null;
  /** Environment variable name, used in error messages. */
  label: string;
  length?: number;
}): ResolvedSeedPassword {
  const fromEnv = options.envValue?.trim();

  if (fromEnv) {
    const problem = checkSeedPasswordStrength(fromEnv);
    if (problem) {
      throw new Error(`${options.label} is not strong enough: ${problem}`);
    }
    return { password: fromEnv, source: "env" };
  }

  return { password: generateStrongPassword(options.length), source: "generated" };
}
