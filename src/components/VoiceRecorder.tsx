"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, Square, Copy, RefreshCw, Check, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function VoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [refinedText, setRefinedText] = useState("");
  const [copied, setCopied] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const toggleAction = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  useEffect(() => {
    // Integración con Electron para atajos globales
    if (typeof window !== "undefined" && (window as any).electron) {
      (window as any).electron.onToggleRecording(() => {
        console.log("Recibido toggle-recording desde Electron");
        if (isRecording) {
          stopRecording();
        } else {
          startRecording();
        }
      });
    }
  }, [isRecording, startRecording, stopRecording]);

  async function startRecording() {
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
      if ((window as any).electron) {
        (window as any).electron.setRecordingState(true);
      }
      setRefinedText("");
      toast.info("Grabando... Habla naturalmente.");
    } catch (err) {
      console.error("Error al acceder al micrófono:", err);
      toast.error(
        "No se pudo acceder al micrófono. Por favor, revisa tus permisos.",
      );
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
      setIsRecording(false);
      if ((window as any).electron) {
        (window as any).electron.setRecordingState(false);
      }
    }
  }

  const sendToGroq = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      let data;

      // Si estamos en Electron, usar el puente nativo para evitar depender de API routes
      if (
        (window as any).electron &&
        (window as any).electron.transcribeAudio
      ) {
        const arrayBuffer = await audioBlob.arrayBuffer();
        data = await (window as any).electron.transcribeAudio(arrayBuffer);
      } else {
        // Fallback para web
        const formData = new FormData();
        formData.append("file", audioBlob, "audio.webm");

        const response = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || "Error en el servidor de transcripción",
          );
        }
        data = await response.json();
      }

      if (!data || !data.refined) {
        throw new Error("No se recibió texto refinado");
      }

      setRefinedText(data.refined);

      // Guardar en la base de datos (Supabase)
      try {
        // En Electron, podemos usar el cliente de Supabase directamente si está configurado,
        // Pero para mantener simplicidad usamos el endpoint si está disponible
        // o lo manejamos via IPC si fuera necesario. Por ahora, seguimos con el fetch
        // ya que Supabase es una URL externa.
        const saveResponse = await fetch("/api/transcriptions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            original_text: data.original,
            refined_text: data.refined,
          }),
        });

        if (saveResponse.ok) {
          console.log("Transcripción guardada en la base de datos");
        }
      } catch (saveError) {
        console.error("Error al persistir transcripción:", saveError);
      }

      // Auto-copy & Universal Type
      navigator.clipboard.writeText(data.refined);

      if ((window as any).electron) {
        (window as any).electron.typeText(data.refined);
      }

      setCopied(true);
      toast.success("¡Texto refinado y enviado!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error: any) {
      console.error("Error al procesar audio:", error);
      toast.error("Error: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-8 rounded-[40px] bg-[#111112] border border-white/10 shadow-3xl shadow-purple-500/5">
      <div className="flex flex-col items-center gap-8">
        {/* Visualizer & Button */}
        <div className="relative group">
          <AnimatePresence>
            {isRecording && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1.2, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="absolute inset-0 rounded-full bg-purple-500/20 blur-2xl animate-pulse"
              />
            )}
          </AnimatePresence>

          <button
            onClick={toggleAction}
            className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${
              isRecording
                ? "bg-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)]"
                : "bg-gradient-to-br from-purple-600 to-cyan-500 hover:scale-110 active:scale-95 shadow-xl"
            }`}
          >
            {isRecording ? (
              <Square className="w-8 h-8 fill-white" />
            ) : (
              <Mic className="w-10 h-10" />
            )}
          </button>
        </div>

        {/* Real-time Insight */}
        <div className="w-full min-h-[120px] p-6 rounded-3xl bg-black/40 border border-white/5 text-center flex items-center justify-center">
          {isRecording ? (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-1.5 h-6">
                {[1, 2, 3, 4, 5, 4, 3, 2, 1].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 rounded-full bg-purple-400 animate-pulse"
                    style={{
                      height: `${h * 20}%`,
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                ))}
              </div>
              <p className="text-sm font-bold text-gray-500 tracking-widest uppercase">
                Capturando Audio Pro...
              </p>
            </div>
          ) : isProcessing ? (
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
              <p className="text-sm font-bold text-purple-400 uppercase tracking-widest">
                Groq Whisper Engine Procesando
              </p>
            </div>
          ) : refinedText ? (
            <div className="space-y-4 w-full">
              <p className="text-2xl font-medium text-white leading-relaxed">
                {refinedText}
              </p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-400" /> COPIADO AL
                  PORTAPAPELES
                </span>
              </div>
            </div>
          ) : (
            <p className="text-lg text-gray-500 font-medium italic">
              Haz clic para grabar. Usaremos IA profesional para un resultado
              perfecto.
            </p>
          )}
        </div>

        {/* Action Bar */}
        {refinedText && !isRecording && !isProcessing && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                navigator.clipboard.writeText(refinedText);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
                toast.success("Copiado al portapapeles");
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10 transition-all text-white"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {copied ? "Copiado" : "Copiar de nuevo"}
            </button>
            <button
              onClick={() => {
                setRefinedText("");
              }}
              className="px-6 py-3 rounded-full bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10 transition-all text-gray-400"
            >
              Limpiar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
