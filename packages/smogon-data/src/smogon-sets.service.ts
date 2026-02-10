import { prisma } from "@nasty-plot/db";
import { toId } from "@nasty-plot/core";
import type { SmogonSetData, NatureName, PokemonType } from "@nasty-plot/core";

function buildSetsUrl(formatId: string): string {
  return `https://data.pkmn.cc/sets/${formatId}.json`;
}

// Raw shape from pkmn.cc - fields can be arrays for slash options
interface RawSetEntry {
  ability: string | string[];
  item: string | string[];
  nature: string | string[];
  teraType?: string | string[];
  moves: (string | string[])[];
  evs?: Record<string, number> | Record<string, number>[];
  ivs?: Record<string, number> | Record<string, number>[];
}

type RawSetsJson = Record<string, Record<string, RawSetEntry>>;

/** Take the first element if array, otherwise return the value as-is. */
function firstOf(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

/** Take the first element if array of records, otherwise return the value as-is. */
function firstRecord(val: Record<string, number> | Record<string, number>[]): Record<string, number> {
  return Array.isArray(val) ? val[0] : val;
}

/**
 * Fetch Smogon recommended sets from data.pkmn.cc and persist to DB.
 * @param formatId - The app's format ID (used for DB storage)
 * @param options.pkmnSetsId - Override format ID for the pkmn.cc URL (e.g. "gen9doublesou")
 */
export async function fetchSmogonSets(
  formatId: string,
  options?: { pkmnSetsId?: string },
): Promise<void> {
  const setsId = options?.pkmnSetsId ?? formatId;
  const url = buildSetsUrl(setsId);
  console.log(`[smogon-sets] Fetching ${url}`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch sets: ${res.status} ${res.statusText} (${url})`
    );
  }

  const json: RawSetsJson = await res.json();
  let totalSets = 0;
  let skipped = 0;

  for (const [pokemonName, sets] of Object.entries(json)) {
    const pokemonId = toId(pokemonName);
    if (!pokemonId || !sets || typeof sets !== "object") {
      skipped++;
      continue;
    }

    for (const [setName, setData] of Object.entries(sets)) {
      if (!setData || typeof setData !== "object") {
        skipped++;
        continue;
      }

      const ability = firstOf(setData.ability ?? "");
      const item = firstOf(setData.item ?? "");
      const nature = firstOf(setData.nature ?? "Serious");
      const teraType = setData.teraType ? firstOf(setData.teraType) : null;

      const movesJson = JSON.stringify(setData.moves ?? []);
      const evsJson = JSON.stringify(firstRecord(setData.evs ?? {}));
      const normalizedIvs = setData.ivs ? firstRecord(setData.ivs) : null;
      const ivsJson =
        normalizedIvs && Object.keys(normalizedIvs).length > 0
          ? JSON.stringify(normalizedIvs)
          : null;

      await prisma.smogonSet.upsert({
        where: {
          formatId_pokemonId_setName: { formatId, pokemonId, setName },
        },
        update: {
          ability,
          item,
          nature,
          teraType,
          moves: movesJson,
          evs: evsJson,
          ivs: ivsJson,
        },
        create: {
          formatId,
          pokemonId,
          setName,
          ability,
          item,
          nature,
          teraType,
          moves: movesJson,
          evs: evsJson,
          ivs: ivsJson,
        },
      });

      totalSets++;
    }
  }

  // Update sync log
  await prisma.dataSyncLog.upsert({
    where: {
      source_formatId: { source: "smogon-sets", formatId },
    },
    update: {
      lastSynced: new Date(),
      status: "success",
      message: `Fetched ${totalSets} sets${skipped > 0 ? ` (${skipped} entries skipped)` : ""}`,
    },
    create: {
      source: "smogon-sets",
      formatId,
      lastSynced: new Date(),
      status: "success",
      message: `Fetched ${totalSets} sets${skipped > 0 ? ` (${skipped} entries skipped)` : ""}`,
    },
  });

  console.log(
    `[smogon-sets] Done: ${totalSets} sets saved for ${formatId}${skipped > 0 ? ` (${skipped} skipped)` : ""}`
  );
}

/**
 * Parse a DB SmogonSet row back into a SmogonSetData domain object.
 * Handles malformed JSON gracefully by returning safe defaults.
 */
function rowToSetData(row: {
  pokemonId: string;
  setName: string;
  ability: string;
  item: string;
  nature: string;
  teraType: string | null;
  moves: string;
  evs: string;
  ivs: string | null;
}): SmogonSetData {
  let moves: (string | string[])[];
  let evs: Record<string, number>;
  let ivs: Record<string, number> | undefined;

  try {
    moves = JSON.parse(row.moves);
  } catch {
    moves = [];
  }
  try {
    evs = JSON.parse(row.evs);
  } catch {
    evs = {};
  }
  try {
    ivs = row.ivs ? JSON.parse(row.ivs) : undefined;
  } catch {
    ivs = undefined;
  }

  return {
    pokemonId: row.pokemonId,
    setName: row.setName,
    ability: row.ability,
    item: row.item,
    nature: row.nature as NatureName,
    teraType: (row.teraType as PokemonType) ?? undefined,
    moves,
    evs,
    ivs,
  };
}

/**
 * Get all sets for a specific Pokemon in a specific format.
 */
export async function getSetsForPokemon(
  formatId: string,
  pokemonId: string
): Promise<SmogonSetData[]> {
  const rows = await prisma.smogonSet.findMany({
    where: { formatId, pokemonId },
  });

  return rows.map(rowToSetData);
}

/**
 * Get all sets for a format, grouped by pokemonId.
 */
export async function getAllSetsForFormat(
  formatId: string
): Promise<Record<string, SmogonSetData[]>> {
  const rows = await prisma.smogonSet.findMany({
    where: { formatId },
  });

  const grouped: Record<string, SmogonSetData[]> = {};
  for (const row of rows) {
    const data = rowToSetData(row);
    if (!grouped[data.pokemonId]) {
      grouped[data.pokemonId] = [];
    }
    grouped[data.pokemonId].push(data);
  }

  return grouped;
}
