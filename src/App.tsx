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
  Minimize,
  Tv,
  Smartphone,
  Gamepad2,
  Video,
  VideoOff,
  Circle,
  Square,
  Download,
  X,
  FlipHorizontal
} from "lucide-react";

import { PrompterMode, VisualConfig, PunctuationDurations, VideoConfig } from "./types";
import { parseScript, groupWordsIntoPhrases, formatTime, DEFAULT_PUNCTUATION_DURATIONS } from "./lib/parser";
import { usePrompterEngine } from "./hooks/usePrompterEngine";
import ScriptEditor from "./components/ScriptEditor";
import PrompterDisplay from "./components/PrompterDisplay";
import { Footer } from "./components/Footer";

// Firebase imports for PREMO realtime synchronization
import { db } from "./lib/firebase";
import { doc, setDoc, updateDoc, getDoc, onSnapshot, deleteDoc } from "firebase/firestore";

// Default Indonesian script for first-time load
const INITIAL_SCRIPT = "";

const DEFAULT_STORAGE_KEY = "rhythmprompter_default_config";

interface SavedConfig {
  visualConfig: VisualConfig;
  wpm: number;
  autoPacing: boolean;
  punctuationDurations?: PunctuationDurations;
  mode: PrompterMode;
  maxWordsPerPhrase: number;
}

const getSavedConfig = (): SavedConfig | null => {
  try {
    const saved = localStorage.getItem(DEFAULT_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Error reading default config", e);
  }
  return null;
};

export default function App() {
  const savedConfig = useMemo(() => getSavedConfig(), []);

  // PREMO States
  const [premoRole, setPremoRole] = useState<"none" | "controller" | "monitor">("none");
  const [premoCode, setPremoCode] = useState<string>("");
  const [premoPaired, setPremoPaired] = useState<boolean>(false);
  const [premoError, setPremoError] = useState<string>("");
  const [premoShowSetup, setPremoShowSetup] = useState<boolean>(false);
  const [premoMonitorInput, setPremoMonitorInput] = useState<string>("");
  const [premoLoading, setPremoLoading] = useState<boolean>(false);

  // 1. Script & Pacing States
  const [scriptText, setScriptText] = useState<string>(INITIAL_SCRIPT);
  const [wpm, setWpm] = useState<number>(savedConfig ? savedConfig.wpm : 130);
  const [autoPacing, setAutoPacing] = useState<boolean>(savedConfig ? savedConfig.autoPacing : true);
  const [punctuationDurations, setPunctuationDurations] = useState<PunctuationDurations>(
    savedConfig && savedConfig.punctuationDurations
      ? savedConfig.punctuationDurations
      : { ...DEFAULT_PUNCTUATION_DURATIONS }
  );
  const [mode, setMode] = useState<PrompterMode>(savedConfig ? savedConfig.mode : PrompterMode.PHRASE);
  const [maxWordsPerPhrase, setMaxWordsPerPhrase] = useState<number>(savedConfig ? savedConfig.maxWordsPerPhrase : 3);

  // 2. Tab Navigation for the Config station
  const [activeTab, setActiveTab] = useState<"editor" | "styling" | "hotkeys">("editor");

  // 5. Focus Mode State
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [focusDragOffset, setFocusDragOffset] = useState<number>(() => {
    const saved = localStorage.getItem("rhythmprompter_drag_offset");
    return saved && !isNaN(parseInt(saved, 10)) ? parseInt(saved, 10) : 0;
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem("rhythmprompter_drag_offset", focusDragOffset.toString());
    }, 500);
    return () => clearTimeout(timer);
  }, [focusDragOffset]);

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

  // CAMERA & RECORDING STATE
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showRestartDialog, setShowRestartDialog] = useState(false);
  const [showVideoConfigModal, setShowVideoConfigModal] = useState(false);
  const [videoConfig, setVideoConfig] = useState<VideoConfig>(() => {
    const saved = localStorage.getItem("rhythm_video_config");
    return saved ? JSON.parse(saved) : { codec: "webm", fps: 30, ratio: "16:9" };
  });

  const discardRecordingRef = useRef<boolean>(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [resumeCountdown, setResumeCountdown] = useState<number | null>(null);
  const [isMirrored, setIsMirrored] = useState<boolean>(() => localStorage.getItem("rhythm_mirror") !== "false");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const drawLoopRef = useRef<number | null>(null);

  useEffect(() => {
    localStorage.setItem("rhythm_mirror", isMirrored.toString());
  }, [isMirrored]);

  useEffect(() => {
    localStorage.setItem("rhythm_video_config", JSON.stringify(videoConfig));
  }, [videoConfig]);

  const toggleCameraMode = async () => {
    if (isCameraActive) {
      if (drawLoopRef.current) {
        cancelAnimationFrame(drawLoopRef.current);
        drawLoopRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      setIsCameraActive(false);
      setIsRecording(false);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { frameRate: videoConfig.fps, facingMode: "user" },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        });
        mediaStreamRef.current = stream;
        setIsCameraActive(true);
      } catch (err) {
        console.error("Camera access error:", err);
        alert("Gagal mengakses kamera/mikrofon. Pastikan izin telah diberikan.");
      }
    }
  };

  // Pastikan srcObject diisi setelah elemen <video> di-render oleh React
  useEffect(() => {
    if (isCameraActive && videoRef.current && mediaStreamRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
    }
  }, [isCameraActive]);

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
  const [visualConfig, setVisualConfig] = useState<VisualConfig>(savedConfig ? savedConfig.visualConfig : {
    fontSize: 34,
    theme: "dark-overlay",
    focalHighlight: "text-color",
    highlightColor: "#facc15", // yellow-400
    fontFamily: "sans",
    overlayOpacity: 75,
    textPosition: "center",
    tickerType: "focus",
    phraseHighlightType: "word",
    disableWordHighlight: false,
    showNextPreview: false
  });

  const [showSaveSuccess, setShowSaveSuccess] = useState<boolean>(false);

  const saveAsDefault = () => {
    const configToSave: SavedConfig = {
      visualConfig,
      wpm,
      autoPacing,
      punctuationDurations,
      mode,
      maxWordsPerPhrase
    };
    try {
      localStorage.setItem(DEFAULT_STORAGE_KEY, JSON.stringify(configToSave));
      setShowSaveSuccess(true);
      setTimeout(() => {
        setShowSaveSuccess(false);
      }, 2000);
    } catch (e) {
      console.error("Failed to save default config to localStorage", e);
    }
  };

  // 4. Parse script on input/config change
  const words = useMemo(() => {
    return parseScript(scriptText, wpm, autoPacing, punctuationDurations);
  }, [scriptText, wpm, autoPacing, punctuationDurations]);

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
    play,
    pause,
    togglePlay,
    reset,
    setIndex,
    setExactTime,
    skipNext,
    skipPrev,
    setGestureHolding
  } = usePrompterEngine(words);

  // Wrapped PREMO actions that sync state via Firestore
  const broadcastPremoState = async (action: string, extraFields: any = {}) => {
    if (!premoCode) return;
    try {
      const docRef = doc(db, "premoSessions", premoCode);
      const statePayload = {
        action,
        lastActionTime: Date.now(),
        isPlaying: extraFields.isPlaying !== undefined ? extraFields.isPlaying : isPlaying,
        currentIndex: extraFields.currentIndex !== undefined ? extraFields.currentIndex : currentIndex,
        elapsedTimeMs: extraFields.elapsedTimeMs !== undefined ? extraFields.elapsedTimeMs : elapsedTimeMs,
        isHolding: extraFields.isHolding !== undefined ? extraFields.isHolding : isHolding,
        scriptText,
        wpm,
        autoPacing,
        mode,
        maxWordsPerPhrase,
        punctuationDurations,
        visualConfig,
        ...extraFields
      };
      await updateDoc(docRef, {
        state: statePayload,
        lastUpdated: Date.now()
      });
    } catch (e) {
      console.error("Gagal mengirim sinkronisasi PREMO via Firestore", e);
    }
  };

  const handleTogglePlay = () => {
    togglePlay();
    if (premoRole === "controller" && premoPaired) {
      broadcastPremoState(isPlaying ? "pause" : "play", {
        isPlaying: !isPlaying,
        currentIndex,
        elapsedTimeMs
      });
    }
  };

  const handlePause = () => {
    pause();
    if (premoRole === "controller" && premoPaired) {
      broadcastPremoState("pause", {
        isPlaying: false,
        currentIndex,
        elapsedTimeMs
      });
    }
  };

  const handlePlay = () => {
    play();
    if (premoRole === "controller" && premoPaired) {
      broadcastPremoState("play", {
        isPlaying: true,
        currentIndex,
        elapsedTimeMs
      });
    }
  };

  const handleReset = () => {
    reset();
    if (premoRole === "controller" && premoPaired) {
      broadcastPremoState("reset", {
        isPlaying: false,
        currentIndex: 0,
        elapsedTimeMs: 0
      });
    }
  };

  const handleSkipNext = () => {
    skipNext();
    if (premoRole === "controller" && premoPaired) {
      const nextIndex = Math.min(words.length - 1, currentIndex + 1);
      broadcastPremoState("skipNext", {
        currentIndex: nextIndex,
        elapsedTimeMs: words[nextIndex]?.startTimeMs || 0
      });
    }
  };

  const handleSkipPrev = () => {
    skipPrev();
    if (premoRole === "controller" && premoPaired) {
      const prevIndex = Math.max(0, currentIndex - 1);
      broadcastPremoState("skipPrev", {
        currentIndex: prevIndex,
        elapsedTimeMs: words[prevIndex]?.startTimeMs || 0
      });
    }
  };

  const handleSetIndex = (idx: number) => {
    setIndex(idx);
    if (premoRole === "controller" && premoPaired) {
      broadcastPremoState("setIndex", {
        currentIndex: idx,
        elapsedTimeMs: words[idx]?.startTimeMs || 0
      });
    }
  };

  // RESTART LOGIC
  const handleRestartTake = () => {
    setShowRestartDialog(false);
    if (isRecording) {
      discardRecordingRef.current = true;
      stopRecording();
    }
    handleReset();
    if (isCameraActive) {
      setCountdown(3);
    }
  };

  // RECORDING LOGIC
  const startRecording = () => {
    if (!mediaStreamRef.current) return;
    recordedChunksRef.current = [];
    try {
      let streamToRecord: MediaStream = mediaStreamRef.current;
      
      const needsCanvas = isMirrored || videoConfig.ratio !== "16:9";
      
      if (needsCanvas && videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        
        if (ctx) {
          const vw = video.videoWidth || 1280;
          const vh = video.videoHeight || 720;
          
          let targetRatio = 16 / 9;
          if (videoConfig.ratio === "9:16") targetRatio = 9 / 16;
          else if (videoConfig.ratio === "3:4") targetRatio = 3 / 4;
          else if (videoConfig.ratio === "4:5") targetRatio = 4 / 5;
          else if (videoConfig.ratio === "1:1") targetRatio = 1;
          
          let cw = vw;
          let ch = vh;
          
          if (vw / vh > targetRatio) {
            cw = vh * targetRatio;
          } else {
            ch = vw / targetRatio;
          }
          
          canvas.width = cw;
          canvas.height = ch;
          
          const srcX = (vw - cw) / 2;
          const srcY = (vh - ch) / 2;
          
          const draw = () => {
            if (!video.paused && !video.ended) {
              ctx.save();
              if (isMirrored) {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
              }
              ctx.drawImage(video, srcX, srcY, cw, ch, 0, 0, canvas.width, canvas.height);
              ctx.restore();
            }
            drawLoopRef.current = requestAnimationFrame(draw);
          };
          draw();
          
          const canvasStream = canvas.captureStream(videoConfig.fps);
          streamToRecord = new MediaStream([
            ...canvasStream.getVideoTracks(),
            ...mediaStreamRef.current.getAudioTracks()
          ]);
        }
      }

      let options: MediaRecorderOptions = { mimeType: "video/webm; codecs=vp8,opus" };
      if (videoConfig.codec === "mp4") {
        if (MediaRecorder.isTypeSupported("video/mp4")) {
          options = { mimeType: "video/mp4" };
        } else if (MediaRecorder.isTypeSupported("video/mp4; codecs=avc1")) {
          options = { mimeType: "video/mp4; codecs=avc1" };
        } else {
          console.warn("MP4 not supported by MediaRecorder, falling back to WebM");
        }
      }

      let recorder: MediaRecorder;
      if (MediaRecorder.isTypeSupported(options.mimeType)) {
        recorder = new MediaRecorder(streamToRecord, options);
      } else {
        recorder = new MediaRecorder(streamToRecord);
      }
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (drawLoopRef.current) {
          cancelAnimationFrame(drawLoopRef.current);
          drawLoopRef.current = null;
        }
        if (discardRecordingRef.current) {
          discardRecordingRef.current = false;
          return;
        }
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
        setShowPreviewModal(true);
        if (drawLoopRef.current) {
          cancelAnimationFrame(drawLoopRef.current);
          drawLoopRef.current = null;
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      
      if (!isPlaying) {
        handleTogglePlay(); // Start prompter
      }
    } catch (e) {
      console.error("Recording start error:", e);
      alert("Gagal memulai perekaman. Format mungkin tidak didukung.");
    }
  };

  const stopRecording = () => {
    if (drawLoopRef.current) {
      cancelAnimationFrame(drawLoopRef.current);
      drawLoopRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (isPlaying) {
      handleTogglePlay(); // Stop prompter
    }
  };

  // Auto Pause/Resume Recording on [hold] tags
  useEffect(() => {
    if (isRecording && mediaRecorderRef.current) {
      if (isHolding) {
        if (mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.pause();
        }
      } else {
        if (mediaRecorderRef.current.state === "paused") {
          mediaRecorderRef.current.resume();
        }
      }
    }
  }, [isHolding, isRecording]);

  // Countdown Timer sebelum perekaman
  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCountdown(null);
      startRecording();
    }
  }, [countdown]);

  // Countdown Timer untuk LANJUTKAN (Resume dari Hold)
  useEffect(() => {
    if (resumeCountdown === null) return;
    if (resumeCountdown > 0) {
      const timer = setTimeout(() => setResumeCountdown(resumeCountdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setResumeCountdown(null);
      handleSkipNext();
    }
  }, [resumeCountdown]);

  // Auto Stop Recording saat naskah selesai (jeda 3 detik)
  useEffect(() => {
    if (isRecording && !isPlaying && !isHolding && words.length > 0 && currentIndex >= words.length - 1) {
      const timer = setTimeout(() => {
        stopRecording();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isPlaying, currentIndex, isRecording, words.length, isHolding]);

  const handlePremoDisconnect = async () => {
    if (premoCode) {
      try {
        const docRef = doc(db, "premoSessions", premoCode);
        await deleteDoc(docRef);
      } catch (e) {
        console.error("Error deleting session on disconnect", e);
      }
    }
    setPremoRole("none");
    setPremoCode("");
    setPremoPaired(false);
    setPremoError("");
    setPremoMonitorInput("");
    setIsFocusMode(false);
  };

  const handleRegisterController = async () => {
    setPremoLoading(true);
    setPremoError("");
    try {
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      const docRef = doc(db, "premoSessions", code);
      const initialState = {
        action: "init",
        lastActionTime: Date.now(),
        isPlaying,
        currentIndex,
        elapsedTimeMs,
        isHolding,
        scriptText,
        wpm,
        autoPacing,
        mode,
        maxWordsPerPhrase,
        punctuationDurations,
        visualConfig
      };
      await setDoc(docRef, {
        code,
        isPaired: false,
        state: initialState,
        lastUpdated: Date.now()
      });
      setPremoCode(code);
      setPremoRole("controller");
      setPremoPaired(false);
      setPremoShowSetup(true);
    } catch (e) {
      console.error("Error registering controller via Firestore", e);
      setPremoError("Koneksi Firebase gagal. Pastikan terhubung internet.");
    } finally {
      setPremoLoading(false);
    }
  };

  const handlePairMonitor = async () => {
    if (premoMonitorInput.length < 4) return;
    setPremoLoading(true);
    setPremoError("");
    try {
      const docRef = doc(db, "premoSessions", premoMonitorInput);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        setPremoError("Kode pairing tidak ditemukan. Silakan periksa kembali.");
        setPremoLoading(false);
        return;
      }
      const data = docSnap.data();
      if (data.isPaired) {
        setPremoError("Sesi ini sudah terhubung dengan monitor lain.");
        setPremoLoading(false);
        return;
      }
      await updateDoc(docRef, {
        isPaired: true,
        lastUpdated: Date.now()
      });
      setPremoCode(premoMonitorInput);
      setPremoPaired(true);
      setPremoShowSetup(false);
      setIsFocusMode(true);
    } catch (e) {
      console.error("Error pairing monitor via Firestore", e);
      setPremoError("Gagal terhubung ke database. Silakan coba lagi.");
    } finally {
      setPremoLoading(false);
    }
  };

  // Controller pairing and status snapshot listener
  useEffect(() => {
    if (premoRole !== "controller" || !premoCode) return;

    const docRef = doc(db, "premoSessions", premoCode);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (!snapshot.exists()) {
        if (premoPaired) {
          handlePremoDisconnect();
        }
        return;
      }
      const data = snapshot.data();
      if (data.isPaired && !premoPaired) {
        setPremoPaired(true);
        setPremoShowSetup(false);
        // Sync our latest config to make sure the monitor is up to date
        broadcastPremoState("init", {
          scriptText,
          wpm,
          autoPacing,
          mode,
          maxWordsPerPhrase,
          punctuationDurations,
          visualConfig
        });
      }
    }, (error) => {
      console.error("Error in controller snapshot listener:", error);
    });

    return () => unsubscribe();
  }, [premoRole, premoCode, premoPaired]);

  // Controller periodic status sync when playing to prevent timing drift
  useEffect(() => {
    if (premoRole === "controller" && premoPaired && isPlaying) {
      const interval = setInterval(() => {
        broadcastPremoState("sync", {
          isPlaying: true,
          currentIndex,
          elapsedTimeMs
        });
      }, 2500);
      return () => clearInterval(interval);
    }
  }, [premoRole, premoPaired, isPlaying, currentIndex, elapsedTimeMs]);

  // Controller config change sync
  useEffect(() => {
    if (premoRole === "controller" && premoPaired && premoCode) {
      const timer = setTimeout(() => {
        broadcastPremoState("config", {
          scriptText,
          wpm,
          autoPacing,
          mode,
          maxWordsPerPhrase,
          punctuationDurations,
          visualConfig
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [scriptText, wpm, autoPacing, mode, maxWordsPerPhrase, punctuationDurations, visualConfig, premoRole, premoPaired, premoCode]);

  // Monitor realtime sync listener
  const lastActionTimeRef = useRef<number>(0);

  // Store actions in ref to prevent snapshot listener resubscription during playback
  const prompterActionsRef = useRef({
    play,
    pause,
    reset,
    setIndex,
    setExactTime,
    skipNext,
    skipPrev,
    handlePremoDisconnect
  });

  useEffect(() => {
    prompterActionsRef.current = {
      play,
      pause,
      reset,
      setIndex,
      setExactTime,
      skipNext,
      skipPrev,
      handlePremoDisconnect
    };
  });

  useEffect(() => {
    if (premoRole !== "monitor" || !premoPaired || !premoCode) return;

    const docRef = doc(db, "premoSessions", premoCode);
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (!snapshot.exists()) {
        prompterActionsRef.current.handlePremoDisconnect();
        return;
      }
      const data = snapshot.data();
      if (!data.isPaired) {
        prompterActionsRef.current.handlePremoDisconnect();
        return;
      }
      const remote = data.state;
      if (!remote) return;

      // 1. Synchronize script text and visual settings
      setScriptText((prev) => (remote.scriptText !== undefined && remote.scriptText !== prev ? remote.scriptText : prev));
      setWpm((prev) => (remote.wpm !== undefined && remote.wpm !== prev ? remote.wpm : prev));
      setAutoPacing((prev) => (remote.autoPacing !== undefined && remote.autoPacing !== prev ? remote.autoPacing : prev));
      setMode((prev) => (remote.mode !== undefined && remote.mode !== prev ? remote.mode : prev));
      setMaxWordsPerPhrase((prev) => (remote.maxWordsPerPhrase !== undefined && remote.maxWordsPerPhrase !== prev ? remote.maxWordsPerPhrase : prev));
      setPunctuationDurations((prev) => {
        if (remote.punctuationDurations !== undefined && JSON.stringify(remote.punctuationDurations) !== JSON.stringify(prev)) {
          return remote.punctuationDurations;
        }
        return prev;
      });
      setVisualConfig((prev) => {
        if (remote.visualConfig !== undefined && JSON.stringify(remote.visualConfig) !== JSON.stringify(prev)) {
          return remote.visualConfig;
        }
        return prev;
      });

      // 2. Process remote actions with sub-second latency compensation
      const now = Date.now();
      const latencyMs = remote.lastActionTime ? Math.max(0, Math.min(now - remote.lastActionTime, 3000)) : 0;

      if (remote.lastActionTime && remote.lastActionTime > lastActionTimeRef.current) {
        lastActionTimeRef.current = remote.lastActionTime;
        const { reset, setExactTime } = prompterActionsRef.current;
        const action = remote.action;

        if (action === "play") {
          const targetElapsed = (remote.elapsedTimeMs ?? 0) + latencyMs;
          setExactTime(targetElapsed, true);
        } else if (action === "pause") {
          const targetElapsed = remote.elapsedTimeMs ?? 0;
          setExactTime(targetElapsed, false);
        } else if (action === "reset") {
          reset();
        } else if (action === "skipNext" || action === "skipPrev" || action === "setIndex" || action === "sync" || action === "init") {
          const targetElapsed = (remote.elapsedTimeMs ?? 0) + (remote.isPlaying ? latencyMs : 0);
          setExactTime(targetElapsed, remote.isPlaying);
        }
      } else if (remote.isPlaying) {
        // Continuous latency drift correction during playback
        const { setExactTime } = prompterActionsRef.current;
        const expectedElapsed = (remote.elapsedTimeMs ?? 0) + latencyMs;
        if (Math.abs(expectedElapsed - elapsedTimeMs) > 120) {
          setExactTime(expectedElapsed, true);
        }
      }
    }, (error) => {
      console.error("Error in monitor snapshot listener:", error);
      prompterActionsRef.current.handlePremoDisconnect();
    });

    return () => unsubscribe();
  }, [premoRole, premoPaired, premoCode, elapsedTimeMs]);

  // 6. Global keyboard listener (Bypassed when typing in inputs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement).tagName;
      if (targetTag === "TEXTAREA" || targetTag === "INPUT") {
        return;
      }

      // Overriding shortcuts for PREMO Controller mode as requested
      if (premoRole === "controller" && premoPaired) {
        switch (e.key) {
          case "ArrowUp":
            e.preventDefault();
            handleReset();
            break;
          case "ArrowDown":
            e.preventDefault();
            handlePause();
            break;
          case "ArrowLeft":
            e.preventDefault();
            handleSkipPrev();
            break;
          case "ArrowRight":
            e.preventDefault();
            handleSkipNext();
            break;
          default:
            break;
        }
        return;
      }

      switch (e.key) {
        case " ":
          e.preventDefault();
          handleTogglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          handleSkipNext();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handleSkipPrev();
          break;
        case "Escape":
          e.preventDefault();
          handleReset();
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
  }, [handleTogglePlay, handleSkipNext, handleSkipPrev, handleReset, handlePause, setIsFocusMode, premoRole, premoPaired, words, currentIndex]);

  return (
    <div className="min-h-screen bg-[#09090b] text-neutral-100 flex flex-col font-sans" id="rhythmprompter-app-root">
      {/* FLOATING CONTROLS (ONLY IN FOCUS MODE) - Moves to bottom if prompter is dragged/shifted upwards */}
      {isFocusMode && premoRole !== "monitor" && (
        <div
          className={`fixed right-4 z-50 flex items-center gap-2 transition-all duration-300 ${focusDragOffset < -50 ? "bottom-4 animate-slideUp" : "top-4"
            }`}
          id="focus-mode-floating-controls"
        >
          {isCameraActive && (
            <button
              onClick={() => setShowRestartDialog(true)}
              className="w-10 h-10 flex items-center justify-center rounded-none border transition active:scale-95 shadow-lg bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700"
              title="Ulangi dari Awal"
            >
              <RotateCcw className="w-4 h-4 transition-transform duration-300" />
            </button>
          )}

          {isCameraActive && !isRecording && (
            <button
              onClick={() => setIsMirrored(prev => !prev)}
              className="w-10 h-10 flex items-center justify-center rounded-none border transition active:scale-95 shadow-lg bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700"
              title={isMirrored ? "Matikan Efek Mirror" : "Nyalakan Efek Mirror"}
            >
              <FlipHorizontal className={`w-4 h-4 transition-transform duration-300 ${isMirrored ? "text-emerald-400" : ""}`} />
            </button>
          )}

          {isCameraActive && isHolding && (
            <button
              id="btn-resume-hold"
              onClick={() => setResumeCountdown(3)}
              className="w-10 h-10 flex items-center justify-center rounded-none border transition active:scale-95 shadow-lg bg-amber-500 text-neutral-950 border-amber-400 hover:bg-amber-400 animate-pulse"
              title="Lanjutkan dari Tag Hold"
            >
              <Play className="w-4 h-4 fill-current" />
            </button>
          )}

          {isCameraActive && (
            <button
              id="btn-toggle-record"
              onClick={isRecording ? stopRecording : () => setCountdown(3)}
              className={`w-10 h-10 flex items-center justify-center rounded-none border transition active:scale-95 shadow-lg ${
                isRecording
                  ? "bg-red-600 text-white border-red-500 hover:bg-red-500 animate-pulse"
                  : "bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500"
              }`}
              title={isRecording ? "Stop Perekaman" : "Mulai Rekam Video"}
            >
              {isRecording ? (
                <Square className="w-4 h-4 fill-current" />
              ) : (
                <Circle className="w-4 h-4 fill-current" />
              )}
            </button>
          )}

          <button
            id="btn-toggle-camera"
            onClick={toggleCameraMode}
            className={`w-10 h-10 flex items-center justify-center rounded-none border transition active:scale-95 ${
              isCameraActive 
                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30"
                : "bg-neutral-900 border-neutral-700 text-neutral-200 hover:bg-neutral-800 hover:text-white"
            }`}
            title={isCameraActive ? "Matikan Kamera" : "Aktifkan Kamera"}
          >
            {isCameraActive ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          {/* [UI-NONPROGRAMMER] Tombol aksi layar penuh. Ubah warna hover pada 'hover:bg-neutral-800' jika perlu. */}
          <button
            id="btn-toggle-fullscreen"
            onClick={toggleFullscreen}
            className="w-10 h-10 flex items-center justify-center bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white rounded-none border border-neutral-700 transition active:scale-95"
            title={isFullscreen ? "Keluar Layar Penuh" : "Masuk Layar Penuh"}
          >
            {isFullscreen ? (
              <Minimize className="w-5 h-5 text-emerald-400" />
            ) : (
              <Maximize className="w-5 h-5 text-emerald-400" />
            )}
          </button>

          {/* [UI-NONPROGRAMMER] Tombol Konfigurasi Video */}
          <button
            onClick={() => setShowVideoConfigModal(true)}
            className="w-10 h-10 flex items-center justify-center bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white rounded-none border border-neutral-700 transition active:scale-95"
            title="Pengaturan Video"
          >
            <Video className="w-5 h-5 text-emerald-400" />
          </button>

          {/* [UI-NONPROGRAMMER] Tombol aksi keluar mode fokus. Ubah warna hover pada 'hover:bg-neutral-800' jika perlu. */}
          <button
            id="btn-exit-focus"
            onClick={() => setIsFocusMode(false)}
            className="w-10 h-10 flex items-center justify-center bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white rounded-none border border-neutral-700 transition active:scale-95"
            title="Buka Konfigurasi (Keluar Focus Mode)"
          >
            <Settings className="w-5 h-5 text-emerald-400 animate-spin" style={{ animationDuration: "12s" }} />
          </button>
        </div>
      )}

      {/* PREMO MONITOR MODE EXCLUSIVE FLOATING BAR */}
      {isFocusMode && premoRole === "monitor" && premoPaired && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-neutral-950/95 border border-neutral-800 px-4 py-2 shadow-2xl transition-all duration-300 ${(visualConfig.textPosition === "top" || focusDragOffset < -50) ? "bottom-4 animate-slideUp" : "top-4"
            }`}
          id="premo-monitor-bar"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 tracking-wider uppercase select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            PAIRED
          </div>
          <span className="w-px h-4 bg-neutral-800" />
          <button
            onClick={toggleFullscreen}
            className="p-1.5 text-neutral-400 hover:text-white transition active:scale-95 cursor-pointer"
            title={isFullscreen ? "Keluar Layar Penuh" : "Masuk Layar Penuh"}
            id="premo-monitor-fullscreen-btn"
          >
            {isFullscreen ? (
              <Minimize className="w-4 h-4 text-emerald-400" />
            ) : (
              <Maximize className="w-4 h-4 text-emerald-400" />
            )}
          </button>
          <button
            onClick={handlePremoDisconnect}
            className="p-1.5 text-neutral-400 hover:text-red-400 transition active:scale-95 cursor-pointer"
            title="Putuskan Hubungan"
            id="premo-monitor-disconnect-btn"
          >
            <RotateCcw className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}

      {/* BRAND HEADER BAR */}
      {!isFocusMode && (
        <header className="border-b border-neutral-800 bg-[#0c0c0e] px-4 md:px-8 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4" id="app-main-header">
          <div className="flex items-center justify-between md:justify-start gap-4">
            <div className="flex items-center gap-3">
              <img src="/favicon.png" alt="RePrompter Logo" className="w-8 h-8 rounded-none object-contain shadow-[0_0_15px_rgba(16,185,129,0.15)]" id="brand-logo-icon" />
              <div>
                <h1 className="text-sm font-extrabold tracking-tight text-neutral-100 flex items-center gap-1.5">
                  RePrompter
                  <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded-none font-bold border border-emerald-800">
                    PRO v1.2
                  </span>
                </h1>
                <p className="text-[11px] text-neutral-500 font-medium">Modular speech-paced teleprompter engine</p>
              </div>
            </div>

            {/* PREMO Mode Actions in Header */}
            <div className="flex items-center gap-2">
              {premoRole === "none" && (
                <button
                  id="btn-premo-setup"
                  onClick={() => setPremoShowSetup(true)}
                  className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 hover:text-purple-200 border border-purple-850 hover:border-purple-700 transition flex items-center gap-2 active:scale-95 cursor-pointer shadow"
                >
                  <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
                  PREMO Mode
                </button>
              )}

              {premoRole === "controller" && !premoPaired && (
                <div className="flex items-center gap-2 bg-purple-950/50 text-purple-300 border border-purple-800 px-3 py-1.5 text-xs font-bold uppercase tracking-wider" id="premo-pairing-header">
                  <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" />
                  PAIRING CODE: {premoCode}
                  <button
                    onClick={handlePremoDisconnect}
                    className="ml-2 pl-2 border-l border-purple-800 hover:text-red-400 font-bold transition text-xs cursor-pointer"
                    title="Batal Pairing"
                  >
                    BATAL
                  </button>
                </div>
              )}

              {premoRole === "controller" && premoPaired && (
                <div className="flex items-center gap-2 bg-emerald-950/50 text-emerald-300 border border-emerald-800/80 px-3 py-1.5 text-xs font-bold uppercase tracking-wider" id="premo-paired-header">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  PAIRED: {premoCode}
                  <button
                    onClick={handlePremoDisconnect}
                    className="ml-2 pl-2 border-l border-emerald-800 hover:text-red-400 font-bold transition text-xs cursor-pointer"
                    title="Putuskan Hubungan"
                  >
                    DISCONNECT
                  </button>
                </div>
              )}
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

        {isCameraActive && isFocusMode && (
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none flex items-center justify-center">
            <div 
              style={{ aspectRatio: videoConfig.ratio.replace(":", "/") }}
              className="relative max-w-full max-h-full h-full overflow-hidden"
            >
              <video 
                ref={videoRef}
                autoPlay 
                muted 
                playsInline 
                className={`w-full h-full object-cover opacity-60 ${isMirrored ? "-scale-x-100" : ""}`}
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>
          </div>
        )}

        {(countdown !== null || resumeCountdown !== null) && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-black/60 backdrop-blur-sm">
            <span className="text-[12rem] md:text-[16rem] font-black text-emerald-400 drop-shadow-[0_0_40px_rgba(16,185,129,0.8)] animate-pulse select-none">
              {countdown !== null
                ? (countdown > 0 ? countdown : "START!")
                : (resumeCountdown !== null && resumeCountdown > 0 ? resumeCountdown : "LANJUT!")}
            </span>
          </div>
        )}

        {/* LEFT COLUMN: ACTIVE VIEW (CAMERA PREVIEW + TELEPROMPTER OVERLAY) - (Span 7 / Full in Focus Mode) */}
        <section
          className={isFocusMode ? "w-full flex flex-col gap-5 justify-center transition-transform duration-75 ease-out" : "lg:col-span-7 flex flex-col gap-4"}
          style={isFocusMode ? { transform: `translateY(${focusDragOffset}px)` } : undefined}
          id="left-prompter-column"
        >

          {!isFocusMode && (
            <div className="flex items-center justify-between px-1" id="prompter-section-header">
              <h2 className="text-xs text-neutral-500 flex items-center gap-1.5">
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
                  <span>Mode Fokus</span>
                </button>
              </div>
            </div>
          )}

          {/* Teleprompter Visual Canvas */}
          <PrompterDisplay
            mode={mode}
            words={words}
            phrases={phrases}
            currentIndex={currentIndex}
            elapsedTimeMs={elapsedTimeMs}
            isPlaying={isPlaying}
            isHolding={isHolding}
            visualConfig={visualConfig}
            onTriggerNext={handleSkipNext}
            onTriggerPrev={handleSkipPrev}
            onHoldActive={setGestureHolding}
            onTogglePlay={handleTogglePlay}
            isFocusMode={isFocusMode}
            onDragStart={handleFocusDragStart}
            onDragMove={handleFocusDragMove}
            onDragEnd={handleFocusDragEnd}
            onDoubleClick={handleFocusDoubleClick}
          />

          {/* LOWER CONTROLLER HUB */}
          {!isCameraActive && (!isFocusMode || premoRole !== "monitor") && (
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
                  onClick={handleSkipPrev}
                  disabled={currentIndex === 0}
                  className="w-12 h-12 flex items-center justify-center bg-neutral-950 border border-neutral-800/80 text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 rounded-none transition active:scale-95 shadow-md"
                  title="Sebelumnya"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                <button
                  id="btn-nav-play-toggle"
                  onClick={handleTogglePlay}
                  className={`px-8 py-2.5 h-12 font-bold text-xs rounded-none transition active:scale-95 flex items-center gap-2.5 shadow-xl uppercase tracking-wider ${isPlaying
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
                  onClick={handleSkipNext}
                  disabled={words.length === 0}
                  className="w-12 h-12 flex items-center justify-center bg-neutral-950 border border-neutral-800/80 text-neutral-400 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-400 rounded-none transition active:scale-95 shadow-md"
                  title={isHolding ? "Lompati Hold" : "Selanjutnya"}
                >
                  <ChevronRight className="w-6 h-6" />
                </button>

                <button
                  id="btn-nav-reset"
                  onClick={handleReset}
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
          )}
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
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-none transition-all ${activeTab === tab.id
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
                  punctuationDurations={punctuationDurations}
                  onChangePunctuationDurations={setPunctuationDurations}
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
                  phraseHighlightType={visualConfig.phraseHighlightType || "word"}
                  onChangePhraseHighlightType={(type) =>
                    setVisualConfig((prev) => ({ ...prev, phraseHighlightType: type }))
                  }
                  disableWordHighlight={!!visualConfig.disableWordHighlight}
                  onChangeDisableWordHighlight={(disable) =>
                    setVisualConfig((prev) => ({ ...prev, disableWordHighlight: disable }))
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
                          className={`w-8 h-8 rounded-none transition relative ${visualConfig.highlightColor === color.hex
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
                          className={`py-1.5 rounded-none text-xs font-semibold border transition ${visualConfig.textPosition === item.pos
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
                          className={`py-1.5 rounded-none text-xs font-semibold border transition ${visualConfig.fontFamily === item.family
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
                          className={`py-2 px-3 rounded-none text-xs font-semibold border text-left transition ${visualConfig.theme === theme.id
                            ? "bg-neutral-900 border-emerald-500 text-emerald-300"
                            : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700"
                            }`}
                        >
                          {theme.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fitur Pratinjau Teks Selanjutnya */}
                  <div className="flex flex-col gap-3 bg-neutral-950 p-3 rounded-none border border-neutral-800" id="show-next-preview-toggle-container">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-neutral-300">Tampilkan Frasa/Kata Selanjutnya</span>
                        <span className="text-[10px] text-neutral-500 leading-tight">Menampilkan teks berikutnya di bawah kata/frasa utama (opacity 50%)</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          id="show-next-preview-checkbox"
                          type="checkbox"
                          checked={!!visualConfig.showNextPreview}
                          onChange={(e) =>
                            setVisualConfig((prev) => ({ ...prev, showNextPreview: e.target.checked }))
                          }
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-none peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-300 after:border-neutral-300 after:border after:rounded-none after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white" />
                      </label>
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

            {/* SET DEFAULT ACTION BANNER */}
            <div className="bg-neutral-950/40 border border-neutral-800/60 p-4 rounded-none flex items-center justify-between gap-4" id="set-default-banner">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-neutral-300">Setelan Bawaan (Default)</span>
                <span className="text-[10px] text-neutral-500 leading-normal">
                  Simpan tempo, pacing, mode, dan gaya saat ini sebagai bawaan aplikasi.
                </span>
              </div>
              <button
                onClick={saveAsDefault}
                className={`px-4 py-2 font-bold text-xs uppercase tracking-wider transition-all duration-300 active:scale-95 whitespace-nowrap ${showSaveSuccess
                  ? "bg-emerald-500 text-neutral-950"
                  : "bg-neutral-900 text-emerald-400 hover:text-emerald-300 border border-neutral-800 hover:border-neutral-700"
                  }`}
                id="btn-set-default"
              >
                {showSaveSuccess ? "Tersimpan! ✓" : "Set Default"}
              </button>
            </div>
          </section>
        )}

      </main>

      {/* FOOTER */}
      <Footer isFocusMode={isFocusMode} />

      {/* PREMO SETUP MODAL */}
      {premoShowSetup && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-fadeIn" id="premo-setup-overlay">
          {/* [UI-NONPROGRAMMER] Overlay setup dialog. Di atas adalah wrapper latar belakang modal. */}
          <div className="w-full max-w-md bg-neutral-950 border border-neutral-800 p-6 shadow-2xl relative" id="premo-setup-modal">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-5" id="premo-modal-header">
              <div className="flex items-center gap-2">
                <Tv className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-extrabold text-neutral-100 tracking-wider uppercase">PREMO (Previewer & Monitor)</h3>
              </div>
              <button
                onClick={() => {
                  setPremoShowSetup(false);
                  setPremoError("");
                }}
                className="text-neutral-500 hover:text-neutral-300 font-bold text-xs p-1 cursor-pointer"
                id="premo-modal-close"
              >
                TUTUP
              </button>
            </div>

            {/* Error messaging */}
            {premoError && (
              <div className="mb-4 p-3 bg-red-950/40 border border-red-900/60 text-red-300 text-xs font-bold rounded-none" id="premo-error-msg">
                {premoError}
              </div>
            )}

            {/* Role selection screen (when role is none) */}
            {premoRole === "none" && (
              <div className="flex flex-col gap-5" id="premo-role-selector">
                <p className="text-xs text-neutral-400 leading-relaxed font-medium">
                  Hubungkan dua perangkat secara nirkabel untuk mengontrol prompter jarak jauh. Satu perangkat bertindak sebagai <strong className="text-purple-300 font-semibold">KONTROLER</strong>, dan perangkat lainnya bertindak sebagai <strong className="text-emerald-400 font-semibold">MONITOR</strong>.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  {/* Controller card option */}
                  <button
                    onClick={handleRegisterController}
                    disabled={premoLoading}
                    className="flex flex-col items-center gap-3 p-5 border border-purple-900/50 hover:border-purple-600 bg-purple-950/20 hover:bg-purple-950/40 text-purple-300 hover:text-white rounded-none transition active:scale-95 text-center group disabled:opacity-50 cursor-pointer"
                    id="premo-opt-controller"
                  >
                    <Gamepad2 className="w-8 h-8 text-purple-400 group-hover:scale-110 transition duration-300" />
                    <div>
                      <span className="block text-xs font-bold uppercase tracking-wider">KONTROLER</span>
                      <span className="block text-[10px] text-neutral-500 mt-1 leading-normal font-medium">Device utama untuk navigasi & play/pause</span>
                    </div>
                  </button>

                  {/* Monitor card option */}
                  <button
                    onClick={() => {
                      setPremoRole("monitor");
                      setPremoError("");
                    }}
                    className="flex flex-col items-center gap-3 p-5 border border-emerald-900/40 hover:border-emerald-600 bg-emerald-950/10 hover:bg-emerald-950/20 text-emerald-400 hover:text-white rounded-none transition active:scale-95 text-center group cursor-pointer"
                    id="premo-opt-monitor"
                  >
                    <Smartphone className="w-8 h-8 text-emerald-400 group-hover:scale-110 transition duration-300" />
                    <div>
                      <span className="block text-xs font-bold uppercase tracking-wider">MONITOR</span>
                      <span className="block text-[10px] text-neutral-500 mt-1 leading-normal font-medium">Device layar prompter (Fokus Mode)</span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Controller screen: showing generated pairing code */}
            {premoRole === "controller" && (
              <div className="flex flex-col items-center text-center gap-4 py-3" id="premo-controller-setup">
                <span className="text-[10px] bg-purple-950 text-purple-300 px-2 py-0.5 border border-purple-800 font-bold uppercase tracking-widest">KONTROLER MODE</span>
                <p className="text-xs text-neutral-400 leading-normal max-w-xs">
                  Buka PREMO di device kedua, pilih <strong className="text-emerald-400 font-semibold">MONITOR</strong>, lalu masukkan kode berikut untuk menghubungkan:
                </p>

                {premoLoading ? (
                  <div className="h-16 flex items-center justify-center font-mono font-bold text-neutral-500 animate-pulse" id="premo-controller-loading">
                    MEMBUAT KODE...
                  </div>
                ) : (
                  <div className="bg-neutral-900 border border-neutral-800 px-8 py-4 font-mono font-extrabold text-3xl tracking-[0.5em] text-neutral-100 select-all" id="premo-pairing-code-display">
                    {premoCode || "----"}
                  </div>
                )}

                <div className="flex items-center gap-2 text-[10px] text-neutral-500 animate-pulse mt-1" id="premo-controller-status-tip">
                  <span className="w-1.5 h-1.5 bg-purple-400 rounded-full" />
                  Menunggu device monitor terhubung...
                </div>

                <button
                  onClick={handlePremoDisconnect}
                  className="mt-4 px-4 py-2 text-xs font-bold uppercase tracking-wider border border-neutral-800 hover:border-neutral-700 hover:text-white text-neutral-400 rounded-none transition active:scale-95 cursor-pointer"
                  id="premo-cancel-pairing"
                >
                  BATAL & RESET
                </button>
              </div>
            )}

            {/* Monitor screen: input pairing code */}
            {premoRole === "monitor" && (
              <div className="flex flex-col items-center text-center gap-4 py-3" id="premo-monitor-setup">
                <span className="text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 border border-emerald-800 font-bold uppercase tracking-widest">MONITOR MODE</span>
                <p className="text-xs text-neutral-400 leading-normal max-w-xs">
                  Masukkan 4 digit kode pairing yang tampil di layar perangkat <strong className="text-purple-300 font-semibold">KONTROLER</strong>:
                </p>

                <input
                  type="text"
                  maxLength={4}
                  value={premoMonitorInput}
                  onChange={(e) => {
                    const cleanValue = e.target.value.replace(/[^0-9]/g, "");
                    setPremoMonitorInput(cleanValue);
                    setPremoError("");
                  }}
                  placeholder="0000"
                  className="bg-neutral-900 border-2 border-neutral-800 focus:border-emerald-500 text-center text-3xl font-mono font-extrabold tracking-[0.4em] py-3 text-neutral-100 placeholder-neutral-700 rounded-none focus:outline-none w-48 shadow-inner"
                  id="premo-pairing-input"
                  disabled={premoLoading}
                  autoFocus
                />

                <div className="flex gap-3 w-full mt-3">
                  <button
                    onClick={() => {
                      setPremoRole("none");
                      setPremoMonitorInput("");
                      setPremoError("");
                    }}
                    className="flex-1 py-2.5 text-xs font-bold border border-neutral-800 hover:border-neutral-700 text-neutral-400 rounded-none transition active:scale-95 cursor-pointer"
                    id="premo-monitor-back"
                  >
                    KEMBALI
                  </button>
                  <button
                    onClick={handlePairMonitor}
                    disabled={premoMonitorInput.length < 4 || premoLoading}
                    className="flex-1 py-2.5 text-xs font-bold bg-emerald-500 disabled:bg-neutral-900 text-neutral-950 disabled:text-neutral-600 disabled:border disabled:border-neutral-800 rounded-none transition active:scale-95 cursor-pointer"
                    id="premo-monitor-submit"
                  >
                    {premoLoading ? "MENGHUBUNGKAN..." : "SINKRONISASI"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIDEO PREVIEW MODAL */}
      {showRestartDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 shadow-2xl max-w-sm w-full animate-slideUp">
            <div className="p-6">
              <h2 className="text-xl font-bold text-neutral-100 mb-2">Ulangi Rekaman?</h2>
              <p className="text-sm text-neutral-400 mb-6">
                Apakah Anda yakin ingin mengulang dari awal? Jika Anda sedang merekam, rekaman saat ini akan dihapus secara permanen.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowRestartDialog(false)}
                  className="px-4 py-2 text-sm font-bold bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700 transition"
                >
                  BATAL
                </button>
                <button
                  onClick={handleRestartTake}
                  className="px-4 py-2 text-sm font-bold bg-red-600 text-white border border-red-500 hover:bg-red-500 transition"
                >
                  YA, ULANGI
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIDEO CONFIG MODAL */}
      {showVideoConfigModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 shadow-2xl max-w-md w-full animate-slideUp">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-neutral-100">Pengaturan Video</h2>
                <button onClick={() => setShowVideoConfigModal(false)} className="text-neutral-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-neutral-400">Format (Codec)</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setVideoConfig(p => ({ ...p, codec: "webm" }))}
                      className={`px-3 py-2 text-sm font-bold border transition ${videoConfig.codec === "webm" ? "bg-emerald-600 text-white border-emerald-500" : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700"}`}
                    >.WEBM</button>
                    <button
                      onClick={() => setVideoConfig(p => ({ ...p, codec: "mp4" }))}
                      className={`px-3 py-2 text-sm font-bold border transition ${videoConfig.codec === "mp4" ? "bg-emerald-600 text-white border-emerald-500" : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700"}`}
                    >.MP4</button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-neutral-400">Frame Rate</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[24, 30, 60].map((fps) => (
                      <button
                        key={fps}
                        onClick={() => setVideoConfig(p => ({ ...p, fps: fps as any }))}
                        className={`px-3 py-2 text-sm font-bold border transition ${videoConfig.fps === fps ? "bg-emerald-600 text-white border-emerald-500" : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700"}`}
                      >{fps} FPS</button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-neutral-400">Rasio Aspek</label>
                  <div className="grid grid-cols-3 gap-2">
                    {["16:9", "9:16", "3:4", "4:5", "1:1"].map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => setVideoConfig(p => ({ ...p, ratio: ratio as any }))}
                        className={`px-3 py-2 text-sm font-bold border transition ${videoConfig.ratio === ratio ? "bg-emerald-600 text-white border-emerald-500" : "bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700"}`}
                      >{ratio}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setShowVideoConfigModal(false)}
                  className="px-6 py-2 text-sm font-bold bg-neutral-100 text-neutral-900 hover:bg-white transition"
                >
                  SELESAI
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPreviewModal && recordedVideoUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4">
          <div className="bg-neutral-950 border border-neutral-800 p-4 md:p-6 rounded-none w-full max-w-3xl flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-emerald-400" />
                Preview Hasil Rekaman
              </h3>
              <button 
                onClick={() => {
                  setShowPreviewModal(false);
                  URL.revokeObjectURL(recordedVideoUrl);
                  setRecordedVideoUrl(null);
                }}
                className="text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative w-full aspect-video bg-black border border-neutral-800">
              <video src={recordedVideoUrl} controls className="w-full h-full object-contain" />
            </div>
            <div className="flex justify-end gap-3 mt-2">
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  URL.revokeObjectURL(recordedVideoUrl);
                  setRecordedVideoUrl(null);
                }}
                className="px-4 py-2 text-sm font-bold bg-neutral-900 border border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
              >
                Tutup & Hapus
              </button>
              <a
                href={recordedVideoUrl}
                download={`RePrompter_Record_${new Date().getTime()}.webm`}
                className="px-4 py-2 text-sm font-bold bg-emerald-600 text-neutral-950 hover:bg-emerald-500 transition flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Unduh Video
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
