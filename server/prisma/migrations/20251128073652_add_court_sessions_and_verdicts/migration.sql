/*
  Warnings:

  - You are about to drop the column `verdict` on the `Case` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Case` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Verdict" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT NOT NULL,
    "addendumBy" TEXT,
    "addendumText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Verdict_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CourtSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "createdBy" TEXT NOT NULL,
    "userAJoined" BOOLEAN NOT NULL DEFAULT false,
    "userBJoined" BOOLEAN NOT NULL DEFAULT false,
    "caseId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Case" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userAInput" TEXT NOT NULL,
    "userAFeelings" TEXT NOT NULL DEFAULT '',
    "userBInput" TEXT NOT NULL,
    "userBFeelings" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "caseTitle" TEXT,
    "severityLevel" TEXT,
    "primaryHissTag" TEXT,
    "shortResolution" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Case" ("createdAt", "id", "status", "userAInput", "userBInput") SELECT "createdAt", "id", "status", "userAInput", "userBInput" FROM "Case";
DROP TABLE "Case";
ALTER TABLE "new_Case" RENAME TO "Case";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Verdict_caseId_idx" ON "Verdict"("caseId");
