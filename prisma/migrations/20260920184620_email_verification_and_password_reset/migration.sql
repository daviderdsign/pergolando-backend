-- AlterTable
ALTER TABLE "sellers" ADD COLUMN "emailVerifiedAt" DATETIME;

-- CreateTable
CREATE TABLE "verification_codes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sellerId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "verification_codes_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "sellers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "verification_codes_sellerId_purpose_idx" ON "verification_codes"("sellerId", "purpose");
