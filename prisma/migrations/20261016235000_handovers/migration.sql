CREATE TABLE "case_handovers" (
 "id" TEXT NOT NULL PRIMARY KEY, "caseId" TEXT NOT NULL, "requestKey" TEXT NOT NULL, "revision" INTEGER NOT NULL,
 "sellerId" TEXT NOT NULL, "snapshot" TEXT NOT NULL, "pdf" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "case_handovers_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "customer_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "case_handovers_caseId_requestKey_key" ON "case_handovers"("caseId", "requestKey");
CREATE UNIQUE INDEX "case_handovers_caseId_revision_key" ON "case_handovers"("caseId", "revision");
CREATE TABLE "case_handover_files" (
 "handoverId" TEXT NOT NULL, "fileId" TEXT NOT NULL, PRIMARY KEY ("handoverId", "fileId"),
 CONSTRAINT "case_handover_files_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "case_handovers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "case_handover_files_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "case_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
