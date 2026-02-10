import path from "path";
import fs from "fs";
import { PrismaClient } from "../../../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function findMonorepoRoot(): string {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "turbo.json"))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function resolveDbUrl(rawUrl: string): string {
  if (!rawUrl.startsWith("file:./")) return rawUrl;
  const relPath = rawUrl.slice("file:".length);
  return "file:" + path.resolve(findMonorepoRoot(), relPath);
}

function createPrismaClient(): PrismaClient {
  const dbUrl = resolveDbUrl(process.env.DATABASE_URL || "file:./prisma/dev.db");
  const adapter = new PrismaBetterSqlite3({ url: dbUrl });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
