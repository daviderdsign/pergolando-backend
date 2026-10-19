CREATE TABLE "support_quotes" (
 "id" TEXT NOT NULL PRIMARY KEY, "workId" TEXT NOT NULL, "number" INTEGER NOT NULL, "requestKey" TEXT NOT NULL,
 "snapshot" TEXT NOT NULL, "pdf" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'ISSUED', "sellerId" TEXT NOT NULL,
 "decisionKey" TEXT, "decisionActor" TEXT, "decisionNote" TEXT, "decidedAt" DATETIME,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("workId") REFERENCES "support_works"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "support_quotes_workId_number_key" ON "support_quotes"("workId", "number");
CREATE UNIQUE INDEX "support_quotes_workId_requestKey_key" ON "support_quotes"("workId", "requestKey");
