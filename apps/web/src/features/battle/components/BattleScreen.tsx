"use client"

import { cn } from "@/lib/utils"
import type { BattleState } from "@nasty-plot/battle-engine"
import type { AnimationState } from "../hooks/use-battle-animations"
import { BattleField } from "./BattleField"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

export interface SidebarTab {
  value: string
  label: string
  content: React.ReactNode
}

interface BattleScreenProps {
  state: BattleState
  animState: AnimationState
  textSpeed?: number
  speed?: number
  onSpeedChange?: (speed: number) => void
  sidebarTabs: SidebarTab[]
  /** Content rendered below the battle field in the left column (e.g. move controls) */
  bottomContent?: React.ReactNode
  /** Vertical eval bar rendered to the left of the battle field, height-matched to field row */
  evalBar?: React.ReactNode
  className?: string
}

/**
 * Shared battle screen layout used by both live battle and replay.
 *
 * When `bottomContent` is provided (live battle), uses a CSS grid so
 * the left column (field + controls) and right column (sidebar) share
 * exact top/bottom alignment. Without it (replay), falls back to flex-row.
 */
export function BattleScreen({
  state,
  animState,
  textSpeed,
  speed,
  onSpeedChange,
  sidebarTabs,
  bottomContent,
  evalBar,
  className,
}: BattleScreenProps) {
  const hasControls = !!bottomContent

  return (
    <div
      className={cn(
        "flex flex-col gap-2 min-h-0",
        hasControls
          ? "lg:grid lg:grid-cols-[7fr_3fr] lg:grid-rows-[1fr_240px]"
          : "lg:flex lg:flex-row",
        className,
      )}
    >
      {/* Battle field — with eval bar absolutely positioned to its left */}
      <div
        className={cn(
          "min-w-0 relative",
          hasControls ? "lg:col-start-1 lg:row-start-1" : "lg:flex-[7]",
        )}
      >
        {evalBar && (
          <div className="hidden lg:flex absolute right-full top-0 bottom-0 mr-2">{evalBar}</div>
        )}
        <BattleField
          state={state}
          animationStates={animState.slotAnimations}
          textMessage={animState.textMessage}
          damageNumbers={animState.damageNumbers}
          textSpeed={textSpeed}
          speed={speed}
          onSpeedChange={onSpeedChange}
          className={hasControls ? "h-full aspect-auto" : undefined}
        />
      </div>

      {/* Controls below field */}
      {hasControls && (
        <div className="lg:col-start-1 lg:row-start-2 min-h-0 overflow-y-auto">{bottomContent}</div>
      )}

      {/* Tabbed sidebar — spans both rows when grid, flex-[3] when flex */}
      {sidebarTabs.length > 0 && (
        <Tabs
          defaultValue={sidebarTabs[0].value}
          className={cn(
            "flex flex-col min-w-0 min-h-0",
            hasControls ? "lg:col-start-2 lg:row-start-1 lg:row-span-2" : "lg:flex-[3]",
          )}
        >
          <TabsList className="w-full shrink-0">
            {sidebarTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {sidebarTabs.map((tab) => (
            <TabsContent
              key={tab.value}
              value={tab.value}
              className="flex-1 min-h-0 mt-1 overflow-y-auto"
            >
              {tab.content}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
