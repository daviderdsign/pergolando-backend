ALTER TABLE "case_order_batches" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "supplier_order_events" (
 "id" TEXT NOT NULL PRIMARY KEY, "batchId" TEXT NOT NULL, "requestKey" TEXT NOT NULL,
 "revision" INTEGER NOT NULL, "groupIndex" INTEGER NOT NULL, "kind" TEXT NOT NULL,
 "snapshot" TEXT NOT NULL, "sellerId" TEXT NOT NULL, "fileId" TEXT,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "supplier_order_events_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "case_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "supplier_order_events_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "case_order_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "supplier_order_events_batchId_requestKey_key" ON "supplier_order_events"("batchId", "requestKey");
CREATE UNIQUE INDEX "supplier_order_events_batchId_revision_key" ON "supplier_order_events"("batchId", "revision");

