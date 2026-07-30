/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { FileText, Plus, HelpCircle, Settings2, Sliders, Layers, Sparkles, Volume2, ChevronDown, ChevronUp } from "lucide-react";
import { PrompterMode, PunctuationDurations } from "../types";

interface ScriptEditorProps {
  text: string;
  onChangeText: (text: string) => void;
  wpm: number;
  onChangeWpm: (wpm: number) => void;
  autoPacing: boolean;
  onChangeAutoPacing: (pacing: boolean) => void;
  punctuationDurations: PunctuationDurations;
  onChangePunctuationDurations: (durations: PunctuationDurations) => void;
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
  phraseHighlightType?: "word" | "phrase";
  onChangePhraseHighlightType?: (type: "word" | "phrase") => void;
  disableWordHighlight?: boolean;
  onChangeDisableWordHighlight?: (disable: boolean) => void;
}

const SCRIPT_PRESETS = [
  {
    title: "Template Shorts (Ind)",
    text: "Halo semuanya! [pause:1.0] Selamat datang di RhythmPrompter. Hari ini kita membongkar rahasia bicara di depan kamera secara natural. [pause:1.5] Kuncinya bukan membaca teks terus-menerus, tapi memahami irama kalimat. [pause:0.8] Coba perhatikan bagaimana tulisan ini berhenti sejenak ketika saya ingin menekankan poin penting. [pause:1.2] Dan sekarang, teleprompter ini akan menunggu saya [hold] sampai saya menekan tombol lanjut atau mengetuk layar. Keren banget kan? Cobain deh!"
  },
  {
    title: "Template Shorts (Eng)",
    text: "Hey guys! [pause:0.8] Today we are reviewing the modular Dynamic Prompter. [pause:1.2] Conventional teleprompters make you sound robotic, scrolling at a rigid speed. [pause:1.0] But this system adapts to human speech rhythms. [pause:0.6] See how a period naturally adds a brief rest? [pause:0.8] And if I need to stop to showcase the product, [hold] the prompter holds perfectly. Tap spacebar or click to resume whenever you are ready!"
  },
  {
    title: "Clear",
    text: ""
  }
];

interface SecureSliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  label: string;
  displayValue: string;
}

const SecureSlider: React.FC<SecureSliderProps> = ({
  value,
  min,
  max,
  step,
  onChange,
  label,
  displayValue
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.stopPropagation();
    e.preventDefault();

    const rect = containerRef.current.getBoundingClientRect();
    const clientX = e.clientX;
    const relativeX = clientX - rect.left;
    const fraction = Math.min(1, Math.max(0, relativeX / rect.width));

    let rawValue = min + fraction * (max - min);
    const stepsCount = Math.round((rawValue - min) / step);
    let steppedValue = min + stepsCount * step;
    steppedValue = Math.min(max, Math.max(min, steppedValue));

    onChange(steppedValue);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    setIsDragging(false);
  };

  return (
    <div className="flex flex-col gap-1 py-1" id={`secure-slider-container-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
      <div className="flex justify-between items-center text-[10px] text-neutral-400 select-none">
        <span className="font-semibold text-neutral-300">{label}</span>
        <span className="font-bold text-emerald-400">{displayValue}</span>
      </div>

      <div
        ref={containerRef}
        className="relative w-full h-4 flex items-center select-none"
      >
        {/* Track Bar (No pointer events to prevent accidental clicks!) */}
        <div className="absolute w-full h-1 bg-neutral-900 rounded-lg pointer-events-none border border-neutral-800">
          <div
            className="h-full bg-emerald-500 rounded-lg"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Head Handle (Thumb) - Interactive and secure */}
        <div
          className="absolute w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-[0_0_6px_rgba(16,185,129,0.4)] cursor-grab active:cursor-grabbing hover:scale-110 transition-transform duration-75 flex items-center justify-center z-10"
          style={{
            left: `calc(${percentage}% - 8px)`,
            touchAction: "none"
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          id={`secure-slider-thumb-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-white opacity-90" />
        </div>
      </div>
    </div>
  );
};

export default function ScriptEditor({
  text,
  onChangeText,
  wpm,
  onChangeWpm,
  autoPacing,
  onChangeAutoPacing,
  punctuationDurations,
  onChangePunctuationDurations,
  mode,
  onChangeMode,
  maxWordsPerPhrase,
  onChangeMaxWordsPerPhrase,
  wordCount,
  estimatedDurationMs,
  pauseTagsCount,
  holdTagsCount,
  tickerType,
  onChangeTickerType,
  phraseHighlightType,
  onChangePhraseHighlightType,
  disableWordHighlight,
  onChangeDisableWordHighlight
}: ScriptEditorProps) {
  const [showTagHelp, setShowTagHelp] = useState(false);
  const [isPuncCollapse, setIsPuncCollapse] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (textareaRef.current && backdropRef.current) {
      backdropRef.current.scrollTop = textareaRef.current.scrollTop;
      backdropRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const renderHighlightedText = (content: string) => {
    if (!content) return null;
    const regex = /(\[pause:\d+(?:\.\d+)?\]|\[hold\])/gi;
    const parts = content.split(regex);
    
    return parts.map((part, i) => {
      if (regex.test(part)) {
        return (
          <span key={i} className="bg-emerald-500/20 text-emerald-400 rounded-sm font-medium font-mono px-0.5 mx-0.5">
            {part}
          </span>
        );
      }
      return <span key={i} className="text-neutral-200">{part}</span>;
    });
  };

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
          Template Naskah
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
          <button
            id="btn-inject-pause-0-5"
            onClick={() => injectTag("[pause:0.5]")}
            className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs rounded-none font-medium transition flex items-center gap-1"
            title="Sisipkan tag jeda selama 0.5 detik [pause:0.5] di naskah untuk menghentikan gulir sejenak"
          >
            <Plus className="w-3 h-3 text-emerald-400" />
            0.5s
          </button>
          <button
            id="btn-inject-pause-1-0"
            onClick={() => injectTag("[pause:1.0]")}
            className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs rounded-none font-medium transition flex items-center gap-1"
            title="Sisipkan tag jeda selama 1.0 detik [pause:1.0] di naskah untuk jeda kalimat"
          >
            <Plus className="w-3 h-3 text-emerald-400" />
            1.0s
          </button>
          <button
            id="btn-inject-pause-1-5"
            onClick={() => injectTag("[pause:1.5]")}
            className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs rounded-none font-medium transition flex items-center gap-1"
            title="Sisipkan tag jeda selama 1.5 detik [pause:1.5] di naskah untuk jeda nafas atau intonasi alami"
          >
            <Plus className="w-3 h-3 text-emerald-400" />
            1.5s
          </button>
          <button
            id="btn-inject-hold"
            onClick={() => injectTag("[hold]")}
            className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs rounded-none font-medium transition flex items-center gap-1"
            title="Sisipkan tag penahan [hold] untuk menghentikan gulir otomatis sepenuhnya sampai Anda mengklik layar atau tombol Selanjutnya"
          >
            <Plus className="w-3 h-3 text-emerald-400" />
            Hold
          </button>
        </div>

        {/* [UI-NONPROGRAMMER] Container editor naskah dengan syntax highlighting */}
        <div className="relative w-full h-44 rounded-none border border-neutral-800 bg-neutral-950 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/20 resize-y overflow-hidden group">
          {/* Backdrop untuk highlight tag */}
          <div 
            ref={backdropRef}
            aria-hidden="true"
            className="absolute inset-0 w-full h-full px-4 py-3 text-sm font-sans leading-relaxed whitespace-pre-wrap break-words overflow-hidden pointer-events-none"
          >
            {renderHighlightedText(text)}
            {text.endsWith('\n') ? <br /> : null}
          </div>
          
          <textarea
            id="script-textarea"
            ref={textareaRef}
            value={text}
            onScroll={handleScroll}
            onChange={(e) => onChangeText(e.target.value)}
            placeholder="Tuliskan script pembuka Anda di sini, sisipkan tag [pause:1.5] untuk menciptakan jeda alami bagi penonton..."
            className="absolute inset-0 w-full h-full bg-transparent text-transparent caret-white px-4 py-3 text-sm font-sans leading-relaxed resize-none focus:outline-none overflow-auto"
            style={{ color: 'transparent', caretColor: 'white' }}
            spellCheck="false"
          />
        </div>
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
              { mode: PrompterMode.WORD, label: "Word-by-Word" },
              { mode: PrompterMode.PHRASE, label: "Frasa (Clause)" },
              { mode: PrompterMode.TICKER, label: "Ticker Teks" }
            ].map((item) => (
              <button
                key={item.mode}
                id={`mode-btn-${item.mode.toLowerCase()}`}
                onClick={() => onChangeMode(item.mode)}
                className={`p-2 rounded-none text-left border transition-all ${mode === item.mode
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
        <div className="flex flex-col gap-4" id="range-sliders-block">
          {/* Speed slider */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-neutral-400 flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-neutral-500" />
                Tempo
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
              <span>Lambat</span>
              <span>Sedang</span>
              <span>Cepat</span>
            </div>
          </div>

          {/* Autopacing trigger */}
          <div className="flex flex-col gap-3 bg-neutral-950 p-3 rounded-none border border-neutral-800">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-neutral-300">Pacing Tanda Baca Otomatis</span>
                  {autoPacing && (
                    <button
                      type="button"
                      onClick={() => setIsPuncCollapse(!isPuncCollapse)}
                      className="text-neutral-400 hover:text-emerald-400 p-0.5 transition-colors rounded hover:bg-neutral-900"
                      title={isPuncCollapse ? "Tampilkan Detail Jeda" : "Sembunyikan Detail Jeda"}
                      id="toggle-punc-collapse-btn"
                    >
                      {isPuncCollapse ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
                <span className="text-[10px] text-neutral-500 leading-tight">Jeda natural pada tanda baca</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="auto-pacing-toggle-checkbox"
                  type="checkbox"
                  checked={autoPacing}
                  onChange={(e) => {
                    onChangeAutoPacing(e.target.checked);
                    if (e.target.checked) {
                      setIsPuncCollapse(false);
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-none peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-300 after:border-neutral-300 after:border after:rounded-none after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white" />
              </label>
            </div>

            {autoPacing && !isPuncCollapse && (
              <div className="mt-1 pt-3 border-t border-neutral-900 flex flex-col gap-4 text-xs animate-slideDown" id="punc-custom-durations">
                {/* Comma slider */}
                <SecureSlider
                  label="Jeda Koma ( , - )"
                  value={punctuationDurations.comma}
                  min={0}
                  max={3000}
                  step={100}
                  displayValue={`${(punctuationDurations.comma / 1000).toFixed(1)}s`}
                  onChange={(val) => onChangePunctuationDurations({ ...punctuationDurations, comma: val })}
                />

                {/* Period slider */}
                <SecureSlider
                  label="Jeda Titik ( . 。 )"
                  value={punctuationDurations.period}
                  min={0}
                  max={3000}
                  step={100}
                  displayValue={`${(punctuationDurations.period / 1000).toFixed(1)}s`}
                  onChange={(val) => onChangePunctuationDurations({ ...punctuationDurations, period: val })}
                />

                {/* Question mark slider */}
                <SecureSlider
                  label="Jeda Tanya ( ? ？ )"
                  value={punctuationDurations.question}
                  min={0}
                  max={3000}
                  step={100}
                  displayValue={`${(punctuationDurations.question / 1000).toFixed(1)}s`}
                  onChange={(val) => onChangePunctuationDurations({ ...punctuationDurations, question: val })}
                />

                {/* Exclamation mark slider */}
                <SecureSlider
                  label="Jeda Seru ( ! ！ )"
                  value={punctuationDurations.exclamation}
                  min={0}
                  max={3000}
                  step={100}
                  displayValue={`${(punctuationDurations.exclamation / 1000).toFixed(1)}s`}
                  onChange={(val) => onChangePunctuationDurations({ ...punctuationDurations, exclamation: val })}
                />

                {/* Colon/Semicolon slider */}
                <SecureSlider
                  label="Jeda Titik Dua & Koma ( : ; )"
                  value={punctuationDurations.colonSemicolon}
                  min={0}
                  max={3000}
                  step={100}
                  displayValue={`${(punctuationDurations.colonSemicolon / 1000).toFixed(1)}s`}
                  onChange={(val) => onChangePunctuationDurations({ ...punctuationDurations, colonSemicolon: val })}
                />
              </div>
            )}
          </div>
        </div>

        {/* Phrase mode specific count config */}
        {mode === PrompterMode.PHRASE && (
          <div className="flex flex-col gap-3 bg-neutral-950 p-3 rounded-none border border-neutral-800 animate-slideDown" id="phrase-mode-settings-panel">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-neutral-300">Max Word Each Phrase</span>
              </div>
              <div className="flex items-center gap-1">
                {[2, 3, 4, 5].map((count) => (
                  <button
                    key={count}
                    id={`phrase-word-count-btn-${count}`}
                    onClick={() => onChangeMaxWordsPerPhrase(count)}
                    className={`w-8 h-8 rounded-none text-xs font-bold border transition ${maxWordsPerPhrase === count
                      ? "bg-emerald-500 text-neutral-950 border-emerald-500"
                      : "bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-700"
                      }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-900 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-neutral-300">Highlight Mode</span>
              </div>
              <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded-none border border-neutral-800">
                {[
                  { type: "word", label: "Each Word" },
                  { type: "phrase", label: "Whole Phrase" }
                ].map((item) => (
                  <button
                    key={item.type}
                    id={`phrase-highlight-btn-${item.type}`}
                    onClick={() => onChangePhraseHighlightType?.(item.type as "word" | "phrase")}
                    className={`px-3 py-1.5 rounded-none text-xs font-bold transition-all ${(phraseHighlightType || "word") === item.type
                      ? "bg-emerald-500 text-neutral-950"
                      : "text-neutral-400 hover:text-neutral-200"
                      }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Ticker mode specific config */}
        {mode === PrompterMode.TICKER && (
          <div className="flex flex-col gap-3 bg-neutral-950 p-3 rounded-none border border-neutral-800 animate-slideDown" id="ticker-mode-settings-panel">
            <div className="flex items-center justify-between">
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
                    className={`px-3 py-1.5 rounded-none text-xs font-bold transition-all ${(tickerType || "focus") === item.type
                      ? "bg-emerald-500 text-neutral-950"
                      : "text-neutral-400 hover:text-neutral-200"
                      }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-900 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-neutral-300">Sorotan Kata Aktif</span>
                <span className="text-[10px] text-neutral-500">Nyalakan sorotan kata atau running text polos biasa</span>
              </div>
              <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded-none border border-neutral-800">
                {[
                  { disabled: false, label: "Sorotan Aktif" },
                  { disabled: true, label: "Tanpa Highlight" }
                ].map((item) => (
                  <button
                    key={item.disabled ? "disabled" : "enabled"}
                    id={`ticker-highlight-btn-${item.disabled ? "disabled" : "enabled"}`}
                    onClick={() => onChangeDisableWordHighlight?.(item.disabled)}
                    className={`px-3 py-1.5 rounded-none text-xs font-bold transition-all ${!!disableWordHighlight === item.disabled
                      ? "bg-emerald-500 text-neutral-950"
                      : "text-neutral-400 hover:text-neutral-200"
                      }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
