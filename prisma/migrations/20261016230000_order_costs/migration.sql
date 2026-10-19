ALTER TABLE "case_finance_entries" ADD COLUMN "sourceOrderKey" TEXT;
ALTER TABLE "case_finance_entries" ADD COLUMN "sourceOrderEventId" TEXT;
ALTER TABLE "case_finance_entries" ADD COLUMN "costPending" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "case_finance_entries_sourceOrderEventId_key" ON "case_finance_entries"("sourceOrderEventId");
CREATE INDEX "case_finance_entries_caseId_sourceOrderKey_idx" ON "case_finance_entries"("caseId", "sourceOrderKey");
