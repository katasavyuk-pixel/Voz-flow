import Link from "next/link";
import {
  Mic,
  Sparkles,
  Copy,
  Globe,
  ShieldCheck,
  Gauge,
  Command,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden text-white">
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_18%_20%,rgba(14,165,233,0.2),transparent_35%),radial-gradient(circle_at_82%_80%,rgba(245,158,11,0.16),transparent_32%)]" />
      <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-[#070b12]/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-sky-500 to-amber-400 shadow-[0_8px_24px_rgba(14,165,233,0.35)] flex items-center justify-center">
              <Mic className="w-4 h-4 text-[#04131f]" />
            </div>
            <span className="text-xl font-bold tracking-tight font-mono text-sky-100">
              SoyVOZ
            </span>
          </div>
          <div className="hidden md:flex items-center gap-10">
            <a
              href="#features"
              className="text-sm font-medium text-slate-400 hover:text-sky-100 transition-colors"
            >
              Características
            </a>
            <a
              href="#workflow"
              className="text-sm font-medium text-slate-400 hover:text-sky-100 transition-colors"
            >
              Flujo
            </a>
            <a
              href="#privacy"
              className="text-sm font-medium text-slate-400 hover:text-sky-100 transition-colors"
            >
              Privacidad
            </a>
          </div>
          <div className="flex items-center gap-5">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="px-5 py-2.5 rounded-full bg-sky-400 text-[#021521] text-sm font-bold hover:bg-sky-300 transition-all shadow-xl"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative px-6 pt-36 pb-20">
        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-sky-300/20 bg-sky-400/10 text-xs font-semibold text-sky-200 mb-8 animate-in fade-in slide-in-from-bottom-3 duration-700">
            <Sparkles className="w-3.5 h-3.5" />
            Inspirado en la experiencia de SFlow
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[0.95] mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            Habla una vez.
            <br />
            <span className="bg-gradient-to-r from-sky-300 to-amber-200 bg-clip-text text-transparent font-mono">
              Escribe en cualquier parte.
            </span>
          </h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed font-medium animate-in fade-in slide-in-from-bottom-5 duration-700 delay-150">
            SoyVOZ captura tu dictado, lo limpia con IA y lo deja listo para
            pegar. Flujo de trabajo rápido, claro y con sensación de herramienta
            profesional.
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300">
            <Link
              href="/dashboard"
              className="w-full md:w-auto px-10 py-5 rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-400 text-[#03131f] text-lg font-bold hover:opacity-95 transition-all shadow-2xl shadow-sky-500/20"
            >
              Abrir cabina de voz
            </Link>
            <Link
              href="/login"
              className="w-full md:w-auto px-10 py-5 rounded-2xl bg-white/5 border border-white/15 text-sky-100 text-lg font-bold hover:bg-white/10 transition-all shadow-xl text-center"
            >
              Conectar cuenta
            </Link>
          </div>
        </div>
      </section>

      <section id="workflow" className="pb-28 px-6">
        <div className="mx-auto max-w-4xl rounded-[36px] border border-white/10 bg-[#060d16]/80 p-8 md:p-10 shadow-[0_28px_80px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-7">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-sky-300/80 mb-2">
                Estado de sesión
              </p>
              <h2 className="text-2xl md:text-3xl font-bold text-sky-100">
                Pill UI de dictado
              </h2>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
              Listo para grabar
            </span>
          </div>
          <div className="rounded-3xl border border-white/10 bg-[#030810] p-7 md:p-9">
            <div className="mx-auto max-w-xl rounded-full border border-white/15 bg-[#081423] px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-sky-400/15 border border-sky-300/30 flex items-center justify-center">
                  <Mic className="w-4 h-4 text-sky-200" />
                </div>
                <p className="text-sm md:text-base text-slate-100 font-semibold">
                  Mantener Espacio para hablar
                </p>
              </div>
              <kbd className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                Space
              </kbd>
            </div>
            <div className="mt-8 flex items-end justify-center gap-1.5 h-16">
              {[2, 4, 6, 9, 11, 8, 6, 3, 5, 10, 12, 8, 4, 2].map(
                (height, index) => (
                  <div
                    key={index}
                    className="w-2 rounded-full bg-gradient-to-t from-sky-500 via-cyan-400 to-amber-200 animate-wave"
                    style={{
                      height: `${height * 6}%`,
                      animationDelay: `${index * 0.08}s`,
                    }}
                  />
                ),
              )}
            </div>
            <p className="mt-8 text-center text-lg text-slate-300">
              &quot;Necesito un correo claro para reagendar la reunión del
              viernes&quot;
            </p>
          </div>
        </div>
      </section>

      <section
        id="features"
        className="py-24 border-y border-white/10 bg-[#060a12]/70"
      >
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Gauge className="w-5 h-5 text-sky-300" />}
              title="Latencia baja"
              desc="Dictado continuo con feedback visual en vivo y transición clara entre grabar, procesar y listo."
            />
            <FeatureCard
              icon={<Sparkles className="w-5 h-5 text-amber-300" />}
              title="Texto refinado"
              desc="Limpieza inteligente de muletillas, gramática y tono para que el resultado salga utilizable al instante."
            />
            <FeatureCard
              icon={<Copy className="w-5 h-5 text-cyan-300" />}
              title="Auto-copiado"
              desc="Al terminar, el resultado se copia solo para pegarlo en correo, chat, CRM o donde estés trabajando."
            />
            <FeatureCard
              icon={<Command className="w-5 h-5 text-orange-300" />}
              title="Atajos rápidos"
              desc="Flujo estilo push-to-talk: mantén espacio para hablar o toca el botón si prefieres control manual."
            />
            <FeatureCard
              icon={<Globe className="w-5 h-5 text-emerald-300" />}
              title="Multi idioma"
              desc="Compatible con dictado en español, inglés y otros idiomas soportados por Whisper."
            />
            <FeatureCard
              icon={<ShieldCheck className="w-5 h-5 text-slate-200" />}
              title="Control y privacidad"
              desc="Arquitectura con historial y control de sesión para evitar perder contexto y mantener trazabilidad."
            />
          </div>
        </div>
      </section>

      <section id="privacy" className="py-20 px-6">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-[#06101a]/90 p-8 md:p-10 text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-sky-200/70 mb-3">
            Hecho para uso real
          </p>
          <h3 className="text-3xl md:text-4xl font-bold text-sky-100 mb-4">
            Inspiración SFlow, identidad SoyVOZ
          </h3>
          <p className="text-slate-300 leading-relaxed">
            Tomamos lo mejor del enfoque de rapidez y claridad de SFlow, y lo
            aterrizamos a tu stack web/electron con el look and feel propio de
            SoyVOZ.
          </p>
        </div>
      </section>

      <footer className="py-12 border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5 text-slate-300">
            <Mic className="w-4 h-4 text-sky-300" />
            <span className="font-mono">SoyVOZ</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <Link
              href="/dashboard"
              className="hover:text-sky-200 transition-colors"
            >
              Cabina
            </Link>
            <Link
              href="/login"
              className="hover:text-sky-200 transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="hover:text-sky-200 transition-colors"
            >
              Registro
            </Link>
          </div>
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} SoyVOZ
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <article className="group rounded-3xl border border-white/10 bg-[#07101a]/75 p-6 transition-all hover:-translate-y-1 hover:border-sky-300/30">
      <div className="mb-4 h-11 w-11 rounded-2xl border border-white/15 bg-white/5 flex items-center justify-center">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-100 mb-2">{title}</h3>
      <p className="text-slate-400 leading-relaxed text-sm">{desc}</p>
    </article>
  );
}
