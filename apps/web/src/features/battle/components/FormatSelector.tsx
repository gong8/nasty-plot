"use client"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useFormats } from "../hooks/use-formats"

interface FormatSelectorProps {
  value: string
  onChange: (formatId: string) => void
  activeOnly?: boolean
}

export function FormatSelector({ value, onChange, activeOnly = true }: FormatSelectorProps) {
  const { data: formats, isLoading } = useFormats(activeOnly)

  const singles = formats.filter((f) => f.gameType === "singles")
  const doubles = formats.filter((f) => f.gameType === "doubles")

  return (
    <Select value={value} onValueChange={onChange} disabled={isLoading}>
      <SelectTrigger>
        <SelectValue placeholder="Select format..." />
      </SelectTrigger>
      <SelectContent>
        {singles.length > 0 && (
          <SelectGroup>
            <SelectLabel>Singles</SelectLabel>
            {singles.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {doubles.length > 0 && (
          <SelectGroup>
            <SelectLabel>Doubles</SelectLabel>
            {doubles.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  )
}
