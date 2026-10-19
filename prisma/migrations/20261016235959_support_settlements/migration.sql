ALTER TABLE "case_finance_entries" ADD COLUMN "sourceSupportWorkId" TEXT;
ALTER TABLE "case_finance_entries" ADD COLUMN "sourceSupportQuoteId" TEXT;
ALTER TABLE "case_finance_entries" ADD COLUMN "supportSettlement" TEXT;
CREATE INDEX "case_finance_entries_caseId_sourceSupportWorkId_idx" ON "case_finance_entries"("caseId","sourceSupportWorkId");
