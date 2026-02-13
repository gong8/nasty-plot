"use client"

import { useState, useCallback, type ReactNode } from "react"
import { Popover as PopoverPrimitive } from "radix-ui"
import { Command as CommandPrimitive } from "cmdk"
import { ChevronsUpDown, SearchIcon } from "lucide-react"
import { cn } from "./utils"

interface SearchComboboxItem {
  id: string
  [key: string]: unknown
}

interface SearchComboboxProps<T extends SearchComboboxItem> {
  /** Currently selected value (displayed in trigger) */
  value: string
  /** Placeholder text when no value is selected */
  placeholder?: string
  /** Callback when an item is selected */
  onSelect: (item: T) => void
  /** Render each item in the dropdown list */
  renderItem: (item: T) => ReactNode
  /** Render the selected value in the trigger button (defaults to value string) */
  renderValue?: () => ReactNode
  /** Static list of items to filter locally (mutually exclusive with fetchResults) */
  items?: T[]
  /** Async function to fetch results based on search query (mutually exclusive with items) */
  fetchResults?: (query: string) => Promise<T[]>
  /** Minimum characters before triggering search (only for fetchResults mode) */
  minSearchLength?: number
  /** Width of the popover dropdown */
  popoverWidth?: string
  /** Max height of the result list */
  maxHeight?: string
  /** Message shown when no results are found */
  emptyMessage?: string
  /** Message shown when search query is too short */
  minLengthMessage?: string
  /** Whether the combobox is disabled */
  disabled?: boolean
  /** Additional className for the trigger button */
  triggerClassName?: string
  /** Additional className for the popover content */
  popoverClassName?: string
  /** Whether the Command component should handle its own filtering (for static items) */
  shouldFilter?: boolean
  /** Custom filter function for static items (used when items prop is provided and shouldFilter is false) */
  filterItems?: (items: T[], query: string) => T[]
  /** Maximum number of items to display */
  maxItems?: number
}

export function SearchCombobox<T extends SearchComboboxItem>({
  value,
  placeholder = "Search...",
  onSelect,
  renderItem,
  renderValue,
  items,
  fetchResults,
  minSearchLength = 2,
  popoverWidth = "w-[240px]",
  maxHeight = "max-h-[200px]",
  emptyMessage = "No results found.",
  minLengthMessage,
  disabled = false,
  triggerClassName,
  popoverClassName,
  shouldFilter,
  filterItems,
  maxItems,
}: SearchComboboxProps<T>) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [asyncResults, setAsyncResults] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const isAsyncMode = !!fetchResults
  const resolvedShouldFilter = shouldFilter ?? !isAsyncMode

  const handleSearchChange = useCallback(
    async (query: string) => {
      setSearch(query)

      if (!fetchResults) return

      if (query.length < minSearchLength) {
        setAsyncResults([])
        return
      }

      setIsLoading(true)
      try {
        const results = await fetchResults(query)
        setAsyncResults(results)
      } catch {
        setAsyncResults([])
      } finally {
        setIsLoading(false)
      }
    },
    [fetchResults, minSearchLength],
  )

  const handleSelect = useCallback(
    (item: T) => {
      onSelect(item)
      setSearch("")
      setOpen(false)
    },
    [onSelect],
  )

  // Determine which items to display
  let displayItems: T[]
  if (isAsyncMode) {
    displayItems = asyncResults
  } else if (items) {
    if (filterItems && search) {
      displayItems = filterItems(items, search)
    } else {
      displayItems = items
    }
  } else {
    displayItems = []
  }

  if (maxItems) {
    displayItems = displayItems.slice(0, maxItems)
  }

  // Determine empty message
  const resolvedEmptyMessage =
    isAsyncMode && search.length < minSearchLength
      ? (minLengthMessage ?? `Type at least ${minSearchLength} characters...`)
      : isLoading
        ? "Loading..."
        : emptyMessage

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "inline-flex items-center justify-between gap-2 whitespace-nowrap rounded-md text-sm font-normal transition-all",
            "border border-input bg-background shadow-xs",
            "hover:bg-accent hover:text-accent-foreground",
            "disabled:pointer-events-none disabled:opacity-50",
            "outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
            "h-8 px-3 py-1 text-xs w-full",
            triggerClassName,
          )}
        >
          {value && renderValue ? (
            renderValue()
          ) : value ? (
            <span className="truncate">{value}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-auto h-3.5 w-3.5 shrink-0 opacity-50" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className={cn(
            "bg-card dark:bg-glass-bg dark:backdrop-blur-xl text-popover-foreground",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
            "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            "z-50 origin-(--radix-popover-content-transform-origin) rounded-md border dark:border-glass-border shadow-md outline-hidden",
            "p-0",
            popoverWidth,
            popoverClassName,
          )}
        >
          <CommandPrimitive
            shouldFilter={resolvedShouldFilter}
            className="bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md"
          >
            <div className="flex h-9 items-center gap-2 border-b px-3">
              <SearchIcon className="size-4 shrink-0 opacity-50" />
              <CommandPrimitive.Input
                placeholder={placeholder}
                value={search}
                onValueChange={handleSearchChange}
                className="placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-xs outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <CommandPrimitive.List
              className={cn("scroll-py-1 overflow-x-hidden overflow-y-auto", maxHeight)}
            >
              <CommandPrimitive.Empty className="py-6 text-center text-xs">
                {resolvedEmptyMessage}
              </CommandPrimitive.Empty>
              <CommandPrimitive.Group className="text-foreground overflow-hidden p-1 [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium">
                {displayItems.map((item) => (
                  <CommandPrimitive.Item
                    key={item.id}
                    value={item.id}
                    onSelect={() => handleSelect(item)}
                    className="data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50"
                  >
                    {renderItem(item)}
                  </CommandPrimitive.Item>
                ))}
              </CommandPrimitive.Group>
            </CommandPrimitive.List>
          </CommandPrimitive>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
