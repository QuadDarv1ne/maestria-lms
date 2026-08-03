"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Upload, Send, FileText, CheckCircle2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import type { StepComponentProps } from "./StepTypes";

export function StepFileUpload({ step, locale, onSubmitAssignment }: StepComponentProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(t("course.step.fileTooLarge", locale));
        return;
      }
      setSelectedFile(file);
    }
  }, [locale]);

  const handleSubmit = useCallback(async () => {
    if (!selectedFile) {
      toast.error(t("course.step.selectFileFirst", locale));
      return;
    }
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("folder", "submissions");
    setUploading(true);
    setUploadProgress(0);
    try {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener("progress", (evt) => {
        if (evt.lengthComputable) {
          setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      });
      await new Promise<void>((resolve, reject) => {
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            try {
              const data = JSON.parse(xhr.responseText);
              reject(new Error(data.error || t("course.step.errorLoad", locale)));
            } catch {
              reject(new Error(t("course.step.errorLoad", locale)));
            }
          }
        });
        xhr.addEventListener("error", () => reject(new Error(t("course.step.errorLoad", locale))));
        xhr.open("POST", "/api/upload");
        xhr.send(formData);
      });

      const assignment = step.assignments?.[0];
      if (assignment) {
        await onSubmitAssignment(assignment.id, { fileName: selectedFile.name, uploaded: true });
      }
      setUploaded(true);
      toast.success(t("course.step.fileSent", locale));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("course.step.errorLoad", locale));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [selectedFile, step, onSubmitAssignment, locale]);

  return (
    <div className="space-y-4 mb-6">
      {step.content && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="prose prose-sm max-w-none whitespace-pre-wrap">{step.content}</div>
          </CardContent>
        </Card>
      )}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4 text-sm text-slate-600 dark:text-slate-400">
            <Upload className="w-4 h-4" />
            <span className="font-medium">{t("course.step.fileUpload", locale)}</span>
          </div>
          {!uploaded ? (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                <Upload className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-2">{t("course.step.dragDropFile", locale)}</p>
                <label className="inline-block cursor-pointer">
                  <span className="text-blue-600 hover:text-blue-700 text-sm font-medium">{t("course.step.browseFiles", locale)}</span>
                  <input type="file" className="hidden" onChange={handleFileSelect} accept=".pdf,.doc,.docx,.txt,.zip,.jpg,.png" />
                </label>
                <p className="text-xs text-muted-foreground mt-2">{t("course.step.maxFileSize", locale)}</p>
              </div>
              {selectedFile && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border dark:border-gray-700">
                  <FileText className="w-5 h-5 text-slate-600" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSelectedFile(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
              {uploading && (
                <div className="space-y-1">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-right">{uploadProgress}%</p>
                </div>
              )}
              <Button className="bg-slate-600 hover:bg-slate-700 text-white" onClick={handleSubmit} disabled={!selectedFile || uploading}>
                {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{uploadProgress}%</> : <><Send className="w-4 h-4 mr-2" />{t("course.step.submitFile", locale)}</>}
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
              <p className="text-sm font-medium mb-1">{t("course.step.fileUploaded", locale)}</p>
              {selectedFile && <p className="text-xs text-muted-foreground">{selectedFile.name}</p>}
              <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-0 mt-2">
                {t("course.step.awaitingReview", locale)}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
