CREATE TABLE "support_accesses" (
 "id" TEXT NOT NULL PRIMARY KEY, "caseId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "email" TEXT NOT NULL,
 "mailStatus" TEXT NOT NULL DEFAULT 'NOT_SENT', "expiresAt" DATETIME NOT NULL, "revokedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("caseId") REFERENCES "customer_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "support_accesses_tokenHash_key" ON "support_accesses"("tokenHash");
CREATE TABLE "support_tickets" (
 "id" TEXT NOT NULL PRIMARY KEY, "caseId" TEXT NOT NULL, "requestKey" TEXT NOT NULL,
 "title" TEXT NOT NULL, "description" TEXT NOT NULL, "priority" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'OPEN',
 "assignee" TEXT NOT NULL DEFAULT '', "revision" INTEGER NOT NULL DEFAULT 0,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
 FOREIGN KEY ("caseId") REFERENCES "customer_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "support_tickets_caseId_requestKey_key" ON "support_tickets"("caseId","requestKey");
CREATE TABLE "support_ticket_events" (
 "id" TEXT NOT NULL PRIMARY KEY, "ticketId" TEXT NOT NULL, "requestKey" TEXT NOT NULL,
 "revision" INTEGER NOT NULL, "actor" TEXT NOT NULL, "status" TEXT NOT NULL, "priority" TEXT NOT NULL,
 "assignee" TEXT NOT NULL, "internalNote" TEXT NOT NULL, "message" TEXT NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "support_ticket_events_ticketId_requestKey_key" ON "support_ticket_events"("ticketId","requestKey");
CREATE UNIQUE INDEX "support_ticket_events_ticketId_revision_key" ON "support_ticket_events"("ticketId","revision");
CREATE TABLE "support_photos" (
 "id" TEXT NOT NULL PRIMARY KEY, "ticketId" TEXT NOT NULL, "name" TEXT NOT NULL, "mimeType" TEXT NOT NULL,
 "hash" TEXT NOT NULL, "data" TEXT NOT NULL, "size" INTEGER NOT NULL,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "support_photos_ticketId_hash_key" ON "support_photos"("ticketId","hash");

