"use client";

import { useState } from "react";
import NextImage from "next/image";
import { t } from "@/lib/i18n";
import { toast } from "sonner";
import type { Locale } from "@/lib/stores/ui";
import type { CourseFormData } from "./types";
import { CATEGORIES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, GraduationCap, Image, Star, Upload, Loader2 } from "lucide-react";

const CATEGORY_OPTIONS = CATEGORIES;

interface BasicTabProps {
  form: CourseFormData;
  locale: Locale;
  levelOptions: { value: string; label: string }[];
  onUpdateField: <K extends keyof CourseFormData>(key: K, value: CourseFormData[K]) => void;
  onTitleChange: (title: string) => void;
  onNextTab: () => void;
}

export function BasicTab({
  form, locale, levelOptions, onUpdateField, onTitleChange, onNextTab: _onNextTab,
}: BasicTabProps) {
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("courseEditor.fileTooLarge", locale));
      return;
    }
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "courses");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t("courseEditor.uploadError", locale));
      }
      const data = await res.json();
      onUpdateField("image", data.url);
      toast.success(t("courseEditor.imageUploaded", locale));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("courseEditor.uploadError", locale));
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-700" />
              {t("courseEditor.sectionCourseInfo", locale)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t("courseEditor.fieldTitle", locale)}</Label>
              <Input
                id="title"
                placeholder={t("courseEditor.titlePlaceholder", locale)}
                value={form.title}
                onChange={(e) => onTitleChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">{t("courseEditor.slugLabel", locale)}</Label>
              <Input
                id="slug"
                placeholder={t("editor.basic.slug_placeholder", locale)}
                value={form.slug}
                onChange={(e) => onUpdateField("slug", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("courseEditor.autoSlug", locale)}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shortDesc">{t("courseEditor.fieldShortDesc", locale)}</Label>
              <Input
                id="shortDesc"
                placeholder={t("courseEditor.shortDescPlaceholder", locale)}
                maxLength={200}
                value={form.shortDesc}
                onChange={(e) => onUpdateField("shortDesc", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t("courseEditor.fieldFullDesc", locale)}</Label>
              <Textarea
                id="description"
                placeholder={t("courseEditor.descriptionPlaceholder", locale)}
                rows={7}
                value={form.description}
                onChange={(e) => onUpdateField("description", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">{t("courseEditor.fieldTags", locale)}</Label>
              <Input
                id="tags"
                placeholder={t("courseEditor.tagsPlaceholder", locale)}
                value={form.tags}
                onChange={(e) => onUpdateField("tags", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-violet-600" />
              {t("courseEditor.categoryAndLevel", locale)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("courseEditor.fieldCategory", locale)}</Label>
              <Select
                value={form.categorySlug}
                onValueChange={(v) => onUpdateField("categorySlug", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("courseEditor.categoryPlaceholder", locale)} />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <SelectItem key={cat.slug} value={cat.slug}>
                      <span className="mr-2">{cat.icon}</span>
                      {t(cat.labelKey, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("courseEditor.fieldLevel", locale)}</Label>
              <Select
                value={form.level}
                onValueChange={(v) => onUpdateField("level", v as CourseFormData["level"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {levelOptions.map((lvl) => (
                    <SelectItem key={lvl.value} value={lvl.value}>
                      {lvl.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">{t("courseEditor.fieldDuration", locale)}</Label>
              <Input
                id="duration"
                placeholder={t("courseEditor.durationPlaceholder", locale)}
                value={form.duration}
                onChange={(e) => onUpdateField("duration", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Image className="w-5 h-5 text-blue-600" />
              {t("courseEditor.courseCover", locale)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="relative h-40 rounded-lg bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-muted-foreground/20"
            >
              {form.image ? (
                <NextImage
                  src={form.image}
                  alt={t("courseEditor.coverPreview", locale) || "Course cover"}
                  className="absolute inset-0 w-full h-full object-cover"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              ) : (
                <div className="text-center text-muted-foreground">
                  <Image className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">{t("courseEditor.noCover", locale)}</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                disabled={uploadingImage}
                className="hidden"
                id="cover-upload"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={uploadingImage}
                onClick={() => document.getElementById("cover-upload")?.click()}
              >
                {uploadingImage ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-1" />
                )}
                {uploadingImage ? t("courseEditor.uploading", locale) : t("courseEditor.uploadCover", locale)}
              </Button>
              {form.image && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-700"
                  onClick={() => onUpdateField("image", "")}
                >
                  {t("common.remove", locale)}
                </Button>
              )}
            </div>
            <Input
              placeholder="https://example.com/course-cover.jpg"
              value={form.image}
              onChange={(e) => onUpdateField("image", e.target.value)}
              className="text-xs"
            />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              {t("courseEditor.priceAndCertificate", locale)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">{t("courseEditor.fieldPrice", locale)}</Label>
                <Input
                  id="price" type="number" min={0}
                  value={form.price}
                  onChange={(e) => onUpdateField("price", Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oldPrice">{t("courseEditor.fieldOldPrice", locale)}</Label>
                <Input
                  id="oldPrice" type="number" min={0}
                  placeholder={t("courseEditor.optional", locale)}
                  value={form.oldPrice || ""}
                  onChange={(e) => onUpdateField("oldPrice", Number(e.target.value) || 0)}
                />
              </div>
            </div>
            {form.price === 0 && (
              <Badge className="bg-green-100 text-green-700 border-0">
                {t("courseEditor.freeCourse", locale)}
              </Badge>
            )}
            {form.oldPrice > form.price && form.price > 0 && (
              <Badge className="bg-red-100 text-red-700 border-0">
                {t("courseEditor.discountPercent", locale).replace("{percent}", String(Math.round(
                  ((form.oldPrice - form.price) / form.oldPrice) * 100
                )))}
              </Badge>
            )}
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>{t("courseEditor.fieldCertificate", locale)}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("courseEditor.certificateHint", locale)}
                </p>
              </div>
              <Switch
                checked={form.hasCertificate}
                onCheckedChange={(v) => onUpdateField("hasCertificate", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>{t("courseEditor.fieldRecommended", locale)}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("courseEditor.recommendedHint", locale)}
                </p>
              </div>
              <Switch
                checked={form.isFeatured}
                onCheckedChange={(v) => onUpdateField("isFeatured", v)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
