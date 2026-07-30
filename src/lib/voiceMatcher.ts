/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PrompterWord } from '../types';

/**
 * Membersihkan kata dari tanda baca dan mengubah ke huruf kecil
 */
function normalizeWord(word: string): string {
  return word.replace(/[^\w\s]/gi, '').toLowerCase();
}

// Kata-kata umum yang sering diulang, diabaikan saat pencocokan 1 kata
const STOP_WORDS = new Set([
  'di', 'ke', 'dari', 'dan', 'atau', 'yang', 'ini', 'itu', 'pada',
  'untuk', 'dengan', 'dalam', 'akan', 'ada', 'tidak', 'bisa', 'saya', 'kami'
]);

/**
 * Mencocokkan teks hasil suara dengan naskah prompter.
 * Prioritas:
 * 1. Urutan 2 kata berurutan (Paling akurat)
 * 2. 1 kata yang cukup panjang dan bukan kata umum (Fallback)
 * 
 * @param transcript Hasil pengenalan suara terbaru
 * @param words Array kata naskah
 * @param currentIndex Indeks kata yang sedang aktif
 * @param lookaheadWindow Berapa kata ke depan yang harus dipantau
 */
export function matchVoiceToPrompter(
  transcript: string,
  words: PrompterWord[],
  currentIndex: number,
  lookaheadWindow: number = 15
): number | null {
  if (!transcript || words.length === 0) return null;

  const transcriptWords = transcript.split(/\s+/).map(normalizeWord).filter(w => w.length > 0);
  if (transcriptWords.length === 0) return null;

  // Ambil 5 kata terakhir yang diucapkan
  const recentSpoken = transcriptWords.slice(-5);

  // Batas jangkauan pencarian ke depan
  const maxIndex = Math.min(currentIndex + lookaheadWindow, words.length - 1);

  // Strategi 1: Cari urutan 2 kata (Sangat Akurat)
  // Pencarian mundur agar jika membaca cepat, prompter langsung melompat ke yang terjauh
  if (recentSpoken.length >= 2) {
    for (let i = maxIndex; i > currentIndex; i--) {
      if (i > 0) {
        const sw1 = normalizeWord(words[i - 1].cleanText);
        const sw2 = normalizeWord(words[i].cleanText);

        for (let j = 0; j < recentSpoken.length - 1; j++) {
          if (recentSpoken[j] === sw1 && recentSpoken[j + 1] === sw2) {
            return i;
          }
        }
      }
    }
  }

  // Strategi 2: Cari 1 kata spesifik (Cukup Akurat)
  for (let i = maxIndex; i > currentIndex; i--) {
    const scriptWord = normalizeWord(words[i].cleanText);

    // Abaikan jika kata terlalu pendek atau merupakan kata umum
    if (!scriptWord || STOP_WORDS.has(scriptWord) || scriptWord.length < 4) continue;

    for (let j = recentSpoken.length - 1; j >= 0; j--) {
      const spokenWord = recentSpoken[j];

      // Pencocokan eksak atau fuzzy (substring) jika kata cukup panjang
      if (spokenWord === scriptWord ||
        (spokenWord.length >= 5 && scriptWord.length >= 5 &&
          (spokenWord.includes(scriptWord) || scriptWord.includes(spokenWord)))) {
        return i;
      }
    }
  }

  return null;
}
