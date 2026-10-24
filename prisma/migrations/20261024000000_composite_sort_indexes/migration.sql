-- Add composite index for Module(courseId, sortOrder) — speeds up lesson ordering within courses
CREATE INDEX "Module_courseId_sortOrder_idx" ON "Module"("courseId", "sortOrder");

-- Add composite index for Lesson(moduleId, sortOrder) — speeds up lesson ordering within modules
CREATE INDEX "Lesson_moduleId_sortOrder_idx" ON "Lesson"("moduleId", "sortOrder");
