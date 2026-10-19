CREATE TABLE "support_notifications" (
 "id" TEXT NOT NULL PRIMARY KEY, "ticketId" TEXT NOT NULL, "revision" INTEGER NOT NULL, "kind" TEXT NOT NULL,
 "recipient" TEXT NOT NULL, "subject" TEXT NOT NULL, "text" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING', "errorCode" TEXT, "attempts" INTEGER NOT NULL DEFAULT 0,
 "startedAt" DATETIME, "completedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "support_notifications_ticketId_revision_kind_key" ON "support_notifications"("ticketId","revision","kind");
CREATE INDEX "support_notifications_status_createdAt_idx" ON "support_notifications"("status","createdAt");
CREATE TABLE "support_notification_attempts" (
 "id" TEXT NOT NULL PRIMARY KEY, "notificationId" TEXT NOT NULL, "number" INTEGER NOT NULL, "status" TEXT NOT NULL,
 "recipient" TEXT NOT NULL, "text" TEXT NOT NULL, "errorCode" TEXT, "messageId" TEXT,
 "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" DATETIME,
 FOREIGN KEY ("notificationId") REFERENCES "support_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "support_notification_attempts_notificationId_number_key" ON "support_notification_attempts"("notificationId","number");
