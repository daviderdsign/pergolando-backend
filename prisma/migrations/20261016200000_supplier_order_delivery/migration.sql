CREATE TABLE "supplier_order_deliveries" (
 "id" TEXT NOT NULL PRIMARY KEY, "batchId" TEXT NOT NULL, "groupIndex" INTEGER NOT NULL,
 "requestKey" TEXT NOT NULL, "recipient" TEXT NOT NULL, "subject" TEXT NOT NULL, "text" TEXT NOT NULL,
 "pdf" TEXT NOT NULL, "snapshotHash" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'SENDING',
 "errorCode" TEXT, "messageId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" DATETIME,
 CONSTRAINT "supplier_order_deliveries_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "case_order_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "supplier_order_deliveries_batchId_requestKey_key" ON "supplier_order_deliveries"("batchId", "requestKey");
CREATE INDEX "supplier_order_deliveries_batchId_groupIndex_idx" ON "supplier_order_deliveries"("batchId", "groupIndex");
