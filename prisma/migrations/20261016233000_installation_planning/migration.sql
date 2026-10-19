CREATE TABLE "case_installation_events" (
 "id" TEXT NOT NULL PRIMARY KEY, "caseId" TEXT NOT NULL, "revision" INTEGER NOT NULL,
 "requestKey" TEXT NOT NULL, "sellerId" TEXT NOT NULL, "snapshot" TEXT NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "case_installation_events_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "customer_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "case_installation_events_caseId_revision_key" ON "case_installation_events"("caseId", "revision");
CREATE UNIQUE INDEX "case_installation_events_caseId_requestKey_key" ON "case_installation_events"("caseId", "requestKey");
