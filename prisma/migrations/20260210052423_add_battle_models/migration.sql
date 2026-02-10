-- CreateTable
CREATE TABLE "Battle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formatId" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "aiDifficulty" TEXT,
    "team1Paste" TEXT NOT NULL,
    "team1Name" TEXT NOT NULL DEFAULT 'Player',
    "team2Paste" TEXT NOT NULL,
    "team2Name" TEXT NOT NULL DEFAULT 'Opponent',
    "team1Id" TEXT,
    "team2Id" TEXT,
    "winnerId" TEXT,
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "protocolLog" TEXT NOT NULL,
    "batchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Battle_team1Id_fkey" FOREIGN KEY ("team1Id") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Battle_team2Id_fkey" FOREIGN KEY ("team2Id") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Battle_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BatchSimulation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BattleTurn" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "battleId" TEXT NOT NULL,
    "turnNumber" INTEGER NOT NULL,
    "team1Action" TEXT NOT NULL,
    "team2Action" TEXT NOT NULL,
    "stateSnapshot" TEXT NOT NULL,
    "winProbTeam1" REAL,
    CONSTRAINT "BattleTurn_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BatchSimulation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "formatId" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "aiDifficulty" TEXT NOT NULL,
    "team1Paste" TEXT NOT NULL,
    "team1Name" TEXT NOT NULL DEFAULT 'Team 1',
    "team2Paste" TEXT NOT NULL,
    "team2Name" TEXT NOT NULL DEFAULT 'Team 2',
    "totalGames" INTEGER NOT NULL,
    "completedGames" INTEGER NOT NULL DEFAULT 0,
    "team1Wins" INTEGER NOT NULL DEFAULT 0,
    "team2Wins" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "analytics" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SampleTeam" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "formatId" TEXT NOT NULL,
    "archetype" TEXT,
    "source" TEXT,
    "sourceUrl" TEXT,
    "paste" TEXT NOT NULL,
    "pokemonIds" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Battle_batchId_idx" ON "Battle"("batchId");

-- CreateIndex
CREATE INDEX "Battle_createdAt_idx" ON "Battle"("createdAt");

-- CreateIndex
CREATE INDEX "BattleTurn_battleId_idx" ON "BattleTurn"("battleId");

-- CreateIndex
CREATE UNIQUE INDEX "BattleTurn_battleId_turnNumber_key" ON "BattleTurn"("battleId", "turnNumber");

-- CreateIndex
CREATE INDEX "BatchSimulation_status_idx" ON "BatchSimulation"("status");

-- CreateIndex
CREATE INDEX "SampleTeam_formatId_idx" ON "SampleTeam"("formatId");

-- CreateIndex
CREATE INDEX "SampleTeam_formatId_archetype_idx" ON "SampleTeam"("formatId", "archetype");
