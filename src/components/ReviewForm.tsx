"use client";

import React, { useState } from "react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";
import { toast } from "sonner";

interface ReviewFormProps {
  courseId: string;
  onReviewSubmitted: () => void;
}

const RATING_LABELS: Record<number, string> = {
  1: "Ужасно",
  2: "Плохо",
  3: "Нормально",
  4: "Хорошо",
  5: "Отлично",
};

const MAX_COMMENT_LENGTH = 500;

export function ReviewForm({ courseId, onReviewSubmitted }: ReviewFormProps) {
  const user = useAppStore((s) => s.user);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Only show for logged-in, enrolled users.
  // The enrollment check is deferred to the API; we hide the form if there's
  // no logged-in user. The parent page can also gate this with `course.isEnrolled`.
  if (!user) return null;

  const displayRating = hoverRating || rating;

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Пожалуйста, выберите оценку");
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
        toast.success(data.updated ? "Отзыв обновлён" : "Отзыв добавлен");
        setRating(0);
        setHoverRating(0);
        setComment("");
        onReviewSubmitted();
      } else {
        toast.error(data.error || "Не удалось отправить отзыв");
      }
    } catch {
      toast.error("Произошла ошибка при отправке отзыва");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-6">
        <h3 className="text-lg font-bold mb-4">Оставить отзыв</h3>

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
                aria-label={RATING_LABELS[starValue]}
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
              {RATING_LABELS[displayRating]}
            </span>
          )}
        </div>

        {/* Comment textarea */}
        <div className="mt-4">
          <Textarea
            placeholder="Комментарий (необязательно)"
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
          {submitting ? "Отправка..." : "Отправить отзыв"}
        </Button>
      </CardContent>
    </Card>
  );
}
