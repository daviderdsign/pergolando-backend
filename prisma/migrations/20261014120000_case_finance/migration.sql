ALTER TABLE "customer_cases" ADD COLUMN "financeRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "customer_cases" ADD COLUMN "costsComplete" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "customer_cases" ADD COLUMN "deliveredAt" DATETIME;
CREATE TABLE "case_finance_entries" ("id" TEXT NOT NULL PRIMARY KEY,"caseId" TEXT NOT NULL,"requestKey" TEXT NOT NULL,"kind" TEXT NOT NULL,"stage" TEXT NOT NULL,"description" TEXT NOT NULL,"supplier" TEXT NOT NULL,"amountCents" INTEGER NOT NULL,"hours" REAL,"hourlyRateCents" INTEGER,"supersedesId" TEXT,"documentId" TEXT,"occurredOn" TEXT NOT NULL,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "case_finance_entries_caseId_fkey" FOREIGN KEY("caseId") REFERENCES "customer_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE UNIQUE INDEX "case_finance_entries_caseId_requestKey_key" ON "case_finance_entries"("caseId","requestKey");
CREATE UNIQUE INDEX "case_finance_entries_caseId_supersedesId_key" ON "case_finance_entries"("caseId","supersedesId");
CREATE INDEX "case_finance_entries_caseId_idx" ON "case_finance_entries"("caseId");
CREATE TABLE "case_finance_documents" ("id" TEXT NOT NULL PRIMARY KEY,"caseId" TEXT NOT NULL,"name" TEXT NOT NULL,"mimeType" TEXT NOT NULL,"hash" TEXT NOT NULL,"data" TEXT NOT NULL,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "case_finance_documents_caseId_fkey" FOREIGN KEY("caseId") REFERENCES "customer_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE UNIQUE INDEX "case_finance_documents_caseId_hash_key" ON "case_finance_documents"("caseId","hash");
