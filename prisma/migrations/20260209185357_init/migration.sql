-- CreateTable
CREATE TABLE "Format" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "gameType" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UsageStats" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "formatId" TEXT NOT NULL,
    "pokemonId" TEXT NOT NULL,
    "usagePercent" REAL NOT NULL,
    "rank" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    CONSTRAINT "UsageStats_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "Format" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SmogonSet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "formatId" TEXT NOT NULL,
    "pokemonId" TEXT NOT NULL,
    "setName" TEXT NOT NULL,
    "ability" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "nature" TEXT NOT NULL,
    "teraType" TEXT,
    "moves" TEXT NOT NULL,
    "evs" TEXT NOT NULL,
    "ivs" TEXT,
    CONSTRAINT "SmogonSet_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "Format" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeammateCorr" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "formatId" TEXT NOT NULL,
    "pokemonAId" TEXT NOT NULL,
    "pokemonBId" TEXT NOT NULL,
    "correlationPercent" REAL NOT NULL,
    CONSTRAINT "TeammateCorr_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "Format" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CheckCounter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "formatId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "counterId" TEXT NOT NULL,
    "koPercent" REAL NOT NULL,
    "switchPercent" REAL NOT NULL,
    CONSTRAINT "CheckCounter_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "Format" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "formatId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'freeform',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Team_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "Format" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamSlot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "teamId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "pokemonId" TEXT NOT NULL,
    "ability" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "nature" TEXT NOT NULL,
    "teraType" TEXT,
    "level" INTEGER NOT NULL DEFAULT 100,
    "move1" TEXT NOT NULL,
    "move2" TEXT,
    "move3" TEXT,
    "move4" TEXT,
    "evHp" INTEGER NOT NULL DEFAULT 0,
    "evAtk" INTEGER NOT NULL DEFAULT 0,
    "evDef" INTEGER NOT NULL DEFAULT 0,
    "evSpA" INTEGER NOT NULL DEFAULT 0,
    "evSpD" INTEGER NOT NULL DEFAULT 0,
    "evSpe" INTEGER NOT NULL DEFAULT 0,
    "ivHp" INTEGER NOT NULL DEFAULT 31,
    "ivAtk" INTEGER NOT NULL DEFAULT 31,
    "ivDef" INTEGER NOT NULL DEFAULT 31,
    "ivSpA" INTEGER NOT NULL DEFAULT 31,
    "ivSpD" INTEGER NOT NULL DEFAULT 31,
    "ivSpe" INTEGER NOT NULL DEFAULT 31,
    CONSTRAINT "TeamSlot_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataSyncLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "source" TEXT NOT NULL,
    "formatId" TEXT NOT NULL,
    "lastSynced" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChatSession_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UsageStats_formatId_rank_idx" ON "UsageStats"("formatId", "rank");

-- CreateIndex
CREATE INDEX "UsageStats_pokemonId_idx" ON "UsageStats"("pokemonId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageStats_formatId_pokemonId_year_month_key" ON "UsageStats"("formatId", "pokemonId", "year", "month");

-- CreateIndex
CREATE INDEX "SmogonSet_formatId_pokemonId_idx" ON "SmogonSet"("formatId", "pokemonId");

-- CreateIndex
CREATE UNIQUE INDEX "SmogonSet_formatId_pokemonId_setName_key" ON "SmogonSet"("formatId", "pokemonId", "setName");

-- CreateIndex
CREATE INDEX "TeammateCorr_formatId_pokemonAId_idx" ON "TeammateCorr"("formatId", "pokemonAId");

-- CreateIndex
CREATE UNIQUE INDEX "TeammateCorr_formatId_pokemonAId_pokemonBId_key" ON "TeammateCorr"("formatId", "pokemonAId", "pokemonBId");

-- CreateIndex
CREATE INDEX "CheckCounter_formatId_targetId_idx" ON "CheckCounter"("formatId", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckCounter_formatId_targetId_counterId_key" ON "CheckCounter"("formatId", "targetId", "counterId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamSlot_teamId_position_key" ON "TeamSlot"("teamId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "DataSyncLog_source_formatId_key" ON "DataSyncLog"("source", "formatId");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId");
