"use client";

import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/stores/ui";
import type { CourseFormData } from "./types";
import { CATEGORIES } from "@/lib/constants";
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
import { FileText, GraduationCap, Star } from "lucide-react";

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
                placeholder="python-beginners"
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
