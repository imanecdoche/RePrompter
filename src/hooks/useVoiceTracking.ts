/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// Deklarasi global untuk Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function useVoiceTracking() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'id-ID'; // Bahasa utama (bisa disesuaikan nanti)
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        // Loop seluruh hasil yang didapat
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript + ' ';
          } else {
            interimTranscript += result[0].transcript;
          }
        }
        
        // Gabungkan final dan interim
        const combined = (finalTranscript + interimTranscript).trim();
        setTranscript(combined);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
          setError('Izin mikrofon ditolak.');
          setIsListening(false);
        } else if (event.error !== 'no-speech') {
          setError(event.error);
        }
      };

      recognition.onend = () => {
        // Fitur auto-restart jika putus padahal state masih listening
        setIsListening((prev) => {
          if (prev) {
            try {
              recognition.start();
            } catch (e) {
              return false;
            }
          }
          return prev;
        });
      };

      recognitionRef.current = recognition;
    } else {
      setError('Browser tidak mendukung Web Speech API.');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null; // Mencegah restart loop saat unmount
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    setTranscript('');
    setIsListening(true);
    try {
      recognitionRef.current?.start();
    } catch (e) {
      // Abaikan jika sudah berjalan
    }
  }, []);

  const stopListening = useCallback(() => {
    setIsListening(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    resetTranscript,
    isSupported: !!recognitionRef.current
  };
}
