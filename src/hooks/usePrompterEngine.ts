/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { PrompterWord, PrompterState } from "../types";

export function usePrompterEngine(words: PrompterWord[]) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [elapsedTimeMs, setElapsedTimeMs] = useState<number>(0);
  const [isHolding, setIsHolding] = useState<boolean>(false);
  
  // Interactive gesture state: pressing on display to temporarily hold
  const [isGestureHolding, setIsGestureHolding] = useState<boolean>(false);

  // High-precision clock references (Web Audio API)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioStartCtxTimeRef = useRef<number>(0);
  const audioStartElapsedMsRef = useRef<number>(0);

  // Use refs to avoid closures and lag in the requestAnimationFrame loop
  const isPlayingRef = useRef(isPlaying);
  const wordsRef = useRef(words);
  const currentIndexRef = useRef(currentIndex);
  const elapsedTimeMsRef = useRef(elapsedTimeMs);
  const isHoldingRef = useRef(isHolding);
  const isGestureHoldingRef = useRef(isGestureHolding);
  const rafIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // Synchronize state values to refs
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { wordsRef.current = words; }, [words]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { elapsedTimeMsRef.current = elapsedTimeMs; }, [elapsedTimeMs]);
  useEffect(() => { isHoldingRef.current = isHolding; }, [isHolding]);
  useEffect(() => { isGestureHoldingRef.current = isGestureHolding; }, [isGestureHolding]);

  // Handle word-matching based on current elapsed time
  const updateIndexFromTime = useCallback((time: number) => {
    const currentWords = wordsRef.current;
    if (currentWords.length === 0) return;

    // Find the word active at the given elapsed time
    let matchedIndex = 0;
    for (let i = 0; i < currentWords.length; i++) {
      const w = currentWords[i];
      if (time >= w.startTimeMs && time < w.startTimeMs + w.totalDurationMs) {
        matchedIndex = i;
        break;
      }
      // If time exceeds the last word, pin it to the last word
      if (i === currentWords.length - 1 && time >= w.startTimeMs + w.totalDurationMs) {
        matchedIndex = i;
      }
    }

    if (matchedIndex !== currentIndexRef.current) {
      setCurrentIndex(matchedIndex);
      currentIndexRef.current = matchedIndex;
    }
  }, []);

  // Sync Web Audio references on playback start/change
  const syncAudioClock = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtxRef.current = new AudioContextClass();
      }
    }
    const ctx = audioCtxRef.current;
    if (ctx) {
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      audioStartCtxTimeRef.current = ctx.currentTime;
      audioStartElapsedMsRef.current = elapsedTimeMsRef.current;
    }
  }, []);

  // Play Loop Execution using requestAnimationFrame and high-precision AudioContext timeline
  useEffect(() => {
    const loop = (timestamp: number) => {
      if (!isPlayingRef.current) {
        lastTimeRef.current = null;
        return;
      }

      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
        syncAudioClock();
      }

      // If user holds down click/touch, pause timer and continuously update start anchors
      if (isGestureHoldingRef.current) {
        if (audioCtxRef.current) {
          audioStartCtxTimeRef.current = audioCtxRef.current.currentTime;
          audioStartElapsedMsRef.current = elapsedTimeMsRef.current;
        }
        lastTimeRef.current = timestamp;
        rafIdRef.current = requestAnimationFrame(loop);
        return;
      }

      // Calculate highly-stable elapsed time using Web Audio thread (or high-res fallback)
      let nextElapsedTime = elapsedTimeMsRef.current;
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === "running") {
        const audioDeltaSec = ctx.currentTime - audioStartCtxTimeRef.current;
        nextElapsedTime = audioStartElapsedMsRef.current + audioDeltaSec * 1000;
      } else {
        const delta = Math.min(timestamp - lastTimeRef.current, 100); // safety cap to prevent glitches
        nextElapsedTime = elapsedTimeMsRef.current + delta;
      }
      lastTimeRef.current = timestamp;

      const currentWords = wordsRef.current;
      if (currentWords.length === 0) {
        setIsPlaying(false);
        return;
      }

      const lastWord = currentWords[currentWords.length - 1];
      const totalScriptDuration = lastWord.startTimeMs + lastWord.totalDurationMs;

      // Detect if we completed the script
      if (nextElapsedTime >= totalScriptDuration) {
        setElapsedTimeMs(totalScriptDuration);
        elapsedTimeMsRef.current = totalScriptDuration;
        updateIndexFromTime(totalScriptDuration - 1);
        setIsPlaying(false);
        return;
      }

      // Detect if we crossed a HOLD threshold
      let shouldHold = false;
      let holdTargetTime = 0;

      for (let i = 0; i < currentWords.length; i++) {
        const w = currentWords[i];
        if (w.isHold) {
          const boundaryTime = w.startTimeMs + w.totalDurationMs;
          if (elapsedTimeMsRef.current < boundaryTime && nextElapsedTime >= boundaryTime) {
            shouldHold = true;
            holdTargetTime = boundaryTime;
            break;
          }
        }
      }

      if (shouldHold) {
        setElapsedTimeMs(holdTargetTime);
        elapsedTimeMsRef.current = holdTargetTime;
        updateIndexFromTime(holdTargetTime - 1);
        setIsPlaying(false);
        setIsHolding(true);
        lastTimeRef.current = null;
        return;
      }

      // Normal stable progress
      setElapsedTimeMs(nextElapsedTime);
      elapsedTimeMsRef.current = nextElapsedTime;
      updateIndexFromTime(nextElapsedTime);

      rafIdRef.current = requestAnimationFrame(loop);
    };

    if (isPlaying) {
      lastTimeRef.current = null;
      rafIdRef.current = requestAnimationFrame(loop);
    } else {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    }

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [isPlaying, updateIndexFromTime, syncAudioClock]);

  // Actions
  const play = useCallback(() => {
    if (wordsRef.current.length === 0) return;
    
    // If at the very end, reset to beginning first
    const lastWord = wordsRef.current[wordsRef.current.length - 1];
    const totalDuration = lastWord.startTimeMs + lastWord.totalDurationMs;
    if (elapsedTimeMsRef.current >= totalDuration) {
      setElapsedTimeMs(0);
      elapsedTimeMsRef.current = 0;
      setCurrentIndex(0);
      currentIndexRef.current = 0;
    }

    setIsPlaying(true);
    setIsHolding(false);

    // Bootstrap Audio Context on user action
    setTimeout(() => {
      syncAudioClock();
    }, 0);
  }, [syncAudioClock]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setIsHolding(false);
    setIsGestureHolding(false);
    setElapsedTimeMs(0);
    elapsedTimeMsRef.current = 0;
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    lastTimeRef.current = null;
    
    if (audioCtxRef.current) {
      audioStartCtxTimeRef.current = audioCtxRef.current.currentTime;
      audioStartElapsedMsRef.current = 0;
    }
  }, []);

  const setIndex = useCallback((index: number) => {
    const currentWords = wordsRef.current;
    if (currentWords.length === 0) return;

    const boundedIndex = Math.max(0, Math.min(index, currentWords.length - 1));
    const targetTime = currentWords[boundedIndex].startTimeMs;

    setElapsedTimeMs(targetTime);
    elapsedTimeMsRef.current = targetTime;
    setCurrentIndex(boundedIndex);
    currentIndexRef.current = boundedIndex;
    setIsHolding(false);

    if (audioCtxRef.current) {
      audioStartCtxTimeRef.current = audioCtxRef.current.currentTime;
      audioStartElapsedMsRef.current = targetTime;
    }
  }, []);

  const skipNext = useCallback(() => {
    const currentWords = wordsRef.current;
    if (currentWords.length === 0) return;

    // If currently blocked by a Hold tag, skip past it!
    if (isHolding) {
      setIsHolding(false);
      const nextIndex = currentIndexRef.current + 1;
      if (nextIndex < currentWords.length) {
        setIndex(nextIndex);
        setIsPlaying(true);
      } else {
        const lastWord = currentWords[currentWords.length - 1];
        const endPos = lastWord.startTimeMs + lastWord.totalDurationMs;
        setElapsedTimeMs(endPos);
        elapsedTimeMsRef.current = endPos;
      }
      return;
    }

    const nextIndex = currentIndexRef.current + 1;
    if (nextIndex < currentWords.length) {
      setIndex(nextIndex);
    }
  }, [isHolding, setIndex]);

  const skipPrev = useCallback(() => {
    const prevIndex = currentIndexRef.current - 1;
    if (prevIndex >= 0) {
      setIndex(prevIndex);
    }
  }, [setIndex]);

  // Set Gesture holding state from screen touch/mouse-down
  const setGestureHolding = useCallback((holding: boolean) => {
    setIsGestureHolding(holding);
  }, []);

  return {
    isPlaying,
    currentIndex,
    elapsedTimeMs,
    isHolding,
    isGestureHolding,
    play,
    pause,
    togglePlay,
    reset,
    setIndex,
    skipNext,
    skipPrev,
    setGestureHolding
  };
}
