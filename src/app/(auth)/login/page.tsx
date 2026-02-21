"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginPage() {
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                router.push("/dashboard");
            } else {
                setLoading(false);
            }
        };
        checkUser();
    }, [router, supabase]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            <div className="w-full max-w-md space-y-8 rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl shadow-2xl">
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-white">
                        Bienvenido
                    </h1>
                    <p className="mt-2 text-sm text-slate-400">
                        Inicia sesión para continuar
                    </p>
                </div>

                <form className="space-y-6" action="/api/auth/login" method="POST">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-300">
                            Email
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            className="mt-1 block w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                            placeholder="tu@email.com"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                            Contraseña
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            className="mt-1 block w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-fuchsia-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:from-purple-500 hover:to-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all duration-300"
                    >
                        Iniciar Sesión
                    </button>
                </form>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="bg-slate-900/50 px-4 text-slate-400">O continúa con</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <a
                        href="/api/auth/google"
                        className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10 transition-all"
                    >
                        Google
                    </a>
                    <a
                        href="/api/auth/github"
                        className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10 transition-all"
                    >
                        GitHub
                    </a>
                </div>

                <p className="text-center text-sm text-slate-400">
                    ¿No tienes cuenta?{" "}
                    <a href="/register" className="font-medium text-purple-400 hover:text-purple-300 transition-colors">
                        Regístrate
                    </a>
                </p>
            </div>
        </div>
    );
}
