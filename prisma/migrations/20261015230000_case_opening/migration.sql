ALTER TABLE "customer_cases" ADD COLUMN "caseName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "customer_cases" ADD COLUMN "companyName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "customer_cases" ADD COLUMN "siteAddress" TEXT NOT NULL DEFAULT '';
ALTER TABLE "customer_cases" ADD COLUMN "projectNotes" TEXT NOT NULL DEFAULT '';
ALTER TABLE "customer_cases" ADD COLUMN "creationKey" TEXT;
CREATE UNIQUE INDEX "customer_cases_sellerId_creationKey_key" ON "customer_cases"("sellerId","creationKey");
CREATE TABLE "case_files" ("id" TEXT NOT NULL PRIMARY KEY,"caseId" TEXT NOT NULL,"name" TEXT NOT NULL,"mimeType" TEXT NOT NULL,"hash" TEXT NOT NULL,"size" INTEGER NOT NULL,"data" TEXT NOT NULL,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "case_files_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "customer_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE UNIQUE INDEX "case_files_caseId_hash_key" ON "case_files"("caseId","hash");
