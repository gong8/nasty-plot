import type { TeamData, UsageStatsEntry } from "@nasty-plot/core";

export function buildTeamContext(teamData: TeamData): string {
  const lines: string[] = [
    `## Current Team: "${teamData.name}"`,
    `Format: ${teamData.formatId}`,
    `Slots filled: ${teamData.slots.length}/6`,
    "",
  ];

  for (const slot of teamData.slots) {
    const species = slot.species;
    const typesStr = species?.types.join("/") ?? "Unknown";
    const movesStr = slot.moves.filter(Boolean).join(", ") || "None";
    const evEntries = Object.entries(slot.evs)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${v} ${k.toUpperCase()}`)
      .join(" / ");

    lines.push(`### Slot ${slot.position}: ${species?.name ?? slot.pokemonId}`);
    lines.push(`- Type: ${typesStr}`);
    lines.push(`- Ability: ${slot.ability}`);
    lines.push(`- Item: ${slot.item}`);
    lines.push(`- Nature: ${slot.nature}`);
    if (slot.teraType) lines.push(`- Tera Type: ${slot.teraType}`);
    lines.push(`- EVs: ${evEntries || "None"}`);
    lines.push(`- Moves: ${movesStr}`);
    if (species?.baseStats) {
      const bst = Object.values(species.baseStats).reduce((a, b) => a + b, 0);
      lines.push(
        `- Base Stats: ${species.baseStats.hp}/${species.baseStats.atk}/${species.baseStats.def}/${species.baseStats.spa}/${species.baseStats.spd}/${species.baseStats.spe} (BST: ${bst})`
      );
    }
    lines.push("");
  }

  // Type coverage summary
  if (teamData.slots.length > 0) {
    const allTypes = teamData.slots
      .filter((s) => s.species)
      .flatMap((s) => s.species!.types);
    const uniqueTypes = [...new Set(allTypes)];
    lines.push(`### Team Type Composition`);
    lines.push(`Types represented: ${uniqueTypes.join(", ")}`);
    lines.push("");
  }

  return lines.join("\n");
}

export function buildMetaContext(
  formatId: string,
  topPokemon: UsageStatsEntry[]
): string {
  const lines: string[] = [
    `## Meta Overview: ${formatId}`,
    `Top ${topPokemon.length} Pokemon by usage:`,
    "",
  ];

  for (const entry of topPokemon) {
    const name = entry.pokemonName ?? entry.pokemonId;
    lines.push(
      `${entry.rank}. ${name} - ${entry.usagePercent.toFixed(2)}% usage`
    );
  }

  return lines.join("\n");
}
