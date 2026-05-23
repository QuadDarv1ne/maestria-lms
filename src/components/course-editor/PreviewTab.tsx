"use client";

import { useMemo } from "react";
import { t } from "@/lib/i18n";
import { lessonTypeIcon, levelLabels, levelColors, CATEGORIES } from "@/lib/constants";
import { formatNumber, getInitials } from "@/lib/utils";
import type { Locale } from "@/lib/stores/ui";
import type { CourseFormData } from "./types";
import type { UserData } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Eye, Clock, BookOpen, Users, Award, ArrowLeft, CheckCircle2, Save, Send,
} from "lucide-react";

interface PreviewTabProps {
  form: CourseFormData;
  locale: Locale;
  user: UserData | null;
  saving: boolean;
  onSave: (publish: boolean) => void;
  onBackToEdit: () => void;
  onNavigate: (page: string) => void;
}

export function PreviewTab({
  form, locale, user, saving, onSave, onBackToEdit, onNavigate,
}: PreviewTabProps) {
  const totalLessons = useMemo(
    () => form.modules.reduce((acc, m) => acc + m.lessons.length, 0),
    [form.modules]
  );
  const totalDuration = useMemo(
    () => form.modules.reduce((acc, m) => acc + m.lessons.reduce((la, l) => la + (l.duration || 0), 0), 0),
    [form.modules]
  );
  const freeLessons = useMemo(
    () => form.modules.reduce((acc, m) => acc + m.lessons.filter((l) => l.isFree).length, 0),
    [form.modules]
  );
  const categoryLabel = form.categorySlug
    ? (() => { const c = CATEGORIES.find((cat) => cat.slug === form.categorySlug); return c ? t(c.labelKey, locale) : ""; })()
    : "";

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4 flex items-center gap-3">
          <Eye className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            {t("courseEditor.previewBanner", locale)}
          </p>
        </CardContent>
      </Card>

      <div className="rounded-xl overflow-hidden">
        <section className="bg-gradient-to-br from-blue-800 to-violet-800 text-white">
          <div className="container mx-auto px-6 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <div className="flex items-center gap-2 mb-3">
                  {form.categorySlug && (
                    <Badge className="bg-white/20 text-white border-0">
                      {categoryLabel}
                    </Badge>
                  )}
                  <Badge className={levelColors[form.level]}>
                    {t(levelLabels[form.level], locale)}
                  </Badge>
                  {form.isPublished ? (
                    <Badge className="bg-green-500/20 text-green-200 border-0 text-xs">
                      {t("common.published", locale)}
                    </Badge>
                  ) : (
                    <Badge className="bg-yellow-500/20 text-yellow-200 border-0 text-xs">
                      {t("common.draft", locale)}
                    </Badge>
                  )}
                </div>
                <h1 className="text-2xl md:text-4xl font-bold mb-3">
                  {form.title || t("courseEditor.fieldTitleFallback", locale)}
                </h1>
                {form.shortDesc && (
                  <p className="text-blue-100 text-lg mb-4">{form.shortDesc}</p>
                )}
                <div className="flex flex-wrap items-center gap-4 text-sm text-blue-100">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {form.duration || t("courseEditor.minutes", locale).replace("{count}", String(totalDuration))}
                  </span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-4 h-4" />
                    {t("courseEditor.totalLessons", locale).replace("{count}", String(totalLessons))}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {t("courseEditor.zeroStudents", locale)}
                  </span>
                  {form.hasCertificate && (
                    <span className="flex items-center gap-1">
                      <Award className="w-4 h-4" />
                      {t("common.certificate", locale)}
                    </span>
                  )}
                </div>
                {form.tags && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {form.tags.split(",").filter(Boolean).map((tag, i) => (
                      <Badge key={i} className="bg-white/10 text-white/80 border-0 text-xs">
                        {tag.trim()}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="lg:col-span-1">
                <Card className="border-0 shadow-xl">
                  <CardContent className="p-6">
                    <div className="mb-4">
                      {form.price === 0 ? (
                        <span className="text-3xl font-bold text-green-600">
                          {t("courseCard.free", locale)}
                        </span>
                      ) : (
                        <div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold">
                              {formatNumber(form.price, locale)} ₽
                            </span>
                            {form.oldPrice > form.price && (
                              <span className="text-lg text-muted-foreground line-through">
                                {formatNumber(form.oldPrice, locale)} ₽
                              </span>
                            )}
                          </div>
                          {form.oldPrice > form.price && form.price > 0 && (
                            <Badge className="mt-1 bg-red-100 text-red-700 border-0">
                              {t("courseEditor.discountPercent", locale).replace("{percent}", String(Math.round(
                                ((form.oldPrice - form.price) / form.oldPrice) * 100
                              )))}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="mt-4 text-xs text-muted-foreground space-y-1">
                      <p>✅ {t("courseEditor.lessonsCount", locale).replace("{count}", String(totalLessons))}</p>
                      <p>✅ {t("courseEditor.freeLessons", locale).replace("{count}", String(freeLessons))}</p>
                      <p>✅ {t("courseEditor.learningDuration", locale).replace("{duration}", form.duration || t("courseEditor.minutes", locale).replace("{count}", String(totalDuration)))}</p>
                      {form.hasCertificate && <p>✅ {t("courseEditor.certificateCompletion", locale)}</p>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <div className="container mx-auto px-6 py-8 bg-white">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {form.whatYouLearn.filter(Boolean).length > 0 && (
                <div>
                  <h2 className="text-xl font-bold mb-4">
                    {t("courseEditor.sectionWhatYouLearnPreview", locale)}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {form.whatYouLearn.filter(Boolean).map((item, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {form.description && (
                <div>
                  <h2 className="text-xl font-bold mb-4">{t("courseEditor.sectionAboutCourse", locale)}</h2>
                  <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
                    {form.description}
                  </div>
                </div>
              )}

              {form.requirements.filter(Boolean).length > 0 && (
                <div>
                  <h2 className="text-xl font-bold mb-4">
                    {t("courseEditor.sectionRequirements", locale)}
                  </h2>
                  <ul className="space-y-2">
                    {form.requirements.filter(Boolean).map((req, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span>•</span>
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {form.modules.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold mb-4">
                    {t("courseEditor.programWithCount", locale).replace("{count}", String(form.modules.length))}
                  </h2>
                  <div className="space-y-2">
                    {form.modules.map((mod, mIdx) => (
                      <div key={mod.id} className="border rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 bg-violet-100 text-violet-700 rounded-lg flex items-center justify-center text-sm font-semibold">
                            {mIdx + 1}
                          </span>
                          <div>
                            <p className="font-semibold text-sm">
                              {mod.title || t("courseEditor.moduleName", locale).replace("{number}", String(mIdx + 1))}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {t("courseEditor.lessonsCountInModule", locale).replace("{count}", String(mod.lessons.length))}
                            </p>
                          </div>
                        </div>
                        {mod.lessons.length > 0 && (
                          <div className="mt-3 ml-11 space-y-1">
                            {mod.lessons.map((lesson, lIdx) => (
                              <div key={lesson.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                                {lessonTypeIcon(lesson.type)}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm truncate">
                                    {lesson.title || t("courseEditor.lessonName", locale).replace("{number}", String(lIdx + 1))}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {lesson.isFree && (
                                    <Badge variant="outline" className="text-[10px] text-green-600 border-green-300">
                                      {t("courseCard.free", locale)}
                                    </Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {t("courseEditor.minutes", locale).replace("{count}", String(lesson.duration))}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h2 className="text-xl font-bold mb-4">
                  {t("courseEditor.sectionInstructor", locale)}
                </h2>
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center text-violet-700 font-bold text-xl">
                      {getInitials(user?.name, "?")}
                    </div>
                    <div>
                      <h3 className="font-semibold">
                        {user?.name || t("courseEditor.sectionInstructor", locale)}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {t("courseEditor.authorLabel", locale)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 pb-8">
        <Button variant="outline" onClick={onBackToEdit}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("courseEditor.backToEdit", locale)}
        </Button>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => onNavigate("admin")} className="text-muted-foreground">
            {t("common.cancel", locale)}
          </Button>
          <Button
            variant="outline"
            className="border-blue-200 text-blue-700 hover:bg-blue-50"
            onClick={() => onSave(false)}
            disabled={saving}
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? t("common.saving", locale) : t("courseEditor.saveDraft", locale)}
          </Button>
          <Button
            className="bg-blue-700 hover:bg-blue-800 text-white"
            onClick={() => onSave(true)}
            disabled={saving}
          >
            <Send className="w-4 h-4 mr-2" />
            {saving ? t("common.publishing", locale) : t("courseEditor.publish", locale)}
          </Button>
        </div>
      </div>
    </div>
  );
}
