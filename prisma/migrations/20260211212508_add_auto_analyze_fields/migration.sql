-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN "metadata" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Battle" (
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
    "commentary" TEXT,
    "chatSessionId" TEXT,
    "batchId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Battle_team1Id_fkey" FOREIGN KEY ("team1Id") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Battle_team2Id_fkey" FOREIGN KEY ("team2Id") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Battle_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "ChatSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Battle_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BatchSimulation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Battle" ("aiDifficulty", "batchId", "commentary", "createdAt", "formatId", "gameType", "id", "mode", "protocolLog", "team1Id", "team1Name", "team1Paste", "team2Id", "team2Name", "team2Paste", "turnCount", "winnerId") SELECT "aiDifficulty", "batchId", "commentary", "createdAt", "formatId", "gameType", "id", "mode", "protocolLog", "team1Id", "team1Name", "team1Paste", "team2Id", "team2Name", "team2Paste", "turnCount", "winnerId" FROM "Battle";
DROP TABLE "Battle";
ALTER TABLE "new_Battle" RENAME TO "Battle";
CREATE INDEX "Battle_batchId_idx" ON "Battle"("batchId");
CREATE INDEX "Battle_createdAt_idx" ON "Battle"("createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
