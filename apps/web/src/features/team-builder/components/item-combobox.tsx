"use client"

import { useState, useMemo, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@nasty-plot/ui"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { formatUsagePercent, type ItemData, type PaginatedResponse } from "@nasty-plot/core"
import { fetchJson } from "@/lib/api-client"
import { usePopularityData } from "../hooks/use-popularity-data"
import { usePopularityGroups } from "@/hooks/use-popularity-groups"

interface ItemComboboxProps {
  value: string
  onChange: (value: string) => void
  formatId?: string
  pokemonId?: string
}

const ITEMS_PAGE_SIZE = 100

async function fetchAllItems(formatId?: string): Promise<ItemData[]> {
  const formatParam = formatId ? `&formatId=${encodeURIComponent(formatId)}` : ""
  try {
    const firstPage = await fetchJson<PaginatedResponse<ItemData>>(
      `/api/items?pageSize=${ITEMS_PAGE_SIZE}&page=1${formatParam}`,
    )
    const allItems = [...firstPage.data]
    const totalPages = Math.ceil(firstPage.total / firstPage.pageSize)
    for (let page = 2; page <= totalPages; page++) {
      try {
        const nextPage = await fetchJson<PaginatedResponse<ItemData>>(
          `/api/items?pageSize=${ITEMS_PAGE_SIZE}&page=${page}${formatParam}`,
        )
        allItems.push(...nextPage.data)
      } catch {
        // Skip failed pages
      }
    }
    return allItems
  } catch {
    return []
  }
}

export function ItemCombobox({ value, onChange, formatId, pokemonId }: ItemComboboxProps) {
  const [open, setOpen] = useState(false)

  const { data: items = [] } = useQuery<ItemData[]>({
    queryKey: ["all-items", formatId],
    queryFn: () => fetchAllItems(formatId),
    staleTime: Infinity,
  })

  const { data: popularity } = usePopularityData(pokemonId ?? "", formatId)

  const getItemKey = useCallback((item: ItemData) => item.name, [])
  const { common: commonItems, other: otherItems } = usePopularityGroups(
    items,
    popularity?.items,
    getItemKey,
  )

  const usageMap = useMemo(
    () => new Map(popularity?.items?.map((i) => [i.name, i.usagePercent]) ?? []),
    [popularity],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {value || "Select item..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
        side="bottom"
        avoidCollisions
      >
        <Command>
          <CommandInput placeholder="Search items..." />
          <CommandList className="max-h-[200px] overflow-y-auto">
            <CommandEmpty>No item found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => {
                  onChange("")
                  setOpen(false)
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                <span className="text-muted-foreground">None</span>
              </CommandItem>
            </CommandGroup>
            {commonItems.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Common">
                  {commonItems.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.name}
                      onSelect={() => {
                        onChange(item.name)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === item.name ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="flex items-center justify-between w-full">
                        <span>{item.name}</span>
                        {usageMap.get(item.name) != null && (
                          <span className="text-xs text-muted-foreground ml-2">
                            {formatUsagePercent(usageMap.get(item.name)!)}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            <CommandGroup heading={commonItems.length > 0 ? "All Items" : undefined}>
              {otherItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.name}
                  onSelect={() => {
                    onChange(item.name)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === item.name ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{item.name}</span>
                    {item.description && (
                      <span className="text-xs text-muted-foreground whitespace-normal">
                        {item.description}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
