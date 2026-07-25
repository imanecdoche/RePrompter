/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { FileText, Plus, HelpCircle, Settings2, Sliders, Layers, Sparkles, Volume2 } from "lucide-react";
import { PrompterMode } from "../types";

interface ScriptEditorProps {
  text: string;
  onChangeText: (text: string) => void;
  wpm: number;
  onChangeWpm: (wpm: number) => void;
  autoPacing: boolean;
  onChangeAutoPacing: (pacing: boolean) => void;
  mode: PrompterMode;
  onChangeMode: (mode: PrompterMode) => void;
  maxWordsPerPhrase: number;
  onChangeMaxWordsPerPhrase: (count: number) => void;
  wordCount: number;
  estimatedDurationMs: number;
  pauseTagsCount: number;
  holdTagsCount: number;
  tickerType?: "focus" | "flat";
  onChangeTickerType?: (type: "focus" | "flat") => void;
}

const SCRIPT_PRESETS = [
  {
    title: "Template Shorts / Reels (Indonesian)",
    text: "Halo semuanya! [pause:1.0] Selamat datang di RhythmPrompter. Hari ini kita membongkar rahasia bicara di depan kamera secara natural. [pause:1.5] Kuncinya bukan membaca teks terus-menerus, tapi memahami irama kalimat. [pause:0.8] Coba perhatikan bagaimana tulisan ini berhenti sejenak ketika saya ingin menekankan poin penting. [pause:1.2] Dan sekarang, teleprompter ini akan menunggu saya [hold] sampai saya menekan tombol lanjut atau mengetuk layar. Keren banget kan? Cobain deh!"
  },
  {
    title: "Interactive Tech Review (English)",
    text: "Hey guys! [pause:0.8] Today we are reviewing the modular Dynamic Prompter. [pause:1.2] Conventional teleprompters make you sound robotic, scrolling at a rigid speed. [pause:1.0] But this system adapts to human speech rhythms. [pause:0.6] See how a period naturally adds a brief rest? [pause:0.8] And if I need to stop to showcase the product, [hold] the prompter holds perfectly. Tap spacebar or click to resume whenever you are ready!"
  },
  {
    title: "Naskah Kosong",
    text: ""
  }
];

export default function ScriptEditor({
  text,
  onChangeText,
  wpm,
  onChangeWpm,
  autoPacing,
  onChangeAutoPacing,
  mode,
  onChangeMode,
  maxWordsPerPhrase,
  onChangeMaxWordsPerPhrase,
  wordCount,
  estimatedDurationMs,
  pauseTagsCount,
  holdTagsCount,
  tickerType,
  onChangeTickerType
}: ScriptEditorProps) {
  const [showTagHelp, setShowTagHelp] = useState(false);

  const injectTag = (tag: string) => {
    const textarea = document.getElementById("script-textarea") as HTMLTextAreaElement | null;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;

    const before = value.substring(0, start);
    const after = value.substring(end, value.length);

    // Ensure whitespace surrounding injected tag
    const formattedTag = `${before.endsWith(" ") || start === 0 ? "" : " "}${tag}${after.startsWith(" ") || end === value.length ? "" : " "}`;
    const newText = before + formattedTag + after;
    
    onChangeText(newText);

    // Restore focus and cursor position after render
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + formattedTag.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handlePresetSelect = (presetText: string) => {
    onChangeText(presetText);
  };

  const formatEstTime = (ms: number) => {
    const seconds = Math.ceil(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs} detik`;
  };

  return (
    <div className="w-full flex flex-col gap-6" id="script-editor-container">
      {/* 1. Header with Presets */}
      <div className="flex flex-col gap-2" id="preset-selector-header">
        <label className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          Pilih Template Naskah
        </label>
        <div className="flex flex-wrap gap-2">
          {SCRIPT_PRESETS.map((preset, index) => (
            <button
              key={index}
              id={`preset-btn-${index}`}
              onClick={() => handlePresetSelect(preset.text)}
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 rounded-none text-xs font-medium border border-neutral-800 hover:border-neutral-700 transition active:scale-95 text-left"
            >
              {preset.title}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Textarea with tag injectors */}
      <div className="flex flex-col gap-2" id="script-textarea-wrapper">
        <div className="flex justify-between items-center">
          <label className="text-sm font-semibold text-neutral-300">Tulis atau Paste Naskah Anda</label>
          <button
            id="btn-toggle-syntax-help"
            onClick={() => setShowTagHelp(!showTagHelp)}
            className="text-xs text-neutral-400 hover:text-emerald-400 flex items-center gap-1 transition"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Petunjuk Tag Timing</span>
          </button>
        </div>

        {showTagHelp && (
          <div className="p-3.5 bg-neutral-900 border border-neutral-800 rounded-none text-xs text-neutral-400 leading-relaxed space-y-2 animate-fadeIn" id="syntax-guide-box">
            <span className="font-semibold text-neutral-300 block">Sintaks Tag Kontrol Tempo</span>
            <p>
              Gunakan tag inline ini untuk menciptakan ritme baca alami yang disinkronkan dengan video:
            </p>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                <strong className="text-yellow-400">[pause:X]</strong> atau <strong className="text-yellow-400">&lt;pause:X&gt;</strong>: Memberikan jeda X detik pada kata sebelumnya. Contoh: <code className="bg-neutral-950 px-1 py-0.5 rounded-none">Halo [pause:1.5] dunia</code> (jeda 1.5 detik setelah kata Halo).
              </li>
              <li>
                <strong className="text-yellow-400">[hold]</strong> atau <strong className="text-yellow-400">&lt;hold&gt;</strong>: Menghentikan prompter sepenuhnya pada kata tersebut. Bergulir kembali hanya setelah Anda mengetuk/klik layar atau tombol lanjut. Cocok untuk demo barang atau improvisasi.
              </li>
            </ul>
          </div>
        )}

        {/* Action Injectors Row */}
        <div className="flex flex-wrap gap-2 items-center" id="quick-injectors-row">
          <span className="text-xs text-neutral-500 font-medium">Sisipkan Tag:</span>
          <button
            id="btn-inject-pause-0-5"
            onClick={() => injectTag("[pause:0.5]")}
            className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs rounded-none font-medium transition flex items-center gap-1"
          >
            <Plus className="w-3 h-3 text-emerald-400" />
            Jeda 0.5s
          </button>
          <button
            id="btn-inject-pause-1-5"
            onClick={() => injectTag("[pause:1.5]")}
            className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs rounded-none font-medium transition flex items-center gap-1"
          >
            <Plus className="w-3 h-3 text-emerald-400" />
            Jeda 1.5s
          </button>
          <button
            id="btn-inject-hold"
            onClick={() => injectTag("[hold]")}
            className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs rounded-none font-medium transition flex items-center gap-1"
          >
            <Plus className="w-3 h-3 text-emerald-400" />
            Tahan (Hold)
          </button>
        </div>

        <textarea
          id="script-textarea"
          value={text}
          onChange={(e) => onChangeText(e.target.value)}
          placeholder="Tuliskan script pembuka Anda di sini, sisipkan tag [pause:1.5] untuk menciptakan jeda alami bagi penonton..."
          className="w-full h-44 bg-neutral-950 border border-neutral-800 rounded-none px-4 py-3 text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 font-sans leading-relaxed resize-y"
        />
      </div>

      {/* 3. Real-time Analysis stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" id="script-analytics-stats">
        <div className="p-3 bg-neutral-900/60 border border-neutral-800 rounded-none" id="stat-words">
          <span className="text-xs text-neutral-500 block mb-0.5">Jumlah Kata</span>
          <span className="text-lg font-bold text-neutral-200">{wordCount}</span>
        </div>
        <div className="p-3 bg-neutral-900/60 border border-neutral-800 rounded-none" id="stat-duration">
          <span className="text-xs text-neutral-500 block mb-0.5">Estimasi Durasi</span>
          <span className="text-lg font-bold text-emerald-400">{formatEstTime(estimatedDurationMs)}</span>
        </div>
        <div className="p-3 bg-neutral-900/60 border border-neutral-800 rounded-none" id="stat-pause-tags">
          <span className="text-xs text-neutral-500 block mb-0.5">Tag Jeda (Pause)</span>
          <span className="text-lg font-bold text-yellow-500">{pauseTagsCount}</span>
        </div>
        <div className="p-3 bg-neutral-900/60 border border-neutral-800 rounded-none" id="stat-hold-tags">
          <span className="text-xs text-neutral-500 block mb-0.5">Tag Tahan (Hold)</span>
          <span className="text-lg font-bold text-red-400">{holdTagsCount}</span>
        </div>
      </div>

      {/* 4. Controls section */}
      <div className="p-4 bg-neutral-900/40 border border-neutral-800/80 rounded-none flex flex-col gap-5" id="editor-speed-pacing-controls">
        <h3 className="text-sm font-bold text-neutral-300 flex items-center gap-2 border-b border-neutral-800/60 pb-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          Konfigurasi Aliran Teks
        </h3>

        {/* Display Mode Selectors */}
        <div className="flex flex-col gap-2" id="display-mode-options">
          <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            Metode Tampilan Prompter
          </span>
          <div className="grid grid-cols-3 gap-2">
            {[
              { mode: PrompterMode.WORD, label: "Word-by-Word", desc: "Satu kata terpusat (RSVP)" },
              { mode: PrompterMode.PHRASE, label: "Frasa (Clause)", desc: "Potongan 2-4 kata per kloter" },
              { mode: PrompterMode.TICKER, label: "Ticker Teks", desc: "Running text mendatar" }
            ].map((item) => (
              <button
                key={item.mode}
                id={`mode-btn-${item.mode.toLowerCase()}`}
                onClick={() => onChangeMode(item.mode)}
                className={`p-2 rounded-none text-left border transition-all ${
                  mode === item.mode
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-300 font-semibold"
                    : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-300"
                }`}
              >
                <span className="text-xs block">{item.label}</span>
                <span className="text-[10px] text-neutral-500 font-normal leading-tight block mt-0.5">{item.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Extra controls for WPM / Pause durations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="range-sliders-block">
          {/* Speed slider */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-neutral-500" />
                Tempo Bicara (Speed)
              </span>
              <span className="text-xs font-bold text-emerald-400">{wpm} WPM</span>
            </div>
            <input
              id="wpm-speed-slider"
              type="range"
              min="60"
              max="300"
              step="5"
              value={wpm}
              onChange={(e) => onChangeWpm(parseInt(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-500">
              <span>Lambat (60)</span>
              <span>Sedang (130)</span>
              <span>Cepat (300)</span>
            </div>
          </div>

          {/* Autopacing trigger */}
          <div className="flex flex-col justify-center gap-1.5 bg-neutral-950 p-3 rounded-none border border-neutral-800">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-neutral-300">Pacing Tanda Baca Otomatis</span>
                <span className="text-[10px] text-neutral-500 leading-tight">Jeda natural pada koma (+0.3s) & titik (+0.7s)</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="auto-pacing-toggle-checkbox"
                  type="checkbox"
                  checked={autoPacing}
                  onChange={(e) => onChangeAutoPacing(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-none peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-300 after:border-neutral-300 after:border after:rounded-none after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white" />
              </label>
            </div>
          </div>
        </div>

        {/* Phrase mode specific count config */}
        {mode === PrompterMode.PHRASE && (
          <div className="flex items-center justify-between bg-neutral-950 p-3 rounded-none border border-neutral-800 animate-slideDown" id="phrase-mode-settings-panel">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-neutral-300">Maksimal Kata per Frasa</span>
              <span className="text-[10px] text-neutral-500">Jumlah kata sebelum otomatis dipotong ke kloter berikutnya</span>
            </div>
            <div className="flex items-center gap-1">
              {[2, 3, 4, 5].map((count) => (
                <button
                  key={count}
                  id={`phrase-word-count-btn-${count}`}
                  onClick={() => onChangeMaxWordsPerPhrase(count)}
                  className={`w-8 h-8 rounded-none text-xs font-bold border transition ${
                    maxWordsPerPhrase === count
                      ? "bg-emerald-500 text-neutral-950 border-emerald-500"
                      : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Ticker mode specific config */}
        {mode === PrompterMode.TICKER && (
          <div className="flex items-center justify-between bg-neutral-950 p-3 rounded-none border border-neutral-800 animate-slideDown" id="ticker-mode-settings-panel">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-neutral-300">Gaya Ticker Teks</span>
              <span className="text-[10px] text-neutral-500">Pilih fokus per kata terpusat atau flat teks biasa</span>
            </div>
            <div className="flex items-center gap-1.5 bg-neutral-900 p-0.5 rounded-none border border-neutral-800">
              {[
                { type: "focus", label: "Fokus Kata" },
                { type: "flat", label: "Flat Teks" }
              ].map((item) => (
                <button
                  key={item.type}
                  id={`ticker-type-btn-${item.type}`}
                  onClick={() => onChangeTickerType?.(item.type as "focus" | "flat")}
                  className={`px-3 py-1.5 rounded-none text-xs font-bold transition-all ${
                    (tickerType || "focus") === item.type
                      ? "bg-emerald-500 text-neutral-950"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
