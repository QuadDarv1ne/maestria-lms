/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { promoCourseIds } from "@/lib/promo-courses";

/**
 * Course cover file-name safety.
 *
 * Next.js optimizes every cover through /_next/image. The optimizer rebuilds the
 * internal request from the decoded `url` parameter and does not re-encode the
 * path, so a file name containing a URL delimiter is parsed as syntax instead of
 * as part of the name:
 *   - `+` becomes a space in the query string
 *   - `#` starts a fragment, so the request is truncated at that point
 *   - `,` `&` `;` `=` `@` `[` `]` split the query or the path
 *   - a stray `%` throws inside the decoder (500)
 * The static file itself is served fine, which is why the failure only shows up
 * as a broken cover on the rendered page. "C++.png", "React + Native.png",
 * "Язык программирования C#.jpg" and "Написние курсовых, дипломных работ.jpg"
 * were all unreachable this way.
 *
 * Spaces and non-ASCII letters are safe: they are percent-encoded and decode
 * back to the same path.
 */

const coursesDir = join(process.cwd(), "public", "courses");

// Characters that break the optimizer's internal request. Verified empirically
// against a production build: each of these returned 400 (or 500 for `%`) from
// /_next/image while the same bytes served as a static file returned 200.
const URL_UNSAFE_IN_FILE_NAME = /[+,#&;=@[\]?%]/;

function allFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? allFiles(full) : [entry];
  });
}

describe("course cover file names survive the image optimizer", () => {
  it("contains no URL delimiter that breaks /_next/image", () => {
    const offenders = allFiles(coursesDir).filter((name) => URL_UNSAFE_IN_FILE_NAME.test(name));
    expect(offenders, `rename these files: ${offenders.join(", ")}`).toEqual([]);
  });

  it("keeps promo card image paths equally safe", () => {
    const offenders = promoCourseIds
      .map((course) => course.image)
      .filter((image) => URL_UNSAFE_IN_FILE_NAME.test(image));
    expect(offenders).toEqual([]);
  });

  it("points promo cards at the safe course cover names", () => {
    const images = promoCourseIds.map((c) => c.image);
    expect(images).toContain("/courses/coursework-writing.jpg");
    expect(images).not.toContain("/courses/Написние курсовых, дипломных работ.jpg");
  });
});
