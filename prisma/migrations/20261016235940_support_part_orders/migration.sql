CREATE TABLE "support_part_orders" (
 "id" TEXT NOT NULL PRIMARY KEY, "workId" TEXT NOT NULL, "number" INTEGER NOT NULL,
 "requestKey" TEXT NOT NULL, "supplier" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'DRAFT',
 "revision" INTEGER NOT NULL DEFAULT 0, "snapshot" TEXT NOT NULL, "pdf" TEXT NOT NULL,
 "sellerId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("workId") REFERENCES "support_works"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "support_part_orders_workId_number_key" ON "support_part_orders"("workId","number");
CREATE UNIQUE INDEX "support_part_orders_workId_requestKey_key" ON "support_part_orders"("workId","requestKey");
CREATE TABLE "support_part_order_events" (
 "id" TEXT NOT NULL PRIMARY KEY, "orderId" TEXT NOT NULL, "requestKey" TEXT NOT NULL, "revision" INTEGER NOT NULL,
 "kind" TEXT NOT NULL, "snapshot" TEXT NOT NULL, "sellerId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("orderId") REFERENCES "support_part_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "support_part_order_events_orderId_requestKey_key" ON "support_part_order_events"("orderId","requestKey");
CREATE UNIQUE INDEX "support_part_order_events_orderId_revision_key" ON "support_part_order_events"("orderId","revision");
