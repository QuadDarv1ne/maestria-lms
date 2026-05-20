"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/stores/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";
import { toast } from "sonner";

interface ReviewFormProps {
  courseId: string;
  onReviewSubmitted: () => void;
}

const RATING_LABELS = (locale?: Locale): Record<number, string> => ({
  1: t("review.awful", locale),
  2: t("review.bad", locale),
  3: t("review.okay", locale),
  4: t("review.good", locale),
  5: t("review.excellent", locale),
});

const MAX_COMMENT_LENGTH = 500;

export function ReviewForm({ courseId, onReviewSubmitted }: ReviewFormProps) {
  const user = useAppStore((s) => s.user);
  const locale = useAppStore((s) => s.locale);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Only show for logged-in, enrolled users.
  // The enrollment check is deferred to the API; we hide the form if there's
  // no logged-in user. The parent page can also gate this with `course.isEnrolled`.
  if (!user) return null;

  const displayRating = hoverRating || rating;
  const ratingLabels = RATING_LABELS(locale);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error(t("review.selectRating", locale));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          comment: comment.trim() || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(
          data.updated ? t("review.updated", locale) : t("review.added", locale),
        );
        setRating(0);
        setHoverRating(0);
        setComment("");
        onReviewSubmitted();
      } else {
        toast.error(data.error || t("review.error", locale));
      }
    } catch {
      toast.error(t("review.error", locale));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-6">
        <h3 className="text-lg font-bold mb-4">{t("review.title", locale)}</h3>

        {/* Star rating selector */}
        <div className="flex items-center gap-1 mb-1">
          {Array.from({ length: 5 }).map((_, i) => {
            const starValue = i + 1;
            const filled = starValue <= displayRating;

            return (
              <button
                key={starValue}
                type="button"
                className="p-0.5 transition-transform hover:scale-110 focus:outline-none"
                onClick={() => setRating(starValue)}
                onMouseEnter={() => setHoverRating(starValue)}
                onMouseLeave={() => setHoverRating(0)}
                aria-label={ratingLabels[starValue]}
              >
                <Star
                  className={`w-7 h-7 transition-colors ${
                    filled
                      ? "fill-amber-400 text-amber-500"
                      : "text-gray-300"
                  }`}
                />
              </button>
            );
          })}

          {displayRating > 0 && (
            <span className="ml-2 text-sm font-medium text-amber-600">
              {ratingLabels[displayRating]}
            </span>
          )}
        </div>

        {/* Comment textarea */}
        <div className="mt-4">
          <Textarea
            placeholder={t("review.commentPlaceholder", locale)}
            value={comment}
            onChange={(e) => {
              if (e.target.value.length <= MAX_COMMENT_LENGTH) {
                setComment(e.target.value);
              }
            }}
            rows={3}
            className="resize-none text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {comment.length}/{MAX_COMMENT_LENGTH}
          </p>
        </div>

        {/* Submit button */}
        <Button
          className="mt-4 bg-blue-700 hover:bg-blue-800 text-white"
          disabled={submitting || rating === 0}
          onClick={handleSubmit}
        >
          {submitting
            ? t("review.submitting", locale)
            : t("review.submit", locale)}
        </Button>
      </CardContent>
    </Card>
  );
}
