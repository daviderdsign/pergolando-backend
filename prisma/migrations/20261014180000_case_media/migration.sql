ALTER TABLE "case_items" ADD COLUMN "mediaIds" TEXT NOT NULL DEFAULT '{}';
CREATE TABLE "case_media" ("id" TEXT NOT NULL PRIMARY KEY,"caseId" TEXT NOT NULL,"hash" TEXT NOT NULL,"data" TEXT NOT NULL,"mimeType" TEXT NOT NULL,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "case_media_caseId_fkey" FOREIGN KEY("caseId") REFERENCES "customer_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE UNIQUE INDEX "case_media_caseId_hash_key" ON "case_media"("caseId","hash");
