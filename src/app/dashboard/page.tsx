import VoiceRecorder from "@/components/VoiceRecorder";
import { Mic, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
    return (
        <div className="min-h-screen bg-[#0A0A0B] text-white selection:bg-purple-500/30 p-6 md:p-12 relative overflow-hidden">
            {/* Background Orbs */}
            <div className="fixed -top-20 -left-20 w-[600px] h-[600px] bg-purple-600/5 blur-[120px] rounded-full pointer-events-none" />
            <div className="fixed -bottom-20 -right-20 w-[600px] h-[600px] bg-cyan-600/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="mx-auto max-w-5xl relative z-10">
                <header className="flex items-center justify-between mb-16">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                            <Mic className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Voz Flow</h1>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Espacio Personal</p>
                        </div>
                    </div>
                    <Link href="/" className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-white transition-all">
                        <ArrowLeft className="w-4 h-4" /> Volver al Inicio
                    </Link>
                </header>

                <main className="flex flex-col items-center justify-center min-h-[60vh]">
                    <div className="mb-12 text-center space-y-4">
                        <h2 className="text-4xl md:text-5xl font-black tracking-tighter">¿En qué estás pensando?</h2>
                        <p className="text-gray-400 font-medium max-w-lg mx-auto">
                            Presiona el micrófono y habla naturalmente. Tus pensamientos serán transcritos y refinados automáticamente.
                        </p>
                    </div>

                    <VoiceRecorder />

                    <div className="mt-20 grid md:grid-cols-2 gap-6 w-full opacity-60">
                        <div className="p-6 rounded-3xl border border-white/5 bg-white/5 space-y-2">
                            <h3 className="font-bold text-sm text-gray-300 uppercase tracking-widest">Modelo Activo</h3>
                            <p className="text-sm font-medium text-gray-500">Whisper Nativo + Refinamiento Llama 3 (Nube)</p>
                        </div>
                        <div className="p-6 rounded-3xl border border-white/5 bg-white/5 space-y-2">
                            <h3 className="font-bold text-sm text-gray-300 uppercase tracking-widest">Modo Portapapeles</h3>
                            <p className="text-sm font-medium text-gray-500">Auto-copiado activado (Solo resultados refinados)</p>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
