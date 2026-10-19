CREATE TABLE "case_notifications" ("id" TEXT NOT NULL PRIMARY KEY,"caseId" TEXT NOT NULL,"invitationId" TEXT NOT NULL,"kind" TEXT NOT NULL,"recipient" TEXT NOT NULL,"subject" TEXT NOT NULL,"text" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'PENDING',"attempts" INTEGER NOT NULL DEFAULT 0,"errorCode" TEXT,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"completedAt" DATETIME);
CREATE UNIQUE INDEX "case_notifications_invitationId_kind_key" ON "case_notifications"("invitationId","kind");
CREATE INDEX "case_notifications_caseId_createdAt_idx" ON "case_notifications"("caseId","createdAt");
