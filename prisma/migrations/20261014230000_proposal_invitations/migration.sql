ALTER TABLE "customer_cases" ADD COLUMN "acceptedProposalId" TEXT;
ALTER TABLE "customer_cases" ADD COLUMN "confirmedProposalId" TEXT;
CREATE TABLE "proposal_invitations" ("id" TEXT NOT NULL PRIMARY KEY,"proposalId" TEXT NOT NULL,"tokenHash" TEXT NOT NULL,"expiresAt" DATETIME NOT NULL,"revokedAt" DATETIME,"acceptedAt" DATETIME,"acceptedName" TEXT,"acceptedEmail" TEXT,"acceptanceText" TEXT,"confirmedAt" DATETIME,"rejectedAt" DATETIME,"decisionNote" TEXT,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "proposal_invitations_proposalId_fkey" FOREIGN KEY("proposalId") REFERENCES "case_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE);
CREATE UNIQUE INDEX "proposal_invitations_tokenHash_key" ON "proposal_invitations"("tokenHash");
CREATE INDEX "proposal_invitations_proposalId_idx" ON "proposal_invitations"("proposalId");
