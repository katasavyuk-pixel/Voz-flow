import Link from "next/link";
import { Mic, Zap, Sparkles, Copy, Globe, ShieldCheck } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white selection:bg-purple-500/30 overflow-x-hidden">
      {/* Background Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-cyan-600/5 blur-[100px] rounded-full pointer-events-none z-0" />

      {/* Navbar */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-[#0A0A0B]/60 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-purple-500 via-fuchsia-500 to-cyan-500 shadow-lg shadow-purple-500/20 flex items-center justify-center">
              <Mic className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Voz Flow
            </span>
          </div>
          <div className="hidden md:flex items-center gap-10">
            <a href="#features" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Características</a>
            <a href="#how-it-works" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Cómo funciona</a>
            <a href="#pricing" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Precios</a>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="px-5 py-2.5 rounded-full bg-white text-black text-sm font-bold hover:bg-gray-200 transition-all shadow-xl"
            >
              Empezar ahora
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6">
        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/20 bg-purple-500/5 text-xs font-semibold text-purple-400 mb-8 animate-in fade-in slide-in-from-bottom-3 duration-1000">
            <Sparkles className="w-3.5 h-3.5" />
            El Flow con AI ya está aquí
          </div>
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            Deja de escribir.<br />
            <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent italic">
              Empieza a fluir.
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed font-medium animate-in fade-in slide-in-from-bottom-5 duration-700 delay-150">
            Transforma tu voz en texto perfecto y pulido al instante. Solo habla. Nosotros nos encargamos de la transcripción, la gramática y el tono.
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300">
            <Link
              href="/dashboard"
              className="w-full md:w-auto px-10 py-5 rounded-2xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-cyan-600 text-lg font-bold hover:opacity-90 transition-all shadow-2xl shadow-purple-500/20"
            >
              Abrir SoyVOZ Web
            </Link>
            <a
              href="#"
              className="w-full md:w-auto px-10 py-5 rounded-2xl bg-white text-black text-lg font-bold hover:bg-gray-200 transition-all shadow-xl flex items-center justify-center gap-2"
            >
              <Zap className="w-5 h-5 fill-black" /> Descargar Escritorio (Win)
            </a>
          </div>
        </div>
      </section>

      {/* Live Waveform Demo Preview */}
      <section className="pb-32 px-6">
        <div className="mx-auto max-w-4xl relative">
          <div className="absolute inset-x-0 -top-10 h-20 bg-gradient-to-b from-transparent to-[#0A0A0B] z-10" />
          <div className="rounded-[40px] border border-white/10 bg-[#111112] p-2 shadow-2xl overflow-hidden group">
            <div className="rounded-[32px] border border-white/5 bg-[#0A0A0B] p-12 text-center relative overflow-hidden">
              {/* Animated Waveforms */}
              <div className="flex items-center justify-center gap-1.5 h-20 mb-8">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 8, 5, 3, 4, 6, 9].map((h, i) => (
                  <div
                    key={i}
                    className="w-1.5 rounded-full bg-gradient-to-t from-purple-500 to-cyan-400 opacity-60 animate-wave"
                    style={{ height: `${h * 10}%`, animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
              <p className="text-2xl font-bold text-gray-300 mb-2 italic">
                "Transcribe estas notas de la reunión en un resumen profesional..."
              </p>
              <div className="inline-flex items-center gap-2 text-sm text-purple-400 font-semibold">
                <Zap className="w-4 h-4 fill-purple-400" />
                Procesando Flow con IA...
              </div>

              {/* Floating Orb for that Wispr touch */}
              <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-purple-500/20 blur-[80px] rounded-full group-hover:bg-purple-500/30 transition-all duration-1000" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 border-t border-white/5 bg-[#0D0D0E]">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid md:grid-cols-3 gap-12">
            <FeatureCard
              icon={<Zap className="w-6 h-6 text-purple-400" />}
              title="Transcripción Instantánea"
              desc="Impulsado por la tecnología Whisper. Latencia casi nula, incluso para sesiones largas."
            />
            <FeatureCard
              icon={<Sparkles className="w-6 h-6 text-fuchsia-400" />}
              title="Modo AI Flow"
              desc="Elimina muletillas, limpia la gramática y preserva tu voz única automáticamente."
            />
            <FeatureCard
              icon={<Copy className="w-6 h-6 text-cyan-400" />}
              title="Auto-copiado al Portapapeles"
              desc="Una vez terminas de hablar, el texto perfecto ya está en tu portapapeles. Pégalo donde quieras."
            />
            <FeatureCard
              icon={<Globe className="w-6 h-6 text-emerald-400" />}
              title="Potencia Multilingüe"
              desc="Dicta en más de 50 idiomas. Cambia al instante o deja que la IA lo detecte por ti."
            />
            <FeatureCard
              icon={<Mic className="w-6 h-6 text-orange-400" />}
              title="Comandos de Voz"
              desc="Formatea listas, envía correos o cambia el tono simplemente diciéndole a la IA qué hacer."
            />
            <FeatureCard
              icon={<ShieldCheck className="w-6 h-6 text-blue-400" />}
              title="Privacidad Primero"
              desc="Tus grabaciones nunca se usan para entrenamiento. Seguro, encriptado y efímero."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="flex items-center gap-2.5">
            <Mic className="w-5 h-5 text-gray-500" />
            <span className="text-lg font-bold tracking-tight text-gray-400">SoyVOZ</span>
          </div>
          <div className="flex items-center gap-8 text-sm font-medium text-gray-500">
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
            <a href="#" className="hover:text-white transition-colors">Privacidad</a>
            <a href="#" className="hover:text-white transition-colors">Términos</a>
            <a href="#" className="hover:text-white transition-colors">Contacto</a>
          </div>
          <p className="text-sm text-gray-600 font-medium">
            © {new Date().getFullYear()} SoyVOZ. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="group space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-white/20 transition-all">
        {icon}
      </div>
      <h3 className="text-xl font-bold tracking-tight">{title}</h3>
      <p className="text-gray-400 leading-relaxed font-medium">
        {desc}
      </p>
    </div>
  )
}
