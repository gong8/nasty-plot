"use client"

import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { SkipBack, SkipForward, ChevronLeft, ChevronRight, Play, Pause } from "lucide-react"
import { cn } from "@nasty-plot/ui"

interface ReplayControlsProps {
  currentFrame: number
  totalFrames: number
  isPlaying: boolean
  speed: number
  onFirst: () => void
  onPrev: () => void
  onNext: () => void
  onLast: () => void
  onTogglePlay: () => void
  onSeek: (frame: number) => void
  onSpeedChange: (speed: number) => void
  className?: string
}

const SPEEDS = [1, 2, 4]

export function ReplayControls({
  currentFrame,
  totalFrames,
  isPlaying,
  speed,
  onFirst,
  onPrev,
  onNext,
  onLast,
  onTogglePlay,
  onSeek,
  onSpeedChange,
  className,
}: ReplayControlsProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {/* Turn slider */}
      <Slider
        value={[currentFrame]}
        max={Math.max(totalFrames - 1, 0)}
        step={1}
        onValueChange={([v]) => onSeek(v)}
        className="w-full"
      />

      {/* Controls row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={onFirst} className="h-8 w-8">
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onPrev} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={onTogglePlay} className="h-8 w-8">
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="ghost" onClick={onNext} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onLast} className="h-8 w-8">
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Turn counter */}
        <span className="text-sm text-muted-foreground">
          Frame {currentFrame + 1} / {totalFrames}
        </span>

        {/* Speed selector */}
        <div className="flex items-center gap-1">
          {SPEEDS.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={speed === s ? "default" : "ghost"}
              onClick={() => onSpeedChange(s)}
              className="h-7 text-xs px-2"
            >
              {s}x
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
