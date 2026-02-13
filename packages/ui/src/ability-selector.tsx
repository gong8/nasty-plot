"use client"

import { useMemo } from "react"
import { Select as SelectPrimitive } from "radix-ui"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"
import { cn } from "./utils"
import { formatUsagePercent } from "@nasty-plot/core"

interface AbilitySelectorProps {
  value: string
  onValueChange: (ability: string) => void
  abilities: string[]
  popularity?: { name: string; usagePercent: number }[]
  placeholder?: string
  triggerClassName?: string
}

export type { AbilitySelectorProps }

export function AbilitySelector({
  value,
  onValueChange,
  abilities,
  popularity,
  placeholder = "Select ability",
  triggerClassName,
}: AbilitySelectorProps) {
  const { commonAbilities, otherAbilities } = useMemo(() => {
    if (!popularity?.length) {
      return { commonAbilities: [] as string[], otherAbilities: abilities }
    }
    const usageMap = new Map(popularity.map((a) => [a.name, a.usagePercent]))
    const common = abilities
      .filter((a) => usageMap.has(a))
      .sort((a, b) => (usageMap.get(b) ?? 0) - (usageMap.get(a) ?? 0))
    const other = abilities.filter((a) => !usageMap.has(a))
    return { commonAbilities: common, otherAbilities: other }
  }, [abilities, popularity])

  const usageMap = useMemo(() => {
    if (!popularity?.length) return null
    return new Map(popularity.map((a) => [a.name, a.usagePercent]))
  }, [popularity])

  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        className={cn(
          "border-input data-placeholder:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 bg-transparent dark:bg-input/30 hover:bg-accent dark:hover:bg-input/50 flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 h-9 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          triggerClassName,
        )}
      >
        <SelectPrimitive.Value data-slot="select-value" placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDownIcon className="size-4 opacity-50" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="bg-card dark:bg-glass-bg dark:backdrop-blur-xl text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-(--radix-select-content-available-height) min-w-32 origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border dark:border-glass-border shadow-md"
          position="item-aligned"
          align="center"
        >
          <SelectPrimitive.ScrollUpButton className="flex cursor-default items-center justify-center py-1">
            <ChevronUpIcon className="size-4" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="p-1">
            {commonAbilities.length > 0 ? (
              <>
                <SelectPrimitive.Group>
                  <SelectPrimitive.Label className="text-muted-foreground px-2 py-1.5 text-xs">
                    Common
                  </SelectPrimitive.Label>
                  {commonAbilities.map((a) => {
                    const pct = usageMap?.get(a)
                    return (
                      <SelectPrimitive.Item
                        key={a}
                        value={a}
                        className="focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2"
                      >
                        <span className="absolute right-2 flex size-3.5 items-center justify-center">
                          <SelectPrimitive.ItemIndicator>
                            <CheckIcon className="size-4" />
                          </SelectPrimitive.ItemIndicator>
                        </span>
                        <SelectPrimitive.ItemText>
                          {a}{" "}
                          {pct != null && (
                            <span className="text-muted-foreground">
                              ({formatUsagePercent(pct, 0)})
                            </span>
                          )}
                        </SelectPrimitive.ItemText>
                      </SelectPrimitive.Item>
                    )
                  })}
                </SelectPrimitive.Group>
                {otherAbilities.length > 0 && (
                  <SelectPrimitive.Group>
                    <SelectPrimitive.Label className="text-muted-foreground px-2 py-1.5 text-xs">
                      Other
                    </SelectPrimitive.Label>
                    {otherAbilities.map((a) => (
                      <SelectPrimitive.Item
                        key={a}
                        value={a}
                        className="focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2"
                      >
                        <span className="absolute right-2 flex size-3.5 items-center justify-center">
                          <SelectPrimitive.ItemIndicator>
                            <CheckIcon className="size-4" />
                          </SelectPrimitive.ItemIndicator>
                        </span>
                        <SelectPrimitive.ItemText>{a}</SelectPrimitive.ItemText>
                      </SelectPrimitive.Item>
                    ))}
                  </SelectPrimitive.Group>
                )}
              </>
            ) : (
              abilities.map((a) => (
                <SelectPrimitive.Item
                  key={a}
                  value={a}
                  className="focus:bg-accent focus:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2"
                >
                  <span className="absolute right-2 flex size-3.5 items-center justify-center">
                    <SelectPrimitive.ItemIndicator>
                      <CheckIcon className="size-4" />
                    </SelectPrimitive.ItemIndicator>
                  </span>
                  <SelectPrimitive.ItemText>{a}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))
            )}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex cursor-default items-center justify-center py-1">
            <ChevronDownIcon className="size-4" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
