"use client";

import { useState, useRef } from "react";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/stores/ui";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function VideoUploadButton({ onUpload, locale }: { onUpload: (url: string) => void; locale: Locale }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress(0);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "lessons");

    try {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (evt) => {
        if (evt.lengthComputable) {
          setProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      });

      const result = await new Promise<{ url: string }>((resolve, reject) => {
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            try {
              const data = JSON.parse(xhr.responseText);
              reject(new Error(data.error || t("courseEditor.uploadError", locale)));
            } catch {
              reject(new Error(t("courseEditor.uploadError", locale)));
            }
          }
        });
        xhr.addEventListener("error", () => reject(new Error(t("courseEditor.uploadError", locale))));
        xhr.open("POST", "/api/upload");
        xhr.send(formData);
      });

      onUpload(result.url);
      toast.success(t("courseEditor.videoUploaded", locale));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("courseEditor.uploadError", locale));
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        onChange={handleFile}
        disabled={uploading}
        className="hidden"
        id="video-upload"
      />
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs shrink-0"
        disabled={uploading}
        onClick={() => document.getElementById("video-upload")?.click()}
      >
        {uploading ? (
          <>
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            {progress}%
          </>
        ) : (
          t("courseEditor.upload", locale)
        )}
      </Button>
      {uploading && (
        <Progress value={progress} className="w-20 h-1.5" />
      )}
    </div>
  );
}
