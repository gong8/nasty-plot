-- CreateTable
CREATE TABLE "MoveUsage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "formatId" TEXT NOT NULL,
    "pokemonId" TEXT NOT NULL,
    "moveName" TEXT NOT NULL,
    "usagePercent" REAL NOT NULL,
    CONSTRAINT "MoveUsage_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "Format" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemUsage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "formatId" TEXT NOT NULL,
    "pokemonId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "usagePercent" REAL NOT NULL,
    CONSTRAINT "ItemUsage_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "Format" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AbilityUsage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "formatId" TEXT NOT NULL,
    "pokemonId" TEXT NOT NULL,
    "abilityName" TEXT NOT NULL,
    "usagePercent" REAL NOT NULL,
    CONSTRAINT "AbilityUsage_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "Format" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MoveUsage_formatId_pokemonId_idx" ON "MoveUsage"("formatId", "pokemonId");

-- CreateIndex
CREATE UNIQUE INDEX "MoveUsage_formatId_pokemonId_moveName_key" ON "MoveUsage"("formatId", "pokemonId", "moveName");

-- CreateIndex
CREATE INDEX "ItemUsage_formatId_pokemonId_idx" ON "ItemUsage"("formatId", "pokemonId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemUsage_formatId_pokemonId_itemName_key" ON "ItemUsage"("formatId", "pokemonId", "itemName");

-- CreateIndex
CREATE INDEX "AbilityUsage_formatId_pokemonId_idx" ON "AbilityUsage"("formatId", "pokemonId");

-- CreateIndex
CREATE UNIQUE INDEX "AbilityUsage_formatId_pokemonId_abilityName_key" ON "AbilityUsage"("formatId", "pokemonId", "abilityName");
