"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, Copy, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

type HistoryItem = {
  id: string;
  original_text: string;
  refined_text: string;
  status: string;
  created_at: string;
};

type ApiResponse = {
  items: HistoryItem[];
  error?: string;
};

const PAGE_SIZE = 8;

type DateFilter = "all" | "today" | "week" | "month";

export default function TranscriptionHistory() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const loadHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/transcriptions", { method: "GET" });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(data.error || "No se pudo cargar el historial");
      }

      setItems(data.items ?? []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error al cargar historial";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();

    const handleRefresh = () => {
      loadHistory();
    };

    window.addEventListener("soyvoz:transcription-saved", handleRefresh);
    return () => {
      window.removeEventListener("soyvoz:transcription-saved", handleRefresh);
    };
  }, []);

  const filtered = useMemo(() => {
    const now = Date.now();
    const normalized = query.trim().toLowerCase();

    return items.filter((item) => {
      const matchesQuery =
        !normalized ||
        item.refined_text.toLowerCase().includes(normalized) ||
        item.original_text.toLowerCase().includes(normalized);

      if (!matchesQuery) {
        return false;
      }

      if (dateFilter === "all") {
        return true;
      }

      const createdAtMs = new Date(item.created_at).getTime();
      if (Number.isNaN(createdAtMs)) {
        return false;
      }

      if (dateFilter === "today") {
        const today = new Date();
        const itemDate = new Date(item.created_at);
        return (
          today.getFullYear() === itemDate.getFullYear() &&
          today.getMonth() === itemDate.getMonth() &&
          today.getDate() === itemDate.getDate()
        );
      }

      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      if (dateFilter === "week") {
        return now - createdAtMs <= sevenDays;
      }

      return now - createdAtMs <= thirtyDays;
    });
  }, [dateFilter, items, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    setPage(1);
  }, [query, dateFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <section className="rounded-3xl border border-white/10 bg-[#06111c]/85 p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-semibold text-slate-100">
          Historial reciente
        </h3>
        <span className="text-xs text-slate-400 inline-flex items-center gap-1.5">
          <Clock3 className="w-3.5 h-3.5" /> Ultimas 50 entradas
        </span>
      </div>

      <label className="relative block mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por frase, tema o palabra"
          className="w-full rounded-xl border border-white/10 bg-[#030913] pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
        />
      </label>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(
          [
            ["all", "Todo"],
            ["today", "Hoy"],
            ["week", "7 dias"],
            ["month", "30 dias"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setDateFilter(value)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${dateFilter === value ? "border-sky-300/60 bg-sky-300/20 text-sky-100" : "border-white/10 text-slate-300 hover:bg-white/5"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3 max-h-[360px] overflow-auto pr-1">
        {loading && (
          <p className="text-sm text-slate-400">Cargando historial...</p>
        )}

        {!loading && filtered.length === 0 && (
          <p className="text-sm text-slate-400">
            No encontramos transcripciones con ese criterio.
          </p>
        )}

        {pagedItems.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-white/10 bg-[#071523] p-4"
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-xs text-slate-400 inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-300" />
                {new Date(item.created_at).toLocaleString("es-ES")}
              </p>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(item.refined_text);
                  toast.success("Texto copiado");
                }}
                className="inline-flex items-center gap-1.5 text-xs text-slate-300 border border-white/10 rounded-md px-2 py-1 hover:bg-white/5"
              >
                <Copy className="w-3.5 h-3.5" /> Copiar
              </button>
            </div>
            <p className="text-sm text-slate-100 leading-relaxed line-clamp-4">
              {item.refined_text}
            </p>
          </article>
        ))}
      </div>

      {!loading && filtered.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Pagina {page} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
              className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-slate-300 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-slate-300 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
