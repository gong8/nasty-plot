"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ReplayEngine, type ReplayFrame, type BattleFormat } from "@nasty-plot/battle-engine";

interface UseReplayConfig {
  protocolLog: string;
  format?: BattleFormat;
}

export function useReplay(config: UseReplayConfig) {
  const engineRef = useRef<ReplayEngine | null>(null);
  const [currentFrame, setCurrentFrame] = useState<ReplayFrame | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isReady, setIsReady] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize engine
  useEffect(() => {
    if (!config.protocolLog) return;

    const engine = new ReplayEngine(config.protocolLog, config.format || "singles");
    engine.parse();
    engineRef.current = engine;

    setTotalFrames(engine.totalFrames);
    setIsReady(true);

    const first = engine.getFrame(0);
    if (first) {
      setCurrentFrame(first);
      setCurrentIndex(0);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [config.protocolLog, config.format]);

  // Auto-advance when playing
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!isPlaying || !engineRef.current) return;

    const interval = 1500 / speed;
    intervalRef.current = setInterval(() => {
      const engine = engineRef.current;
      if (!engine) return;

      const next = engine.nextFrame();
      if (next) {
        setCurrentFrame(next);
        setCurrentIndex(engine.getCurrentIndex());
      } else {
        setIsPlaying(false);
      }
    }, interval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, speed]);

  const goToFirst = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const frame = engine.setCurrentIndex(0);
    if (frame) {
      setCurrentFrame(frame);
      setCurrentIndex(0);
    }
    setIsPlaying(false);
  }, []);

  const goToPrev = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const frame = engine.prevFrame();
    if (frame) {
      setCurrentFrame(frame);
      setCurrentIndex(engine.getCurrentIndex());
    }
  }, []);

  const goToNext = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const frame = engine.nextFrame();
    if (frame) {
      setCurrentFrame(frame);
      setCurrentIndex(engine.getCurrentIndex());
    }
  }, []);

  const goToLast = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const frame = engine.setCurrentIndex(engine.totalFrames - 1);
    if (frame) {
      setCurrentFrame(frame);
      setCurrentIndex(engine.getCurrentIndex());
    }
    setIsPlaying(false);
  }, []);

  const seekTo = useCallback((index: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    const frame = engine.setCurrentIndex(index);
    if (frame) {
      setCurrentFrame(frame);
      setCurrentIndex(index);
    }
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying((p) => !p);
  }, []);

  const changeSpeed = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
  }, []);

  const getAllFrames = useCallback(() => {
    return engineRef.current?.getAllFrames() || [];
  }, []);

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
  };
}
