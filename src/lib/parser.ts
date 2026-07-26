/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PrompterWord, PrompterPhrase, PunctuationDurations } from "../types";

export const DEFAULT_PUNCTUATION_DURATIONS: PunctuationDurations = {
  comma: 300,
  period: 700,
  question: 800,
  exclamation: 800,
  colonSemicolon: 700
};

/**
 * Parses raw text into an array of PrompterWord items, tracking timing, custom pauses, and holds.
 */
export function parseScript(
  text: string,
  wpm: number,
  autoPunctuationPause: boolean,
  customDurations?: PunctuationDurations
): PrompterWord[] {
  if (!text || text.trim() === "") return [];

  const durations = customDurations || DEFAULT_PUNCTUATION_DURATIONS;

  // Regex to match pause tags, hold tags, or standard words
  const tokenRegex = /(\[pause:[\d.]+s?\]|<pause:[\d.]+s?>|\[hold\]|<hold>|[^\s]+)/gi;
  const tokens = text.match(tokenRegex) || [];

  const words: PrompterWord[] = [];
  let pendingPauseMs = 0;
  let pendingHold = false;
  let wordIndex = 0;

  const baseDurationMs = Math.round((60000 / wpm));

  for (const token of tokens) {
    const isPauseTag = token.match(/^(?:\[pause:([\d.]+)(?:s)?\]|<pause:([\d.]+)(?:s)?>)$/i);
    const isHoldTag = token.match(/^(?:\[hold\]|<hold>)$/i);

    if (isPauseTag) {
      const seconds = parseFloat(isPauseTag[1] || isPauseTag[2]);
      const ms = Math.round(seconds * 1000);
      if (words.length > 0) {
        words[words.length - 1].customPauseMs += ms;
        words[words.length - 1].totalDurationMs += ms;
      } else {
        pendingPauseMs += ms;
      }
    } else if (isHoldTag) {
      if (words.length > 0) {
        words[words.length - 1].isHold = true;
      } else {
        pendingHold = true;
      }
    } else {
      // Clean word check
      const wordText = token;
      // Remove punctuation for clean speech analysis if needed, but keep original text for render
      const cleanText = wordText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "");

      let puncPauseMs = 0;
      if (autoPunctuationPause) {
        if (wordText.endsWith(",") || wordText.endsWith("，") || wordText.endsWith("-")) {
          puncPauseMs = durations.comma;
        } else if (
          wordText.endsWith(".") ||
          wordText.endsWith("。")
        ) {
          puncPauseMs = durations.period;
        } else if (
          wordText.endsWith(":") ||
          wordText.endsWith("：") ||
          wordText.endsWith(";") ||
          wordText.endsWith("；")
        ) {
          puncPauseMs = durations.colonSemicolon;
        } else if (
          wordText.endsWith("?") ||
          wordText.endsWith("？")
        ) {
          puncPauseMs = durations.question;
        } else if (
          wordText.endsWith("!") ||
          wordText.endsWith("！")
        ) {
          puncPauseMs = durations.exclamation;
        }
      }

      const totalDuration = baseDurationMs + puncPauseMs + pendingPauseMs;

      words.push({
        id: `word-${wordIndex}-${Math.random().toString(36).substring(2, 9)}`,
        text: wordText,
        cleanText,
        index: wordIndex,
        durationMs: baseDurationMs,
        punctuationPauseMs: puncPauseMs,
        customPauseMs: pendingPauseMs,
        isHold: pendingHold,
        totalDurationMs: totalDuration,
        startTimeMs: 0 // To be filled in next step
      });

      pendingPauseMs = 0;
      pendingHold = false;
      wordIndex++;
    }
  }

  // Recalculate start times based on total durations
  let currentStartTime = 0;
  for (let i = 0; i < words.length; i++) {
    words[i].startTimeMs = currentStartTime;
    currentStartTime += words[i].totalDurationMs;
  }

  return words;
}

/**
 * Groups an array of PrompterWords into logical phrases based on punctuation, hold triggers, pauses, or maximum word count.
 */
export function groupWordsIntoPhrases(words: PrompterWord[], maxWordsPerPhrase = 3): PrompterPhrase[] {
  if (words.length === 0) return [];

  const phrases: PrompterPhrase[] = [];
  let currentPhraseWords: PrompterWord[] = [];
  let phraseIndex = 0;

  for (const word of words) {
    currentPhraseWords.push(word);

    const hasPunctuationSplit =
      word.text.endsWith(",") ||
      word.text.endsWith("，") ||
      word.text.endsWith(".") ||
      word.text.endsWith("。") ||
      word.text.endsWith("?") ||
      word.text.endsWith("？") ||
      word.text.endsWith("!") ||
      word.text.endsWith("！") ||
      word.text.endsWith(";") ||
      word.text.endsWith("；") ||
      word.text.endsWith(":") ||
      word.text.endsWith("：");

    const hasPause = word.customPauseMs > 0;
    const isHold = word.isHold;
    const isMaxWords = currentPhraseWords.length >= maxWordsPerPhrase;

    if (hasPunctuationSplit || hasPause || isHold || isMaxWords) {
      const phraseText = currentPhraseWords.map((w) => w.text).join(" ");
      const totalDur = currentPhraseWords.reduce((sum, w) => sum + w.totalDurationMs, 0);
      const startTime = currentPhraseWords[0].startTimeMs;

      phrases.push({
        id: `phrase-${phraseIndex}`,
        words: [...currentPhraseWords],
        text: phraseText,
        durationMs: totalDur,
        startTimeMs: startTime,
        isHold: currentPhraseWords.some((w) => w.isHold)
      });

      currentPhraseWords = [];
      phraseIndex++;
    }
  }

  // Handle remaining words
  if (currentPhraseWords.length > 0) {
    const phraseText = currentPhraseWords.map((w) => w.text).join(" ");
    const totalDur = currentPhraseWords.reduce((sum, w) => sum + w.totalDurationMs, 0);
    const startTime = currentPhraseWords[0].startTimeMs;

    phrases.push({
      id: `phrase-${phraseIndex}`,
      words: [...currentPhraseWords],
      text: phraseText,
      durationMs: totalDur,
      startTimeMs: startTime,
      isHold: currentPhraseWords.some((w) => w.isHold)
    });
  }

  return phrases;
}

/**
 * Formats milliseconds into high-readability minutes:seconds format.
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}
