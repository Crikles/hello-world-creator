import { useEffect, useRef, useState } from "react";
import type { ElementType } from "react";
import { motion, useInView, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BellRing,
  Boxes,
  Check,
  CreditCard,
  Eye,
  Globe2,
  Infinity as InfinityIcon,
  Languages,
  LineChart,
  Mail,
  MailCheck,
  MessageCircle,
  PackageCheck,
  PlugZap,
  Radar,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  Truck,
  Webhook,
  Zap,
} from "lucide-react";

import logoAdoorei from "@/assets/logo-adoorei.png";
import logoAlphazz from "@/assets/logo-alphazz.png";
import logoCloudfy from "@/assets/logo-cloudfy.png";
import logoCorvex from "@/assets/logo-corvex.ico";
import logoLuna from "@/assets/logo-luna.png";
import logoNuvorafy from "@/assets/logo-nuvorafy.png";
import logoShopify from "@/assets/logo-shopify.png";
import logoVega from "@/assets/logo-vega.png";
import logoZedy from "@/assets/logo-zedy.png";

const LOGIN_URL = "https://magnusfrete.net/login";
const SIGNUP_URL = "https://magnusfrete.net/signup";

function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 48, damping: 18 });
  const text = useTransform(spring, (v) =>
    v.toLocaleString("pt-BR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }),
  );

  useEffect(() => {
    if (inView) mv.set(value);
  }, [inView, mv, value]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      <motion.span>{text}</motion.span>
      {suffix}
    </span>
  );
}

function LiveDot() {
  return (
    <span className="relative inline-flex h-2.5 w-2.5 items-center justify-center">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
    </span>
  );
}

function Header() {
  const links = [
    { label: "Dashboard", href: "#dashboard" },
    { label: "Benefícios", href: "#beneficios" },
    { label: "Integrações", href: "#integracoes" },
    { label: "Preços", href: "#precos" },
    { label: "Termos", href: "/termos-de-uso" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-5 py-4 lg:px-8">
        <a href="#top" className="flex items-center" aria-label="Magnus Frete">
          <img src="/logo-magnus.png" alt="Magnus Frete" className="h-12 w-auto object-contain md:h-16" />
        </a>

        <nav className="hidden items-center gap-7 font-sans text-sm text-foreground/68 lg:flex">
          {links.map((link) => (
            <a key={link.label} href={link.href} className="transition hover:text-primary">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href={LOGIN_URL}
            className="hidden rounded-sm border border-border px-4 py-2.5 text-sm font-medium text-foreground/80 transition hover:border-primary/50 hover:text-primary sm:inline-flex"
          >
            Login
          </a>
          <a
            href={SIGNUP_URL}
            className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Criar conta
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="relative overflow-hidden border-b border-border/70">
      <div className="absolute inset-0 bg-grid-pattern opacity-35" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_25%_10%,hsl(var(--primary)/0.18),transparent_55%),radial-gradient(ellipse_at_85%_40%,hsl(var(--primary)/0.08),transparent_45%)]" />

      <div className="relative mx-auto grid max-w-[1440px] items-center gap-12 px-5 py-16 lg:grid-cols-[0.92fr_1.08fr] lg:px-8 lg:py-20 xl:py-24">
        <div>
          <div className="mb-7 inline-flex items-center gap-3 border border-primary/25 bg-primary/5 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
            <LiveDot /> pós-venda de alta escala
          </div>

          <h1 className="font-serif text-[clamp(3.35rem,7vw,7.4rem)] leading-[0.9] text-foreground">
            Magnus Frete
            <span className="mt-3 block text-primary">R$ 1,50</span>
            <span className="block">por envio.</span>
          </h1>

          <p className="mt-7 max-w-2xl text-lg leading-8 text-foreground/64">
            Rastreamento, e-mails automáticos, SMS, WhatsApp, integração com checkouts e fluxos globais para lojas que
            precisam operar milhares de pedidos sem mensalidade e sem limite mensal de envios.
          </p>

          <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
            <HeroPill icon={InfinityIcon} label="Envios ilimitados" />
            <HeroPill icon={ShieldCheck} label="Sem plano mensal" />
            <HeroPill icon={Zap} label="Só paga se usar" />
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href={SIGNUP_URL}
              className="inline-flex items-center gap-2 rounded-sm bg-primary px-7 py-4 font-mono text-sm font-semibold uppercase tracking-[0.16em] text-primary-foreground transition hover:bg-primary/90"
            >
              Começar agora
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#dashboard"
              className="inline-flex items-center gap-2 rounded-sm border border-border px-7 py-4 font-mono text-sm uppercase tracking-[0.16em] text-foreground/75 transition hover:border-primary/50 hover:text-primary"
            >
              Ver a plataforma
            </a>
          </div>
        </div>

        <DashboardPreview />
      </div>
    </section>
  );
}

function HeroPill({ icon: Icon, label }: { icon: ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 border border-border bg-card/50 px-3 py-3 text-sm text-foreground/75">
      <Icon className="h-4 w-4 text-primary" />
      <span>{label}</span>
    </div>
  );
}

const CHART_DATA = [
  { month: "Jan", value: 18210 },
  { month: "Fev", value: 21980 },
  { month: "Mar", value: 25944 },
  { month: "Abr", value: 33760 },
  { month: "Mai", value: 41890 },
  { month: "Jun", value: 52480 },
];

function DashboardPreview() {
  return (
    <div id="dashboard" className="relative">
      <div className="absolute -inset-4 border border-primary/10 bg-primary/5 blur-2xl" />
      <div className="relative overflow-hidden rounded-sm border border-border bg-card shadow-2xl shadow-primary/10">
        <div className="flex items-center justify-between border-b border-border bg-secondary/35 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-primary/40" />
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Magnus dashboard</span>
          </div>
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
            <LiveDot /> online
          </span>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[0.78fr_1.22fr]">
          <div className="space-y-4">
            <KpiCard label="Pedidos no mês" value="52.480" note="+26% em 30 dias" icon={PackageCheck} highlight />
            <KpiCard label="Receita monitorada" value="R$ 4.892.730" note="25.944 pedidos no pico" icon={LineChart} />
            <KpiCard label="Custo médio" value="R$ 1,50" note="sem plano mensal" icon={CreditCard} />
          </div>

          <div className="space-y-4">
            <div className="border border-border bg-background/45 p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Pedidos nos últimos 6 meses</p>
                  <h3 className="mt-1 font-serif text-3xl text-foreground">crescimento visível</h3>
                </div>
                <span className="border border-primary/25 bg-primary/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-primary">
                  +188%
                </span>
              </div>
              <SalesChart />
            </div>

            <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
              <TrackingRoutesCard />
              <ActiveChannelsCard />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  note,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string;
  note: string;
  icon: ElementType;
  highlight?: boolean;
}) {
  return (
    <div className={`border p-4 ${highlight ? "border-primary/35 bg-primary/10" : "border-border bg-background/45"}`}>
      <div className="mb-5 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="font-serif text-4xl leading-none text-foreground">{value}</div>
      <div className="mt-3 text-xs text-foreground/55">{note}</div>
    </div>
  );
}

function SalesChart() {
  const width = 720;
  const height = 260;
  const padX = 52;
  const padTop = 22;
  const padBottom = 38;
  const max = Math.max(...CHART_DATA.map((d) => d.value)) * 1.12;
  const step = (width - padX * 2) / (CHART_DATA.length - 1);

  const points = CHART_DATA.map((item, index) => ({
    x: padX + index * step,
    y: padTop + (height - padTop - padBottom) * (1 - item.value / max),
    ...item,
  }));

  const path = points.reduce((acc, point, index, arr) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const prev2 = arr[index - 2] || arr[index - 1];
    const prev = arr[index - 1];
    const next = arr[index + 1] || point;
    const c1x = prev.x + (point.x - prev2.x) / 6;
    const c1y = prev.y + (point.y - prev2.y) / 6;
    const c2x = point.x - (next.x - prev.x) / 6;
    const c2y = point.y - (next.y - prev.y) / 6;
    return `${acc} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${point.x} ${point.y}`;
  }, "");

  const area = `${path} L ${points[points.length - 1].x} ${height - padBottom} L ${points[0].x} ${height - padBottom} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Gráfico de pedidos dos últimos seis meses">
      <defs>
        <linearGradient id="salesArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
        <filter id="salesGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {[0.2, 0.4, 0.6, 0.8].map((fraction) => (
        <line
          key={fraction}
          x1={padX}
          x2={width - padX}
          y1={padTop + (height - padTop - padBottom) * fraction}
          y2={padTop + (height - padTop - padBottom) * fraction}
          stroke="hsl(var(--border))"
          strokeDasharray="4 8"
        />
      ))}
      <path d={area} fill="url(#salesArea)" />
      <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="3" filter="url(#salesGlow)" />

      {points.map((point) => (
        <g key={point.month}>
          <circle cx={point.x} cy={point.y} r="5" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="2" />
          <text x={point.x} y={height - 14} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="12" fontFamily="JetBrains Mono">
            {point.month}
          </text>
          <text x={point.x} y={point.y - 13} textAnchor="middle" fill="hsl(var(--foreground))" fillOpacity="0.72" fontSize="11" fontFamily="JetBrains Mono">
            {point.value.toLocaleString("pt-BR")}
          </text>
        </g>
      ))}
    </svg>
  );
}

function TrackingRoutesCard() {
  const routes = [
    { flag: "br", label: "Nacional", value: "38.520" },
    { flag: "us", label: "Global US", value: "9.840" },
    { flag: "es", label: "Global ES", value: "4.120" },
  ];

  return (
    <div className="border border-border bg-background/45 p-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Rastreios</p>
        <Truck className="h-4 w-4 text-primary" />
      </div>
      <div className="space-y-2">
        {routes.map((route) => (
          <div key={route.label} className="flex items-center justify-between gap-3 border border-border/80 bg-secondary/20 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <img src={`https://flagcdn.com/w40/${route.flag}.png`} alt={route.label} className="h-5 w-7 shrink-0 rounded-sm object-cover" />
              <span className="truncate whitespace-nowrap text-sm text-foreground/78">{route.label}</span>
            </div>
            <span className="shrink-0 whitespace-nowrap font-mono text-xs text-primary">{route.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActiveChannelsCard() {
  const channels = ["E-mail", "SMS", "WhatsApp", "Webhook", "Upsell", "Global", "Recuperação", "LiveView"];

  return (
    <div className="border border-border bg-background/45 p-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Canais ativos</p>
        <Radar className="h-4 w-4 text-primary" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {channels.map((channel) => (
          <div key={channel} className="flex items-center gap-2 border border-primary/15 bg-primary/5 px-2.5 py-2 text-xs text-foreground/75">
            <Check className="h-3.5 w-3.5 text-primary" />
            {channel}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProofStrip() {
  return (
    <section className="border-b border-border/70 bg-secondary/20">
      <div className="mx-auto grid max-w-[1440px] gap-px border-x border-border/60 bg-border/60 md:grid-cols-4">
        <ProofItem label="Pedidos/mês" value={<AnimatedNumber value={50000} suffix="+" />} />
        <ProofItem label="Custo por envio" value="R$ 1,50" />
        <ProofItem label="Mensalidade" value="R$ 0" />
        <ProofItem label="Limite mensal" value="Ilimitado" />
      </div>
    </section>
  );
}

function ProofItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-background px-6 py-7">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <div className="mt-2 font-serif text-4xl text-foreground">{value}</div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-primary">{eyebrow}</p>
      <h2 className="mt-4 font-serif text-[clamp(2.4rem,5vw,5rem)] leading-[0.98] text-foreground">{title}</h2>
      <p className="mt-5 text-base leading-8 text-foreground/60">{subtitle}</p>
    </div>
  );
}

const BENEFITS = [
  {
    icon: MailCheck,
    title: "Fluxos automáticos de e-mail",
    text: "Envie confirmação de pagamento, atualizações de rastreio e comunicações por etapa sem operação manual.",
  },
  {
    icon: MessageCircle,
    title: "SMS e WhatsApp integrados",
    text: "Acompanhe o cliente no canal certo, reduzindo tickets e aumentando a confiança depois da compra.",
  },
  {
    icon: Globe2,
    title: "Global em inglês e espanhol",
    text: "Fluxos internacionais com idioma, país de origem e experiência de rastreio correta para cada operação.",
  },
  {
    icon: BadgeCheck,
    title: "Rastreio white-label",
    text: "Página de rastreio com identidade da operação, status claro e espaço para ofertas de upsell.",
  },
  {
    icon: Webhook,
    title: "Webhooks e API Magnus",
    text: "Conecte sua loja, checkout ou operação própria com uma ponte preparada para alto volume.",
  },
  {
    icon: BellRing,
    title: "Pós-venda que escala",
    text: "Centralize envios, notificações, eventos e acompanhamento para mais de 50 mil pedidos mensais.",
  },
];

function BenefitsSection() {
  return (
    <section id="beneficios" className="border-b border-border/70 py-24 lg:py-28">
      <div className="mx-auto max-w-[1440px] px-5 lg:px-8">
        <SectionHeader
          eyebrow="Tudo que sua loja precisa"
          title="Benefícios claros para operação, atendimento e escala."
          subtitle="A Magnus não é só uma tela de rastreio: é uma camada completa de pós-venda para conectar checkout, logística, mensagens e experiência do cliente."
        />

        <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {BENEFITS.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <div key={benefit.title} className="border border-border bg-card/70 p-6 transition hover:border-primary/40 hover:bg-card">
                <div className="mb-8 flex h-12 w-12 items-center justify-center border border-primary/25 bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-serif text-3xl text-foreground">{benefit.title}</h3>
                <p className="mt-4 leading-7 text-foreground/58">{benefit.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const INTEGRATIONS = [
  { name: "Shopify", logo: logoShopify },
  { name: "Cloudfy", logo: logoCloudfy },
  { name: "Zedy", logo: logoZedy },
  { name: "Vega", logo: logoVega },
  { name: "Luna", logo: logoLuna },
  { name: "Adoorei", logo: logoAdoorei },
  { name: "Alphazz", logo: logoAlphazz },
  { name: "Nuvorafy", logo: logoNuvorafy },
  { name: "Corvex", logo: logoCorvex },
];

function MagnusApiIcon() {
  return (
    <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden border border-primary/25 bg-primary/10">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,hsl(var(--primary)/0.25),transparent_55%)]" />
      <PlugZap className="relative h-7 w-7 text-primary" />
    </div>
  );
}

function IntegrationsSection() {
  return (
    <section id="integracoes" className="border-b border-border/70 bg-secondary/10 py-24 lg:py-28">
      <div className="mx-auto max-w-[1440px] px-5 lg:px-8">
        <SectionHeader
          eyebrow="Checkouts e integrações"
          title="Conecte os pedidos onde sua loja já vende."
          subtitle="Temos integração com os principais checkouts e também uma API própria para operações que precisam de uma ponte personalizada."
        />

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {INTEGRATIONS.map((integration) => (
            <div key={integration.name} className="border border-border bg-card/80 p-5 transition hover:border-primary/40">
              <div className="mb-5 flex h-14 w-14 items-center justify-center border border-border bg-foreground p-2">
                <img src={integration.logo} alt={integration.name} className="max-h-full max-w-full object-contain" />
              </div>
              <h3 className="font-serif text-2xl text-foreground">{integration.name}</h3>
              <p className="mt-2 text-sm text-foreground/55">Integração disponível na Magnus Frete.</p>
            </div>
          ))}

          <div className="border border-primary/30 bg-primary/10 p-5 transition hover:border-primary/60">
            <div className="mb-5">
              <MagnusApiIcon />
            </div>
            <h3 className="font-serif text-2xl text-foreground">Magnus API</h3>
            <p className="mt-2 text-sm text-foreground/65">Integração direta para lojas, ERPs e checkouts próprios.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

const COUNTRIES = [
  { code: "br", name: "Brasil", title: "Rastreio nacional", text: "Operação nacional com identificação por bandeira, status claros e fluxo em português." },
  { code: "us", name: "United States", title: "Global US", text: "Comunicação em inglês para pedidos internacionais com experiência alinhada ao país." },
  { code: "es", name: "España", title: "Global ES", text: "Fluxos em espanhol, origem global e templates preparados para o cliente final." },
];

function CountriesSection() {
  return (
    <section className="border-b border-border/70 py-24 lg:py-28">
      <div className="mx-auto max-w-[1440px] px-5 lg:px-8">
        <SectionHeader
          eyebrow="Nacional e global"
          title="Cada pedido com o país, idioma e logística correta."
          subtitle="A experiência identifica Brasil, Global US e Global ES para facilitar leitura, suporte e confiança do cliente final."
        />

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {COUNTRIES.map((country) => (
            <div key={country.code} className="border border-border bg-card/70 p-7">
              <img
                src={`https://flagcdn.com/w160/${country.code}.png`}
                alt={`Bandeira: ${country.name}`}
                className="h-16 w-24 rounded-sm border border-border object-cover"
              />
              <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">{country.name}</p>
              <h3 className="mt-2 font-serif text-3xl text-foreground">{country.title}</h3>
              <p className="mt-4 leading-7 text-foreground/58">{country.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const COMPARE = [
  { platform: "Magnus Frete", cost: "R$ 1,50", monthly: "R$ 0", limit: "Ilimitado", featured: true },
  { platform: "Concorrente A", cost: "R$ 2,00", monthly: "Plano mensal", limit: "1.000 pedidos/mês" },
  { platform: "Concorrente B", cost: "R$ 2,50", monthly: "Plano mensal", limit: "2.000 pedidos/mês" },
  { platform: "Concorrente C", cost: "Acima de R$ 2,00", monthly: "Plano mensal", limit: "Limite por faixa" },
];

function PriceSection() {
  return (
    <section id="precos" className="border-b border-border/70 py-24 lg:py-28">
      <div className="mx-auto max-w-[1440px] px-5 lg:px-8">
        <SectionHeader
          eyebrow="Por que somos diferentes"
          title="R$ 1,50 por envio, sem plano mensal e sem travar seu crescimento."
          subtitle="Enquanto outras plataformas cobram mensalidade, preço maior por pedido e limitam o volume, a Magnus foi pensada para escala real."
        />

        <div className="mt-14 overflow-hidden border border-border bg-card">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-border bg-secondary/35 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                <th className="px-5 py-4">Plataforma</th>
                <th className="px-5 py-4">Custo por pedido</th>
                <th className="px-5 py-4">Mensalidade</th>
                <th className="px-5 py-4">Limite de envios</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row) => (
                <tr key={row.platform} className={`border-b border-border last:border-b-0 ${row.featured ? "bg-primary/10" : ""}`}>
                  <td className="px-5 py-5">
                    <div className="flex items-center gap-3">
                      {row.featured ? <Sparkles className="h-4 w-4 text-primary" /> : <span className="h-4 w-4" />}
                      <span className={`font-medium ${row.featured ? "text-foreground" : "text-foreground/68"}`}>{row.platform}</span>
                    </div>
                  </td>
                  <td className={`px-5 py-5 font-serif text-2xl ${row.featured ? "text-primary" : "text-foreground/72"}`}>{row.cost}</td>
                  <td className="px-5 py-5 text-foreground/68">{row.monthly}</td>
                  <td className="px-5 py-5 text-foreground/68">{row.limit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <PriceNote icon={CreditCard} title="Sem assinatura" text="Não existe plano mensal obrigatório para manter a conta rodando." />
          <PriceNote icon={InfinityIcon} title="Sem teto mensal" text="Se sua loja vender 1.000 ou 50.000 pedidos, o fluxo continua disponível." />
          <PriceNote icon={Boxes} title="Custo previsível" text="R$ 1,50 por envio para o lojista calcular margem sem surpresa." />
        </div>
      </div>
    </section>
  );
}

function PriceNote({ icon: Icon, title, text }: { icon: ElementType; title: string; text: string }) {
  return (
    <div className="border border-border bg-card/60 p-5">
      <Icon className="h-5 w-5 text-primary" />
      <h3 className="mt-4 font-serif text-2xl text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-foreground/58">{text}</p>
    </div>
  );
}

function FinalCTA() {
  return (
    <section className="relative overflow-hidden py-24 lg:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.18),transparent_62%)]" />
      <div className="relative mx-auto max-w-5xl px-5 text-center lg:px-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-primary">comece com estrutura de grande operação</p>
        <h2 className="mt-5 font-serif text-[clamp(2.8rem,6vw,6rem)] leading-[0.96] text-foreground">
          50 mil pedidos por mês não cabem em pós-venda manual.
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-foreground/62">
          Conecte sua loja, ative os fluxos e deixe a Magnus cuidar do rastreio, mensagens e integrações por R$ 1,50 por envio.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <a
            href={SIGNUP_URL}
            className="inline-flex items-center gap-2 rounded-sm bg-primary px-8 py-4 font-mono text-sm font-semibold uppercase tracking-[0.16em] text-primary-foreground transition hover:bg-primary/90"
          >
            Criar conta
            <ArrowUpRight className="h-4 w-4" />
          </a>
          <a
            href={LOGIN_URL}
            className="inline-flex items-center gap-2 rounded-sm border border-border px-8 py-4 font-mono text-sm uppercase tracking-[0.16em] text-foreground/75 transition hover:border-primary/50 hover:text-primary"
          >
            Acessar login
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8 px-5 py-10 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center gap-4">
          <img src="/logo-magnus.png" alt="Magnus Frete" className="h-12 w-auto object-contain" />
          <div>
            <p className="font-semibold text-foreground">Magnus Frete</p>
            <p className="mt-1 text-sm text-muted-foreground">Pós-venda, rastreio e integrações para lojas de alta escala.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-5 text-sm text-foreground/62">
          <a href="/termos-de-uso" className="transition hover:text-primary">
            Termos de uso
          </a>
          <a href={LOGIN_URL} className="transition hover:text-primary">
            Login
          </a>
          <a href={SIGNUP_URL} className="transition hover:text-primary">
            Criar conta
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  useEffect(() => {
    document.title = "Magnus Frete — Rastreio inteligente para e-commerce";
  }, []);
  return (
    <main className="min-h-screen bg-background text-foreground antialiased">
      <Header />
      <Hero />
      <ProofStrip />
      <BenefitsSection />
      <IntegrationsSection />
      <CountriesSection />
      <PriceSection />
      <FinalCTA />
      <Footer />
    </main>
  );
}