-- Migration: admin_audit_log
--
-- Persistent trail of administrative actions (who changed what, when, from
-- which IP). Previously the admin "Logs" tab rendered demo data and the only
-- real source was `server.log`, which is not a durable audit record.
--
-- The actor is denormalised on purpose: a foreign key to User would either
-- block account erasure or cascade-delete the trail, and an anonymised user
-- (GDPR art.17) would leave entries with no readable author at all.

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "targetLabel" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Feed ordering and retention deletes both scan by time.
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
-- "what did this admin do" -- the main investigation query.
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
-- "history of this object" -- e.g. every change to one course.
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
