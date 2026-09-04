"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { apiErrorMessage } from "@/lib/api-error-codes";
import { formatFileSize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Paperclip,
  FileText,
  FileArchive,
  FileImage,
  FileVideo,
  FileSpreadsheet,
  File as FileIcon,
  Download,
  Trash2,
  Upload,
  Loader2,
  AlertTriangle,
} from "lucide-react";

export interface LessonAttachmentItem {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  createdAt: string;
  addedBy: { id: string; name: string | null };
}

interface LessonAttachmentsProps {
  courseId: string;
  lessonId: string;
}

const MAX_ATTACHMENT_SIZE = 100 * 1024 * 1024;

function fileIcon(type: string, className = "w-5 h-5") {
  if (type.startsWith("image/")) return <FileImage className={className} />;
  if (type.startsWith("video/")) return <FileVideo className={className} />;
  if (type.includes("spreadsheet") || type === "text/csv") {
    return <FileSpreadsheet className={className} />;
  }
  if (
    type.includes("zip") ||
    type.includes("octet-stream") ||
    type.includes("presentation")
  ) {
    return <FileArchive className={className} />;
  }
  if (type.startsWith("text/") || type === "application/pdf") {
    return <FileText className={className} />;
  }
  return <FileIcon className={className} />;
}

export function LessonAttachments({ courseId, lessonId }: LessonAttachmentsProps) {
  const locale = useAppStore((s) => s.locale);
  const [attachments, setAttachments] = useState<LessonAttachmentItem[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchAttachments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/lessons/${lessonId}/attachments`);
      if (res.ok) {
        const data = await res.json();
        setAttachments(data.attachments ?? []);
        setCanManage(!!data.canManage);
      }
    } catch {
      // silent — show empty state
    } finally {
      setLoading(false);
    }
  }, [courseId, lessonId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const upload = async (file: File) => {
    if (file.size > MAX_ATTACHMENT_SIZE) {
      toast.error(t("attachments.fileTooLarge", locale));
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    setUploadProgress(0);
    try {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (evt) => {
        if (evt.lengthComputable) {
          setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      });
      const responseText = await new Promise<string>((resolve, reject) => {
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.responseText);
          } else {
            try {
              const data = JSON.parse(xhr.responseText);
              reject(new Error(apiErrorMessage(data, locale, "attachments.uploadError")));
            } catch {
              reject(new Error(t("attachments.uploadError", locale)));
            }
          }
        });
        xhr.addEventListener("error", () => reject(new Error(t("attachments.uploadError", locale))));
        xhr.open("POST", `/api/courses/${courseId}/lessons/${lessonId}/attachments`);
        xhr.send(formData);
      });
      const data = JSON.parse(responseText);
      setAttachments((prev) => [...prev, data.attachment]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("attachments.uploadError", locale));
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
  };

  const remove = async (item: LessonAttachmentItem) => {
    setDeletingId(null);
    try {
      const res = await fetch(
        `/api/courses/${courseId}/lessons/${lessonId}/attachments/${item.id}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        setAttachments((prev) => prev.filter((a) => a.id !== item.id));
      }
    } catch {
      // keep item on failure
    }
  };

  return (
    <section className="mt-10" aria-label={t("attachments.title", locale)}>
      <Separator className="mb-6" />
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Paperclip className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold">{t("attachments.title", locale)}</h2>
          {!loading && attachments.length > 0 && (
            <Badge variant="secondary">{attachments.length}</Badge>
          )}
        </div>

        {canManage && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  {uploadProgress > 0 ? `${uploadProgress}%` : t("attachments.uploading", locale)}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-1" />
                  {t("attachments.upload", locale)}
                </>
              )}
            </Button>
          </>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : attachments.length === 0 ? (
        <div className="text-center py-8 bg-muted/30 rounded-lg">
          <FileIcon className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{t("attachments.empty", locale)}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {attachments.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-lg border bg-card p-3"
            >
              <span className="shrink-0 text-blue-600 dark:text-blue-400">
                {fileIcon(item.type)}
              </span>
              <div className="flex-1 min-w-0">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm font-medium truncate hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  {item.name}
                </a>
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(item.size, locale)}
                </span>
              </div>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("attachments.download", locale)}
                className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Download className="w-4 h-4" />
              </a>
              {canManage &&
                (deletingId === item.id ? (
                  <span className="inline-flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                    <button
                      type="button"
                      onClick={() => remove(item)}
                      className="text-xs text-red-600 hover:text-red-700 font-medium transition-colors"
                    >
                      {t("attachments.confirmDelete", locale)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingId(null)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {t("attachments.cancel", locale)}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeletingId(item.id)}
                    aria-label={t("attachments.delete", locale)}
                    className="inline-flex items-center justify-center size-8 rounded-md text-muted-foreground hover:text-red-600 hover:bg-muted transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ))}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
