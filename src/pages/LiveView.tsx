import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Users, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLoja } from "@/contexts/LojaContext";
import { useLiveVisitorsRealtime } from "@/hooks/useLiveVisitorsRealtime";
import { MetricCard } from "@/components/live-view/MetricCard";
import { LiveActivityTable } from "@/components/live-view/LiveActivityTable";

const LogisticsGlobe = lazy(() => import("@/components/ui/logistics-globe"));

function GlobeSkeleton() {
  return (
    <div className="w-full max-w-[700px] mx-auto aspect-square rounded-full bg-gradient-to-br from-blue-950/40 to-zinc-900/40 animate-pulse border border-zinc-800" />
  );
}

// AudioContext precisa ser criado/retomado dentro de um gesto do usuário,
// então mantemos uma instância única ativada no primeiro clique de "Som".
let sharedAudioCtx: AudioContext | null = null;
function ensureAudioCtx() {
  if (!sharedAudioCtx) {
    try {
      sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function playBeep() {
  const ctx = sharedAudioCtx;
  if (!ctx || ctx.state !== "running") return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.05;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.08);
  } catch {
    /* noop */
  }
}

export default function LiveView() {
  // Use loja from context (already validated by LojaProvider against the user's
  // own stores via RLS). This guards against URL tampering: if the user
  // changes :lojaId to another user's store, LojaProvider redirects to /lojas
  // before we ever subscribe, and `loja` stays null in the meantime.
  const { loja, loading: lojaLoading } = useLoja();
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
    lojaId: loja?.id ?? null,
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
    id: m.city, // estável por cidade — mesma cidade = mesma posição entre updates
    location: m.location,
    city: m.city,
    count: m.count,
  }));

  // Build arcs from the busiest city to the next top cities, giving the globe
  // a sense of "live traffic flow" between visitor hotspots.
  const globeArcs =
    globeMarkers.length > 1
      ? globeMarkers.slice(1, 8).map((m, i) => ({
          id: `arc-${i}`,
          from: globeMarkers[0].location,
          to: m.location,
        }))
      : [];

  // Loja still being validated against the user's account — render nothing
  // sensitive until LojaProvider confirms ownership (or redirects away).
  if (lojaLoading || !loja) {
    return (
      <div className="min-h-full flex items-center justify-center text-sm text-muted-foreground">
        Carregando Live View…
      </div>
    );
  }

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-100">
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
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Metrics column */}
          <div className="lg:col-span-2 flex flex-col gap-4 self-start">
            <MetricCard
              label="Visitantes Online"
              value={totalOnline}
              icon={Users}
              history={visitorsHistory}
              accent="green"
            />

            {/* Controls card — preenche o espaço vazio abaixo do contador */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-md p-5">
              <div className="text-zinc-400 text-xs uppercase tracking-wider font-medium mb-3">
                Controles
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSoundOn((s) => {
                      const next = !s;
                      if (next) {
                        // ativa o AudioContext no gesto do usuário e dá um beep de confirmação
                        ensureAudioCtx();
                        setTimeout(playBeep, 50);
                      }
                      return next;
                    });
                  }}
                  className="justify-start border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:text-zinc-100 text-zinc-300"
                >
                  {soundOn ? <Volume2 className="h-4 w-4 mr-2" /> : <VolumeX className="h-4 w-4 mr-2" />}
                  Som {soundOn ? "Ligado" : "Desligado"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaused((p) => !p)}
                  className="justify-start border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:text-zinc-100 text-zinc-300"
                >
                  {paused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                  {paused ? "Retomar atualizações" : "Pausar atualizações"}
                </Button>
              </div>
              <p className="mt-3 text-[11px] text-zinc-500 leading-relaxed">
                {paused
                  ? "Atualizações em tempo real pausadas."
                  : soundOn
                  ? "Você ouvirá um beep a cada novo visitante."
                  : "Ative o som para receber alertas sonoros."}
              </p>
            </div>
          </div>

          {/* Globe column */}
          <div
            className="lg:col-span-3 relative rounded-2xl border border-zinc-800 p-4 md:p-6 overflow-hidden"
            style={{
              background:
                "radial-gradient(ellipse at center, #1a2332 0%, #0b1220 70%, #060a14 100%)",
            }}
          >
            <div className="relative">
              <Suspense fallback={<GlobeSkeleton />}>
                <LogisticsGlobe markers={globeMarkers} arcs={globeArcs} speed={0.0008} />
              </Suspense>
            </div>
            <div className="absolute bottom-4 left-4 text-xs space-y-1.5 bg-zinc-900/70 backdrop-blur-sm border border-zinc-700/60 rounded-lg px-3 py-2 text-zinc-300">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
                Visitante ativo
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-zinc-400" />
                Rota de tráfego
              </div>
            </div>
            <div className="absolute top-4 right-4 text-[10px] uppercase tracking-wider text-zinc-400 font-mono">
              {markers.length} cidades · {totalOnline} sessões
            </div>
          </div>
        </div>

        {/* Activity table */}
        <div className="mt-6">
          <LiveActivityTable rows={recentActivity} />
        </div>

        <div className="mt-6 text-center text-[11px] text-zinc-600">
          Tráfego ao vivo das suas páginas públicas de rastreio · isolado por loja
        </div>
      </div>
    </div>
  );
}
