ALTER TABLE "dealer_catalogs" ADD COLUMN "approvalNotice" TEXT;
ALTER TABLE "dealer_catalogs" ADD COLUMN "approvedBy" TEXT;
ALTER TABLE "catalog_checks" ADD COLUMN "generatedKey" TEXT;
ALTER TABLE "catalog_checks" ADD COLUMN "generatedSnapshot" TEXT;
ALTER TABLE "catalog_checks" ADD COLUMN "reviewedAt" DATETIME;
ALTER TABLE "catalog_checks" ADD COLUMN "reviewedBy" TEXT;
ALTER TABLE "catalog_checks" ADD COLUMN "reviewNote" TEXT;
CREATE UNIQUE INDEX "catalog_checks_catalogId_revision_generatedKey_key" ON "catalog_checks"("catalogId","revision","generatedKey");
