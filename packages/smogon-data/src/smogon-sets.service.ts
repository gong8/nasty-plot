import { prisma } from "@nasty-plot/db";
import type { SmogonSetData, NatureName, PokemonType } from "@nasty-plot/core";

function toId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildSetsUrl(formatId: string): string {
  return `https://data.pkmn.cc/sets/${formatId}.json`;
}

// Raw shape from pkmn.cc - fields can be arrays for slash options
type RawSetEntry = {
  ability: string | string[];
  item: string | string[];
  nature: string | string[];
  teraType?: string | string[];
  moves: (string | string[])[];
  evs?: Record<string, number> | Record<string, number>[];
  ivs?: Record<string, number> | Record<string, number>[];
};

type RawSetsJson = Record<string, Record<string, RawSetEntry>>;

/**
 * Normalize ability/item fields that can be string or string[]
 * into a single string (first element if array).
 */
function normalizeStringOrArray(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

/**
 * Fetch Smogon recommended sets from data.pkmn.cc and persist to DB.
 */
export async function fetchSmogonSets(formatId: string): Promise<void> {
  const url = buildSetsUrl(formatId);
  console.log(`[smogon-sets] Fetching ${url}`);

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to fetch sets: ${res.status} ${res.statusText} (${url})`
    );
  }

  const json: RawSetsJson = await res.json();
  let totalSets = 0;

  for (const [pokemonName, sets] of Object.entries(json)) {
    const pokemonId = toId(pokemonName);
    if (!pokemonId || !sets || typeof sets !== "object") continue;

    for (const [setName, setData] of Object.entries(sets)) {
      if (!setData || typeof setData !== "object") continue;

      const ability = normalizeStringOrArray(setData.ability ?? "");
      const item = normalizeStringOrArray(setData.item ?? "");
      const nature = normalizeStringOrArray(setData.nature ?? "Serious");
      const teraType = setData.teraType
        ? normalizeStringOrArray(setData.teraType)
        : null;

      const movesJson = JSON.stringify(setData.moves ?? []);
      const rawEvs = setData.evs ?? {};
      const evsJson = JSON.stringify(Array.isArray(rawEvs) ? rawEvs[0] : rawEvs);
      const rawIvs = setData.ivs;
      const normalizedIvs = rawIvs ? (Array.isArray(rawIvs) ? rawIvs[0] : rawIvs) : null;
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
      message: `Fetched ${totalSets} sets`,
    },
    create: {
      source: "smogon-sets",
      formatId,
      lastSynced: new Date(),
      status: "success",
      message: `Fetched ${totalSets} sets`,
    },
  });

  console.log(
    `[smogon-sets] Done: ${totalSets} sets saved for ${formatId}`
  );
}

/**
 * Parse a DB SmogonSet row back into a SmogonSetData domain object.
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
  return {
    pokemonId: row.pokemonId,
    setName: row.setName,
    ability: row.ability,
    item: row.item,
    nature: row.nature as NatureName,
    teraType: (row.teraType as PokemonType) ?? undefined,
    moves: JSON.parse(row.moves),
    evs: JSON.parse(row.evs),
    ivs: row.ivs ? JSON.parse(row.ivs) : undefined,
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
