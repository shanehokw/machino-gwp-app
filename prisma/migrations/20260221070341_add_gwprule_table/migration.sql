-- CreateTable
CREATE TABLE "GwpRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "purchaseThreshold" INTEGER NOT NULL,
    "giftVariantId" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME,
    "isActive" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "GwpRule_name_key" ON "GwpRule"("name");
