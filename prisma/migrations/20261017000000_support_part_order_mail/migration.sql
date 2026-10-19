CREATE TABLE "support_part_order_deliveries" (
 "id" TEXT NOT NULL PRIMARY KEY, "orderId" TEXT NOT NULL, "requestKey" TEXT NOT NULL, "sellerId" TEXT NOT NULL,
 "recipient" TEXT NOT NULL, "sender" TEXT NOT NULL, "subject" TEXT NOT NULL, "text" TEXT NOT NULL, "filename" TEXT NOT NULL,
 "pdfHash" TEXT NOT NULL, "snapshotHash" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'SENDING', "errorCode" TEXT, "messageId" TEXT,
 "resolution" TEXT, "resolutionKey" TEXT, "resolutionReference" TEXT, "resolutionNote" TEXT, "resolvedBy" TEXT, "resolvedAt" DATETIME,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" DATETIME,
 FOREIGN KEY ("orderId") REFERENCES "support_part_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "support_part_order_deliveries_orderId_requestKey_key" ON "support_part_order_deliveries"("orderId","requestKey");
CREATE INDEX "support_part_order_deliveries_status_createdAt_idx" ON "support_part_order_deliveries"("status","createdAt");
