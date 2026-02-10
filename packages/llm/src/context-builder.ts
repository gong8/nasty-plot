import type { TeamData, UsageStatsEntry, PokemonSpecies } from "@nasty-plot/core";

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

export function buildPokemonContext(pokemonId: string, species: PokemonSpecies): string {
  const bst = Object.values(species.baseStats).reduce((a, b) => a + b, 0);
  const abilities = Object.entries(species.abilities)
    .map(([slot, name]) => (slot === "H" ? `${name} (Hidden)` : name))
    .join(", ");

  return [
    `## Currently Viewing: ${species.name}`,
    `- Types: ${species.types.join("/")}`,
    `- Base Stats: ${species.baseStats.hp}/${species.baseStats.atk}/${species.baseStats.def}/${species.baseStats.spa}/${species.baseStats.spd}/${species.baseStats.spe} (BST: ${bst})`,
    `- Abilities: ${abilities}`,
    species.tier ? `- Tier: ${species.tier}` : "",
    "",
  ]
    .filter(Boolean)
    .join("\n");
}

export interface PageContextData {
  pageType: string;
  contextSummary: string;
  teamId?: string;
  pokemonId?: string;
  formatId?: string;
}

export function buildPageContextPrompt(context: PageContextData): string {
  if (!context.contextSummary) return "";
  return `\n## Current Page Context\n${context.contextSummary}\n`;
}

export function buildPlanModePrompt(): string {
  return `
## Planning
For complex multi-step tasks (building a team, comprehensive analysis, multi-pokemon comparison),
create a step-by-step plan first:

<plan>
<step>Step 1 description</step>
<step>Step 2 description</step>
</plan>

As you complete each step, output:
<step_update index="0" status="complete"/>

For simple questions, answer directly without a plan.
`;
}
