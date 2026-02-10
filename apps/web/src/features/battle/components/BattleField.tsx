"use client"

import { cn } from "@/lib/utils"
import type { BattleState, BattlePokemon } from "@nasty-plot/battle-engine"
import { BattleSprite } from "./PokemonSprite"
import { HealthBar } from "./HealthBar"
import { BattlePlatform } from "./BattlePlatform"
import { PokeballIndicator } from "./PokeballIndicator"
import { WeatherOverlay } from "./WeatherOverlay"
import { SideConditionIndicators } from "./SideConditionIndicators"
import { BattleTextBox } from "./BattleTextBox"
import { DamageNumber } from "./DamageNumber"

interface BattleFieldProps {
  state: BattleState
  animationStates?: Record<string, string> // slot key -> CSS class
  textMessage?: string | null
  textSpeed?: number
  damageNumbers?: { value: string; side: "p1" | "p2"; slot: number }[] | null
  speed?: number
  onSpeedChange?: (speed: number) => void
  className?: string
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  brn: { label: "BRN", color: "bg-red-500" },
  par: { label: "PAR", color: "bg-yellow-500" },
  slp: { label: "SLP", color: "bg-muted-foreground" },
  frz: { label: "FRZ", color: "bg-cyan-400" },
  psn: { label: "PSN", color: "bg-purple-500" },
  tox: { label: "TOX", color: "bg-purple-700 dark:bg-purple-500" },
}

/** Positioning configs for singles and doubles */
const SINGLES_POSITIONS = {
  player: [{ bottom: "14%", left: "10%" }],
  opponent: [{ top: "6%", right: "10%" }],
} as const

const DOUBLES_POSITIONS = {
  player: [
    { bottom: "10%", left: "5%" },
    { bottom: "4%", left: "30%" },
  ],
  opponent: [
    { top: "4%", right: "5%" },
    { top: "10%", right: "30%" },
  ],
} as const

function PokemonInfoPlate({ pokemon, isPlayer }: { pokemon: BattlePokemon; isPlayer: boolean }) {
  const statusInfo = pokemon.status ? STATUS_BADGE[pokemon.status] : null

  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 px-3 py-1.5 rounded-lg border shadow-sm min-w-[160px]",
        "bg-card/90 backdrop-blur-sm",
        isPlayer ? "items-start" : "items-end",
      )}
    >
      <div className={cn("flex items-center gap-1.5", !isPlayer && "flex-row-reverse")}>
        <span className="font-semibold text-sm truncate max-w-[120px]">
          {pokemon.nickname || pokemon.name}
        </span>
        <span className="text-xs text-muted-foreground">Lv{pokemon.level}</span>
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
      <HealthBar hp={pokemon.hp} maxHp={pokemon.maxHp} showText={true} className="w-full" />
    </div>
  )
}

function ActivePokemonSlot({
  pokemon,
  isPlayer,
  slotIndex,
  isDoubles,
  animationClass,
}: {
  pokemon: BattlePokemon
  isPlayer: boolean
  slotIndex: number
  isDoubles: boolean
  animationClass?: string
}) {
  const positions = isDoubles ? DOUBLES_POSITIONS : SINGLES_POSITIONS
  const posArray = isPlayer ? positions.player : positions.opponent
  const pos = posArray[slotIndex] ?? posArray[0]

  return (
    <div className="absolute flex flex-col items-center" style={pos as React.CSSProperties}>
      {/* Info plate above/below sprite depending on side */}
      {!isPlayer && <PokemonInfoPlate pokemon={pokemon} isPlayer={false} />}

      {/* Sprite + platform container */}
      <div className="relative">
        <BattleSprite
          speciesId={pokemon.speciesId || pokemon.name}
          side={isPlayer ? "back" : "front"}
          fainted={pokemon.fainted}
          size={isPlayer ? 128 : 96}
          animationClass={animationClass}
        />
        {/* Platform beneath sprite */}
        <BattlePlatform
          variant={isPlayer ? "player" : "opponent"}
          className={cn("left-1/2 -translate-x-1/2", isPlayer ? "-bottom-2" : "-bottom-1")}
        />
      </div>

      {isPlayer && <PokemonInfoPlate pokemon={pokemon} isPlayer={true} />}
    </div>
  )
}

export function BattleField({
  state,
  animationStates,
  textMessage = null,
  textSpeed,
  damageNumbers = null,
  speed,
  onSpeedChange,
  className,
}: BattleFieldProps) {
  const isDoubles = state.sides.p1.active.length > 1

  return (
    <div
      className={cn(
        "relative aspect-[2/1] w-full overflow-hidden rounded-xl border",
        "bg-gradient-to-b from-sky-200 via-sky-100 to-emerald-200",
        "dark:from-slate-900 dark:via-indigo-950 dark:to-emerald-950",
        className,
      )}
    >
      {/* Weather/terrain overlay */}
      <WeatherOverlay field={state.field} />

      {/* Opponent pokeball indicators (right side, vertical) */}
      <div className="absolute top-3 right-1 z-20">
        <PokeballIndicator team={state.sides.p2.team} vertical />
      </div>

      {/* Player pokeball indicators (left side, vertical) */}
      <div className="absolute bottom-[48px] left-1 z-20">
        <PokeballIndicator team={state.sides.p1.team} vertical />
      </div>

      {/* Opponent side conditions (top-left area, near their side) */}
      <SideConditionIndicators
        conditions={state.sides.p2.sideConditions}
        side="opponent"
        className="absolute top-3 left-3 z-20"
      />

      {/* Player side conditions (bottom-right area, near their side) */}
      <SideConditionIndicators
        conditions={state.sides.p1.sideConditions}
        side="player"
        className="absolute bottom-3 right-3 z-20"
      />

      {/* Opponent active Pokemon */}
      {state.sides.p2.active.map((pokemon, i) => {
        if (!pokemon) return null
        const slotKey = `p2-${i}`
        return (
          <ActivePokemonSlot
            key={slotKey}
            pokemon={pokemon}
            isPlayer={false}
            slotIndex={i}
            isDoubles={isDoubles}
            animationClass={animationStates?.[slotKey]}
          />
        )
      })}

      {/* Player active Pokemon */}
      {state.sides.p1.active.map((pokemon, i) => {
        if (!pokemon) return null
        const slotKey = `p1-${i}`
        return (
          <ActivePokemonSlot
            key={slotKey}
            pokemon={pokemon}
            isPlayer={true}
            slotIndex={i}
            isDoubles={isDoubles}
            animationClass={animationStates?.[slotKey]}
          />
        )
      })}

      {/* Speed controls — faint overlay, bottom-right above text box */}
      {onSpeedChange && (
        <div className="absolute bottom-[48px] right-2 z-20 flex items-center gap-px opacity-40 hover:opacity-90 transition-opacity">
          {[1, 2, 4].map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={cn(
                "px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors",
                speed === s
                  ? "bg-white/90 text-black"
                  : "bg-black/30 text-white/80 hover:bg-black/50",
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      )}

      {/* Pokemon-style text box */}
      <BattleTextBox message={textMessage} speed={textSpeed} />

      {/* Damage numbers */}
      {damageNumbers?.map((dn, i) => (
        <DamageNumber
          key={`${dn.side}-${dn.slot}-${i}`}
          value={dn.value}
          side={dn.side}
          slotIndex={dn.slot}
        />
      ))}
    </div>
  )
}
