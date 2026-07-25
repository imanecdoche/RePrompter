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

  // Play Loop Execution using requestAnimationFrame
  useEffect(() => {
    const loop = (timestamp: number) => {
      if (!isPlayingRef.current) {
        lastTimeRef.current = null;
        return;
      }

      if (lastTimeRef.current === null) {
        lastTimeRef.current = timestamp;
      }

      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      // If the user is currently holding down click/touch, pause the timer
      if (isGestureHoldingRef.current) {
        rafIdRef.current = requestAnimationFrame(loop);
        return;
      }

      const nextElapsedTime = elapsedTimeMsRef.current + delta;
      const currentWords = wordsRef.current;

      if (currentWords.length === 0) {
        setIsPlaying(false);
        return;
      }

      // Check if we hit a hold tag or reached the very end
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

      // Find if we transitioned out of a word that had `isHold = true`
      for (let i = 0; i < currentWords.length; i++) {
        const w = currentWords[i];
        if (w.isHold) {
          const boundaryTime = w.startTimeMs + w.totalDurationMs;
          // If we crossed this hold boundary in this tick
          if (elapsedTimeMsRef.current < boundaryTime && nextElapsedTime >= boundaryTime) {
            shouldHold = true;
            holdTargetTime = boundaryTime;
            break;
          }
        }
      }

      if (shouldHold) {
        // Halt right at the boundary
        setElapsedTimeMs(holdTargetTime);
        elapsedTimeMsRef.current = holdTargetTime;
        updateIndexFromTime(holdTargetTime - 1); // Select the hold word as active
        setIsPlaying(false);
        setIsHolding(true);
        lastTimeRef.current = null;
        return;
      }

      // Normal progress
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
  }, [isPlaying, updateIndexFromTime]);

  // Actions
  const play = useCallback(() => {
    if (wordsRef.current.length === 0) return;
    
    // If we're at the very end, reset to beginning first
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
  }, []);

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
  }, []);

  const skipNext = useCallback(() => {
    const currentWords = wordsRef.current;
    if (currentWords.length === 0) return;

    // If currently blocked by a Hold tag, skip past it!
    if (isHolding) {
      setIsHolding(false);
      // Advance to the next word immediately
      const nextIndex = currentIndexRef.current + 1;
      if (nextIndex < currentWords.length) {
        setIndex(nextIndex);
        // Automatically play after skipping hold if it was playing previously
        setIsPlaying(true);
      } else {
        // We reached the end
        const lastWord = currentWords[currentWords.length - 1];
        setElapsedTimeMs(lastWord.startTimeMs + lastWord.totalDurationMs);
        elapsedTimeMsRef.current = lastWord.startTimeMs + lastWord.totalDurationMs;
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
