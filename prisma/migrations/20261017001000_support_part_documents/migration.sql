CREATE TABLE "support_part_documents" (
 "id" TEXT NOT NULL PRIMARY KEY, "orderId" TEXT NOT NULL, "caseId" TEXT NOT NULL,
 "requestKey" TEXT NOT NULL, "documentId" TEXT NOT NULL, "kind" TEXT NOT NULL,
 "reference" TEXT NOT NULL, "occurredOn" TEXT NOT NULL, "netCents" INTEGER NOT NULL,
 "allocatedCents" INTEGER NOT NULL, "costId" TEXT, "supersedesId" TEXT,
 "note" TEXT NOT NULL, "sellerId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "support_part_documents_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "support_part_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "support_part_documents_orderId_requestKey_key" ON "support_part_documents"("orderId","requestKey");
CREATE UNIQUE INDEX "support_part_documents_supersedesId_key" ON "support_part_documents"("supersedesId");
CREATE INDEX "support_part_documents_caseId_idx" ON "support_part_documents"("caseId");
