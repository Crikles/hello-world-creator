import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { RecentActivity } from "@/hooks/useLiveVisitorsRealtime";

interface Props {
  rows: RecentActivity[];
}

function timeAgo(ts: number, now: number): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  return `há ${h}h`;
}

export function LiveActivityTable({ rows }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-md overflow-hidden">
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">Atividade ao Vivo</h3>
        <span className="text-xs text-zinc-500 font-mono">{rows.length} eventos</span>
      </div>

      {/* Desktop / Tablet table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-500 text-xs uppercase">Tempo</TableHead>
              <TableHead className="text-zinc-500 text-xs uppercase">Localização</TableHead>
              <TableHead className="text-zinc-500 text-xs uppercase">Código</TableHead>
              <TableHead className="text-zinc-500 text-xs uppercase">Status</TableHead>
              <TableHead className="text-zinc-500 text-xs uppercase">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="border-zinc-800">
                <TableCell colSpan={5} className="text-center text-zinc-500 py-8">
                  Aguardando atividade…
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r, idx) => {
                const isFresh = now - r.at < 3000;
                return (
                  <TableRow
                    key={r.id}
                    className={`border-zinc-800 transition-colors animate-in fade-in slide-in-from-top-2 duration-300 ${
                      isFresh && idx === 0 ? "bg-emerald-500/10" : "hover:bg-zinc-800/40"
                    }`}
                  >
                    <TableCell className="font-mono text-xs text-zinc-400">{timeAgo(r.at, now)}</TableCell>
                    <TableCell className="text-zinc-200 text-sm">
                      {r.city}, <span className="text-zinc-500">{r.countryCode}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-blue-400">{r.trackingCode}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Visualizando
                      </span>
                    </TableCell>
                    <TableCell className="text-zinc-300 text-sm">{r.status}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-zinc-800">
        {rows.length === 0 ? (
          <div className="text-center text-zinc-500 py-8 text-sm">Aguardando atividade…</div>
        ) : (
          rows.map((r, idx) => {
            const isFresh = now - r.at < 3000;
            return (
              <div
                key={r.id}
                className={`p-4 animate-in fade-in slide-in-from-top-2 duration-300 ${
                  isFresh && idx === 0 ? "bg-emerald-500/10" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-zinc-200 text-sm font-medium">
                    {r.city}, {r.countryCode}
                  </span>
                  <span className="font-mono text-xs text-zinc-500">{timeAgo(r.at, now)}</span>
                </div>
                <div className="font-mono text-xs text-blue-400 mb-1">{r.trackingCode}</div>
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Visualizando
                  </span>
                  <span className="text-zinc-300 text-xs">{r.status}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
