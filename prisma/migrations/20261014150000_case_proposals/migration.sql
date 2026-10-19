ALTER TABLE "customer_cases" ADD COLUMN "proposalRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "case_items" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "case_items" ADD COLUMN "archivedAt" DATETIME;
ALTER TABLE "case_items" ADD COLUMN "lastMutationKey" TEXT;
CREATE TABLE "case_proposals" ("id" TEXT NOT NULL PRIMARY KEY,"caseId" TEXT NOT NULL,"number" INTEGER NOT NULL,"requestKey" TEXT NOT NULL,"snapshot" TEXT NOT NULL,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "case_proposals_caseId_fkey" FOREIGN KEY("caseId") REFERENCES "customer_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE UNIQUE INDEX "case_proposals_caseId_number_key" ON "case_proposals"("caseId","number");
CREATE UNIQUE INDEX "case_proposals_caseId_requestKey_key" ON "case_proposals"("caseId","requestKey");
