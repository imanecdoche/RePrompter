/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum PrompterMode {
  WORD = "WORD",     // RSVP (one word centered)
  PHRASE = "PHRASE", // Phrase-by-phrase (group of words)
  TICKER = "TICKER"  // Continuous horizontal scrolling
}

export interface PrompterWord {
  id: string;
  text: string;               // The actual text displayed (e.g., "Halo,")
  cleanText: string;          // The text without punctuation (e.g., "Halo")
  index: number;              // Index in the complete script
  durationMs: number;         // Base duration based on WPM
  punctuationPauseMs: number; // Pause added by punctuation (, = 300, . = 700, etc.)
  customPauseMs: number;      // Pause specified by [pause:X] tag (in milliseconds)
  isHold: boolean;            // True if followed by [hold] tag, requiring manual click to proceed
  totalDurationMs: number;    // durationMs + punctuationPauseMs + customPauseMs
  startTimeMs: number;        // Cached start time from the beginning of the play session
}

export interface PrompterPhrase {
  id: string;
  words: PrompterWord[];
  text: string;
  durationMs: number;
  startTimeMs: number;
  isHold: boolean;            // True if any word in the phrase requires a hold
}

export interface VisualConfig {
  fontSize: number;          // in pixels or rem equivalent
  theme: "dark-overlay" | "high-contrast" | "neon-glass" | "classic-light";
  focalHighlight: "text-color" | "underline" | "background" | "none";
  highlightColor: string;    // hex color like #eab308 (yellow-500)
  fontFamily: "sans" | "serif" | "mono";
  overlayOpacity: number;    // Background opacity behind text (0 to 100)
  textPosition: "top" | "center" | "bottom"; // Position of text overlay relative to camera feed
  tickerType?: "focus" | "flat";
}

export interface PrompterState {
  isPlaying: boolean;
  currentIndex: number;       // active word index
  elapsedTimeMs: number;      // current playtime in ms
  isHolding: boolean;         // waiting for manual trigger on a hold tag
}
