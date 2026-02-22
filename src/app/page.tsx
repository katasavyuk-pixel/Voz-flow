"use client";

import { useState, useEffect, useRef } from "react";
import {
  Mic,
  Square,
  Copy,
  Check,
  Sparkles,
  Download,
  Apple,
  Monitor,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function LandingPage() {
  const macDownloadUrl = process.env.NEXT_PUBLIC_DOWNLOAD_URL_MAC || "";
  const winDownloadUrl = process.env.NEXT_PUBLIC_DOWNLOAD_URL_WIN || "";

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [refinedText, setRefinedText] = useState("");
  const [copied, setCopied] = useState(false);
  const [demoText, setDemoText] = useState("");
  const [showResult, setShowResult] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const demoInput =
    "umm bueno ayer estuve hablando con maria sobre el proyecto y me dijo que necesitamos terminar el reporte para el viernes aunque no estoy seguro si va a ser posible porque hay muchos cambios pendientes";
  const demoOutput =
    "Ayer estuve hablando con María sobre el proyecto. Me comentó que necesitamos terminar el reporte para el viernes, aunque no estoy seguro si será posible porque hay muchos cambios pendientes.";

  useEffect(() => {
    if (!isRecording && !isProcessing && !showResult) {
      let i = 0;
      const interval = setInterval(() => {
        if (i <= demoInput.length) {
          setDemoText(demoInput.slice(0, i));
          i += 2;
        } else {
          clearInterval(interval);
          setTimeout(() => {
            setShowResult(true);
          }, 500);
        }
      }, 30);
      return () => clearInterval(interval);
    }
  }, [isRecording, isProcessing, showResult]);

  useEffect(() => {
    if (showResult) {
      const timeout = setTimeout(() => {
        setShowResult(false);
        setDemoText("");
      }, 4000);
      return () => clearTimeout(timeout);
    }
  }, [showResult]);

  const toggleAction = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        await sendToGroq(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setShowResult(false);
      setDemoText("");
      setRefinedText("");
      toast.info("Grabando...");
    } catch (err) {
      console.error("Error:", err);
      toast.error("No se pudo acceder al micrófono");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
      setIsRecording(false);
    }
  };

  const sendToGroq = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.webm");

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Error en transcripción");

      const data = await response.json();
      setRefinedText(data.refined);
      navigator.clipboard.writeText(data.refined);
      setCopied(true);
      toast.success("Texto copiado al portapapeles");
      setTimeout(() => setCopied(false), 2000);
    } catch (error: any) {
      toast.error("Error: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadClick = (url: string, platform: "Mac" | "Windows") => {
    if (!url) {
      toast.info(
        `Configura NEXT_PUBLIC_DOWNLOAD_URL_${platform === "Mac" ? "MAC" : "WIN"} para habilitar esta descarga en producción`,
      );
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white overflow-x-hidden">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-cyan-500/5 blur-[100px] rounded-full pointer-events-none" />

      <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-[#0A0A0B]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 via-fuchsia-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">Voz Flow</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="#download"
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
            >
              Descargar
            </a>
            <a
              href="/dashboard"
              className="px-5 py-2 rounded-full bg-white text-black text-sm font-bold hover:bg-gray-200 transition-all"
            >
              Abrir App
            </a>
          </div>
        </div>
      </nav>

      <section className="relative pt-32 pb-16 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-sm font-semibold text-purple-400 mb-8">
            <Sparkles className="w-4 h-4" />
            Dictado inteligente con IA
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.1] mb-6">
            Deja de escribir.
            <br />
            <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
              Empieza a fluir.
            </span>
          </h1>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-12">
            Transforma tu voz en texto perfecto al instante. Habla en español o
            inglés, la IA limpia, corrige y formatea todo automáticamente.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a
              href="/dashboard"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-lg font-bold hover:opacity-90 transition-all shadow-xl shadow-purple-500/20 flex items-center justify-center gap-2"
            >
              <Mic className="w-5 h-5" />
              Probar Ahora
            </a>
            <a
              href="#download"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-lg font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Descargar App
            </a>
          </div>
        </div>
      </section>

      <section className="pb-24 px-6">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl border border-white/10 bg-[#111112] p-8 shadow-2xl">
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <AnimatePresence>
                  {isRecording && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1.2, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="absolute inset-0 rounded-full bg-red-500/30 blur-xl animate-pulse"
                    />
                  )}
                </AnimatePresence>
                <button
                  onClick={toggleAction}
                  disabled={isProcessing}
                  className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isRecording
                      ? "bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)]"
                      : "bg-gradient-to-br from-purple-600 to-cyan-500 hover:scale-105 active:scale-95 shadow-xl"
                  }`}
                >
                  {isRecording ? (
                    <Square className="w-6 h-6 fill-white" />
                  ) : (
                    <Mic className="w-8 h-8" />
                  )}
                </button>
              </div>

              <div className="w-full min-h-[100px] p-5 rounded-2xl bg-black/40 border border-white/5 text-center flex items-center justify-center">
                {isRecording ? (
                  <div className="flex items-center gap-1.5 h-6">
                    {[3, 5, 4, 6, 4, 5, 3].map((h, i) => (
                      <div
                        key={i}
                        className="w-1.5 rounded-full bg-purple-400 animate-pulse"
                        style={{
                          height: `${h * 6}px`,
                          animationDelay: `${i * 0.1}s`,
                        }}
                      />
                    ))}
                  </div>
                ) : isProcessing ? (
                  <p className="text-purple-400 font-medium">
                    Procesando con IA...
                  </p>
                ) : refinedText ? (
                  <p className="text-lg text-white leading-relaxed">
                    {refinedText}
                  </p>
                ) : showResult ? (
                  <p className="text-lg text-white leading-relaxed">
                    {demoOutput}
                  </p>
                ) : demoText ? (
                  <p className="text-base text-gray-400 italic">{demoText}</p>
                ) : (
                  <p className="text-gray-500">Haz clic para grabar</p>
                )}
              </div>

              {refinedText && !isRecording && !isProcessing && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(refinedText);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
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
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 border-t border-white/5 bg-[#0D0D0E]">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Funciona en todas partes
            </h2>
            <p className="text-gray-400 text-lg">
              Descarga la app de escritorio para usarla en cualquier aplicación
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-8 rounded-3xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center">
                  <Apple className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">macOS</h3>
                  <p className="text-gray-500 text-sm">Intel y Apple Silicon</p>
                </div>
              </div>
              <a
                href={macDownloadUrl || "#"}
                onClick={(e) => {
                  if (!macDownloadUrl) {
                    e.preventDefault();
                    handleDownloadClick("", "Mac");
                  }
                }}
                className="w-full py-3 rounded-xl bg-white text-black font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                target={macDownloadUrl ? "_blank" : undefined}
                rel={macDownloadUrl ? "noopener noreferrer" : undefined}
              >
                <Download className="w-5 h-5" />
                Descargar para Mac
              </a>
            </div>

            <div className="p-8 rounded-3xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center">
                  <Monitor className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Windows</h3>
                  <p className="text-gray-500 text-sm">Windows 10/11</p>
                </div>
              </div>
              <a
                href={winDownloadUrl || "#"}
                onClick={(e) => {
                  if (!winDownloadUrl) {
                    e.preventDefault();
                    handleDownloadClick("", "Windows");
                  }
                }}
                className="w-full py-3 rounded-xl bg-white text-black font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                target={winDownloadUrl ? "_blank" : undefined}
                rel={winDownloadUrl ? "noopener noreferrer" : undefined}
              >
                <Download className="w-5 h-5" />
                Descargar para Windows
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="download" className="py-24 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Descarga Voz Flow
          </h2>
          <p className="text-gray-400 text-lg mb-12">
            App de escritorio con atajo global. Presiona{" "}
            <kbd className="px-2 py-1 rounded bg-white/10 text-white font-mono text-sm">
              Command + Option + R
            </kbd>{" "}
            para grabar desde cualquier aplicación.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => handleDownloadClick(macDownloadUrl, "Mac")}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-lg font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
            >
              <Apple className="w-5 h-5" />
              Descargar para Mac
            </button>
            <button
              onClick={() => handleDownloadClick(winDownloadUrl, "Windows")}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-lg font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
            >
              <Monitor className="w-5 h-5" />
              Descargar para Windows
            </button>
          </div>

          <p className="mt-8 text-sm text-gray-500">
            Configura en producción:{" "}
            <code className="px-2 py-1 rounded bg-white/10 font-mono">
              NEXT_PUBLIC_DOWNLOAD_URL_MAC
            </code>{" "}
            y{" "}
            <code className="px-2 py-1 rounded bg-white/10 font-mono">
              NEXT_PUBLIC_DOWNLOAD_URL_WIN
            </code>
          </p>
        </div>
      </section>

      <footer className="py-12 border-t border-white/5">
        <div className="mx-auto max-w-6xl px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <Mic className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold">Voz Flow</span>
          </div>
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} Voz Flow. Dictado inteligente con IA.
          </p>
        </div>
      </footer>
    </div>
  );
}
