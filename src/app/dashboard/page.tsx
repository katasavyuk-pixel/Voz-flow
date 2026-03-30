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
  Save,
  ShieldAlert,
  RefreshCw,
  Hand,
  CheckCircle,
  XCircle,
} from "lucide-react";
import TranscriptionHistory from "@/components/TranscriptionHistory";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import Link from "next/link";

type FlowSnippet = {
  trigger: string;
  output: string;
};

function parseDictionaryInput(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseSnippetsInput(value: string): FlowSnippet[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.includes("→") ? "→" : "->";
      const [trigger, output] = line
        .split(separator)
        .map((chunk) => chunk?.trim());
      if (!trigger || !output) return null;
      return { trigger, output };
    })
    .filter((item): item is FlowSnippet => item !== null);
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [refinedText, setRefinedText] = useState("");
  const [copied, setCopied] = useState(false);
  const [shortcutInput, setShortcutInput] = useState("");
  const [activeShortcut, setActiveShortcut] = useState("-");

  useEffect(() => { setMounted(true); }, []);
  const [isSavingShortcut, setIsSavingShortcut] = useState(false);
  const [isCapturingShortcut, setIsCapturingShortcut] = useState(false);
  const [shortcutSavedFlash, setShortcutSavedFlash] = useState(false);
  const [shortcutRegistered, setShortcutRegistered] = useState<boolean | null>(
    null,
  );
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<{
    accessibility: boolean;
    automation: boolean;
    message: string;
  } | null>(null);
  const [isCheckingPermissions, setIsCheckingPermissions] = useState(false);
  const [isRunningPasteTest, setIsRunningPasteTest] = useState(false);
  const [dictionaryInput, setDictionaryInput] = useState("");
  const [snippetsInput, setSnippetsInput] = useState("");
  const [appState, setAppState] = useState<string>("idle");
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [doubleTapEnabled, setDoubleTapEnabled] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioAnimFrameRef = useRef<number | null>(null);
  const isRecordingRef = useRef(false);
  const recordingStartTimeRef = useRef<number>(0);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

        if ((window as any).electron?.getShortcutDiagnostics) {
          const diag = await (window as any).electron.getShortcutDiagnostics();
          if (diag?.activeShortcut) {
            setActiveShortcut(diag.activeShortcut);
            setShortcutInput(diag.activeShortcut);
          }
          setShortcutRegistered(Boolean(diag?.registered));
        }

        if ((window as any).electron?.getApiKey) {
          const currentApiKey = await (window as any).electron.getApiKey();
          if (currentApiKey) setApiKeyInput(currentApiKey);
        }

        const storedDictionary = localStorage.getItem(
          "flow-personal-dictionary",
        );
        if (storedDictionary) setDictionaryInput(storedDictionary);

        const storedSnippets = localStorage.getItem("flow-snippets");
        if (storedSnippets) setSnippetsInput(storedSnippets);

        // Load double-tap settings
        if ((window as any).electron?.getDoubleTapSettings) {
          const dtSettings = await (window as any).electron.getDoubleTapSettings();
          setDoubleTapEnabled(dtSettings.enabled);
        }
      } catch {
        setActiveShortcut("-");
      }
    };

    loadShortcut();
  }, []);

  // Listen for app state changes from main process
  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).electron) return;
    const unsub = (window as any).electron.onAppStateChanged?.((state: string) => {
      setAppState(state);
      if (state === "done") {
        setIsProcessing(false);
        setIsRecording(false);
      } else if (state === "error") {
        setIsProcessing(false);
        setIsRecording(false);
      }
    });
    return () => { if (typeof unsub === "function") unsub(); };
  }, []);

  const checkMacPermissions = useCallback(async () => {
    if (!(window as any).electron?.checkMacPermissions) return;
    setIsCheckingPermissions(true);
    try {
      const status = await (window as any).electron.checkMacPermissions();
      setPermissionStatus(status);
    } catch {
      setPermissionStatus(null);
    } finally {
      setIsCheckingPermissions(false);
    }
  }, []);

  useEffect(() => {
    void checkMacPermissions();
  }, [checkMacPermissions]);

  const runPasteTest = useCallback(async () => {
    if (!(window as any).electron?.schedulePasteTest) {
      toast.info("Esta prueba solo aplica en la app de escritorio");
      return;
    }

    setIsRunningPasteTest(true);
    try {
      const result = await (window as any).electron.schedulePasteTest(3000);
      if (!result?.ok) {
        toast.error("No se pudo iniciar la prueba de pegado");
        return;
      }

      toast.info(
        "Prueba de pegado iniciada. Cambia al chat en 3 segundos para validar.",
      );
    } catch {
      toast.error("No se pudo iniciar la prueba de pegado");
    } finally {
      setTimeout(() => setIsRunningPasteTest(false), 1200);
    }
  }, []);

  const copyToClipboardSafely = useCallback(async (text: string) => {
    if (!text) return false;
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return false;
    }
    if (typeof document !== "undefined" && !document.hasFocus()) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, []);

  const processAudio = useCallback(
    async (audioBlob: Blob) => {
      setIsProcessing(true);
      if ((window as any).electron?.setIndicatorState) {
        (window as any).electron.setIndicatorState("processing");
      }
      try {
        let data;
        const flowConfig = {
          personalDictionary: parseDictionaryInput(dictionaryInput),
          snippets: parseSnippetsInput(snippetsInput),
        };

        if ((window as any).electron?.transcribeAudio) {
          const arrayBuffer = await audioBlob.arrayBuffer();
          data = await (window as any).electron.transcribeAudio(
            arrayBuffer,
            flowConfig,
          );
        } else {
          const formData = new FormData();
          formData.append("file", audioBlob, "audio.webm");
          formData.append("flowConfig", JSON.stringify(flowConfig));
          const response = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });
          if (!response.ok) throw new Error("Error en transcripción");
          data = await response.json();
        }

        const refined = (data.refined || "").trim();

        // Don't paste empty text
        if (!refined) {
          toast.info("No se detecto voz");
          return;
        }

        setRefinedText(refined);
        setHistoryRefresh((prev) => prev + 1);
        const copiedToClipboard = await copyToClipboardSafely(refined);
        if ((window as any).electron)
          (window as any).electron.typeText(refined);
        if (copiedToClipboard) {
          setCopied(true);
          toast.success("Texto copiado al portapapeles");
          setTimeout(() => setCopied(false), 2000);
        } else {
          toast.success("Texto listo");
        }
      } catch (error: any) {
        toast.error(error.message || "Error al procesar");
      } finally {
        setIsProcessing(false);
        // State machine in main.js handles DONE -> IDLE transition automatically
      }
    },
    [copyToClipboardSafely, dictionaryInput, snippetsInput],
  );

  useEffect(() => {
    localStorage.setItem("flow-personal-dictionary", dictionaryInput);
  }, [dictionaryInput]);

  useEffect(() => {
    localStorage.setItem("flow-snippets", snippetsInput);
  }, [snippetsInput]);

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

  // Audio visualization: send FFT data to pill via IPC
  const startAudioVisualization = useCallback((stream: MediaStream) => {
    try {
      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const NUM_BARS = 24;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const sendFrame = () => {
        if (!analyserRef.current) return;
        analyser.getByteFrequencyData(dataArray);

        // Downsample to NUM_BARS
        const binSize = Math.floor(dataArray.length / 2 / NUM_BARS);
        const barValues: number[] = [];
        for (let i = 0; i < NUM_BARS; i++) {
          let sum = 0;
          for (let j = 0; j < binSize; j++) {
            sum += dataArray[i * binSize + j];
          }
          barValues.push(Math.min(1, (sum / binSize / 255) * 2));
        }

        if ((window as any).electron?.sendAudioData) {
          (window as any).electron.sendAudioData(barValues);
        }

        audioAnimFrameRef.current = requestAnimationFrame(sendFrame);
      };
      audioAnimFrameRef.current = requestAnimationFrame(sendFrame);
    } catch {
      // Audio viz not critical
    }
  }, []);

  const stopAudioVisualization = useCallback(() => {
    if (audioAnimFrameRef.current) {
      cancelAnimationFrame(audioAnimFrameRef.current);
      audioAnimFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
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
      chunksRef.current = [];
      recordingStartTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stopAudioVisualization();
        if (autoStopTimerRef.current) {
          clearTimeout(autoStopTimerRef.current);
          autoStopTimerRef.current = null;
        }

        const durationMs = Date.now() - recordingStartTimeRef.current;

        // Skip if too short (<0.5s) — likely accidental
        if (durationMs < 500) {
          toast.info("Grabacion muy corta");
          if ((window as any).electron?.setIndicatorState) {
            (window as any).electron.setIndicatorState("idle");
          }
          return;
        }

        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRefinedText("");

      // Auto-stop after 2 minutes as safety net
      autoStopTimerRef.current = setTimeout(() => {
        if (isRecordingRef.current) {
          toast.info("Grabacion detenida (limite 2 min)");
          stopRecording();
        }
      }, 120000);

      // Start audio visualization for the pill
      startAudioVisualization(stream);

      if ((window as any).electron)
        (window as any).electron.setRecordingState(true);
      toast.info("Grabando...");
    } catch {
      toast.error("No se pudo acceder al micrófono");
    }
  }, [processAudio, startAudioVisualization, stopAudioVisualization, stopRecording]);

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

  // Listen for paste result feedback from main process
  useEffect(() => {
    if (typeof window === "undefined" || !(window as any).electron?.onPasteResult) return;
    const unsubscribe = (window as any).electron.onPasteResult((result: { ok: boolean; error?: string }) => {
      if (!result.ok && result.error) {
        toast.error(result.error);
      }
    });
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  const saveShortcutValue = useCallback(async (rawShortcut: string) => {
    if (!(window as any).electron?.setShortcut) {
      toast.info("Los atajos globales solo aplican en la app de escritorio");
      return;
    }

    const candidate = rawShortcut.trim();
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
      setShortcutRegistered(true);
      setShortcutSavedFlash(true);
      setTimeout(() => setShortcutSavedFlash(false), 1800);
      toast.success(`Atajo guardado: ${result.shortcut}`);
    } catch {
      toast.error("No se pudo guardar el atajo");
      setShortcutRegistered(false);
    } finally {
      setIsSavingShortcut(false);
    }
  }, []);

  const saveShortcut = async () => {
    await saveShortcutValue(shortcutInput);
  };

  useEffect(() => {
    if (!isCapturingShortcut) return;

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const isModifierOnly =
        event.key === "Meta" ||
        event.key === "Control" ||
        event.key === "Shift" ||
        event.key === "Alt";

      if (isModifierOnly) return;

      const modifiers: string[] = [];
      if (event.metaKey || event.ctrlKey) modifiers.push("CommandOrControl");
      if (event.shiftKey) modifiers.push("Shift");
      if (event.altKey) modifiers.push("Alt");

      let finalKey = event.key;
      if (finalKey === " ") finalKey = "Space";
      if (finalKey.length === 1) finalKey = finalKey.toUpperCase();

      if (finalKey === "Space") {
        setIsCapturingShortcut(false);
        toast.error("No usamos Space. Pulsa Command + Option + una letra");
        return;
      }

      if (!event.altKey || (!event.metaKey && !event.ctrlKey)) {
        setIsCapturingShortcut(false);
        toast.error("Debe incluir Command y Option");
        return;
      }

      const accelerator = [...modifiers, finalKey].join("+");
      setShortcutInput(accelerator);
      setIsCapturingShortcut(false);
      void saveShortcutValue(accelerator);
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [isCapturingShortcut, saveShortcutValue]);

  const saveApiKey = async () => {
    if (!(window as any).electron?.setApiKey) {
      toast.info("La API key local solo aplica en la app de escritorio");
      return;
    }

    const candidate = apiKeyInput.trim();
    if (!candidate) {
      toast.error("Escribe tu GROQ API key");
      return;
    }

    setIsSavingApiKey(true);
    try {
      const result = await (window as any).electron.setApiKey(candidate);
      if (!result?.ok) {
        toast.error(result?.error || "No se pudo guardar la API key");
        return;
      }
      toast.success("API key guardada correctamente");
    } catch {
      toast.error("No se pudo guardar la API key");
    } finally {
      setIsSavingApiKey(false);
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
          <button
            onClick={() => {
              if ((window as any).electron) {
                // En Electron, volver a la raíz cargando el archivo index.html directamente
                // o regresando mediante el sistema de archivos si es necesario.
                // Para export estático, a veces '/' no mapea bien a './index.html'
                window.location.href = (window as any).location.origin + "/index.html";
              } else {
                window.location.href = "/";
              }
            }}
            className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Inicio
          </button>
        </header>

        <main className="flex flex-col items-center">
          {permissionStatus &&
            (!permissionStatus.accessibility ||
              !permissionStatus.automation) && (
              <div className="w-full mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-amber-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4" />
                      Faltan permisos del sistema
                    </p>
                    <p className="text-xs mt-1 text-amber-200/90">
                      Sin estos permisos no puede pegar en WhatsApp, ChatGPT o
                      cualquier chat externo.
                    </p>
                    <p className="text-xs mt-1 text-amber-200/80">
                      Estado: {permissionStatus.message}
                    </p>
                  </div>
                  <button
                    onClick={() => void checkMacPermissions()}
                    disabled={isCheckingPermissions}
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${isCheckingPermissions ? "animate-spin" : ""}`}
                    />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={() =>
                      (window as any).electron?.openMacPrivacyPane?.(
                        "accessibility",
                      )
                    }
                    className="text-xs px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20"
                  >
                    Abrir Accesibilidad
                  </button>
                  <button
                    onClick={() =>
                      (window as any).electron?.openMacPrivacyPane?.(
                        "automation",
                      )
                    }
                    className="text-xs px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20"
                  >
                    Abrir Automatizacion
                  </button>
                  <button
                    onClick={() => void runPasteTest()}
                    disabled={isRunningPasteTest}
                    className="text-xs px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-400/40 hover:bg-emerald-500/30 disabled:opacity-50"
                  >
                    {isRunningPasteTest
                      ? "Probando..."
                      : "Probar pegado en chat"}
                  </button>
                </div>
              </div>
            )}

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
                  className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${isRecording
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
                    onClick={async () => {
                      const copiedToClipboard =
                        await copyToClipboardSafely(refinedText);
                      if (!copiedToClipboard) {
                        toast.error(
                          "No se pudo copiar. Enfoca la app y reintenta.",
                        );
                        return;
                      }
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

          <div className="w-full grid lg:grid-cols-3 gap-4 opacity-80">
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
              {shortcutRegistered === false && (
                <p className="text-[11px] text-amber-300 mb-2">
                  Atajo no registrado. Prueba otro preset.
                </p>
              )}
              {shortcutSavedFlash && (
                <p className="text-[11px] text-emerald-400 mb-2">
                  Atajo activo
                </p>
              )}
              <div className="flex items-center gap-2">
                <input
                  value={shortcutInput}
                  readOnly
                  placeholder="Captura: Command + Option + letra"
                  className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-xs text-gray-200 placeholder:text-gray-500"
                />
                <button
                  onClick={() => setIsCapturingShortcut((prev) => !prev)}
                  className={`px-3 py-2 rounded-lg transition-all ${isCapturingShortcut
                    ? "bg-cyan-500/20 border border-cyan-400/40"
                    : "bg-white/10 hover:bg-white/20"
                    }`}
                  title="Capturar atajo"
                >
                  {isCapturingShortcut ? "Teclea..." : "Capturar"}
                </button>
                <button
                  onClick={saveShortcut}
                  disabled={isSavingShortcut}
                  className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all disabled:opacity-50"
                  title="Guardar atajo"
                >
                  <Save className="w-4 h-4" />
                </button>
                <button
                  onClick={() =>
                    (window as any).electron?.forceToggleRecording?.()
                  }
                  className="px-3 py-2 rounded-lg bg-cyan-500/20 border border-cyan-400/40 hover:bg-cyan-500/30"
                  title="Probar grabacion sin atajo"
                >
                  Test
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {[
                  "CommandOrControl+Alt+R",
                  "CommandOrControl+Alt+D",
                  "CommandOrControl+Alt+V",
                ].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setShortcutInput(preset)}
                    className="text-[10px] px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-5 rounded-2xl border border-white/5 bg-white/5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  API Groq (Desktop)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-xs text-gray-200 placeholder:text-gray-500"
                />
                <button
                  onClick={saveApiKey}
                  disabled={isSavingApiKey}
                  className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-all disabled:opacity-50"
                  title="Guardar API key"
                >
                  <Save className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Se guarda localmente para transcribir en la app de escritorio.
              </p>
            </div>
            <div className="p-5 rounded-2xl border border-white/5 bg-white/5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-fuchsia-400" />
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Flow Personalizado
                </span>
              </div>
              <label className="block text-[11px] text-gray-500 mb-1">
                Diccionario personal (1 termino por linea)
              </label>
              <textarea
                value={dictionaryInput}
                onChange={(e) => setDictionaryInput(e.target.value)}
                placeholder={"Cheyene\nViktor\nSaaS\nGTM"}
                className="w-full h-24 rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-xs text-gray-200 placeholder:text-gray-500 resize-none"
              />
              <label className="block text-[11px] text-gray-500 mt-3 mb-1">
                Snippets (trigger -&gt; texto completo)
              </label>
              <textarea
                value={snippetsInput}
                onChange={(e) => setSnippetsInput(e.target.value)}
                placeholder={
                  "mi calendario -> Podes agendar una llamada de 30 minutos aqui: calendly.com/tuusuario"
                }
                className="w-full h-24 rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-xs text-gray-200 placeholder:text-gray-500 resize-none"
              />
            </div>
          </div>

          {/* Double-tap (Hands-free) settings card */}
          {mounted && typeof window !== "undefined" && (window as any).electron && (
            <div className="w-full mt-4">
              <div className="p-5 rounded-2xl border border-white/5 bg-white/5 opacity-80">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Hand className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Modo Manos Libres
                    </span>
                  </div>
                  <button
                    onClick={async () => {
                      const next = !doubleTapEnabled;
                      setDoubleTapEnabled(next);
                      await (window as any).electron.setDoubleTapSettings({ enabled: next });
                      toast.success(next ? "Doble-tap activado" : "Doble-tap desactivado");
                    }}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      doubleTapEnabled ? "bg-emerald-500" : "bg-gray-600"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        doubleTapEnabled ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Doble toque en Ctrl para iniciar. Un toque para detener. Tambien puedes mantener Ctrl+Option.
                </p>
              </div>
            </div>
          )}

          {/* State indicator for done/error */}
          {appState === "done" && (
            <div className="flex items-center gap-2 mt-4 text-emerald-400 animate-pulse">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Listo</span>
            </div>
          )}
          {appState === "error" && (
            <div className="flex items-center gap-2 mt-4 text-red-400 animate-pulse">
              <XCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Error en transcripcion</span>
            </div>
          )}

          {/* Transcription history with search (SQLite) */}
          <TranscriptionHistory
            onSelect={(text) => setRefinedText(text)}
            refreshTrigger={historyRefresh}
          />
        </main>
      </div>
    </div>
  );
}
