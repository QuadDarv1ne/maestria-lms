"use client";

import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/stores/ui";
import type { CourseFormData, CourseVisibility } from "./types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Globe, Users, BookOpen, X } from "lucide-react";

const VISIBILITY_OPTIONS = [
  { value: "public", label: "Публичный", description: "Виден всем пользователям" },
  { value: "private", label: "Приватный", description: "Доступ только по приглашению" },
  { value: "unlisted", label: "Скрытый", description: "Виден только по прямой ссылке" },
];

const LANGUAGE_OPTIONS = [
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
];

interface SettingsTabProps {
  form: CourseFormData;
  locale: Locale;
  onUpdateField: <K extends keyof CourseFormData>(key: K, value: CourseFormData[K]) => void;
  coursesList?: { id: string; title: string }[];
}

export function SettingsTab({ form, locale, onUpdateField, coursesList = [] }: SettingsTabProps) {
  const handleAddPrerequisite = (courseId: string) => {
    if (courseId && !form.prerequisites.includes(courseId)) {
      onUpdateField("prerequisites", [...form.prerequisites, courseId]);
    }
  };

  const handleRemovePrerequisite = (courseId: string) => {
    onUpdateField(
      "prerequisites",
      form.prerequisites.filter((p) => p !== courseId)
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Dates */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-700" />
            Даты проведения
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">Дата начала</Label>
            <Input
              id="startDate"
              type="datetime-local"
              value={form.startDate}
              onChange={(e) => onUpdateField("startDate", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">Дата окончания</Label>
            <Input
              id="endDate"
              type="datetime-local"
              value={form.endDate}
              onChange={(e) => onUpdateField("endDate", e.target.value)}
            />
          </div>
          {form.startDate && form.endDate && (
            <Badge variant="secondary">
              Длительность: {Math.ceil(
                (new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) /
                  (1000 * 60 * 60 * 24)
              )} дней
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Visibility & Access */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="w-5 h-5 text-violet-600" />
            Видимость и доступ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Видимость курса</Label>
            <Select
              value={form.visibility}
              onValueChange={(v) => onUpdateField("visibility", v as CourseVisibility)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISIBILITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div>
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs text-muted-foreground">{opt.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxStudents" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Максимальное количество студентов
            </Label>
            <Input
              id="maxStudents"
              type="number"
              min={0}
              placeholder="0 = без ограничения"
              value={form.maxStudents || ""}
              onChange={(e) => onUpdateField("maxStudents", Number(e.target.value) || 0)}
            />
            {form.maxStudents > 0 && (
              <p className="text-xs text-muted-foreground">
                Курс будет закрыт для записи после достижения лимита
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Language */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="w-5 h-5 text-amber-500" />
            Язык курса
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Основной язык курса</Label>
            <Select
              value={form.language}
              onValueChange={(v) => onUpdateField("language", v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Prerequisites */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-green-600" />
            Предварительные требования
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Курсы-пререквизиты</Label>
            <Select
              value=""
              onValueChange={handleAddPrerequisite}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Добавить курс-пререквизит" />
              </SelectTrigger>
              <SelectContent>
                {coursesList
                  .filter((c) => !form.prerequisites.includes(c.id))
                  .map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          {form.prerequisites.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Добавленные курсы:</p>
              <div className="flex flex-wrap gap-2">
                {form.prerequisites.map((prereqId) => (
                  <Badge key={prereqId} variant="secondary" className="flex items-center gap-1">
                    {coursesList.find((c) => c.id === prereqId)?.title || prereqId}
                    <button
                      className="ml-1 hover:text-red-500"
                      onClick={() => handleRemovePrerequisite(prereqId)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Студенты должны пройти эти курсы перед записью на текущий курс
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
