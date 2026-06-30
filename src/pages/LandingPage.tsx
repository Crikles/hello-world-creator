import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useInView, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Box,
  Clock,
  Truck,
  CheckCircle2,
  Mail,
  MessageSquare,
  Webhook,
  Sparkles,
  RotateCcw,
  CreditCard,
  Globe,
  ShieldCheck,
  LineChart,
  Zap,
  Languages,
  FileText,
  Layers,
} from "lucide-react";

/* ---------- helpers ---------- */

function AnimatedNumber({ value, suffix = "", prefix = "" }: { value: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 60, damping: 18 });
  const rounded = useTransform(spring, (v) => {
    if (value >= 1000) return Math.round(v).toLocaleString("pt-BR");
    return v.toFixed(value % 1 === 0 ? 0 : 1);
  });
  useEffect(() => { if (inView) mv.set(value); }, [inView, value, mv]);
  return (
    <span ref={ref} className="tabular-nums">
      {prefix}<motion.span>{rounded}</motion.span>{suffix}
    </span>
  );
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ---------- top nav ---------- */

function Nav() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-[#0a0a0a]/70 border-b border-gold/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <Link to="/lp" className="flex items-center gap-2.5">
          <div className="size-8 rounded-md border border-gold/30 grid place-items-center bg-noir-elevated">
            <span className="font-serif text-gold text-lg leading-none">M</span>
          </div>
          <span className="font-serif text-[22px] tracking-wide text-foreground">Magnus<span className="text-gold">·</span>Frete</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm text-foreground/70">
          <a href="#dashboard" className="hover:text-gold transition">Plataforma</a>
          <a href="#recursos" className="hover:text-gold transition">Recursos</a>
          <a href="#integracoes" className="hover:text-gold transition">Integrações</a>
          <Link to="/termos-de-uso" className="hover:text-gold transition">Termos</Link>
        </nav>
        <div className="flex items-center gap-3">
          <a href="https://magnusfrete.net/login" className="text-sm text-foreground/80 hover:text-gold transition hidden sm:inline">Entrar</a>
          <a
            href="https://magnusfrete.net/signup"
            className="group inline-flex items-center gap-1.5 rounded-md bg-gold text-noir px-4 py-2 text-sm font-medium hover:bg-gold-soft transition"
          >
            Começar agora
            <ArrowRight className="size-3.5 group-hover:translate-x-0.5 transition" />
          </a>
        </div>
      </div>
    </header>
  );
}

/* ---------- hero ---------- */

function Hero() {
  return (
    <section className="relative pt-40 pb-24 overflow-hidden">
      {/* radial gold glow */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(900px 500px at 50% -10%, rgba(201,168,76,0.18), transparent 60%), radial-gradient(700px 400px at 80% 120%, rgba(201,168,76,0.10), transparent 60%)",
        }}
      />
      {/* fine grain */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.5'/></svg>\")",
        }}
      />
      <div className="relative max-w-7xl mx-auto px-6 lg:px-10 text-center">
        <Reveal>
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-noir-elevated/60 px-3.5 py-1.5 text-[12px] uppercase tracking-[0.18em] text-gold-soft">
            <span className="size-1.5 rounded-full bg-gold animate-pulse" />
            Operação ativa · Brasil · Estados Unidos · Espanha
          </div>
        </Reveal>
        <Reveal delay={0.05}>
          <h1 className="mt-7 font-serif text-[clamp(3rem,7vw,6.5rem)] leading-[0.98] text-foreground">
            Logística silenciosa.<br />
            <span className="italic text-gold-soft">Operação implacável.</span>
          </h1>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mt-7 mx-auto max-w-2xl text-foreground/65 text-[17px] leading-relaxed">
            A Magnus Frete orquestra rastreamento, notificações e cobrança para e-commerces
            que vendem em três continentes — sem caos, sem planilhas, sem retrabalho.
          </p>
        </Reveal>
        <Reveal delay={0.2}>
          <div className="mt-10 flex items-center justify-center gap-3 flex-wrap">
            <Link
              to="/signup"
              className="group inline-flex items-center gap-2 rounded-md bg-gold px-6 py-3.5 text-sm font-medium text-noir hover:bg-gold-soft transition"
            >
              Criar minha conta
              <ArrowUpRight className="size-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-md border border-gold/25 px-6 py-3.5 text-sm text-foreground/85 hover:border-gold/50 hover:text-gold transition"
            >
              Já sou cliente
            </Link>
          </div>
        </Reveal>

        {/* flags row */}
        <Reveal delay={0.28}>
          <div className="mt-14 flex items-center justify-center gap-8 sm:gap-14 flex-wrap">
            {[
              { flag: "🇧🇷", label: "Brasil", note: "Rede nacional" },
              { flag: "🇺🇸", label: "Estados Unidos", note: "Fluxo internacional EN" },
              { flag: "🇪🇸", label: "Espanha", note: "Fluxo internacional ES" },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-3 text-left">
                <div className="text-2xl">{f.flag}</div>
                <div>
                  <div className="text-sm text-foreground">{f.label}</div>
                  <div className="text-[11px] uppercase tracking-wider text-foreground/45">{f.note}</div>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- dashboard mock ---------- */

function DashboardMock() {
  const stats = [
    { label: "Total de Pedidos", value: "3.200", icon: Box },
    { label: "Pendentes", value: "0", icon: Clock },
    { label: "Em Trânsito", value: "3.200", icon: Truck },
    { label: "Entregues", value: "2.847", icon: CheckCircle2 },
  ];
  const channels = [
    { name: "Email", desc: "Notificações ativas", icon: Mail, active: true },
    { name: "SMS", desc: "Não configurado", icon: MessageSquare },
    { name: "Webhook", desc: "Não configurado", icon: Webhook },
    { name: "Upsell", desc: "Não configurado", icon: Sparkles },
    { name: "Recuperação", desc: "Não configurado", icon: RotateCcw },
    { name: "Confirmação de Pagamento", desc: "Ativo", icon: CreditCard, active: true },
    { name: "Global", desc: "Ativo · EN/ES", icon: Globe, active: true },
  ];
  return (
    <section id="dashboard" className="relative py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <Reveal>
          <div className="mb-10 flex items-end justify-between flex-wrap gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-gold/80">Painel</div>
              <h2 className="mt-3 font-serif text-4xl md:text-5xl text-foreground">O centro de comando dos seus envios</h2>
            </div>
            <div className="text-sm text-foreground/55 max-w-md">
              Dashboard real da plataforma Magnus. Cada métrica é atualizada em tempo
              real conforme seus pedidos avançam pelos fluxos.
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="relative rounded-2xl border border-gold/15 bg-noir-elevated overflow-hidden shadow-[0_60px_120px_-40px_rgba(0,0,0,0.8)]">
            {/* top bar */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gold/10 bg-noir/60">
              <span className="size-2.5 rounded-full bg-red-500/60" />
              <span className="size-2.5 rounded-full bg-yellow-500/60" />
              <span className="size-2.5 rounded-full bg-green-500/60" />
              <span className="ml-3 text-xs text-foreground/40">app.magnusfrete.net · Dashboard</span>
            </div>

            <div className="p-6 lg:p-8">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="font-serif text-2xl text-foreground">Dashboard</h3>
                  <p className="text-sm text-foreground/50">Bem-vindo de volta. Aqui está o resumo dos seus envios.</p>
                </div>
              </div>

              {/* brazil banner */}
              <div className="mt-6 rounded-xl border border-gold/15 bg-noir/40 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🇧🇷</span>
                  <div>
                    <div className="text-sm font-medium text-foreground">Rastreio Nacional</div>
                    <div className="text-xs text-foreground/50">Envios processados pela logística nacional</div>
                  </div>
                </div>
                <span className="text-[11px] uppercase tracking-wider text-gold border border-gold/30 rounded-full px-2.5 py-0.5">Ativo</span>
              </div>

              {/* stat cards */}
              <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-xl border border-gold/10 bg-noir/40 p-5">
                    <div className="flex items-start justify-between">
                      <div className="text-xs text-foreground/55">{s.label}</div>
                      <div className="size-9 rounded-md border border-gold/15 grid place-items-center text-gold/80">
                        <s.icon className="size-4" />
                      </div>
                    </div>
                    <div className="mt-3 font-serif text-3xl text-foreground">{s.value}</div>
                  </div>
                ))}
              </div>

              {/* chart + channels */}
              <div className="mt-5 grid lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 rounded-xl border border-gold/10 bg-noir/40 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-foreground/80">
                      <LineChart className="size-4 text-gold" /> Faturamento
                    </div>
                    <div className="font-serif text-xl text-gold-soft">R$ 176.966,85</div>
                  </div>
                  <FakeChart />
                </div>
                <div className="rounded-xl border border-gold/10 bg-noir/40 p-5">
                  <div className="text-sm text-foreground/80 mb-3">Canais de Notificação</div>
                  <div className="space-y-2">
                    {channels.map((c) => (
                      <div
                        key={c.name}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                          c.active ? "border-gold/30 bg-gold/[0.04]" : "border-gold/8"
                        }`}
                      >
                        <c.icon className={`size-4 ${c.active ? "text-gold" : "text-foreground/40"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] text-foreground truncate">{c.name}</div>
                          <div className="text-[11px] text-foreground/45 truncate">{c.desc}</div>
                        </div>
                        <span
                          className={`text-[10px] uppercase tracking-wider rounded-full px-2 py-0.5 border ${
                            c.active
                              ? "border-gold/40 text-gold"
                              : "border-foreground/15 text-foreground/40"
                          }`}
                        >
                          {c.active ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function FakeChart() {
  // Smooth fake area chart in SVG
  const pts = [12, 14, 10, 8, 6, 9, 14, 22, 38, 30, 22, 18, 20, 28, 32, 24, 18, 14];
  const w = 600, h = 180, max = 40;
  const step = w / (pts.length - 1);
  const toY = (v: number) => h - (v / max) * h;
  const path = pts.map((v, i) => `${i === 0 ? "M" : "L"} ${i * step} ${toY(v)}`).join(" ");
  const area = `${path} L ${w} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h + 30}`} className="mt-4 w-full h-44">
      <defs>
        <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#c9a84c" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#c9a84c" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#g1)" />
      <path d={path} fill="none" stroke="#c9a84c" strokeWidth="2" />
      <path d={path} fill="none" stroke="#f0d78c" strokeWidth="1" strokeDasharray="3 4" opacity="0.5" />
      {[0, 10, 20, 30, 40].map((v) => (
        <line key={v} x1="0" x2={w} y1={toY(v)} y2={toY(v)} stroke="#c9a84c" strokeOpacity="0.06" />
      ))}
    </svg>
  );
}

/* ---------- numbers strip ---------- */

function NumbersStrip() {
  return (
    <section className="border-y border-gold/10 bg-noir-elevated/40 py-16">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 grid grid-cols-2 md:grid-cols-4 gap-10">
        {[
          { v: 3200, l: "Envios processados / mês", suffix: "+" },
          { v: 99.4, l: "Uptime da plataforma", suffix: "%" },
          { v: 14, l: "Checkouts integrados", suffix: "" },
          { v: 3, l: "Continentes em operação", suffix: "" },
        ].map((n) => (
          <Reveal key={n.l}>
            <div>
              <div className="font-serif text-5xl md:text-6xl text-gold-soft leading-none">
                <AnimatedNumber value={n.v} suffix={n.suffix} />
              </div>
              <div className="mt-3 text-[12px] uppercase tracking-[0.18em] text-foreground/50">{n.l}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------- features ---------- */

const FEATURES = [
  { icon: Truck, title: "Rastreio com sua marca", desc: "Códigos próprios, página de rastreio sob domínio próprio e identidade visual da sua loja." },
  { icon: Globe, title: "Operação internacional", desc: "Fluxos dedicados para Brasil, Estados Unidos e Espanha, com templates em três idiomas." },
  { icon: Zap, title: "Automação ponta a ponta", desc: "Do webhook do checkout até a confirmação de entrega — sem clique manual no meio." },
  { icon: Layers, title: "Multi-loja real", desc: "Gerencie várias operações na mesma conta com créditos, fluxos e métricas isolados." },
  { icon: Languages, title: "Templates EN / ES / PT", desc: "Confirmação de pagamento, em trânsito e entrega — editáveis e versionados por idioma." },
  { icon: ShieldCheck, title: "Segurança bancária", desc: "RLS no banco, isolamento por loja, autenticação verificada via WhatsApp e auditoria contínua." },
];

function Features() {
  return (
    <section id="recursos" className="py-28 relative">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">
        <Reveal>
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.22em] text-gold/80">Capacidades</div>
            <h2 className="mt-3 font-serif text-4xl md:text-5xl text-foreground">
              Não é mais um rastreador. É a sua espinha dorsal logística.
            </h2>
            <p className="mt-5 text-foreground/60 text-lg">
              Cada bloco da Magnus foi construído para suportar lojistas que operam em volume,
              em múltiplas moedas e em múltiplos idiomas — sem perder a estética.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-gold/10 border border-gold/10 rounded-2xl overflow-hidden">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.04}>
              <div className="group bg-noir-elevated p-8 h-full hover:bg-[#181818] transition">
                <div className="size-11 rounded-md border border-gold/25 grid place-items-center text-gold mb-6 group-hover:border-gold/60 transition">
                  <f.icon className="size-5" />
                </div>
                <div className="font-serif text-2xl text-foreground">{f.title}</div>
                <p className="mt-3 text-sm text-foreground/55 leading-relaxed">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- automation split ---------- */

function AutomationSection() {
  return (
    <section className="py-28 relative">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 grid lg:grid-cols-2 gap-14 items-center">
        <Reveal>
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-gold/80">Automação</div>
            <h2 className="mt-3 font-serif text-4xl md:text-5xl text-foreground">
              Seu cliente informado.<br /><span className="italic text-gold-soft">Sem você levantar do café.</span>
            </h2>
            <p className="mt-6 text-foreground/60 text-lg leading-relaxed">
              Email transacional, SMS, WhatsApp e webhooks disparados em cascata conforme o
              status real do pedido. Sem fila, sem cron caseiro, sem "esqueci de avisar".
            </p>
            <ul className="mt-8 space-y-3">
              {[
                "Templates editáveis com preview em tempo real",
                "Logo e nome fantasia injetados em cada e-mail",
                "Domínio remetente verificado (DKIM + SPF)",
                "Fallback automático em falhas temporárias",
              ].map((i) => (
                <li key={i} className="flex items-start gap-3 text-foreground/75">
                  <CheckCircle2 className="size-4 text-gold mt-0.5 shrink-0" />
                  <span className="text-sm">{i}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="space-y-3">
            {[
              { icon: Mail, title: "Email de rastreio enviado", time: "agora", tag: "EN" },
              { icon: MessageSquare, title: "Status atualizado: In transit", time: "2 min", tag: "EN" },
              { icon: Mail, title: "Confirmación de pago enviada", time: "5 min", tag: "ES" },
              { icon: CreditCard, title: "Webhook Cloudfy · PAID", time: "8 min", tag: "BR" },
            ].map((n, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="flex items-center gap-4 rounded-xl border border-gold/15 bg-noir-elevated px-5 py-4"
              >
                <div className="size-10 rounded-md border border-gold/25 grid place-items-center text-gold">
                  <n.icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground truncate">{n.title}</div>
                  <div className="text-[11px] text-foreground/45">há {n.time}</div>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-gold border border-gold/30 rounded-full px-2 py-0.5">{n.tag}</span>
              </motion.div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- integrations marquee ---------- */

const CHECKOUTS = [
  "Shopify", "Cloudfy", "Zedy", "Vega V1", "Vega V2",
  "Luna", "Adoorei", "Corvex", "Alphazz", "Nuvorafy",
  "Recovery", "Resend", "Magnus API",
];

function IntegrationsMarquee() {
  const row = [...CHECKOUTS, ...CHECKOUTS];
  return (
    <section id="integracoes" className="py-28 border-y border-gold/10 bg-noir-elevated/40 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 text-center mb-14">
        <Reveal>
          <div className="text-[11px] uppercase tracking-[0.22em] text-gold/80">Integrações</div>
          <h2 className="mt-3 font-serif text-4xl md:text-5xl text-foreground">
            Conectado a todos os principais checkouts
          </h2>
          <p className="mt-5 max-w-2xl mx-auto text-foreground/60">
            Webhook único, mapeamento automático de campos e suporte oficial para os
            checkouts mais usados pelo ecossistema brasileiro e internacional.
          </p>
        </Reveal>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#0a0a0a] to-transparent z-10" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#0a0a0a] to-transparent z-10" />
        <div className="flex gap-4 animate-[marquee_45s_linear_infinite] w-max">
          {row.map((c, i) => (
            <div
              key={i}
              className="shrink-0 w-56 rounded-xl border border-gold/15 bg-noir px-6 py-5 flex items-center gap-4"
            >
              <div className="size-10 rounded-md border border-gold/25 grid place-items-center font-serif text-gold">
                {c.charAt(0)}
              </div>
              <div>
                <div className="text-sm text-foreground">{c}</div>
                <div className="text-[10px] uppercase tracking-wider text-foreground/45">Checkout</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`@keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </section>
  );
}

/* ---------- final CTA ---------- */

function FinalCTA() {
  return (
    <section className="py-32 relative">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(700px 300px at 50% 50%, rgba(201,168,76,0.18), transparent 70%)",
        }}
      />
      <div className="relative max-w-4xl mx-auto px-6 text-center">
        <Reveal>
          <h2 className="font-serif text-5xl md:text-6xl text-foreground leading-[1.05]">
            Pronto para operar como<br /><span className="italic text-gold-soft">uma transportadora de verdade?</span>
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-7 text-foreground/65 text-lg max-w-xl mx-auto">
            Crie sua conta em menos de dois minutos. Sem cartão, sem fricção, sem letras miúdas.
          </p>
        </Reveal>
        <Reveal delay={0.18}>
          <div className="mt-10 flex items-center justify-center gap-3 flex-wrap">
            <Link
              to="/signup"
              className="group inline-flex items-center gap-2 rounded-md bg-gold px-7 py-4 text-sm font-medium text-noir hover:bg-gold-soft transition"
            >
              Começar agora
              <ArrowUpRight className="size-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-md border border-gold/25 px-7 py-4 text-sm text-foreground/85 hover:border-gold/50 hover:text-gold transition"
            >
              Acessar painel
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- footer ---------- */

function Footer() {
  return (
    <footer className="border-t border-gold/10 bg-noir py-14">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 grid md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-md border border-gold/30 grid place-items-center bg-noir-elevated">
              <span className="font-serif text-gold text-lg leading-none">M</span>
            </div>
            <span className="font-serif text-xl text-foreground">Magnus<span className="text-gold">·</span>Frete</span>
          </div>
          <p className="mt-5 max-w-sm text-sm text-foreground/55 leading-relaxed">
            Plataforma de logística e rastreamento para operações de e-commerce em
            múltiplos países, idiomas e moedas.
          </p>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-gold/80 mb-4">Institucional</div>
          <ul className="space-y-2.5 text-sm text-foreground/65">
            <li><Link to="/termos-de-uso" className="hover:text-gold transition">Termos de Uso</Link></li>
            <li><a href="#recursos" className="hover:text-gold transition">Recursos</a></li>
            <li><a href="#integracoes" className="hover:text-gold transition">Integrações</a></li>
          </ul>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-gold/80 mb-4">Contato</div>
          <ul className="space-y-2.5 text-sm text-foreground/65">
            <li>denuncias@magnusfrete.net</li>
            <li>Atendimento Seg–Sex · 09h–18h</li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 lg:px-10 mt-12 pt-6 border-t border-gold/10 flex items-center justify-between text-xs text-foreground/40 flex-wrap gap-3">
        <span>© {new Date().getFullYear()} Magnus Frete. Todos os direitos reservados.</span>
        <span>Sistema de gestão de rastreamento de envios</span>
      </div>
    </footer>
  );
}

/* ---------- page ---------- */

export default function LandingPage() {
  useEffect(() => {
    document.title = "Magnus Frete — Logística & Rastreamento Inteligente";
  }, []);
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-foreground font-sans antialiased selection:bg-gold/30 selection:text-foreground">
      <Nav />
      <main>
        <Hero />
        <DashboardMock />
        <NumbersStrip />
        <Features />
        <AutomationSection />
        <IntegrationsMarquee />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
