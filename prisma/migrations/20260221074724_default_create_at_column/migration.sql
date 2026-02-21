-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GwpRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "purchaseThreshold" INTEGER NOT NULL,
    "giftVariantId" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME,
    "isActive" BOOLEAN NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_GwpRule" ("createdAt", "endAt", "giftVariantId", "id", "isActive", "name", "purchaseThreshold", "startAt") SELECT "createdAt", "endAt", "giftVariantId", "id", "isActive", "name", "purchaseThreshold", "startAt" FROM "GwpRule";
DROP TABLE "GwpRule";
ALTER TABLE "new_GwpRule" RENAME TO "GwpRule";
CREATE UNIQUE INDEX "GwpRule_name_key" ON "GwpRule"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
