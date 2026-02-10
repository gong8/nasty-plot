import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@nasty-plot/db";
import { fetchUsageStats, fetchSmogonSets } from "@nasty-plot/smogon-data";
import { isStale } from "@nasty-plot/data-pipeline";

const DEFAULT_FORMATS = [
  { id: "gen9ou", name: "OU", generation: 9, gameType: "singles" },
  { id: "gen9uu", name: "UU", generation: 9, gameType: "singles" },
  { id: "gen9vgc2024", name: "VGC 2024", generation: 9, gameType: "doubles" },
  { id: "gen9vgc2025", name: "VGC 2025", generation: 9, gameType: "doubles" },
];

export async function POST(request: NextRequest) {
  let body: { formatId?: string; force?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine, seed all formats
  }

  const { formatId, force = false } = body;

  const formats = formatId
    ? [{ id: formatId, name: formatId, generation: 9, gameType: "singles" }]
    : DEFAULT_FORMATS;

  const results: { format: string; success: boolean; error?: string }[] = [];

  for (const format of formats) {
    // Upsert format
    try {
      await prisma.format.upsert({
        where: { id: format.id },
        update: {},
        create: {
          id: format.id,
          name: format.name,
          generation: format.generation,
          gameType: format.gameType,
          isActive: true,
        },
      });
    } catch {
      // Format may already exist, that's fine
    }

    const errors: string[] = [];

    // Usage stats
    try {
      const statsNeedRefresh = force || (await isStale("smogon-stats", format.id));
      if (statsNeedRefresh) {
        await fetchUsageStats(format.id);
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }

    // Smogon sets
    try {
      const setsNeedRefresh = force || (await isStale("smogon-sets", format.id));
      if (setsNeedRefresh) {
        await fetchSmogonSets(format.id);
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }

    const error = errors.length > 0 ? errors.join("; ") : undefined;
    results.push({ format: format.id, success: errors.length === 0, error });
  }

  const allSuccess = results.every((r) => r.success);
  return NextResponse.json(
    {
      data: results,
      meta: {
        total: results.length,
        successes: results.filter((r) => r.success).length,
        failures: results.filter((r) => !r.success).length,
      },
    },
    { status: allSuccess ? 200 : 207 }
  );
}
