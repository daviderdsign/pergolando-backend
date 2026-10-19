ALTER TABLE "case_finance_entries" ADD COLUMN "sourceWorkId" TEXT;
CREATE INDEX "case_finance_entries_caseId_sourceWorkId_idx" ON "case_finance_entries"("caseId", "sourceWorkId");
CREATE TABLE "support_works" (
 "id" TEXT NOT NULL PRIMARY KEY, "ticketId" TEXT NOT NULL, "requestKey" TEXT NOT NULL, "title" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PLANNED', "revision" INTEGER NOT NULL DEFAULT 0, "snapshot" TEXT NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
 FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "support_works_ticketId_requestKey_key" ON "support_works"("ticketId", "requestKey");
CREATE INDEX "support_works_status_idx" ON "support_works"("status");
CREATE TABLE "support_work_events" (
 "id" TEXT NOT NULL PRIMARY KEY, "workId" TEXT NOT NULL, "revision" INTEGER NOT NULL, "requestKey" TEXT NOT NULL,
 "snapshot" TEXT NOT NULL, "sellerId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("workId") REFERENCES "support_works"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "support_work_events_workId_requestKey_key" ON "support_work_events"("workId", "requestKey");
CREATE UNIQUE INDEX "support_work_events_workId_revision_key" ON "support_work_events"("workId", "revision");
