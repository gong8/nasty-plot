"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { ReplayEngine, type ReplayFrame } from "@nasty-plot/battle-engine/client"
import type { GameType } from "@nasty-plot/core"

const INTER_FRAME_PAUSE = 500 // ms between frames at 1x speed

interface UseReplayConfig {
  protocolLog: string
  format?: GameType
}

export function useReplay(config: UseReplayConfig) {
  const engineRef = useRef<ReplayEngine | null>(null)
  const [currentFrame, setCurrentFrame] = useState<ReplayFrame | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [totalFrames, setTotalFrames] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [isReady, setIsReady] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const speedRef = useRef(speed)
  useEffect(() => {
    speedRef.current = speed
  }, [speed])
  const isPlayingRef = useRef(isPlaying)
  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])
  const wasPlayingRef = useRef(false)

  const clearPendingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const advance = useCallback(() => {
    const engine = engineRef.current
    if (!engine || !isPlayingRef.current) return

    const next = engine.nextFrame()
    if (next) {
      setCurrentFrame(next)
      setCurrentIndex(engine.getCurrentIndex())
    } else {
      setIsPlaying(false)
    }
  }, [])

  // Signal from useReplayAnimations that current frame's animations are done
  const onFrameAnimationsComplete = useCallback(() => {
    if (!isPlayingRef.current) return
    clearPendingTimeout()
    timeoutRef.current = setTimeout(advance, INTER_FRAME_PAUSE / speedRef.current)
  }, [advance, clearPendingTimeout])

  // Initialize engine
  useEffect(() => {
    if (!config.protocolLog) return

    const engine = new ReplayEngine(config.protocolLog, config.format || "singles")
    engine.parse()
    engineRef.current = engine

    setTotalFrames(engine.totalFrames) // eslint-disable-line react-hooks/set-state-in-effect -- engine initialization
    setIsReady(true)

    const first = engine.getFrame(0)
    if (first) {
      setCurrentFrame(first)
      setCurrentIndex(0)
    }

    return () => clearPendingTimeout()
  }, [config.protocolLog, config.format, clearPendingTimeout])

  // Play/pause transitions
  useEffect(() => {
    if (isPlaying && !wasPlayingRef.current) {
      // Just started playing — schedule first advance after inter-frame pause
      // (current frame is already displayed)
      clearPendingTimeout()
      timeoutRef.current = setTimeout(advance, INTER_FRAME_PAUSE / speedRef.current)
    }
    if (!isPlaying) {
      clearPendingTimeout()
    }
    wasPlayingRef.current = isPlaying
  }, [isPlaying, advance, clearPendingTimeout])

  const applyFrame = useCallback((getFrame: (engine: ReplayEngine) => ReplayFrame | null) => {
    const engine = engineRef.current
    if (!engine) return
    const frame = getFrame(engine)
    if (frame) {
      setCurrentFrame(frame)
      setCurrentIndex(engine.getCurrentIndex())
    }
  }, [])

  const goToFirst = useCallback(() => {
    applyFrame((e) => e.setCurrentIndex(0))
    setIsPlaying(false)
  }, [applyFrame])

  const goToPrev = useCallback(() => {
    applyFrame((e) => e.prevFrame())
  }, [applyFrame])

  const goToNext = useCallback(() => {
    applyFrame((e) => e.nextFrame())
  }, [applyFrame])

  const goToLast = useCallback(() => {
    applyFrame((e) => e.setCurrentIndex(e.totalFrames - 1))
    setIsPlaying(false)
  }, [applyFrame])

  const seekTo = useCallback(
    (index: number) => {
      applyFrame((e) => e.setCurrentIndex(index))
    },
    [applyFrame],
  )

  const togglePlay = useCallback(() => {
    setIsPlaying((p) => !p)
  }, [])

  const changeSpeed = useCallback((newSpeed: number) => {
    setSpeed(newSpeed)
  }, [])

  const getAllFrames = useCallback(() => {
    return engineRef.current?.getAllFrames() || []
  }, [])

  return {
    currentFrame,
    currentIndex,
    totalFrames,
    isPlaying,
    speed,
    isReady,
    goToFirst,
    goToPrev,
    goToNext,
    goToLast,
    seekTo,
    togglePlay,
    changeSpeed,
    getAllFrames,
    onFrameAnimationsComplete,
  }
}
