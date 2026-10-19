ALTER TABLE "case_finance_entries" ADD COLUMN "absorbsEntryId" TEXT;
CREATE UNIQUE INDEX "case_finance_entries_caseId_absorbsEntryId_key" ON "case_finance_entries"("caseId","absorbsEntryId");
UPDATE "customer_cases" SET "costsComplete" = 0, "financeRevision" = "financeRevision" + 1
WHERE "costsComplete" = 1 AND EXISTS (
 SELECT 1 FROM "support_works" w JOIN "support_tickets" t ON t."id" = w."ticketId"
 WHERE t."caseId" = "customer_cases"."id" AND w."status" IN ('PLANNED','CONFIRMED')
);
