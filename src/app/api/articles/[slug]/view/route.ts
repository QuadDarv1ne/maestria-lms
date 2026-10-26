import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { incrementArticleViews } from "@/lib/articles";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { validateParams } from "@/lib/request-validation";
import { log } from "@/lib/logger";
import { z } from "zod";

export const runtime = "nodejs";

/**
 * Records a view for an article.
 *
 * The article page is server-rendered, so the counter cannot be bumped from
 * the RSC render (it would fire on every request, including prefetches, and
 * server components cannot set the dedup cookie). The client calls this route
 * once after mount instead; a short-lived httpOnly cookie keeps refreshes from
 * inflating the number.
 */

const VIEW_DEDUP_COOKIE = "article_view";
const VIEW_DEDUP_TTL = 30 * 60; // seconds — one view per article per 30 min

const checkRateLimit = rateLimit("article-view", RATE_LIMITS.default);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  const { slug } = await params;
  const paramCheck = validateParams({ slug }, z.object({ slug: z.string().min(1).max(200) }));
  if ("response" in paramCheck) return paramCheck.response;

  try {
    const article = await db.article.findUnique({
      where: { slug },
      select: { id: true, isPublished: true, views: true },
    });

    if (!article || !article.isPublished) {
      return NextResponse.json({ error: "Статья не найдена" }, { status: 404 });
    }

    const cookieValue = request.cookies.get(VIEW_DEDUP_COOKIE)?.value ?? "";
    const alreadyViewed = cookieValue.split("|").includes(article.id);

    let views = article.views;
    if (!alreadyViewed) {
      await incrementArticleViews(article.id);
      views = article.views + 1;
    }

    const response = NextResponse.json({ views, counted: !alreadyViewed }, { status: 200 });
    if (!alreadyViewed) {
      // Keep a compact list of recently viewed article ids (max 20).
      const ids = [...cookieValue.split("|").filter(Boolean), article.id].slice(-20);
      response.cookies.set(VIEW_DEDUP_COOKIE, ids.join("|"), {
        httpOnly: true,
        sameSite: "lax",
        maxAge: VIEW_DEDUP_TTL,
        path: "/",
      });
    }
    return response;
  } catch (error) {
    log.warn("[articles:view] Failed to record view", {
      slug,
      error: error instanceof Error ? error.message : String(error),
    });
    // A view counter failure must never surface as a user-facing error.
    return NextResponse.json({ views: null, counted: false }, { status: 200 });
  }
}
