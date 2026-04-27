import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Users, Package, Globe2, TrendingUp, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLiveVisitorsRealtime } from "@/hooks/useLiveVisitorsRealtime";
import { MetricCard } from "@/components/live-view/MetricCard";
import { LiveActivityTable } from "@/components/live-view/LiveActivityTable";

const LogisticsGlobe = lazy(() => import("@/components/ui/logistics-globe"));

function GlobeSkeleton() {
  return (
    <div className="w-full max-w-[700px] mx-auto aspect-square rounded-full bg-gradient-to-br from-blue-950/40 to-zinc-900/40 animate-pulse border border-zinc-800" />
  );
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.05;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.08);
    setTimeout(() => ctx.close(), 200);
  } catch {
    /* noop */
  }
}

export default function LiveView() {
  const { lojaId } = useParams<{ lojaId: string }>();
  const [paused, setPaused] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  const {
    markers,
    totalOnline,
    trackingCodesCount,
    activeCountries,
    peak24h,
    recentActivity,
    visitorsHistory,
    trackingHistory,
    countriesHistory,
    peakHistory,
    lastUpdateAt,
  } = useLiveVisitorsRealtime({
    lojaId,
    paused,
    onNewVisitor: () => {
      if (soundRef.current) playBeep();
    },
  });

  const [secsAgo, setSecsAgo] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setSecsAgo(Math.floor((Date.now() - lastUpdateAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [lastUpdateAt]);

  const globeMarkers = markers.map((m) => ({
    location: m.location,
    size: Math.min(0.12, 0.04 + m.count * 0.012),
  }));

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100 -m-6 p-6 md:-m-8 md:p-8">
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          background:
            "radial-gradient(ellipse at top, rgba(59,130,246,0.12), transparent 60%), radial-gradient(ellipse at bottom right, rgba(16,185,129,0.08), transparent 60%)",
        }}
      />

      <div className="relative max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Live View</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Ao Vivo</span>
              </span>
            </div>
            <p className="text-sm text-zinc-400 mt-1">
              Visitantes rastreando suas encomendas em tempo real
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500 font-mono px-3 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/50">
              Atualizado há {secsAgo}s
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSoundOn((s) => !s)}
              className="border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:text-zinc-100 text-zinc-300"
            >
              {soundOn ? <Volume2 className="h-4 w-4 mr-1.5" /> : <VolumeX className="h-4 w-4 mr-1.5" />}
              Som {soundOn ? "Ligado" : "Desligado"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaused((p) => !p)}
              className="border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:text-zinc-100 text-zinc-300"
            >
              {paused ? <Play className="h-4 w-4 mr-1.5" /> : <Pause className="h-4 w-4 mr-1.5" />}
              {paused ? "Retomar" : "Pausar"}
            </Button>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Metrics column */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
            <MetricCard
              label="Visitantes Online"
              value={totalOnline}
              icon={Users}
              history={visitorsHistory}
              accent="green"
            />
            <MetricCard
              label="Códigos Rastreados"
              value={trackingCodesCount}
              icon={Package}
              history={trackingHistory}
              accent="blue"
            />
            <MetricCard
              label="Países Ativos"
              value={activeCountries}
              icon={Globe2}
              history={countriesHistory}
              accent="blue"
            />
            <MetricCard
              label="Pico em 24h"
              value={peak24h}
              icon={TrendingUp}
              history={peakHistory}
              accent="green"
            />
          </div>

          {/* Globe column */}
          <div className="lg:col-span-3 relative rounded-2xl border border-zinc-800 bg-zinc-900/30 backdrop-blur-md p-4 md:p-6 overflow-hidden">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle at center, rgba(59,130,246,0.12), transparent 70%)",
              }}
            />
            <div className="relative">
              <Suspense fallback={<GlobeSkeleton />}>
                <LogisticsGlobe markers={globeMarkers} />
              </Suspense>
            </div>
            <div className="absolute bottom-4 left-4 text-xs space-y-1.5 bg-zinc-950/70 backdrop-blur-sm border border-zinc-800 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 text-zinc-300">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Visitante ativo
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Rota de tráfego
              </div>
            </div>
            <div className="absolute top-4 right-4 text-[10px] uppercase tracking-wider text-zinc-500 font-mono">
              {markers.length} cidades · {totalOnline} sessões
            </div>
          </div>
        </div>

        {/* Activity table */}
        <div className="mt-6">
          <LiveActivityTable rows={recentActivity} />
        </div>

        <div className="mt-6 text-center text-[11px] text-zinc-600">
          Dados de demonstração — em breve conectado ao tráfego real das suas páginas de rastreio.
        </div>
      </div>
    </div>
  );
}
