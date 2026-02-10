"use client";

import { cn } from "@/lib/utils";
import type { BattleState } from "@nasty-plot/battle-engine";
import { BattleSprite } from "./PokemonSprite";
import { HealthBar } from "./HealthBar";
import { FieldStatus } from "./FieldStatus";

interface BattleFieldProps {
  state: BattleState;
  className?: string;
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  brn: { label: "BRN", color: "bg-red-500" },
  par: { label: "PAR", color: "bg-yellow-500" },
  slp: { label: "SLP", color: "bg-muted-foreground" },
  frz: { label: "FRZ", color: "bg-cyan-400" },
  psn: { label: "PSN", color: "bg-purple-500" },
  tox: { label: "TOX", color: "bg-purple-700 dark:bg-purple-500" },
};

function ActivePokemonDisplay({
  pokemon,
  side,
  isPlayer,
}: {
  pokemon: NonNullable<BattleState["sides"]["p1"]["active"][0]>;
  side: "p1" | "p2";
  isPlayer: boolean;
}) {
  const statusInfo = pokemon.status ? STATUS_BADGE[pokemon.status] : null;

  return (
    <div className={cn(
      "flex flex-col items-center gap-1",
      isPlayer ? "self-end" : "self-start"
    )}>
      {/* Pokemon info plate */}
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border shadow-sm",
        "min-w-[180px]"
      )}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm truncate">
              {pokemon.nickname || pokemon.name}
            </span>
            <span className="text-xs text-muted-foreground">
              Lv{pokemon.level}
            </span>
            {pokemon.isTerastallized && pokemon.teraType && (
              <span className="text-[10px] px-1 rounded bg-pink-500/20 text-pink-500 font-semibold">
                Tera {pokemon.teraType}
              </span>
            )}
            {statusInfo && (
              <span className={cn("text-[10px] px-1 rounded text-white font-bold", statusInfo.color)}>
                {statusInfo.label}
              </span>
            )}
          </div>
          <HealthBar hp={pokemon.hp} maxHp={pokemon.maxHp} showText={true} />
        </div>
      </div>

      {/* Sprite */}
      <BattleSprite
        speciesId={pokemon.speciesId || pokemon.name}
        side={isPlayer ? "back" : "front"}
        fainted={pokemon.fainted}
        size={isPlayer ? 128 : 96}
      />
    </div>
  );
}

export function BattleField({ state, className }: BattleFieldProps) {
  return (
    <div className={cn("relative", className)}>
      {/* Field conditions */}
      <FieldStatus
        field={state.field}
        p1Conditions={state.sides.p1.sideConditions}
        p2Conditions={state.sides.p2.sideConditions}
        className="mb-2"
      />

      {/* Battle area */}
      <div className="relative min-h-[320px] bg-gradient-to-b from-sky-100 to-green-100 dark:from-indigo-950/80 dark:via-purple-950/60 dark:to-background rounded-xl border overflow-hidden p-4">
        {/* Opponent side (top) */}
        <div className="flex justify-end gap-4 mb-8">
          {state.sides.p2.active.map((pokemon, i) => {
            if (!pokemon) return null;
            return (
              <ActivePokemonDisplay
                key={i}
                pokemon={pokemon}
                side="p2"
                isPlayer={false}
              />
            );
          })}
        </div>

        {/* Player side (bottom) */}
        <div className="flex justify-start gap-4">
          {state.sides.p1.active.map((pokemon, i) => {
            if (!pokemon) return null;
            return (
              <ActivePokemonDisplay
                key={i}
                pokemon={pokemon}
                side="p1"
                isPlayer={true}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
