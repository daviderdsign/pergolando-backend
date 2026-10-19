CREATE TABLE "case_order_batches" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "caseId" TEXT NOT NULL,
 "proposalId" TEXT NOT NULL,
 "requestKey" TEXT NOT NULL,
 "sellerId" TEXT NOT NULL,
 "snapshot" TEXT NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "case_order_batches_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "customer_cases" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "case_order_batches_caseId_requestKey_key" ON "case_order_batches"("caseId", "requestKey");
CREATE UNIQUE INDEX "case_order_batches_caseId_proposalId_key" ON "case_order_batches"("caseId", "proposalId");
