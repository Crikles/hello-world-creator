import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Globe,
  Infinity as InfinityIcon,
  Zap,
  ShieldCheck,
  Mail,
  MessageSquare,
  Webhook,
  Languages,
  CreditCard,
  RotateCcw,
  Sparkles,
  LineChart,
  Layers,
  Activity,
} from "lucide-react";
import logoShopify from "@/assets/logo-shopify.png";
import logoCloudfy from "@/assets/logo-cloudfy.png";
import logoZedy from "@/assets/logo-zedy.png";
import logoVega from "@/assets/logo-vega.png";
import logoLuna from "@/assets/logo-luna.png";
import logoAdoorei from "@/assets/logo-adoorei.png";
import logoAlphazz from "@/assets/logo-alphazz.png";
import logoNuvorafy from "@/assets/logo-nuvorafy.png";

/* ============================================================
   MAGNUS FRETE — Data-Room / Terminal LP
   ============================================================ */

const GOLD = "#c9a84c";
const GOLD_DIM = "#8a7635";
const LIVE = "#22c55e";

const LOGIN_URL = "https://magnusfrete.net/login";
const SIGNUP_URL = "https://magnusfrete.net/signup";

/* ---------------- helpers ---------------- */

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function fmtTime(d: Date) {
  return d.toTimeString().slice(0, 8);
}

function AnimatedNumber({
  value,
  suffix = "",
  prefix = "",
  decimals = 0,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 50, damping: 20 });
  const text = useTransform(spring, (v) =>
    decimals === 0
      ? Math.round(v).toLocaleString("pt-BR")
      : v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
  );
  useEffect(() => {
    if (inView) mv.set(value);
  }, [inView, value, mv]);
  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      <motion.span>{text}</motion.span>
      {suffix}
    </span>
  );
}

function LiveDot({ color = LIVE }: { color?: string }) {
  return (
    <span className="relative inline-flex h-2 w-2 items-center justify-center">
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
        style={{ background: color }}
      />
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

/* ---------------- top bar ---------------- */

function TerminalTopBar() {
  const now = useNow();
  return (
    <div className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-white/70">
        <div className="flex items-center gap-4">
          <img src="/logo-magnus.png" alt="Magnus Frete" className="h-6 w-auto" />
          <span className="hidden text-white/30 md:inline">/</span>
          <span className="hidden md:inline">data-room v2026.06</span>
        </div>
        <div className="hidden items-center gap-6 md:flex">
          <span className="flex items-center gap-2">
            <LiveDot /> system online
          </span>
          <span>uptime 99.98%</span>
          <span>{fmtTime(now)} UTC-3</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={LOGIN_URL}
            className="rounded-sm border border-white/15 px-3 py-1.5 text-white/80 transition hover:border-white/40 hover:text-white"
          >
            Login
          </a>
          <a
            href={SIGNUP_URL}
            className="rounded-sm px-3 py-1.5 text-black transition hover:opacity-90"
            style={{ background: GOLD }}
          >
            Criar conta
          </a>
        </div>
      </div>
    </div>
  );
}

/* ---------------- price hero ---------------- */

function PriceHero() {
  return (
    <section className="relative overflow-hidden border-b border-white/10">
      {/* grid background */}
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
        }}
      />
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(900px 500px at 20% 20%, rgba(201,168,76,0.18), transparent 60%), radial-gradient(700px 400px at 90% 80%, rgba(201,168,76,0.10), transparent 60%)",
        }}
      />

      <div className="relative mx-auto grid max-w-[1400px] gap-12 px-6 py-24 lg:grid-cols-[1.4fr_1fr] lg:py-32">
        {/* left: headline */}
        <div>
          <div className="mb-6 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.25em] text-white/50">
            <span className="h-px w-8 bg-white/30" />
            <span>pricing · live</span>
          </div>

          <h1 className="font-serif text-[clamp(3rem,8vw,7rem)] leading-[0.95] tracking-tight text-white">
            Menos de
            <br />
            <span style={{ color: GOLD }}>R$ 2,00</span>
            <br />
            por envio.
          </h1>

          <div className="mt-8 grid max-w-2xl gap-3 font-mono text-sm text-white/70 sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-sm border border-white/10 bg-white/[0.02] px-3 py-2.5">
              <InfinityIcon className="h-4 w-4" style={{ color: GOLD }} />
              <span>Envios ilimitados</span>
            </div>
            <div className="flex items-center gap-2 rounded-sm border border-white/10 bg-white/[0.02] px-3 py-2.5">
              <ShieldCheck className="h-4 w-4" style={{ color: GOLD }} />
              <span>Sem plano mensal</span>
            </div>
            <div className="flex items-center gap-2 rounded-sm border border-white/10 bg-white/[0.02] px-3 py-2.5">
              <Zap className="h-4 w-4" style={{ color: GOLD }} />
              <span>Pague pelo uso</span>
            </div>
          </div>

          <p className="mt-8 max-w-xl text-base leading-relaxed text-white/55">
            Você só paga pelo que envia. Sem mínimos, sem assinatura, sem letras miúdas. A plataforma de
            pós-venda e rastreamento usada por lojas que transacionam{" "}
            <span className="text-white">50.000+ pedidos por mês</span>.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href={SIGNUP_URL}
              className="group inline-flex items-center gap-2 rounded-sm px-6 py-3.5 font-mono text-sm uppercase tracking-[0.18em] text-black transition"
              style={{ background: GOLD }}
            >
              Acessar plataforma
              <ArrowUpRight className="h-4 w-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
            <a
              href={LOGIN_URL}
              className="inline-flex items-center gap-2 rounded-sm border border-white/20 px-6 py-3.5 font-mono text-sm uppercase tracking-[0.18em] text-white/80 transition hover:border-white/60 hover:text-white"
            >
              Entrar
            </a>
          </div>
        </div>

        {/* right: KPI panel */}
        <KpiPanel />
      </div>
    </section>
  );
}

function KpiPanel() {
  return (
    <div className="relative">
      <div className="rounded-sm border border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          <span className="flex items-center gap-2">
            <LiveDot /> live metrics
          </span>
          <span>~/magnus</span>
        </div>
        <div className="divide-y divide-white/10">
          <KpiRow label="Pedidos hoje" value={<AnimatedNumber value={3284} />} delta="+12.4%" />
          <KpiRow label="Pedidos no mês" value={<AnimatedNumber value={52480} />} delta="+8.1%" />
          <KpiRow label="Lojas ativas" value={<AnimatedNumber value={1847} />} delta="+24" />
          <KpiRow
            label="Países atendidos"
            value={
              <span className="tabular-nums">
                <AnimatedNumber value={3} />
              </span>
            }
            delta="BR · US · ES"
            deltaMuted
          />
          <KpiRow
            label="Custo por envio"
            value={
              <span style={{ color: GOLD }}>
                R$ <AnimatedNumber value={1.89} decimals={2} />
              </span>
            }
            delta="-58% vs mercado"
          />
        </div>
        <div className="border-t border-white/10 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
          <span className="text-white/60">$</span> stream connected · last_update 0.4s
        </div>
      </div>
    </div>
  );
}

function KpiRow({
  label,
  value,
  delta,
  deltaMuted,
}: {
  label: string;
  value: React.ReactNode;
  delta: string;
  deltaMuted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/50">{label}</div>
      <div className="flex items-center gap-4">
        <span className="font-serif text-2xl text-white">{value}</span>
        <span
          className="rounded-sm border px-2 py-0.5 font-mono text-[10px]"
          style={{
            borderColor: deltaMuted ? "rgba(255,255,255,0.15)" : "rgba(34,197,94,0.3)",
            color: deltaMuted ? "rgba(255,255,255,0.5)" : LIVE,
          }}
        >
          {delta}
        </span>
      </div>
    </div>
  );
}

/* ---------------- orders ticker ---------------- */

const SAMPLE_ORDERS = [
  { id: "48211", status: "PAID", from: "BR", to: "US", src: "Shopify" },
  { id: "48212", status: "DELIVERED", from: "BR", to: "BR", src: "Cloudfy" },
  { id: "48213", status: "SHIPPED", from: "ES", to: "ES", src: "Zedy" },
  { id: "48214", status: "PAID", from: "BR", to: "BR", src: "Adoorei" },
  { id: "48215", status: "OUT_FOR_DELIVERY", from: "US", to: "US", src: "Shopify" },
  { id: "48216", status: "PAID", from: "BR", to: "ES", src: "Cloudfy" },
  { id: "48217", status: "IN_TRANSIT", from: "BR", to: "US", src: "Vega" },
  { id: "48218", status: "DELIVERED", from: "ES", to: "ES", src: "Luna" },
  { id: "48219", status: "PAID", from: "BR", to: "BR", src: "Nuvorafy" },
  { id: "48220", status: "SHIPPED", from: "BR", to: "US", src: "Alphazz" },
];

function statusColor(s: string) {
  if (s === "PAID") return GOLD;
  if (s === "DELIVERED") return LIVE;
  return "#7dd3fc";
}

function OrdersTicker() {
  const items = [...SAMPLE_ORDERS, ...SAMPLE_ORDERS];
  return (
    <section className="border-b border-white/10 bg-black">
      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
        <LiveDot /> orders feed · realtime
      </div>
      <div className="relative overflow-hidden">
        <div className="flex animate-[ticker_60s_linear_infinite] whitespace-nowrap py-3 font-mono text-[12px] text-white/70">
          {items.map((o, i) => (
            <div key={i} className="flex items-center gap-3 px-6">
              <span className="text-white/40">#{o.id}</span>
              <span style={{ color: statusColor(o.status) }}>{o.status}</span>
              <span className="text-white/50">
                {o.from} <span className="text-white/30">→</span> {o.to}
              </span>
              <span className="text-white/40">· {o.src}</span>
              <span className="text-white/20">|</span>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes ticker {from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
    </section>
  );
}

/* ---------------- data room ---------------- */

const CHART_DATA = [
  { m: "Jan", v: 18420 },
  { m: "Fev", v: 22180 },
  { m: "Mar", v: 27940 },
  { m: "Abr", v: 31260 },
  { m: "Mai", v: 42870 },
  { m: "Jun", v: 52480 },
];

function DataRoomPanel() {
  return (
    <section className="border-b border-white/10 py-24">
      <div className="mx-auto max-w-[1400px] px-6">
        <SectionHeader index="02" title="Data-room ao vivo" subtitle="Tudo que sua loja precisa em um único console." />

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {/* Big chart */}
          <div className="rounded-sm border border-white/10 bg-white/[0.02] lg:col-span-2">
            <PanelHeader label="Pedidos · últimos 6 meses" right="+185% YoY" />
            <div className="p-6">
              <BigChart />
            </div>
          </div>

          {/* Events log */}
          <div className="rounded-sm border border-white/10 bg-white/[0.02]">
            <PanelHeader label="Eventos recentes" right={<LiveDot />} />
            <EventLog />
          </div>

          {/* Routes map */}
          <div className="rounded-sm border border-white/10 bg-white/[0.02]">
            <PanelHeader label="Rotas ativas" right="BR · US · ES" />
            <RoutesMap />
          </div>

          {/* Checkout distribution */}
          <div className="rounded-sm border border-white/10 bg-white/[0.02] lg:col-span-2">
            <PanelHeader label="Distribuição por checkout" right="9 integrações" />
            <CheckoutDistribution />
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeader({ index, title, subtitle }: { index: string; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-3 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-xs text-white/40">[{index}]</span>
        <h2 className="font-serif text-4xl text-white md:text-5xl">{title}</h2>
      </div>
      <p className="max-w-md text-sm text-white/50">{subtitle}</p>
    </div>
  );
}

function PanelHeader({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">{label}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">{right}</span>
    </div>
  );
}

function BigChart() {
  const W = 720;
  const H = 280;
  const PAD_L = 48;
  const PAD_R = 24;
  const PAD_T = 20;
  const PAD_B = 36;
  const max = Math.max(...CHART_DATA.map((d) => d.v)) * 1.1;
  const stepX = (W - PAD_L - PAD_R) / (CHART_DATA.length - 1);

  const pts = CHART_DATA.map((d, i) => ({
    x: PAD_L + i * stepX,
    y: PAD_T + (H - PAD_T - PAD_B) * (1 - d.v / max),
    v: d.v,
    m: d.m,
  }));

  // Catmull-Rom to bezier
  const path = pts.reduce((acc, p, i, arr) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const p0 = arr[i - 2] || arr[i - 1];
    const p1 = arr[i - 1];
    const p2 = p;
    const p3 = arr[i + 1] || p;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    return `${acc} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }, "");

  const area = `${path} L ${pts[pts.length - 1].x} ${H - PAD_B} L ${pts[0].x} ${H - PAD_B} Z`;

  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((t) => PAD_T + (H - PAD_T - PAD_B) * t);
  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * (1 - t)));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="bcArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.35" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </linearGradient>
        <filter id="bcGlow">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {gridYs.map((y, i) => (
        <g key={i}>
          <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="2 4" />
          <text x={PAD_L - 8} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize="10" fontFamily="JetBrains Mono">
            {gridVals[i].toLocaleString("pt-BR")}
          </text>
        </g>
      ))}

      <path d={area} fill="url(#bcArea)" />
      <path d={path} fill="none" stroke={GOLD} strokeWidth="2" filter="url(#bcGlow)" />

      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#0a0a0a" stroke={GOLD} strokeWidth="1.5" />
          <text x={p.x} y={H - PAD_B + 18} textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="10" fontFamily="JetBrains Mono">
            {p.m}
          </text>
          <text x={p.x} y={p.y - 12} textAnchor="middle" fill="rgba(255,255,255,0.65)" fontSize="10" fontFamily="JetBrains Mono">
            {p.v.toLocaleString("pt-BR")}
          </text>
        </g>
      ))}
    </svg>
  );
}

const EVENTS = [
  { t: "14:22:08", k: "ORDER", c: GOLD, m: "#48221 paid · Shopify · BR" },
  { t: "14:22:04", k: "EMAIL", c: "#7dd3fc", m: "Confirmação enviada · pt-BR" },
  { t: "14:21:58", k: "TRACK", c: LIVE, m: "#48198 delivered · Atlas" },
  { t: "14:21:51", k: "ORDER", c: GOLD, m: "#48220 paid · Cloudfy · ES" },
  { t: "14:21:47", k: "EMAIL", c: "#7dd3fc", m: "Confirmación · es-ES" },
  { t: "14:21:39", k: "WEBHK", c: "#a78bfa", m: "Magnus → Loja · 200 OK" },
  { t: "14:21:33", k: "TRACK", c: LIVE, m: "#48201 out_for_delivery · Jetline" },
  { t: "14:21:28", k: "ORDER", c: GOLD, m: "#48219 paid · Adoorei · BR" },
];

function EventLog() {
  return (
    <div className="px-2 py-2 font-mono text-[11px]">
      {EVENTS.map((e, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-1.5">
          <span className="text-white/30">{e.t}</span>
          <span className="rounded-sm px-1.5 py-0.5 text-[9px]" style={{ background: `${e.c}22`, color: e.c }}>
            {e.k}
          </span>
          <span className="truncate text-white/65">{e.m}</span>
        </div>
      ))}
    </div>
  );
}

function RoutesMap() {
  // simple stylized world
  const nodes = {
    BR: { x: 200, y: 170, label: "BR" },
    US: { x: 100, y: 90, label: "US" },
    ES: { x: 260, y: 90, label: "ES" },
  };
  return (
    <div className="p-4">
      <svg viewBox="0 0 340 240" className="w-full">
        <defs>
          <linearGradient id="route" x1="0" x2="1">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0" />
            <stop offset="50%" stopColor={GOLD} stopOpacity="1" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* connections */}
        {[
          [nodes.BR, nodes.US],
          [nodes.BR, nodes.ES],
          [nodes.US, nodes.ES],
        ].map(([a, b], i) => (
          <g key={i}>
            <path
              d={`M ${a.x} ${a.y} Q ${(a.x + b.x) / 2} ${(a.y + b.y) / 2 - 40} ${b.x} ${b.y}`}
              stroke="url(#route)"
              strokeWidth="1.2"
              fill="none"
            />
          </g>
        ))}

        {Object.values(nodes).map((n) => (
          <g key={n.label}>
            <circle cx={n.x} cy={n.y} r="20" fill="rgba(201,168,76,0.08)" stroke={GOLD} strokeOpacity="0.4" />
            <circle cx={n.x} cy={n.y} r="5" fill={GOLD} />
            <text
              x={n.x}
              y={n.y + 38}
              textAnchor="middle"
              fill="rgba(255,255,255,0.7)"
              fontSize="11"
              fontFamily="JetBrains Mono"
            >
              {n.label}
            </text>
          </g>
        ))}
      </svg>

      <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-white/50">
        <div className="rounded-sm border border-white/10 px-2 py-1.5">
          <div className="text-white/40">BR→US</div>
          <div className="text-white/80">18.420</div>
        </div>
        <div className="rounded-sm border border-white/10 px-2 py-1.5">
          <div className="text-white/40">BR→ES</div>
          <div className="text-white/80">12.117</div>
        </div>
        <div className="rounded-sm border border-white/10 px-2 py-1.5">
          <div className="text-white/40">BR→BR</div>
          <div className="text-white/80">21.943</div>
        </div>
      </div>
    </div>
  );
}

const CHECKOUTS = [
  { name: "Shopify", logo: logoShopify, pct: 38 },
  { name: "Cloudfy", logo: logoCloudfy, pct: 21 },
  { name: "Zedy", logo: logoZedy, pct: 12 },
  { name: "Adoorei", logo: logoAdoorei, pct: 10 },
  { name: "Vega", logo: logoVega, pct: 8 },
  { name: "Luna", logo: logoLuna, pct: 5 },
  { name: "Alphazz", logo: logoAlphazz, pct: 4 },
  { name: "Nuvorafy", logo: logoNuvorafy, pct: 2 },
];

function CheckoutDistribution() {
  return (
    <div className="grid gap-2 p-4 sm:grid-cols-2">
      {CHECKOUTS.map((c) => (
        <div key={c.name} className="flex items-center gap-3 rounded-sm border border-white/5 bg-white/[0.02] p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-white/90 p-1.5">
            <img src={c.logo} alt={c.name} className="max-h-full max-w-full object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-white/80">{c.name}</span>
              <span className="text-white/50">{c.pct}%</span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/5">
              <div className="h-full" style={{ width: `${c.pct * 2.5}%`, background: GOLD }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- routes / flags section ---------------- */

const FLAGS = [
  { code: "br", name: "Brasil", logistic: "Atlas · Jetline · Jadlog" },
  { code: "us", name: "United States", logistic: "Magnus Global US" },
  { code: "es", name: "España", logistic: "Magnus Global ES" },
];

function CountriesSection() {
  return (
    <section className="border-b border-white/10 py-24">
      <div className="mx-auto max-w-[1400px] px-6">
        <SectionHeader
          index="03"
          title="Cobertura global"
          subtitle="Logística própria em três países, com templates de e-mail e rastreio no idioma certo."
        />

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {FLAGS.map((f) => (
            <div key={f.code} className="rounded-sm border border-white/10 bg-white/[0.02] p-6">
              <div className="flex items-center gap-4">
                <img
                  src={`https://flagcdn.com/w80/${f.code}.png`}
                  alt={f.name}
                  className="h-10 w-14 rounded-sm border border-white/10 object-cover"
                />
                <div>
                  <div className="font-serif text-2xl text-white">{f.name}</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                    {f.code.toUpperCase()} · live
                  </div>
                </div>
              </div>
              <div className="mt-6 border-t border-white/10 pt-4 font-mono text-[11px] text-white/60">
                <span className="text-white/40">logistics →</span> {f.logistic}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- price comparison ---------------- */

const COMPARE = [
  { name: "Magnus Frete", price: "R$ 1,89", monthly: "Sem mensalidade", limit: "Ilimitado", us: true },
  { name: "Concorrente A", price: "R$ 4,90", monthly: "R$ 197/mês", limit: "5.000/mês" },
  { name: "Concorrente B", price: "R$ 3,80", monthly: "R$ 297/mês", limit: "10.000/mês" },
  { name: "Concorrente C", price: "R$ 2,40", monthly: "R$ 497/mês", limit: "Ilimitado" },
];

function PriceCompareTable() {
  return (
    <section className="border-b border-white/10 py-24">
      <div className="mx-auto max-w-[1400px] px-6">
        <SectionHeader
          index="04"
          title="Por que somos diferentes"
          subtitle="Pague apenas pelo que envia. Sem mensalidade. Sem teto de envios."
        />

        <div className="mt-12 overflow-hidden rounded-sm border border-white/10">
          <table className="w-full font-mono text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-left text-[10px] uppercase tracking-[0.2em] text-white/50">
                <th className="px-5 py-3">Plataforma</th>
                <th className="px-5 py-3">Custo / envio</th>
                <th className="px-5 py-3">Mensalidade</th>
                <th className="px-5 py-3">Limite</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((c) => (
                <tr
                  key={c.name}
                  className={`border-b border-white/5 last:border-0 ${
                    c.us ? "bg-[rgba(201,168,76,0.06)]" : ""
                  }`}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {c.us && <Sparkles className="h-3.5 w-3.5" style={{ color: GOLD }} />}
                      <span className={c.us ? "text-white" : "text-white/70"}>{c.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4" style={{ color: c.us ? GOLD : "rgba(255,255,255,0.65)" }}>
                    {c.price}
                  </td>
                  <td className="px-5 py-4 text-white/65">{c.monthly}</td>
                  <td className="px-5 py-4 text-white/65">{c.limit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
          * valores médios de mercado coletados em jun/2026 — sem assinatura, sem fidelidade.
        </div>
      </div>
    </section>
  );
}

/* ---------------- feature console ---------------- */

const FEATURES = [
  { name: "tracking_widget", label: "Widget de rastreio white-label", tag: "ENABLED", icon: LineChart },
  { name: "email_flows", label: "Fluxos de e-mail (BR · EN · ES)", tag: "LIVE", icon: Mail },
  { name: "sms_notifications", label: "Notificações SMS automáticas", tag: "ENABLED", icon: MessageSquare },
  { name: "webhooks", label: "Webhooks para sua stack", tag: "ENABLED", icon: Webhook },
  { name: "upsell_engine", label: "Upsell no rastreio", tag: "BETA", icon: CreditCard },
  { name: "global_flows", label: "Fluxo internacional automático", tag: "LIVE", icon: Globe },
  { name: "multi_lang", label: "Templates por idioma", tag: "ENABLED", icon: Languages },
  { name: "reverse_logistics", label: "Logística reversa integrada", tag: "ENABLED", icon: RotateCcw },
  { name: "live_view", label: "Live view de clientes na loja", tag: "LIVE", icon: Activity },
  { name: "checkout_bridge", label: "Bridge para checkouts (9+)", tag: "ENABLED", icon: Layers },
];

function tagColor(t: string) {
  if (t === "LIVE") return LIVE;
  if (t === "BETA") return "#a78bfa";
  return GOLD;
}

function FeatureConsole() {
  return (
    <section className="border-b border-white/10 py-24">
      <div className="mx-auto max-w-[1400px] px-6">
        <SectionHeader
          index="05"
          title="Tudo que sua loja precisa"
          subtitle="Recursos prontos para ativar — sem código, sem fricção."
        />

        <div className="mt-12 overflow-hidden rounded-sm border border-white/10 bg-black">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
            <span className="ml-3">magnus@features ~ % ls --all</span>
          </div>
          <div className="divide-y divide-white/5 font-mono text-[13px]">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.name} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-white/30">{">"}</span>
                    <Icon className="h-3.5 w-3.5 text-white/40" />
                    <span className="text-white/80">{f.name}</span>
                    <span className="hidden truncate text-white/40 md:inline">··· {f.label}</span>
                  </div>
                  <span
                    className="rounded-sm border px-2 py-0.5 text-[10px] uppercase tracking-[0.15em]"
                    style={{
                      borderColor: `${tagColor(f.tag)}55`,
                      color: tagColor(f.tag),
                      background: `${tagColor(f.tag)}10`,
                    }}
                  >
                    [{f.tag}]
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- final CTA ---------------- */

function FinalCTA() {
  return (
    <section className="relative overflow-hidden border-b border-white/10 py-32">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(700px 400px at 50% 50%, rgba(201,168,76,0.25), transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-[1400px] px-6 text-center">
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-white/50">
          [06] · começar agora
        </div>
        <h2 className="mx-auto mt-6 max-w-4xl font-serif text-[clamp(2.5rem,6vw,5rem)] leading-[1.05] text-white">
          Menos de <span style={{ color: GOLD }}>R$ 2,00</span> por envio.
          <br />
          Sem mensalidade. Ilimitado.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-white/55">
          Crie sua conta agora. Conecte seu checkout em minutos. Pague apenas pelos envios que rodarem.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <a
            href={SIGNUP_URL}
            className="inline-flex items-center gap-2 rounded-sm px-8 py-4 font-mono text-sm uppercase tracking-[0.18em] text-black"
            style={{ background: GOLD }}
          >
            Criar minha conta <ArrowUpRight className="h-4 w-4" />
          </a>
          <a
            href={LOGIN_URL}
            className="inline-flex items-center gap-2 rounded-sm border border-white/20 px-8 py-4 font-mono text-sm uppercase tracking-[0.18em] text-white/80 transition hover:border-white/60 hover:text-white"
          >
            Já tenho conta
          </a>
        </div>
      </div>
    </section>
  );
}

/* ---------------- footer ---------------- */

function TerminalFooter() {
  const now = useNow();
  return (
    <footer className="bg-black">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-6 py-8 font-mono text-[11px] uppercase tracking-[0.18em] text-white/40 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo-magnus.png" alt="Magnus Frete" className="h-5 w-auto opacity-80" />
          <span>© {new Date().getFullYear()} Magnus Frete</span>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <a href="/termos" className="transition hover:text-white">
            Termos de uso
          </a>
          <a href={LOGIN_URL} className="transition hover:text-white">
            Login
          </a>
          <a href={SIGNUP_URL} className="transition hover:text-white">
            Criar conta
          </a>
        </div>
        <div className="flex items-center gap-3">
          <LiveDot />
          <span>build 2026.06 · {fmtTime(now)}</span>
        </div>
      </div>
    </footer>
  );
}

/* ---------------- page ---------------- */

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white antialiased">
      <TerminalTopBar />
      <PriceHero />
      <OrdersTicker />
      <DataRoomPanel />
      <CountriesSection />
      <PriceCompareTable />
      <FeatureConsole />
      <FinalCTA />
      <TerminalFooter />
    </main>
  );
}
