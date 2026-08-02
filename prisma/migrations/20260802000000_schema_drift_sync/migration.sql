-- DropIndex
DROP INDEX "AssignmentSubmission_assignmentId_userId_key";

-- DropIndex
DROP INDEX "AssignmentSubmission_assignmentId_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN "pendingTwoFactorSecret" TEXT;

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" TEXT NOT NULL DEFAULT 'percentage',
    "discountValue" REAL NOT NULL,
    "minAmount" REAL NOT NULL DEFAULT 0,
    "maxDiscount" REAL,
    "maxUses" INTEGER NOT NULL DEFAULT 0,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "maxUsesPerUser" INTEGER NOT NULL DEFAULT 1,
    "validFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "courseId" TEXT,
    "usedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PromoCode_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lastAttemptAt" DATETIME,
    "nextRetryAt" DATETIME,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "excerpt" TEXT,
    "image" TEXT,
    "category" TEXT NOT NULL,
    "tags" TEXT,
    "readTime" INTEGER NOT NULL DEFAULT 5,
    "views" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Article_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Article" ("authorId", "category", "content", "createdAt", "excerpt", "id", "image", "isFeatured", "isPublished", "readTime", "slug", "tags", "title", "updatedAt", "views") SELECT "authorId", "category", "content", "createdAt", "excerpt", "id", "image", "isFeatured", "isPublished", "readTime", "slug", "tags", "title", "updatedAt", "views" FROM "Article";
DROP TABLE "Article";
ALTER TABLE "new_Article" RENAME TO "Article";
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");
CREATE INDEX "Article_isPublished_idx" ON "Article"("isPublished");
CREATE INDEX "Article_category_idx" ON "Article"("category");
CREATE INDEX "Article_authorId_idx" ON "Article"("authorId");
CREATE INDEX "Article_isFeatured_createdAt_idx" ON "Article"("isFeatured", "createdAt");
CREATE INDEX "Article_slug_idx" ON "Article"("slug");
CREATE INDEX "Article_isPublished_category_createdAt_idx" ON "Article"("isPublished", "category", "createdAt");
CREATE INDEX "Article_isPublished_isFeatured_views_idx" ON "Article"("isPublished", "isFeatured", "views");
CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paymentMethod" TEXT NOT NULL,
    "paymentProvider" TEXT,
    "transactionId" TEXT,
    "paymentData" TEXT,
    "promoCodeId" TEXT,
    "discountAmount" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Payment" ("amount", "courseId", "createdAt", "currency", "id", "paymentData", "paymentMethod", "paymentProvider", "status", "transactionId", "updatedAt", "userId") SELECT "amount", "courseId", "createdAt", "currency", "id", "paymentData", "paymentMethod", "paymentProvider", "status", "transactionId", "updatedAt", "userId" FROM "Payment";
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");
CREATE INDEX "Payment_courseId_idx" ON "Payment"("courseId");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
CREATE INDEX "Payment_transactionId_idx" ON "Payment"("transactionId");
CREATE INDEX "Payment_userId_courseId_status_idx" ON "Payment"("userId", "courseId", "status");
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");
CREATE INDEX "Payment_paymentMethod_status_idx" ON "Payment"("paymentMethod", "status");
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE INDEX "PromoCode_code_idx" ON "PromoCode"("code");

-- CreateIndex
CREATE INDEX "PromoCode_isActive_idx" ON "PromoCode"("isActive");

-- CreateIndex
CREATE INDEX "PromoCode_courseId_idx" ON "PromoCode"("courseId");

-- CreateIndex
CREATE INDEX "PromoCode_validUntil_idx" ON "PromoCode"("validUntil");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_nextRetryAt_idx" ON "WebhookEvent"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_type_idx" ON "WebhookEvent"("type");

-- CreateIndex
CREATE INDEX "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_assignmentId_userId_idx" ON "AssignmentSubmission"("assignmentId", "userId");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_gradedBy_idx" ON "AssignmentSubmission"("gradedBy");

-- CreateIndex
CREATE INDEX "Certificate_issuedAt_idx" ON "Certificate"("issuedAt");

-- CreateIndex
CREATE INDEX "Course_isPublished_level_createdAt_idx" ON "Course"("isPublished", "level", "createdAt");

-- CreateIndex
CREATE INDEX "Course_isPublished_categoryId_createdAt_idx" ON "Course"("isPublished", "categoryId", "createdAt");

-- CreateIndex
CREATE INDEX "Course_isPublished_isFeatured_rating_idx" ON "Course"("isPublished", "isFeatured", "rating");

-- CreateIndex
CREATE INDEX "Course_isPublished_price_idx" ON "Course"("isPublished", "price");

-- CreateIndex
CREATE INDEX "Course_slug_idx" ON "Course"("slug");

-- CreateIndex
CREATE INDEX "Course_teacherId_isPublished_idx" ON "Course"("teacherId", "isPublished");

-- CreateIndex
CREATE INDEX "Course_isPublished_studentCount_idx" ON "Course"("isPublished", "studentCount");

-- CreateIndex
CREATE INDEX "Course_isPublished_language_idx" ON "Course"("isPublished", "language");

-- CreateIndex
CREATE INDEX "Enrollment_userId_status_idx" ON "Enrollment"("userId", "status");

-- CreateIndex
CREATE INDEX "Enrollment_userId_enrolledAt_idx" ON "Enrollment"("userId", "enrolledAt");

-- CreateIndex
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_type_createdAt_idx" ON "Notification"("type", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_read_createdAt_idx" ON "Notification"("read", "createdAt");

-- CreateIndex
CREATE INDEX "Progress_lessonId_completed_idx" ON "Progress"("lessonId", "completed");

-- CreateIndex
CREATE INDEX "Progress_userId_lastAccessed_idx" ON "Progress"("userId", "lastAccessed");

-- CreateIndex
CREATE INDEX "Progress_userId_score_idx" ON "Progress"("userId", "score");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expires_idx" ON "Session"("expires");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "VerificationToken_expires_idx" ON "VerificationToken"("expires");
