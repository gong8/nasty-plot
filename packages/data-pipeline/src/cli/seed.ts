#!/usr/bin/env tsx

import { prisma } from "@nasty-plot/db";
import { FORMAT_DEFINITIONS } from "@nasty-plot/formats";
import { fetchUsageStats, fetchSmogonSets } from "@nasty-plot/smogon-data";
import { isStale } from "../staleness.service";

const FORMATS = FORMAT_DEFINITIONS.filter(f => f.isActive).map(f => ({
  id: f.id,
  name: f.name,
  generation: f.generation,
  gameType: f.gameType,
}));

interface CliArgs {
  formatId?: string;
  force: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = { force: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--format" && args[i + 1]) {
      result.formatId = args[i + 1];
      i++;
    } else if (args[i] === "--force") {
      result.force = true;
    }
  }

  return result;
}

async function seedFormat(
  format: { id: string; name: string; generation: number; gameType: string },
  force: boolean
): Promise<{ success: boolean; error?: string }> {
  console.log(`\n--- Seeding ${format.name} (${format.id}) ---`);

  // Upsert Format record
  await prisma.format.upsert({
    where: { id: format.id },
    update: { name: format.name, generation: format.generation, gameType: format.gameType },
    create: {
      id: format.id,
      name: format.name,
      generation: format.generation,
      gameType: format.gameType,
      isActive: true,
    },
  });

  // Fetch usage stats
  const statsStale = force || (await isStale("smogon-stats", format.id));
  if (statsStale) {
    console.log(`[seed] Fetching usage stats for ${format.id}...`);
    try {
      await fetchUsageStats(format.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[seed] Failed to fetch usage stats for ${format.id}: ${msg}`);
      // Log error but continue to try sets
      await prisma.dataSyncLog.upsert({
        where: { source_formatId: { source: "smogon-stats", formatId: format.id } },
        update: { lastSynced: new Date(), status: "error", message: msg },
        create: { source: "smogon-stats", formatId: format.id, lastSynced: new Date(), status: "error", message: msg },
      });
    }
  } else {
    console.log(`[seed] Usage stats for ${format.id} are fresh, skipping.`);
  }

  // Fetch Smogon sets
  const setsStale = force || (await isStale("smogon-sets", format.id));
  if (setsStale) {
    console.log(`[seed] Fetching Smogon sets for ${format.id}...`);
    try {
      await fetchSmogonSets(format.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[seed] Failed to fetch sets for ${format.id}: ${msg}`);
      await prisma.dataSyncLog.upsert({
        where: { source_formatId: { source: "smogon-sets", formatId: format.id } },
        update: { lastSynced: new Date(), status: "error", message: msg },
        create: { source: "smogon-sets", formatId: format.id, lastSynced: new Date(), status: "error", message: msg },
      });
      return { success: false, error: msg };
    }
  } else {
    console.log(`[seed] Smogon sets for ${format.id} are fresh, skipping.`);
  }

  return { success: true };
}

async function main(): Promise<void> {
  const args = parseArgs();

  console.log("=== Nasty Plot Data Seeder ===");
  if (args.force) console.log("Force mode: ignoring staleness checks");
  if (args.formatId) console.log(`Target format: ${args.formatId}`);

  let formatsToSeed = args.formatId
    ? FORMATS.filter((f) => f.id === args.formatId)
    : FORMATS;

  if (formatsToSeed.length === 0 && args.formatId) {
    formatsToSeed = [{
      id: args.formatId,
      name: args.formatId,
      generation: parseInt(args.formatId.replace(/[^0-9]/g, "").charAt(0) || "9"),
      gameType: "singles" as const,
    }];
  }

  const results: { format: string; success: boolean; error?: string }[] = [];

  for (const format of formatsToSeed) {
    try {
      const result = await seedFormat(format, args.force);
      results.push({ format: format.id, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[seed] Unexpected error for ${format.id}: ${msg}`);
      results.push({ format: format.id, success: false, error: msg });
    }
  }

  // Summary
  console.log("\n=== Seed Summary ===");
  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);

  console.log(`Total: ${results.length} | Success: ${successes.length} | Failed: ${failures.length}`);

  for (const r of results) {
    const icon = r.success ? "[OK]" : "[FAIL]";
    console.log(`  ${icon} ${r.format}${r.error ? ` - ${r.error}` : ""}`);
  }

  await prisma.$disconnect();

  if (failures.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
