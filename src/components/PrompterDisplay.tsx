/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Play, Pause, Hand, CornerDownLeft, Sparkles } from "lucide-react";
import { PrompterMode, PrompterWord, PrompterPhrase, VisualConfig } from "../types";

interface PrompterDisplayProps {
  mode: PrompterMode;
  words: PrompterWord[];
  phrases: PrompterPhrase[];
  currentIndex: number;
  isPlaying: boolean;
  isHolding: boolean;
  visualConfig: VisualConfig;
  onTriggerNext: () => void;
  onTriggerPrev: () => void;
  onHoldActive: (hold: boolean) => void;
  onTogglePlay: () => void;
  isFocusMode?: boolean;
  onDragStart?: (clientY: number) => void;
  onDragMove?: (clientY: number) => void;
  onDragEnd?: () => void;
  onDoubleClick?: () => void;
}

export default function PrompterDisplay({
  mode,
  words,
  phrases,
  currentIndex,
  isPlaying,
  isHolding,
  visualConfig,
  onTriggerNext,
  onTriggerPrev,
  onHoldActive,
  onTogglePlay,
  isFocusMode = false,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDoubleClick
}: PrompterDisplayProps) {
  const tickerContainerRef = useRef<HTMLDivElement | null>(null);
  const activeWordRef = useRef<HTMLSpanElement | null>(null);

  // Smoothly center the active word inside ticker container on change
  useEffect(() => {
    if (mode === PrompterMode.TICKER && tickerContainerRef.current && activeWordRef.current) {
      const container = tickerContainerRef.current;
      const activeElement = activeWordRef.current;

      const targetScrollLeft =
        activeElement.offsetLeft -
        container.offsetWidth / 2 +
        activeElement.offsetWidth / 2;

      container.scrollTo({
        left: targetScrollLeft,
        behavior: "smooth"
      });
    }
  }, [currentIndex, mode]);

  if (words.length === 0) {
    return (
      <div className="w-full h-48 flex items-center justify-center border-2 border-dashed border-neutral-800 rounded-none px-4 text-center text-neutral-500 text-sm" id="prompter-no-words-placeholder">
        Naskah kosong atau tidak terdeteksi. Silakan ketik atau pilih template naskah di bawah untuk memulai teleprompter.
      </div>
    );
  }

  // Get active items
  const activeWord = words[currentIndex] || words[0];

  // Find active phrase based on activeWord index
  const activePhraseIndex = phrases.findIndex((phrase) =>
    phrase.words.some((w) => w.index === currentIndex)
  );
  const activePhrase = phrases[activePhraseIndex] || phrases[0] || { text: "", words: [] };

  // Theme styles mapper
  const getThemeClasses = () => {
    switch (visualConfig.theme) {
      case "high-contrast":
        return "bg-black text-white border border-neutral-800";
      case "neon-glass":
        return "bg-neutral-950/90 backdrop-blur-xl border border-indigo-500/30 text-indigo-100 shadow-[0_0_20px_rgba(99,102,241,0.15)]";
      case "classic-light":
        return "bg-neutral-50 text-neutral-900 border border-neutral-200 shadow-md";
      case "dark-overlay":
      default:
        return "bg-neutral-950/40 backdrop-blur-sm border border-neutral-900 text-neutral-100";
    }
  };

  const getFontFamilyClass = () => {
    switch (visualConfig.fontFamily) {
      case "serif":
        return "font-serif";
      case "mono":
        return "font-mono";
      case "sans":
      default:
        return "font-sans";
    }
  };

  const getFocalHighlightClasses = (isActive: boolean) => {
    if (!isActive) {
      if (mode === PrompterMode.TICKER && visualConfig.tickerType === "flat") {
        return visualConfig.theme === "classic-light"
          ? "text-neutral-700 opacity-90 transition-all duration-200"
          : "text-neutral-300 opacity-90 transition-all duration-200";
      }
      return visualConfig.theme === "classic-light"
        ? "text-neutral-400 opacity-40 transition-all duration-200"
        : "text-neutral-500 opacity-30 transition-all duration-200";
    }

    let highlightStyle = "";
    switch (visualConfig.focalHighlight) {
      case "underline":
        highlightStyle = `underline decoration-4 underline-offset-8`;
        break;
      case "background":
        highlightStyle = `bg-emerald-500/20 px-2 py-0.5 rounded-none border border-emerald-500/30`;
        break;
      case "text-color":
      default:
        highlightStyle = "";
        break;
    }

    if (mode === PrompterMode.TICKER && visualConfig.tickerType === "flat") {
      return `font-bold ${highlightStyle} transition-all duration-200`;
    }

    return `font-bold ${highlightStyle} scale-105 transition-all duration-200`;
  };

  // Inline font sizing helper
  const textStyle: React.CSSProperties = {
    fontSize: `${visualConfig.fontSize}px`,
    lineHeight: 1.4,
    color: activeWord?.isHold && isHolding ? "#f87171" : undefined // Red if manual hold active
  };

  const textPositionClasses = {
    top: "justify-start pt-16",
    center: "justify-center",
    bottom: "justify-end pb-16"
  }[visualConfig.textPosition] || "justify-center";

  return (
    <div className="w-full flex flex-col gap-3 select-none" id="prompter-display-main">
      {/* 1. Visual Presentation Area (Press & Hold and clicks interact here) */}
      <div
        id="prompter-gesture-canvas"
        className={`w-full aspect-video md:aspect-[16/9] flex flex-col items-center rounded-none p-6 md:p-12 transition-all cursor-pointer relative overflow-hidden shadow-2xl ${textPositionClasses} ${getThemeClasses()} ${getFontFamilyClass()} ${
          isFocusMode ? "cursor-grab active:cursor-grabbing" : ""
        }`}
        onMouseDown={(e) => {
          if (onDragStart) {
            onDragStart(e.clientY);
          }
          onHoldActive(true);
        }}
        onMouseMove={(e) => {
          if (onDragMove) {
            onDragMove(e.clientY);
          }
        }}
        onMouseUp={() => {
          if (onDragEnd) {
            onDragEnd();
          }
          onHoldActive(false);
        }}
        onMouseLeave={() => {
          if (onDragEnd) {
            onDragEnd();
          }
          onHoldActive(false);
        }}
        onTouchStart={(e) => {
          if (e.touches[0] && onDragStart) {
            onDragStart(e.touches[0].clientY);
          }
          onHoldActive(true);
        }}
        onTouchMove={(e) => {
          if (e.touches[0] && onDragMove) {
            onDragMove(e.touches[0].clientY);
          }
        }}
        onTouchEnd={() => {
          if (onDragEnd) {
            onDragEnd();
          }
          onHoldActive(false);
        }}
        onDoubleClick={onDoubleClick}
        title={isFocusMode ? "Geser ke atas/bawah untuk memposisikan. Double-klik untuk reset." : "Tahan layar untuk pause tempo"}
      >
        {/* Visual contrast shield using opacity setting */}
        <div
          id="visual-contrast-shield"
          className="absolute inset-0 pointer-events-none transition-all duration-300 z-0"
          style={{ backgroundColor: `rgba(10, 10, 10, ${visualConfig.overlayOpacity / 100})` }}
        />

        {/* Floating Instruction Overlay inside Display */}
        {!isFocusMode && (
          <div className="absolute top-2.5 right-3 z-20 text-[10px] text-neutral-500 flex items-center gap-1 font-medium pointer-events-none" id="gesture-hint-badges">
            <Hand className="w-3 h-3 text-neutral-500" />
            <span>Tahan layar untuk PAUSE</span>
          </div>
        )}

        {/* Play/Pause state background indicator */}
        {!isFocusMode && isHolding && (
          <div className="absolute top-3 left-3 z-20 bg-red-950/80 border border-red-500/30 px-2 py-1 rounded-none text-[10px] font-bold text-red-300 uppercase tracking-widest flex items-center gap-1.5 animate-pulse" id="hold-active-indicator">
            <Hand className="w-3 h-3 text-red-400" />
            <span>HOLD TAG ACTIVE - PRESS NEXT TO RESUME</span>
          </div>
        )}

        {/* Content container */}
        <div
          id="prompter-content-wrapper"
          className="w-full flex flex-col items-center justify-center relative z-10"
        >
          {/* RENDER MODES */}

          {/* MODE A: WORD-BY-WORD (RSVP) */}
          {mode === PrompterMode.WORD && (
            <div className="text-center font-bold tracking-wide transition-all" style={textStyle} id="word-rsvp-box">
              <span
                id={`word-token-${activeWord.index}`}
                style={{
                  color: activeWord.isHold && isHolding ? "#f87171" : visualConfig.highlightColor
                }}
                className={getFocalHighlightClasses(true)}
              >
                {activeWord.text}
              </span>

              {/* Subdued surrounding hint (next word context) to reduce cognitive load */}
              {!isFocusMode && currentIndex < words.length - 1 && (
                <div className="text-xs text-neutral-500 mt-4 opacity-60 font-normal tracking-normal flex items-center justify-center gap-1">
                  <span>Selanjutnya:</span>
                  <span className="font-semibold">{words[currentIndex + 1].text}</span>
                </div>
              )}
            </div>
          )}

          {/* MODE B: PHRASE-BY-PHRASE */}
          {mode === PrompterMode.PHRASE && (
            <div className="text-center flex flex-wrap justify-center gap-x-4 gap-y-2 max-w-2xl leading-relaxed" id="phrase-box">
              {activePhrase.words && activePhrase.words.map((w: PrompterWord) => {
                const isWordActive = w.index === currentIndex;
                return (
                  <span
                    key={w.id}
                    id={`phrase-word-token-${w.index}`}
                    style={
                      isWordActive
                        ? {
                            fontSize: `${visualConfig.fontSize}px`,
                            color: w.isHold && isHolding ? "#f87171" : visualConfig.highlightColor
                          }
                        : {
                            fontSize: `${visualConfig.fontSize * 0.9}px`
                          }
                    }
                    className={`${getFocalHighlightClasses(isWordActive)} inline-block transition-all`}
                  >
                    {w.text}
                  </span>
                );
              })}
            </div>
          )}

          {/* MODE C: HORIZONTAL TICKER */}
          {mode === PrompterMode.TICKER && (
            <div
              id="ticker-scroller"
              ref={tickerContainerRef}
              className="w-full flex items-center overflow-x-hidden py-4 scroll-smooth whitespace-nowrap"
            >
              {/* Focal guide lines for center alignment */}
              {visualConfig.tickerType !== "flat" && (
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-emerald-500/40 pointer-events-none" />
              )}
              
              <div className="flex gap-6 md:gap-10 px-[50%]" id="ticker-word-track">
                {words.map((w) => {
                  const isWordActive = w.index === currentIndex;
                  const isWordRef = isWordActive ? activeWordRef : null;

                  return (
                    <span
                      key={w.id}
                      ref={isWordRef}
                      id={`ticker-word-token-${w.index}`}
                      style={
                        visualConfig.tickerType === "flat"
                          ? {
                              fontSize: `${visualConfig.fontSize}px`,
                              color: isWordActive
                                ? (w.isHold && isHolding ? "#f87171" : visualConfig.highlightColor)
                                : undefined
                            }
                          : (isWordActive
                              ? {
                                  fontSize: `${visualConfig.fontSize}px`,
                                  color: w.isHold && isHolding ? "#f87171" : visualConfig.highlightColor
                                }
                              : {
                                  fontSize: `${visualConfig.fontSize * 0.85}px`
                                }
                            )
                      }
                      className={`${getFocalHighlightClasses(isWordActive)} inline-block transition-all`}
                    >
                      {w.text}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Micro manual navigation control bar */}
      {!isFocusMode && (
        <div className="flex items-center justify-between px-2 text-neutral-400" id="prompter-display-nav-bar">
          <div className="flex gap-2">
            <button
              id="btn-prompter-prev"
              onClick={onTriggerPrev}
              className="p-1.5 hover:text-emerald-400 bg-neutral-900 border border-neutral-800 rounded-none transition active:scale-95"
              title="Suku kata sebelumnya"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              id="btn-prompter-next"
              onClick={onTriggerNext}
              className="p-1.5 hover:text-emerald-400 bg-neutral-900 border border-neutral-800 rounded-none transition active:scale-95 flex items-center gap-1 text-xs"
              title="Lanjut atau Lewati"
            >
              <span className="hidden sm:inline font-semibold">Lewati/Hold</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Mini progress stats tracker */}
          <div className="text-xs font-semibold text-neutral-400 flex items-center gap-3 bg-neutral-900 px-3 py-1.5 border border-neutral-800 rounded-none" id="prompter-progress-bubble">
            <span>Kata:</span>
            <span className="text-emerald-400">{currentIndex + 1} / {words.length}</span>
            <span className="text-neutral-700">|</span>
            <span>Selesai:</span>
            <span className="text-neutral-300">
              {Math.round(((currentIndex + 1) / words.length) * 100)}%
            </span>
          </div>

          {/* Play control shortcut inside display bar */}
          <button
            id="btn-prompter-play-toggle"
            onClick={onTogglePlay}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-none transition active:scale-95 ${
              isPlaying
                ? "bg-amber-600/20 border border-amber-500/30 text-amber-300"
                : "bg-emerald-600 text-neutral-950 hover:bg-emerald-500"
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Mulai</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
