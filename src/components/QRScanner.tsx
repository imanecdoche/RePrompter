import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { 
  LuCamera as Camera, 
  LuCircleX as XCircle 
} from 'react-icons/lu';

interface QRScannerProps {
  onScan: (data: string) => void;
  onCancel: () => void;
}

export default function QRScanner({ onScan, onCancel }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment" } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true"); // required to tell iOS safari we don't want fullscreen
          videoRef.current.play();
          requestAnimationFrame(tick);
        }
      } catch (err) {
        console.error("Camera access denied:", err);
        setError('Akses kamera ditolak atau kamera tidak ditemukan.');
      }
    };

    const tick = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.height = video.videoHeight;
          canvas.width = video.videoWidth;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            });
            
            if (code) {
              onScan(code.data);
              return; // Stop ticking if found
            }
          }
        }
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [onScan]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 bg-neutral-900 border border-neutral-800 p-4 shadow-xl">
      {error ? (
        <div className="text-red-400 text-xs font-bold bg-red-950/30 p-4 border border-red-900/50 text-center">
          {error}
        </div>
      ) : (
        <div className="relative w-full aspect-square max-w-[240px] bg-black overflow-hidden border-2 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)] group">
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover scale-[1.02]" />
          <canvas ref={canvasRef} className="hidden" />
          {/* Scanning overlay frame */}
          <div className="absolute inset-0 pointer-events-none border-[3px] border-emerald-500/30 m-6 rounded-none z-10" />
          <div className="absolute inset-0 pointer-events-none border-b-2 border-emerald-400/80 animate-[scan_2.5s_ease-in-out_infinite] z-20 shadow-[0_4px_12px_rgba(52,211,153,0.5)]" />
        </div>
      )}
      <div className="flex items-center gap-2 text-xs text-neutral-400">
        <Camera className="w-4 h-4" />
        <span>Arahkan layar QR KONTROLER ke kamera</span>
      </div>
      <button 
        onClick={onCancel}
        className="mt-2 flex items-center justify-center gap-2 w-full py-2 border border-neutral-800 hover:border-red-900/50 hover:bg-red-950/20 text-[10px] uppercase font-bold tracking-wider text-neutral-500 hover:text-red-400 transition cursor-pointer"
      >
        <XCircle className="w-3.5 h-3.5" /> Batal Kamera
      </button>
    </div>
  );
}
