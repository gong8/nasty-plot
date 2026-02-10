import { NextRequest, NextResponse } from "next/server";
import { calculateMatchupMatrix } from "@/modules/damage-calc/services/calc.service";
import { prisma } from "@/shared/services/prisma";
import { Dex } from "@pkmn/dex";
import type { TeamSlotData, PokemonType, ApiResponse, MatchupMatrixEntry, ApiError } from "@/shared/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teamId, threatIds, formatId } = body as {
      teamId: string;
      threatIds?: string[];
      formatId: string;
    };

    if (!teamId || !formatId) {
      return NextResponse.json(
        { error: "Missing required fields: teamId, formatId", code: "INVALID_INPUT" } satisfies ApiError,
        { status: 400 }
      );
    }

    // Load team slots
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { slots: true },
    });

    if (!team) {
      return NextResponse.json(
        { error: "Team not found", code: "NOT_FOUND" } satisfies ApiError,
        { status: 404 }
      );
    }

    const slots: TeamSlotData[] = team.slots.map((s: typeof team.slots[number]) => {
      const species = Dex.species.get(s.pokemonId);
      const speciesData = species?.exists
        ? {
            id: s.pokemonId,
            name: species.name,
            num: species.num,
            types: species.types as [PokemonType] | [PokemonType, PokemonType],
            baseStats: {
              hp: species.baseStats.hp,
              atk: species.baseStats.atk,
              def: species.baseStats.def,
              spa: species.baseStats.spa,
              spd: species.baseStats.spd,
              spe: species.baseStats.spe,
            },
            abilities: Object.fromEntries(
              Object.entries(species.abilities).filter(([, v]) => v)
            ),
            weightkg: species.weightkg,
          }
        : undefined;

      return {
        position: s.position,
        pokemonId: s.pokemonId,
        species: speciesData,
        ability: s.ability,
        item: s.item,
        nature: s.nature as TeamSlotData["nature"],
        teraType: (s.teraType as PokemonType) ?? undefined,
        level: s.level,
        moves: [s.move1, s.move2 ?? undefined, s.move3 ?? undefined, s.move4 ?? undefined] as TeamSlotData["moves"],
        evs: {
          hp: s.evHp,
          atk: s.evAtk,
          def: s.evDef,
          spa: s.evSpA,
          spd: s.evSpD,
          spe: s.evSpe,
        },
        ivs: {
          hp: s.ivHp,
          atk: s.ivAtk,
          def: s.ivDef,
          spa: s.ivSpA,
          spd: s.ivSpD,
          spe: s.ivSpe,
        },
      };
    });

    // Resolve threat IDs: use provided or top usage Pokemon
    let resolvedThreats = threatIds ?? [];
    if (resolvedThreats.length === 0) {
      const usageEntries = await prisma.usageStats.findMany({
        where: { formatId },
        orderBy: { rank: "asc" },
        take: 10,
      });
      resolvedThreats = usageEntries.map((e: typeof usageEntries[number]) => e.pokemonId);
    }

    if (resolvedThreats.length === 0) {
      return NextResponse.json({
        data: [],
      } satisfies ApiResponse<MatchupMatrixEntry[][]>);
    }

    const matrix = calculateMatchupMatrix(slots, resolvedThreats, formatId);

    return NextResponse.json({
      data: matrix,
    } satisfies ApiResponse<MatchupMatrixEntry[][]>);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Matrix calculation failed";
    return NextResponse.json(
      { error: message, code: "CALC_ERROR" } satisfies ApiError,
      { status: 500 }
    );
  }
}
