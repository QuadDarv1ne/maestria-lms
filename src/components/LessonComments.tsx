"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { apiErrorMessage } from "@/lib/api-error-codes";
import { formatDate, getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  MessageCircle,
  Send,
  Pencil,
  Trash2,
  Reply,
  User as UserIcon,
  Loader2,
  AlertTriangle,
} from "lucide-react";

export interface LessonCommentItem {
  id: string;
  content: string;
  isEdited: boolean;
  createdAt: string;
  parentId: string | null;
  user: {
    id: string;
    name: string | null;
    image: string | null;
    role: string;
  };
}

interface LessonCommentsProps {
  courseId: string;
  lessonId: string;
}

const ROLE_LABEL_KEY: Record<string, string> = {
  teacher: "comments.roleTeacher",
  admin: "comments.roleAdmin",
};

export function LessonComments({ courseId, lessonId }: LessonCommentsProps) {
  const locale = useAppStore((s) => s.locale);
  const user = useAppStore((s) => s.user);
  const [comments, setComments] = useState<LessonCommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyTarget, setReplyTarget] = useState<LessonCommentItem | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const replyInputRef = useRef<HTMLTextAreaElement | null>(null);

  const isLoggedIn = !!user;

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/lessons/${lessonId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments ?? []);
      }
    } catch {
      // silent — show empty state
    } finally {
      setLoading(false);
    }
  }, [courseId, lessonId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const commentsByParent = useMemo(() => {
    const map: Record<string, LessonCommentItem[]> = {};
    for (const c of comments) {
      const key = c.parentId ?? "root";
      (map[key] ??= []).push(c);
    }
    return map;
  }, [comments]);

  const rootComments = commentsByParent["root"] ?? [];

  const canModerate = (item: LessonCommentItem) =>
    isLoggedIn &&
    (user?.id === item.user.id || user?.role === "admin" || user?.role === "teacher");

  const submit = async (content: string, parentId?: string) => {
    if (!content.trim() || posting) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/lessons/${lessonId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), parentId: parentId ?? null }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(apiErrorMessage(data, locale, "comments.errorPost"));
        return;
      }
      setComments((prev) => [data.comment, ...prev]);
      if (!parentId) {
        setDraft("");
      } else {
        setReplyTarget(null);
        setReplyDrafts((prev) => ({ ...prev, [parentId]: "" }));
      }
    } catch {
      toast.error(t("comments.errorPost", locale));
    } finally {
      setPosting(false);
    }
  };

  const saveEdit = async (item: LessonCommentItem) => {
    if (!editDraft.trim() || posting) return;
    setPosting(true);
    try {
      const res = await fetch(
        `/api/courses/${courseId}/lessons/${lessonId}/comments/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: editDraft.trim() }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(apiErrorMessage(data, locale, "comments.errorEdit"));
        return;
      }
      setComments((prev) => prev.map((c) => (c.id === item.id ? data.comment : c)));
      setEditingId(null);
      setEditDraft("");
    } catch {
      toast.error(t("comments.errorEdit", locale));
    } finally {
      setPosting(false);
    }
  };

  const remove = async (item: LessonCommentItem) => {
    setConfirmingDeleteId(null);
    try {
      const res = await fetch(
        `/api/courses/${courseId}/lessons/${lessonId}/comments/${item.id}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== item.id && c.parentId !== item.id));
      }
    } finally {
      // noop
    }
  };

  const startReply = (item: LessonCommentItem) => {
    setReplyTarget(item);
    setEditingId(null);
    requestAnimationFrame(() => replyInputRef.current?.focus());
  };

  const renderComment = (item: LessonCommentItem, isReply = false) => {
    const replyDraft = replyDrafts[item.id] ?? "";
    return (
      <div key={item.id} className={`${isReply ? "ml-8 sm:ml-12 mt-3" : "mt-4"}`}>
        <div className="flex gap-3">
          <Avatar className="size-8 shrink-0 mt-0.5">
            {item.user.image ? (
              <AvatarImage src={item.user.image} alt={item.user.name || ""} />
            ) : (
              <AvatarFallback className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs">
                {getInitials(item.user.name)}
              </AvatarFallback>
            )}
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
              <span className="text-sm font-semibold">
                {item.user.name || t("comments.anonymous", locale)}
              </span>
              {ROLE_LABEL_KEY[item.user.role] && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {t(ROLE_LABEL_KEY[item.user.role], locale)}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {formatDate(item.createdAt, locale, { day: "numeric", month: "short", year: "numeric" })}
                {item.isEdited && ` · ${t("comments.edited", locale)}`}
              </span>
            </div>

            {editingId === item.id ? (
              <div className="space-y-2">
                <Textarea
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  className="min-h-20 text-sm"
                  maxLength={2000}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveEdit(item)} disabled={posting}>
                    {posting && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                    {t("comments.save", locale)}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditDraft(""); }}>
                    {t("comments.cancel", locale)}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">
                {item.content}
              </p>
            )}

            <div className="flex items-center gap-2 mt-1.5">
              {isLoggedIn && !isReply && (
                <button
                  type="button"
                  onClick={() => startReply(item)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Reply className="w-3 h-3" />
                  {t("comments.reply", locale)}
                </button>
              )}
              {canModerate(item) && (
                <>
                  <button
                    type="button"
                    onClick={() => { setEditingId(item.id); setEditDraft(item.content); setReplyTarget(null); }}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    {t("comments.edit", locale)}
                  </button>
                  {confirmingDeleteId === item.id ? (
                    <span className="inline-flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3 text-red-500" />
                      <button
                        type="button"
                        onClick={() => remove(item)}
                        className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors"
                      >
                        {t("comments.confirmDelete", locale)}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDeleteId(null)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {t("comments.cancel", locale)}
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setConfirmingDeleteId(item.id); setEditingId(null); setReplyTarget(null); }}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      {t("comments.delete", locale)}
                    </button>
                  )}
                </>
              )}
            </div>

            {replyTarget?.id === item.id && (
              <div className="mt-2 space-y-2">
                <Textarea
                  ref={replyInputRef}
                  value={replyDraft}
                  onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  placeholder={t("comments.replyPlaceholder", locale)}
                  className="min-h-16 text-sm"
                  maxLength={2000}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => submit(replyDraft, item.id)}
                    disabled={posting || !replyDraft.trim()}
                  >
                    {posting && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                    <Send className="w-3.5 h-3.5 mr-1" />
                    {t("comments.send", locale)}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setReplyTarget(null)}>
                    {t("comments.cancel", locale)}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {(commentsByParent[item.id] ?? []).map((reply) => renderComment(reply, true))}
      </div>
    );
  };

  return (
    <section className="mt-10" aria-label={t("comments.title", locale)}>
      <Separator className="mb-6" />
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h2 className="text-lg font-semibold">{t("comments.title", locale)}</h2>
        {!loading && comments.length > 0 && (
          <Badge variant="secondary">{comments.length}</Badge>
        )}
      </div>

      {!isLoggedIn ? (
        <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
          {t("comments.loginHint", locale)}
        </p>
      ) : (
        <div className="mb-6">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("comments.placeholder", locale)}
            className="min-h-24 text-sm"
            maxLength={2000}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-muted-foreground">{draft.length}/2000</span>
            <Button
              className="bg-blue-700 hover:bg-blue-800 text-white"
              onClick={() => submit(draft)}
              disabled={posting || !draft.trim()}
            >
              {posting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              <Send className="w-4 h-4 mr-1" />
              {t("comments.send", locale)}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : rootComments.length === 0 ? (
        <div className="text-center py-8 bg-muted/30 rounded-lg">
          <UserIcon className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t("comments.noComments", locale)}</p>
        </div>
      ) : (
        <div>{rootComments.map((c) => renderComment(c))}</div>
      )}
    </section>
  );
}
