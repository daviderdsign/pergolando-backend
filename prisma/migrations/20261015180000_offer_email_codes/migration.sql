ALTER TABLE "proposal_invitations" ADD COLUMN "emailVerifiedAt" DATETIME;
CREATE TABLE "offer_email_codes" ("id" TEXT NOT NULL PRIMARY KEY,"invitationId" TEXT NOT NULL,"email" TEXT NOT NULL,"codeHash" TEXT NOT NULL,"expiresAt" DATETIME NOT NULL,"attempts" INTEGER NOT NULL DEFAULT 0,"sends" INTEGER NOT NULL DEFAULT 1,"sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,"consumedAt" DATETIME,"status" TEXT NOT NULL DEFAULT 'SENDING');
CREATE UNIQUE INDEX "offer_email_codes_invitationId_key" ON "offer_email_codes"("invitationId");
