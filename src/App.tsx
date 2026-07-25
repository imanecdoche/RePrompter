/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Settings,
  Sliders,
  Keyboard,
  Info,
  Type,
  Eye,
  Sparkles,
  Zap,
  HelpCircle,
  Clock,
  Maximize,
  Minimize
} from "lucide-react";

import { PrompterMode, VisualConfig } from "./types";
import { parseScript, groupWordsIntoPhrases, formatTime } from "./lib/parser";
import { usePrompterEngine } from "./hooks/usePrompterEngine";
import ScriptEditor from "./components/ScriptEditor";
import PrompterDisplay from "./components/PrompterDisplay";

// Default Indonesian script for first-time load
const INITIAL_SCRIPT = "";

export default function App() {
  // 1. Script & Pacing States
  const [scriptText, setScriptText] = useState<string>(INITIAL_SCRIPT);
  const [wpm, setWpm] = useState<number>(130);
  const [autoPacing, setAutoPacing] = useState<boolean>(true);
  const [mode, setMode] = useState<PrompterMode>(PrompterMode.PHRASE);
  const [maxWordsPerPhrase, setMaxWordsPerPhrase] = useState<number>(3);

  // 2. Tab Navigation for the Config station
  const [activeTab, setActiveTab] = useState<"editor" | "styling" | "hotkeys">("editor");

  // 5. Focus Mode State
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [focusDragOffset, setFocusDragOffset] = useState<number>(0);

  const startYRef = useRef<number | null>(null);
  const startOffsetRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);

  const handleFocusDragStart = (clientY: number) => {
    if (!isFocusMode) return;
    startYRef.current = clientY;
    startOffsetRef.current = focusDragOffset;
    isDraggingRef.current = false;
  };

  const handleFocusDragMove = (clientY: number) => {
    if (startYRef.current === null) return;
    const diffY = clientY - startYRef.current;
    if (Math.abs(diffY) > 2) {
      isDraggingRef.current = true;
      setFocusDragOffset(startOffsetRef.current + diffY);
    }
  };

  const handleFocusDragEnd = () => {
    startYRef.current = null;
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  };

  const handleFocusDoubleClick = () => {
    setFocusDragOffset(0);
  };

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  useEffect(() => {
    if (!isFocusMode) {
      setFocusDragOffset(0);
    }
  }, [isFocusMode]);

  // 3. Visual Configurations
  const [visualConfig, setVisualConfig] = useState<VisualConfig>({
    fontSize: 34,
    theme: "dark-overlay",
    focalHighlight: "text-color",
    highlightColor: "#facc15", // yellow-400
    fontFamily: "sans",
    overlayOpacity: 75,
    textPosition: "center",
    tickerType: "focus"
  });

  // 4. Parse script on input/config change
  const words = useMemo(() => {
    return parseScript(scriptText, wpm, autoPacing);
  }, [scriptText, wpm, autoPacing]);

  const phrases = useMemo(() => {
    return groupWordsIntoPhrases(words, maxWordsPerPhrase);
  }, [words, maxWordsPerPhrase]);

  // Calculated Stats
  const wordCount = words.length;
  const estimatedDurationMs = useMemo(() => {
    if (words.length === 0) return 0;
    const lastWord = words[words.length - 1];
    return lastWord.startTimeMs + lastWord.totalDurationMs;
  }, [words]);

  const pauseTagsCount = (scriptText.match(/\[pause:[\d.]+s?\]|<pause:[\d.]+s?>/gi) || []).length;
  const holdTagsCount = (scriptText.match(/\[hold\]|<hold>/gi) || []).length;

  // 5. Connect the core timer engine hook
  const {
    isPlaying,
    currentIndex,
    elapsedTimeMs,
    isHolding,
    togglePlay,
    reset,
    skipNext,
    skipPrev,
    setGestureHolding
  } = usePrompterEngine(words);

  // 6. Global keyboard listener (Bypassed when typing in inputs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is writing in any input or textarea
      const targetTag = (e.target as HTMLElement).tagName;
      if (targetTag === "TEXTAREA" || targetTag === "INPUT") {
        return;
      }

      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          skipNext();
          break;
        case "ArrowLeft":
          e.preventDefault();
          skipPrev();
          break;
        case "Escape":
          e.preventDefault();
          reset();
          break;
        case "f":
        case "F":
          e.preventDefault();
          setIsFocusMode((prev) => !prev);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [togglePlay, skipNext, skipPrev, reset, setIsFocusMode]);

  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-100 flex flex-col font-sans" id="rhythmprompter-app-root">
      {/* FLOATING CONTROLS DI POJOK KANAN ATAS (ONLY IN FOCUS MODE) */}
      {isFocusMode && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2" id="focus-mode-floating-controls">
          <button
            id="btn-toggle-fullscreen"
            onClick={toggleFullscreen}
            className="w-10 h-10 flex items-center justify-center bg-neutral-900/95 hover:bg-neutral-800 text-neutral-200 hover:text-white rounded-none border border-neutral-700/60 shadow-2xl backdrop-blur transition active:scale-95"
            title={isFullscreen ? "Keluar Layar Penuh" : "Masuk Layar Penuh"}
          >
            {isFullscreen ? (
              <Minimize className="w-5 h-5 text-emerald-400" />
            ) : (
              <Maximize className="w-5 h-5 text-emerald-400" />
            )}
          </button>

          <button
            id="btn-exit-focus"
            onClick={() => setIsFocusMode(false)}
            className="w-10 h-10 flex items-center justify-center bg-neutral-900/95 hover:bg-neutral-800 text-neutral-200 hover:text-white rounded-none border border-neutral-700/60 shadow-2xl backdrop-blur transition active:scale-95"
            title="Buka Konfigurasi (Keluar Focus Mode)"
          >
            <Settings className="w-5 h-5 text-emerald-400 animate-spin" style={{ animationDuration: "12s" }} />
          </button>
        </div>
      )}

      {/* BRAND HEADER BAR */}
      {!isFocusMode && (
        <header className="border-b border-neutral-800 bg-[#0c0c0e] px-4 md:px-8 py-3.5 flex items-center justify-between" id="app-main-header">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-none bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-sm shadow-[0_0_15px_rgba(16,185,129,0.15)]" id="brand-logo-icon">
              R
            </div>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight text-neutral-100 flex items-center gap-1.5">
                RhythmPrompter
                <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded-none font-bold border border-emerald-800">
                  PRO v1.2
                </span>
              </h1>
              <p className="text-[11px] text-neutral-500 font-medium">Modular speech-paced teleprompter engine</p>
            </div>
          </div>

          {/* Top bar quick parameters summary */}
          <div className="hidden md:flex items-center gap-6 text-xs text-neutral-400 bg-neutral-900/40 px-4 py-1.5 rounded-none border border-neutral-800" id="quick-top-stats">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-neutral-500" />
              <span>Waktu Main:</span>
              <span className="font-mono font-bold text-neutral-200">
                {formatTime(elapsedTimeMs)} / {formatTime(estimatedDurationMs)}
              </span>
            </div>
            <span className="w-1.5 h-1.5 rounded-none bg-neutral-800" />
            <div>
              <span>Tempo:</span> <strong className="text-emerald-400 font-bold">{wpm} WPM</strong>
            </div>
            <span className="w-1.5 h-1.5 rounded-none bg-neutral-800" />
            <div>
              <span>Mode:</span> <strong className="text-neutral-200 uppercase">{mode}</strong>
            </div>
          </div>
        </header>
      )}

      {/* DASHBOARD GRID CONTENT */}
      <main className={isFocusMode 
        ? "flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 flex flex-col justify-center items-center gap-6 relative min-h-[calc(100vh-2rem)]"
        : "flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6"
      } id="dashboard-main-grid">
        
        {/* LEFT COLUMN: ACTIVE VIEW (CAMERA PREVIEW + TELEPROMPTER OVERLAY) - (Span 7 / Full in Focus Mode) */}
        <section 
          className={isFocusMode ? "w-full flex flex-col gap-5 justify-center transition-transform duration-75 ease-out" : "lg:col-span-7 flex flex-col gap-4"} 
          style={isFocusMode ? { transform: `translateY(${focusDragOffset}px)` } : undefined}
          id="left-prompter-column"
        >
          
          {!isFocusMode && (
            <div className="flex items-center justify-between px-1" id="prompter-section-header">
              <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-none bg-emerald-500 animate-pulse" />
                Prompter Live Canvas
              </h2>
              <div className="flex items-center gap-2">
                <button
                  id="btn-trigger-focus"
                  onClick={() => setIsFocusMode(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-emerald-400 hover:text-emerald-300 font-bold text-xs rounded-none border border-neutral-800 transition active:scale-95 shadow-sm"
                  title="Masuk Mode Fokus (Sembunyikan Konfigurasi)"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Mode Fokus (F)</span>
                </button>
                <div className="hidden md:flex items-center gap-1.5 text-[11px] text-neutral-400">
                  <Zap className="w-3 h-3 text-yellow-400 animate-bounce" />
                  Sesuaikan kecepatan baca dengan tempo suara Anda!
                </div>
              </div>
            </div>
          )}

          {/* Teleprompter Visual Canvas */}
          <PrompterDisplay
            mode={mode}
            words={words}
            phrases={phrases}
            currentIndex={currentIndex}
            isPlaying={isPlaying}
            isHolding={isHolding}
            visualConfig={visualConfig}
            onTriggerNext={skipNext}
            onTriggerPrev={skipPrev}
            onHoldActive={setGestureHolding}
            onTogglePlay={togglePlay}
            isFocusMode={isFocusMode}
            onDragStart={handleFocusDragStart}
            onDragMove={handleFocusDragMove}
            onDragEnd={handleFocusDragEnd}
            onDoubleClick={handleFocusDoubleClick}
          />

          {/* LOWER CONTROLLER HUB */}
          <div 
            className={isFocusMode
              ? "flex items-center justify-center p-2 mt-4"
              : "bg-neutral-900 border border-neutral-800 p-4 rounded-none flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-black/40"
            } 
            id="prompter-control-hub"
          >
            {/* Playback navigation buttons */}
            <div className="flex items-center gap-3.5" id="play-buttons-group">
              <button
                id="btn-nav-prev"
                onClick={skipPrev}
                disabled={currentIndex === 0}
                className="w-12 h-12 flex items-center justify-center bg-neutral-950 border border-neutral-800/80 text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 rounded-none transition active:scale-95 shadow-md"
                title="Sebelumnya"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <button
                id="btn-nav-play-toggle"
                onClick={togglePlay}
                className={`px-8 py-2.5 h-12 font-bold text-xs rounded-none transition active:scale-95 flex items-center gap-2.5 shadow-xl uppercase tracking-wider ${
                  isPlaying
                    ? "bg-amber-600 text-white hover:bg-amber-500 shadow-amber-950/25 border border-amber-500"
                    : "bg-emerald-500 text-neutral-950 hover:bg-emerald-400 shadow-emerald-950/25 border border-emerald-400"
                }`}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>PAUSE</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>MULAI</span>
                  </>
                )}
              </button>

              <button
                id="btn-nav-next"
                onClick={skipNext}
                disabled={words.length === 0}
                className="w-12 h-12 flex items-center justify-center bg-neutral-950 border border-neutral-800/80 text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 rounded-none transition active:scale-95 shadow-md"
                title={isHolding ? "Lompati Hold" : "Selanjutnya"}
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              <button
                id="btn-nav-reset"
                onClick={reset}
                className="w-12 h-12 flex items-center justify-center bg-neutral-950 border border-neutral-800/80 text-neutral-400 hover:text-red-400 rounded-none transition hover:border-red-900/30 active:scale-95 shadow-md"
                title="Reset dari awal"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>

            {/* Time counters display */}
            {!isFocusMode && (
              <div className="flex items-center gap-3 bg-neutral-950 px-4 py-2.5 rounded-none border border-neutral-800 w-full sm:w-auto justify-center" id="playtime-stats-overlay">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Durasi</span>
                <span className="font-mono font-bold text-sm text-neutral-200">
                  {formatTime(elapsedTimeMs)}
                </span>
                <span className="text-neutral-800 text-sm">/</span>
                <span className="font-mono text-sm text-neutral-500">
                  {formatTime(estimatedDurationMs)}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: CONFIG STATION (SCRIPT, STYLING, HOTKEYS) - (Span 5) */}
        {!isFocusMode && (
          <section className="lg:col-span-5 flex flex-col gap-4" id="right-config-column">
          {/* Header Tab System */}
          <div className="flex border-b border-neutral-800 bg-[#0c0c0e] p-1 rounded-none" id="config-tabs-navigation">
            {[
              { id: "editor", label: "Teks Naskah", icon: Sliders },
              { id: "styling", label: "Gaya Tampilan", icon: Type },
              { id: "hotkeys", label: "Shortcut", icon: Keyboard }
            ].map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  id={`tab-btn-${tab.id}`}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-none transition-all ${
                    activeTab === tab.id
                      ? "bg-neutral-900 text-emerald-400 shadow-sm"
                      : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/40"
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB CONTENTS (No nesting of cards - directly flat panel content) */}
          <div className="flex-1 bg-neutral-950/40 border border-neutral-800/60 p-5 rounded-none flex flex-col gap-4" id="config-panel-content">
            {activeTab === "editor" && (
              <ScriptEditor
                text={scriptText}
                onChangeText={setScriptText}
                wpm={wpm}
                onChangeWpm={setWpm}
                autoPacing={autoPacing}
                onChangeAutoPacing={setAutoPacing}
                mode={mode}
                onChangeMode={setMode}
                maxWordsPerPhrase={maxWordsPerPhrase}
                onChangeMaxWordsPerPhrase={setMaxWordsPerPhrase}
                wordCount={wordCount}
                estimatedDurationMs={estimatedDurationMs}
                pauseTagsCount={pauseTagsCount}
                holdTagsCount={holdTagsCount}
                tickerType={visualConfig.tickerType || "focus"}
                onChangeTickerType={(type) =>
                  setVisualConfig((prev) => ({ ...prev, tickerType: type }))
                }
              />
            )}

            {activeTab === "styling" && (
              <div className="flex flex-col gap-5" id="styling-config-panel">
                <h3 className="text-sm font-bold text-neutral-300 flex items-center gap-2 border-b border-neutral-800/60 pb-2">
                  <Type className="w-4 h-4 text-emerald-400" />
                  Visual & Tipografi Prompter
                </h3>

                {/* Font Size Configuration */}
                <div className="flex flex-col gap-1.5" id="font-size-slider-group">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-neutral-400">Ukuran Font Teks</span>
                    <span className="text-xs font-bold text-emerald-400">{visualConfig.fontSize}px</span>
                  </div>
                  <input
                    id="slider-font-size"
                    type="range"
                    min="20"
                    max="72"
                    step="1"
                    value={visualConfig.fontSize}
                    onChange={(e) =>
                      setVisualConfig((prev) => ({ ...prev, fontSize: parseInt(e.target.value) }))
                    }
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Text overlay background opacity */}
                <div className="flex flex-col gap-1.5" id="overlay-opacity-slider-group">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-neutral-400">Kepekatan Latar Belakang (Opacity)</span>
                    <span className="text-xs font-bold text-emerald-400">{visualConfig.overlayOpacity}%</span>
                  </div>
                  <input
                    id="slider-overlay-opacity"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={visualConfig.overlayOpacity}
                    onChange={(e) =>
                      setVisualConfig((prev) => ({ ...prev, overlayOpacity: parseInt(e.target.value) }))
                    }
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                  <span className="text-[9px] text-neutral-500 leading-tight">
                    Mengatur kegelapan tirai di belakang tulisan agar tetap mudah dibaca.
                  </span>
                </div>

                {/* Highlight active word colors */}
                <div className="flex flex-col gap-2" id="highlight-color-options">
                  <span className="text-xs font-semibold text-neutral-400">Warna Focal Word (Highlight)</span>
                  <div className="flex gap-2">
                    {[
                      { hex: "#facc15", name: "Yellow" },
                      { hex: "#10b981", name: "Emerald" },
                      { hex: "#06b6d4", name: "Cyan" },
                      { hex: "#ec4899", name: "Pink" },
                      { hex: "#ffffff", name: "White" }
                    ].map((color) => (
                      <button
                        key={color.hex}
                        id={`color-btn-${color.name.toLowerCase()}`}
                        onClick={() =>
                          setVisualConfig((prev) => ({ ...prev, highlightColor: color.hex }))
                        }
                        className={`w-8 h-8 rounded-none transition relative ${
                          visualConfig.highlightColor === color.hex
                            ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-neutral-950"
                            : ""
                        }`}
                        style={{ backgroundColor: color.hex }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                {/* Text position relative to screen */}
                <div className="flex flex-col gap-2" id="text-position-options">
                  <span className="text-xs font-semibold text-neutral-400">Letak Teks (Eye-Line Alignment)</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { pos: "top", label: "Atas" },
                      { pos: "center", label: "Tengah" },
                      { pos: "bottom", label: "Bawah" }
                    ].map((item) => (
                      <button
                        key={item.pos}
                        id={`pos-btn-${item.pos}`}
                        onClick={() =>
                          setVisualConfig((prev) => ({ ...prev, textPosition: item.pos as any }))
                        }
                        className={`py-1.5 rounded-none text-xs font-semibold border transition ${
                          visualConfig.textPosition === item.pos
                            ? "bg-neutral-900 border-emerald-500 text-emerald-300"
                            : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-[9px] text-neutral-500 leading-tight">
                    *Rekomendasi: Pilih posisi <strong>Atas</strong> agar arah pandang mata Anda tetap fokus ke bagian atas layar saat membaca.
                  </span>
                </div>

                {/* Font Family select */}
                <div className="flex flex-col gap-2" id="font-family-options">
                  <span className="text-xs font-semibold text-neutral-400">Jenis Huruf (Font Family)</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { family: "sans", label: "Sans-Serif" },
                      { family: "serif", label: "Serif" },
                      { family: "mono", label: "Monospace" }
                    ].map((item) => (
                      <button
                        key={item.family}
                        id={`font-btn-${item.family}`}
                        onClick={() =>
                          setVisualConfig((prev) => ({ ...prev, fontFamily: item.family as any }))
                        }
                        className={`py-1.5 rounded-none text-xs font-semibold border transition ${
                          visualConfig.fontFamily === item.family
                            ? "bg-neutral-900 border-emerald-500 text-emerald-300"
                            : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Visual Theme Presets */}
                <div className="flex flex-col gap-2" id="preset-themes-options">
                  <span className="text-xs font-semibold text-neutral-400">Tema Latar & Style Canvas</span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "dark-overlay", label: "Dark Transparent" },
                      { id: "high-contrast", label: "High Contrast (Black)" },
                      { id: "neon-glass", label: "Neon Glass Indigo" },
                      { id: "classic-light", label: "Classic Light" }
                    ].map((theme) => (
                      <button
                        key={theme.id}
                        id={`theme-btn-${theme.id}`}
                        onClick={() =>
                          setVisualConfig((prev) => ({ ...prev, theme: theme.id as any }))
                        }
                        className={`py-2 px-3 rounded-none text-xs font-semibold border text-left transition ${
                          visualConfig.theme === theme.id
                            ? "bg-neutral-900 border-emerald-500 text-emerald-300"
                            : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                        }`}
                      >
                        {theme.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "hotkeys" && (
              <div className="flex flex-col gap-5" id="hotkeys-config-panel">
                <h3 className="text-sm font-bold text-neutral-300 flex items-center gap-2 border-b border-neutral-800/60 pb-2">
                  <Keyboard className="w-4 h-4 text-emerald-400" />
                  Akses Cepat & Keyboard Shortcut
                </h3>

                <p className="text-xs text-neutral-400 leading-relaxed">
                  Gunakan tombol-tombol fisik keyboard Anda saat memproduksi video agar proses kontrol teleprompter tetap mulus tanpa memerlukan kursor mouse:
                </p>

                <div className="flex flex-col gap-3" id="shortcuts-legend-list">
                  {[
                    { key: "Spasi (Spacebar)", desc: "Mulai / Jeda (Toggle Play/Pause) jalannya prompter" },
                    { key: "Arrow Right (Kanan)", desc: "Maju satu kata/frasa atau bypass status HOLD" },
                    { key: "Arrow Left (Kiri)", desc: "Kembali ke kata/frasa sebelumnya" },
                    { key: "Esc (Escape)", desc: "Reset jalannya teks kembali ke posisi awal naskah" },
                    { key: "F", desc: "Toggle Mode Fokus (Sembunyikan Konfigurasi)" },
                    { key: "Hold Klik (Mouse/Tap)", desc: "Menahan sejenak tempo prompter selama ditekan" },
                    { key: "Drag Layar Up/Down", desc: "Geser posisi tinggi teks prompter ke atas / bawah" },
                    { key: "Double Klik Layar", desc: "Reset pergeseran teks kembali ke tengah layar" }
                  ].map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center bg-neutral-950 p-2.5 rounded-none border border-neutral-800"
                      id={`shortcut-item-${index}`}
                    >
                      <span className="text-[11px] font-bold text-neutral-300">{shortcut.desc}</span>
                      <kbd className="px-2 py-0.5 bg-neutral-900 text-emerald-400 border border-neutral-800 rounded-none font-mono text-[10px] whitespace-nowrap shadow">
                        {shortcut.key}
                      </kbd>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-neutral-900/60 border border-neutral-800 rounded-none flex items-start gap-2.5 mt-2" id="hotkey-tip-banner">
                  <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-neutral-400 leading-normal">
                    *Catatan: Tombol shortcut dinonaktifkan secara otomatis ketika kursor Anda aktif mengetik di dalam kolom input/textarea editor naskah.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      </main>

      {/* FOOTER */}
      {!isFocusMode && (
        <footer className="border-t border-neutral-900 bg-[#070708] py-4 px-6 text-center text-[11px] text-neutral-600 mt-auto" id="app-footer">
          &copy; 2026 RhythmPrompter. Dibuat dengan presisi untuk konten creator modern. All rights reserved.
        </footer>
      )}
    </div>
  );
}
