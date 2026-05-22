-- AlterTable
ALTER TABLE "Course" ADD COLUMN "startDate" DateTime;
ALTER TABLE "Course" ADD COLUMN "endDate" DateTime;
ALTER TABLE "Course" ADD COLUMN "visibility" String DEFAULT 'public';
ALTER TABLE "Course" ADD COLUMN "maxStudents" Int;
ALTER TABLE "Course" ADD COLUMN "prerequisites" String;
ALTER TABLE "Course" ADD COLUMN "language" String DEFAULT 'ru';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "gradedSubmissions" String;

-- CreateTable
CREATE TABLE "AssignmentSubmission" (
    "id" String NOT NULL,
    "assignmentId" String NOT NULL,
    "userId" String NOT NULL,
    "answer" String NOT NULL,
    "score" Int,
    "maxScore" Int NOT NULL DEFAULT 100,
    "grade" String,
    "feedback" String,
    "status" String NOT NULL DEFAULT 'submitted',
    "submittedAt" DateTime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradedAt" DateTime,
    "gradedBy" String,
    "createdAt" DateTime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DateTime NOT NULL,

    CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentSubmission_assignmentId_userId_key" ON "AssignmentSubmission"("assignmentId", "userId");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_userId_status_idx" ON "AssignmentSubmission"("userId", "status");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_assignmentId_idx" ON "AssignmentSubmission"("assignmentId");

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_gradedBy_fkey" FOREIGN KEY ("gradedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
