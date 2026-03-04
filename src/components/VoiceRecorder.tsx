"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Command,
  Copy,
  Mic,
  RefreshCw,
  Square,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

type RecorderStatus = "idle" | "recording" | "processing" | "done" | "error";

type ElectronBridge = {
  onToggleRecording?: (callback: () => void) => void;
  setRecordingState?: (isRecording: boolean) => void;
  transcribeAudio?: (
    audioArrayBuffer: ArrayBuffer,
  ) => Promise<{ original?: string; refined?: string }>;
  typeText?: (text: string) => void;
};

declare global {
  interface Window {
    electron?: ElectronBridge;
  }
}

export default function VoiceRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [refinedText, setRefinedText] = useState("");
  const [copied, setCopied] = useState(false);
  const [audioBars, setAudioBars] = useState<number[]>(Array(14).fill(10));
  const [durationMs, setDurationMs] = useState(0);
  const [handsFreeMode, setHandsFreeMode] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const holdSpaceRef = useRef(false);

  const isRecording = status === "recording";
  const isProcessing = status === "processing";

  const stopAudioVisualization = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    analyserRef.current = null;

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => null);
      audioContextRef.current = null;
    }
  }, []);

  const beginAudioVisualization = useCallback((stream: MediaStream) => {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.85;
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const frequencyData = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (!analyserRef.current) {
        return;
      }

      analyserRef.current.getByteFrequencyData(frequencyData);
      const chunkSize = Math.floor(frequencyData.length / 14);

      const bars = Array.from({ length: 14 }, (_, index) => {
        const start = index * chunkSize;
        const end = start + chunkSize;
        const chunk = frequencyData.slice(start, end);
        const average =
          chunk.reduce((sum, value) => sum + value, 0) /
          Math.max(chunk.length, 1);
        return Math.max(8, Math.min(100, Math.round((average / 255) * 100)));
      });

      setAudioBars(bars);
      setDurationMs(Date.now() - recordingStartRef.current);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const sendToGroq = useCallback(async (audioBlob: Blob) => {
    setStatus("processing");

    try {
      let data: { original?: string; refined?: string };

      if (window.electron?.transcribeAudio) {
        const arrayBuffer = await audioBlob.arrayBuffer();
        data = await window.electron.transcribeAudio(arrayBuffer);
      } else {
        const formData = new FormData();
        formData.append("file", audioBlob, "audio.webm");

        const response = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || "Error en servidor de transcripción",
          );
        }

        data = await response.json();
      }

      if (!data?.refined) {
        throw new Error("No se recibió texto refinado");
      }

      setRefinedText(data.refined);

      const saveResponse = await fetch("/api/transcriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_text: data.original || data.refined,
          refined_text: data.refined,
          metadata: { source: "soyvoz-web" },
        }),
      });

      if (!saveResponse.ok) {
        const saveError = await saveResponse.json();
        console.error("No se pudo guardar transcripción:", saveError);
      } else {
        window.dispatchEvent(new CustomEvent("soyvoz:transcription-saved"));
      }

      await navigator.clipboard.writeText(data.refined);
      window.electron?.typeText?.(data.refined);

      setCopied(true);
      setStatus("done");
      toast.success("Texto refinado y copiado.");
      setTimeout(() => setCopied(false), 2200);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error inesperado";
      console.error("Error al procesar audio:", error);
      setStatus("error");
      toast.error(message);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !isRecording) {
      return;
    }

    mediaRecorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    window.electron?.setRecordingState?.(false);
    setStatus("processing");
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    if (isRecording || isProcessing) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorderRef.current = mediaRecorder;
      streamRef.current = stream;
      chunksRef.current = [];
      recordingStartRef.current = Date.now();
      setDurationMs(0);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stopAudioVisualization();

        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        const recordedMs = Date.now() - recordingStartRef.current;

        if (recordedMs < 300) {
          setStatus("idle");
          toast.message("Toque muy corto. Mantén más tiempo para dictar.");
          return;
        }

        await sendToGroq(audioBlob);
      };

      mediaRecorder.start();
      beginAudioVisualization(stream);
      setStatus("recording");
      setRefinedText("");
      window.electron?.setRecordingState?.(true);
      toast.info("Grabando. Suelta Espacio o pulsa detener.");
    } catch (error) {
      console.error("Error al iniciar grabación:", error);
      setStatus("error");
      toast.error("No se pudo acceder al micrófono.");
    }
  }, [
    beginAudioVisualization,
    isProcessing,
    isRecording,
    sendToGroq,
    stopAudioVisualization,
  ]);

  const toggleAction = useCallback(async () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    await startRecording();
  }, [isRecording, startRecording, stopRecording]);

  useEffect(() => {
    const cleanup = () => {
      stopAudioVisualization();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      window.electron?.setRecordingState?.(false);
    };

    window.electron?.onToggleRecording?.(() => {
      toggleAction();
    });

    return cleanup;
  }, [stopAudioVisualization, toggleAction]);

  useEffect(() => {
    const isEditableTarget = (eventTarget: EventTarget | null) => {
      const node = eventTarget as HTMLElement | null;
      if (!node) {
        return false;
      }

      const tag = node.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || node.isContentEditable;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.code !== "Space" ||
        event.repeat ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();

      if (handsFreeMode) {
        toggleAction();
        return;
      }

      holdSpaceRef.current = true;
      if (!isRecording && !isProcessing) {
        startRecording();
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") {
        return;
      }

      if (handsFreeMode) {
        event.preventDefault();
        return;
      }

      if (holdSpaceRef.current && isRecording) {
        event.preventDefault();
        stopRecording();
      }

      holdSpaceRef.current = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    handsFreeMode,
    isProcessing,
    isRecording,
    startRecording,
    stopRecording,
    toggleAction,
  ]);

  const statusLabel: Record<RecorderStatus, string> = {
    idle: "Listo",
    recording: "Grabando",
    processing: "Procesando",
    done: "Completado",
    error: "Error",
  };

  const statusColor: Record<RecorderStatus, string> = {
    idle: "bg-slate-400",
    recording: "bg-red-400",
    processing: "bg-amber-300",
    done: "bg-emerald-300",
    error: "bg-rose-300",
  };

  return (
    <div className="w-full max-w-4xl rounded-[34px] border border-white/10 bg-[#050b13]/85 p-6 md:p-8 shadow-[0_35px_90px_rgba(0,0,0,0.45)]">
      <div className="flex flex-col gap-6">
        <div className="rounded-full border border-white/15 bg-[#071523] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`h-2.5 w-2.5 rounded-full ${statusColor[status]} ${isRecording ? "pill-pulse" : ""}`}
            />
            <p className="text-sm text-slate-200 truncate">
              {statusLabel[status]} ·{" "}
              {isRecording
                ? `${(durationMs / 1000).toFixed(1)}s`
                : "esperando entrada"}
            </p>
          </div>
          <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1 text-xs">
            <button
              onClick={() => setHandsFreeMode(false)}
              className={`px-2.5 py-1 rounded-md transition-colors ${!handsFreeMode ? "bg-sky-400 text-[#031320]" : "text-slate-300 hover:text-white"}`}
            >
              Mantener
            </button>
            <button
              onClick={() => setHandsFreeMode(true)}
              className={`px-2.5 py-1 rounded-md transition-colors ${handsFreeMode ? "bg-amber-300 text-[#1f1502]" : "text-slate-300 hover:text-white"}`}
            >
              Hands-free
            </button>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-300 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1">
            <Command className="w-3.5 h-3.5" />{" "}
            {handsFreeMode ? "Tap Space" : "Mantén Space"}
          </span>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#030913] p-6 md:p-8">
          <div className="flex items-end justify-center gap-1.5 h-20 md:h-24 mb-8">
            {(isRecording
              ? audioBars
              : [8, 10, 14, 20, 26, 21, 15, 11, 14, 24, 29, 20, 12, 9]
            ).map((height, index) => (
              <motion.div
                key={index}
                className="w-2 rounded-full bg-gradient-to-t from-sky-500 via-cyan-400 to-amber-200"
                animate={{
                  height: `${height}%`,
                  opacity: isRecording ? 1 : 0.65,
                }}
                transition={{ duration: 0.16, ease: "easeOut" }}
              />
            ))}
          </div>

          <div className="flex justify-center mb-6">
            <AnimatePresence>
              <motion.button
                key={isRecording ? "stop" : "start"}
                onClick={toggleAction}
                initial={{ scale: 0.94, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                whileTap={{ scale: 0.95 }}
                className={`h-20 w-20 rounded-full flex items-center justify-center transition-all ${isRecording ? "bg-rose-500 shadow-[0_0_32px_rgba(244,63,94,0.45)]" : "bg-gradient-to-br from-sky-500 to-cyan-400 shadow-[0_0_28px_rgba(34,211,238,0.35)]"}`}
              >
                {isRecording ? (
                  <Square className="w-7 h-7 fill-white text-white" />
                ) : (
                  <Mic className="w-8 h-8 text-[#031320]" />
                )}
              </motion.button>
            </AnimatePresence>
          </div>

          <div className="text-center min-h-[76px] flex items-center justify-center">
            {isProcessing && (
              <p className="inline-flex items-center gap-2 text-amber-200 font-medium">
                <RefreshCw className="w-4 h-4 animate-spin" /> Transcribiendo y
                refinando...
              </p>
            )}
            {status === "idle" && (
              <p className="text-slate-300">
                {handsFreeMode ? "Toca " : "Mantén "}
                <span className="font-mono text-sky-200">Space</span>
                {handsFreeMode
                  ? " para iniciar y vuelve a tocar para detener."
                  : " para dictar y suelta para detener."}
              </p>
            )}
            {status === "recording" && (
              <p className="text-rose-200">
                {handsFreeMode
                  ? "Grabando en modo hands-free. Pulsa Space para detener."
                  : "Grabando en vivo. Suelta para detener."}
              </p>
            )}
            {status === "error" && (
              <p className="inline-flex items-center gap-2 text-rose-200">
                <AlertCircle className="w-4 h-4" /> No pudimos completar la
                transcripción.
              </p>
            )}
          </div>
        </div>

        {refinedText && (
          <div className="rounded-3xl border border-white/10 bg-[#07111d] p-5 md:p-6">
            <p className="text-sm uppercase tracking-[0.22em] text-slate-400 mb-3">
              Resultado
            </p>
            <p className="text-slate-100 leading-relaxed text-lg">
              {refinedText}
            </p>
            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(refinedText);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2200);
                  toast.success("Copiado al portapapeles");
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:bg-white/10 transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-300" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copied ? "Copiado" : "Copiar"}
              </button>
              <button
                onClick={() => {
                  setRefinedText("");
                  setStatus("idle");
                }}
                className="rounded-full border border-white/10 px-5 py-2.5 text-sm text-slate-300 hover:bg-white/5 transition-colors"
              >
                Limpiar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
