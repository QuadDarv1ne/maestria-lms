"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/stores/ui";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function VideoUploadButton({ onUpload, locale }: { onUpload: (url: string) => void; locale: Locale }) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "lessons");

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }
      const data = await res.json();
      onUpload(data.url);
      toast.success(t("courseEditor.videoUploaded", locale));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("courseEditor.uploadError", locale));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <>
      <input
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
        {uploading ? "..." : t("courseEditor.upload", locale)}
      </Button>
    </>
  );
}
