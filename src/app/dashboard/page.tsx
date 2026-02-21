"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic,
  Square,
  Copy,
  Check,
  Sparkles,
  ArrowLeft,
  Keyboard,
  History,
  Save,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";

export default function DashboardPage() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [refinedText, setRefinedText] = useState("");
  const [copied, setCopied] = useState(false);
  const [shortcutInput, setShortcutInput] = useState("");
  const [activeShortcut, setActiveShortcut] = useState("-");
  const [isSavingShortcut, setIsSavingShortcut] = useState(false);
  const [history, setHistory] = useState<
    Array<{ original: string; refined: string; date: Date }>
  >([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    const loadShortcut = async () => {
      if (!(window as any).electron?.getShortcut) return;
      try {
        const shortcut = await (window as any).electron.getShortcut();
        setActiveShortcut(shortcut);
        setShortcutInput(shortcut);
      } catch {
        setActiveShortcut("-");
      }
    };

    loadShortcut();
  }, []);

  const processAudio = useCallback(async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      let data;
      if ((window as any).electron?.transcribeAudio) {
        const arrayBuffer = await audioBlob.arrayBuffer();
        data = await (window as any).electron.transcribeAudio(arrayBuffer);
      } else {
        const formData = new FormData();
        formData.append("file", audioBlob, "audio.webm");
        const response = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });
        if (!response.ok) throw new Error("Error en transcripción");
        data = await response.json();
      }

      setRefinedText(data.refined);
      setHistory((prev) => [
        { original: data.original, refined: data.refined, date: new Date() },
        ...prev.slice(0, 9),
      ]);
      navigator.clipboard.writeText(data.refined);
      if ((window as any).electron)
        (window as any).electron.typeText(data.refined);
      setCopied(true);
      toast.success("Texto copiado al portapapeles");
      setTimeout(() => setCopied(false), 2000);
    } catch (error: any) {
      toast.error(error.message || "Error al procesar");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
      setIsRecording(false);
      if ((window as any).electron)
        (window as any).electron.setRecordingState(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRefinedText("");
      if ((window as any).electron)
        (window as any).electron.setRecordingState(true);
      toast.info("Grabando...");
    } catch {
      toast.error("No se pudo acceder al micrófono");
    }
  }, [processAudio]);

  const toggleAction = useCallback(() => {
    if (isRecordingRef.current) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [startRecording, stopRecording]);

  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).electron) return;
    const unsubscribe = (window as any).electron.onToggleRecording(() => {
      toggleAction();
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [toggleAction]);

  const saveShortcut = async () => {
    if (!(window as any).electron?.setShortcut) {
      toast.info("Los atajos globales solo aplican en la app de escritorio");
      return;
    }

    const candidate = shortcutInput.trim();
    if (!candidate) {
      toast.error("Escribe un atajo válido");
      return;
    }

    setIsSavingShortcut(true);
    try {
      const result = await (window as any).electron.setShortcut(candidate);
      if (!result?.ok) {
        toast.error(result?.error || "No se pudo guardar el atajo");
        return;
      }
      setActiveShortcut(result.shortcut);
      setShortcutInput(result.shortcut);
      toast.success(`Atajo guardado: ${result.shortcut}`);
    } catch {
      toast.error("No se pudo guardar el atajo");
    } finally {
      setIsSavingShortcut(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white p-4 md:p-6 relative overflow-hidden">
      <div className="fixed -top-32 -left-32 w-[360px] h-[360px] md:w-[500px] md:h-[500px] bg-purple-600/10 blur-[80px] md:blur-[100px] rounded-full pointer-events-none" />
      <div className="fixed -bottom-32 -right-32 w-[360px] h-[360px] md:w-[500px] md:h-[500px] bg-cyan-500/10 blur-[80px] md:blur-[100px] rounded-full pointer-events-none" />

      <div className="mx-auto max-w-4xl relative z-10">
        <header className="flex items-center justify-between mb-12">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-105 transition-transform">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Voz Flow</h1>
              <p className="text-xs text-gray-500">Español & English</p>
            </div>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Inicio
          </Link>
        </header>

        <main className="flex flex-col items-center">
          <div className="text-center mb-8 md:mb-10">
            <h2 className="text-3xl md:text-4xl font-black mb-3">
              ¿Qué quieres decir?
            </h2>
            <p className="text-gray-400 max-w-md mx-auto">
              Presiona el micrófono o usa{" "}
              <kbd className="px-2 py-0.5 rounded bg-white/10 font-mono text-xs">
                {activeShortcut}
              </kbd>
            </p>
          </div>

          <div className="w-full max-w-xl p-5 md:p-8 rounded-[28px] md:rounded-[32px] bg-[#111112] border border-white/10 shadow-2xl mb-8">
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <AnimatePresence>
                  {isRecording && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1.3, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="absolute inset-0 rounded-full bg-red-500/30 blur-xl"
                    />
                  )}
                </AnimatePresence>
                <button
                  onClick={toggleAction}
                  disabled={isProcessing}
                  className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isRecording
                      ? "bg-red-500 shadow-[0_0_40px_rgba(239,68,68,0.5)]"
                      : "bg-gradient-to-br from-purple-600 via-fuchsia-500 to-cyan-500 hover:scale-105 active:scale-95 shadow-xl shadow-purple-500/20"
                  }`}
                >
                  {isProcessing ? (
                    <Sparkles className="w-8 h-8 animate-pulse" />
                  ) : isRecording ? (
                    <Square className="w-7 h-7 fill-white" />
                  ) : (
                    <Mic className="w-10 h-10" />
                  )}
                </button>
              </div>

              <div className="w-full min-h-[80px] p-4 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-center text-center">
                {isRecording ? (
                  <div className="flex items-center gap-1">
                    {[4, 6, 5, 7, 5, 6, 4].map((h, i) => (
                      <div
                        key={i}
                        className="w-1 rounded-full bg-gradient-to-t from-purple-500 to-cyan-400"
                        style={{
                          height: `${h * 4}px`,
                          animation: `wave 0.6s ease-in-out infinite`,
                          animationDelay: `${i * 0.1}s`,
                        }}
                      />
                    ))}
                  </div>
                ) : isProcessing ? (
                  <p className="text-purple-400 font-medium animate-pulse">
                    Procesando con IA...
                  </p>
                ) : refinedText ? (
                  <p className="text-lg text-white leading-relaxed">
                    {refinedText}
                  </p>
                ) : (
                  <p className="text-gray-500 italic">
                    Habla en español o inglés
                  </p>
                )}
              </div>

              {refinedText && !isRecording && !isProcessing && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(refinedText);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                      toast.success("Copiado");
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm font-medium hover:bg-white/10 transition-all"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                  <button
                    onClick={() => {
                      setRefinedText("");
                    }}
                    className="px-5 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-gray-400 hover:bg-white/10 transition-all"
                  >
                    Limpiar
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="w-full grid sm:grid-cols-2 gap-4 opacity-70">
            <div className="p-5 rounded-2xl border border-white/5 bg-white/5">
              <div className="flex items-center gap-2 mb-2">
                <Keyboard className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Atajo Global
                </span>
              </div>
              <p className="text-sm text-gray-300 font-mono mb-2">
                {activeShortcut}
              </p>
              <div className="flex items-center gap-2">
                <input
                  value={shortcutInput}
                  onChange={(e) => setShortcutInput(e.target.value)}
                  placeholder="Ej: CommandOrControl+Shift+Space"
                  className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-xs text-gray-200 placeholder:text-gray-500"
                />
                <button
                  onClick={saveShortcut}
                  disabled={isSavingShortcut}
                  className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all disabled:opacity-50"
                  title="Guardar atajo"
                >
                  <Save className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-5 rounded-2xl border border-white/5 bg-white/5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Motor IA
                </span>
              </div>
              <p className="text-sm text-gray-300">Whisper + Llama 3.3 70B</p>
            </div>
          </div>

          {history.length > 0 && (
            <div className="w-full mt-10">
              <div className="flex items-center gap-2 mb-4">
                <History className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">
                  Historial
                </span>
              </div>
              <div className="space-y-3">
                {history.slice(0, 3).map((item, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                    onClick={() => {
                      setRefinedText(item.refined);
                    }}
                  >
                    <p className="text-sm text-gray-300 line-clamp-2">
                      {item.refined}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {item.date.toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
