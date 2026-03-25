"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { History, Search, Copy, Check, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";

type TranscriptionRecord = {
  id: number;
  original_text: string;
  refined_text: string;
  language: string | null;
  duration_seconds: number | null;
  created_at: string;
};

export default function TranscriptionHistory({
  onSelect,
  refreshTrigger,
}: {
  onSelect?: (text: string) => void;
  refreshTrigger?: number;
}) {
  const [records, setRecords] = useState<TranscriptionRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [visibleCount, setVisibleCount] = useState(20);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isElectron = typeof window !== "undefined" && !!(window as any).electron?.dbGetRecent;

  const loadHistory = useCallback(async () => {
    if (!isElectron) return;
    try {
      if (searchQuery.trim()) {
        const results = await (window as any).electron.dbSearch(searchQuery.trim(), visibleCount);
        setRecords(results);
      } else {
        const results = await (window as any).electron.dbGetRecent(visibleCount);
        setRecords(results);
      }
      const count = await (window as any).electron.dbCount();
      setTotalCount(count);
    } catch {
      // DB not available
    }
  }, [isElectron, searchQuery, visibleCount]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, refreshTrigger]);

  const handleSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        setVisibleCount(20);
      }, 300);
    },
    [],
  );

  const handleCopy = async (text: string, id: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
      toast.success("Copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await (window as any).electron.dbDelete(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setTotalCount((prev) => prev - 1);
      toast.success("Eliminado");
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("es", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  if (!isElectron) return null;

  return (
    <div className="w-full mt-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">
            Historial
          </span>
          {totalCount > 0 && (
            <span className="text-xs text-gray-600 bg-white/5 px-2 py-0.5 rounded-full">
              {totalCount}
            </span>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar en historial..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-purple-500/30"
        />
      </div>

      {/* Records */}
      {records.length === 0 ? (
        <p className="text-center text-sm text-gray-600 py-6">
          {searchQuery ? "Sin resultados" : "Sin transcripciones aun"}
        </p>
      ) : (
        <div className="space-y-2">
          {records.map((record) => {
            const isExpanded = expandedId === record.id;
            return (
              <div
                key={record.id}
                className="rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] transition-all overflow-hidden"
              >
                {/* Header row */}
                <div
                  className="flex items-start gap-3 p-3 cursor-pointer"
                  onClick={() => {
                    setExpandedId(isExpanded ? null : record.id);
                    if (onSelect) onSelect(record.refined_text);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm text-gray-300 ${isExpanded ? "" : "line-clamp-2"}`}>
                      {record.refined_text}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[11px] text-gray-600">
                        {formatDate(record.created_at)}
                      </span>
                      {record.duration_seconds && (
                        <span className="text-[11px] text-gray-600">
                          {record.duration_seconds.toFixed(1)}s
                        </span>
                      )}
                      {record.language && (
                        <span className="text-[10px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded">
                          {record.language}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(record.refined_text, record.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                      title="Copiar"
                    >
                      {copiedId === record.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-gray-500" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(record.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-gray-600 hover:text-red-400" />
                    </button>
                  </div>
                </div>

                {/* Expanded: show original text */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-white/5">
                    <p className="text-[11px] text-gray-600 uppercase tracking-wider mt-2 mb-1">
                      Texto original
                    </p>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      {record.original_text}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Load more */}
      {records.length >= visibleCount && totalCount > visibleCount && (
        <button
          onClick={() => setVisibleCount((prev) => prev + 20)}
          className="w-full mt-3 py-2 flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          <ChevronDown className="w-3.5 h-3.5" />
          Cargar mas ({totalCount - visibleCount} restantes)
        </button>
      )}
    </div>
  );
}
