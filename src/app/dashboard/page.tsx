import VoiceRecorder from "@/components/VoiceRecorder";
import TranscriptionHistory from "@/components/TranscriptionHistory";
import {
  Mic,
  ArrowLeft,
  Waves,
  ClipboardCheck,
  Bot,
  Shield,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="min-h-screen text-white p-5 md:p-10 relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_18%,rgba(14,165,233,0.16),transparent_32%),radial-gradient(circle_at_86%_84%,rgba(245,158,11,0.16),transparent_28%)]" />

      <div className="mx-auto max-w-6xl relative z-10">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500 to-amber-400 flex items-center justify-center shadow-[0_8px_24px_rgba(14,165,233,0.35)]">
              <Mic className="w-5 h-5 text-[#03131f]" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight font-mono text-sky-100">
                SoyVOZ Cabina
              </h1>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-[0.22em]">
                Modo Dictado
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Volver al inicio
          </Link>
        </header>

        <main className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
          <section className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-[#06101a]/80 p-6 md:p-8">
              <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3">
                Dictado con flujo continuo
              </h2>
              <p className="text-slate-300 max-w-2xl">
                Inspiramos la interacción en SFlow: estado claro, pill compacta
                y feedback visual estable. Aquí lo adaptamos al flujo
                web/electron de SoyVOZ.
              </p>
            </div>
            <VoiceRecorder />
            <TranscriptionHistory />
          </section>

          <aside className="space-y-4">
            <InfoCard
              icon={<Waves className="w-4 h-4 text-sky-200" />}
              title="Entrada de voz"
              description="Modo mantener o hands-free (tap Space) + botón central."
            />
            <InfoCard
              icon={<Bot className="w-4 h-4 text-amber-200" />}
              title="Motor IA"
              description="Whisper para STT + refinamiento de salida para texto limpio."
            />
            <InfoCard
              icon={<ClipboardCheck className="w-4 h-4 text-emerald-200" />}
              title="Salida"
              description="Auto-copiado activo para pegar de inmediato en cualquier app."
            />
            <InfoCard
              icon={<Shield className="w-4 h-4 text-slate-200" />}
              title="Persistencia"
              description="Si hay sesión activa, se guarda en historial con estado refined."
            />
          </aside>
        </main>
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-[#07111d]/85 p-4">
      <div className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-white/15 bg-white/5 mb-3">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-slate-100 mb-1">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
    </article>
  );
}
