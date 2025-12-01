-- CreateTable
CREATE TABLE "Appreciation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "kibbleAmount" INTEGER NOT NULL DEFAULT 10,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Appreciation_toUserId_idx" ON "Appreciation"("toUserId");

-- CreateIndex
CREATE INDEX "Appreciation_fromUserId_idx" ON "Appreciation"("fromUserId");
