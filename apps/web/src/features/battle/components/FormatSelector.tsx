"use client"

import { useMemo } from "react"
import { GroupedSelector } from "@nasty-plot/ui"
import { useFormats } from "../hooks/use-formats"

interface FormatSelectorProps {
  value: string
  onChange: (formatId: string) => void
  activeOnly?: boolean
}

export function FormatSelector({ value, onChange, activeOnly = true }: FormatSelectorProps) {
  const { data: formats, isLoading } = useFormats(activeOnly)

  const groups = useMemo(() => {
    const singles = formats.filter((f) => f.gameType === "singles")
    const doubles = formats.filter((f) => f.gameType === "doubles")
    return [
      { label: "Singles", items: singles.map((f) => ({ value: f.id, label: f.name })) },
      { label: "Doubles", items: doubles.map((f) => ({ value: f.id, label: f.name })) },
    ]
  }, [formats])

  return (
    <GroupedSelector
      value={value}
      onValueChange={onChange}
      groups={groups}
      placeholder="Select format..."
      disabled={isLoading}
    />
  )
}
