import { formatProduto } from "@/lib/format-produto";
import { useEffect, useState, useCallback, useMemo, Fragment } from "react";

import { useParams, useSearchParams } from "react-router-dom";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import {
    Package,
    Search,
    ArrowRight,
    CheckCircle2,
    Truck,
    MapPin,
    AlertTriangle,
    ShieldCheck,
    Zap,
    Box,
    Menu,
    X,
    PackageX,
    Clock,
    Globe,
    RefreshCw,
    BarChart3,
    ThumbsUp,
    Radio,
    Users,
    MapPinned,
    History,
    Keyboard,
    Eye,
} from "lucide-react";

/* ─── Neighbor (Vizinho) Logic ─── */
const VIZINHO_NOMES = [
  "Maria Aparecida","José Carlos","Ana Paula","Carlos Eduardo","Fernanda Silva",
  "Mariana Oliveira","Roberto Souza","Patrícia Lima","Lucas Ferreira","Juliana Costa",
  "André Mendes","Beatriz Almeida","Rafael Santos","Camila Ribeiro","Thiago Pereira",
  "Larissa Barbosa","Gustavo Rocha","Isabela Cardoso","Diego Martins","Vanessa Araújo",
  "Felipe Nascimento","Tatiana Moreira","Bruno Teixeira","Priscila Correia","Rodrigo Pinto",
  "Aline Monteiro","Marcelo Duarte","Renata Farias","Leandro Machado","Gabriela Nunes",
  "Eduardo Vieira","Sandra Carvalho","Henrique Dias","Elaine Castro","Marcos Lopes",
  "Cláudia Ramos","Alexandre Gonçalves","Luciana Freitas","Paulo Nogueira","Adriana Campos",
  "Fábio Azevedo","Cristiane Melo","Ricardo Guimarães","Simone Borges","Vinícius Cunha",
  "Daniele Moraes","Sérgio Cavalcanti","Andréa Pires","Cássio Braga","Lúcia Fontes",
  "Peterson Reis","Elisa Tavares","Willian Amaral","Débora Siqueira","Reginaldo Batista",
  "Jéssica Gomes","Rogério Xavier","Monique Miranda","Otávio Coelho","Carolina Sampaio",
  "Matheus Andrade","Viviane Passos","Leonardo Medeiros","Rosana Rezende","Jorge Figueiredo",
  "Bianca Peixoto","Daniel Alencar","Flávia Assis","Maurício Sales","Eliane Barros",
  "Caio Bittencourt","Karina Bastos","Raul Queiroz","Natália Marques","César Leal",
  "Amanda Esteves","Ronaldo Lacerda","Ingrid Rangel","Augusto Brandão","Sabrina Aguiar",
  "Luís Henrique","Tereza Silveira","Thales Pacheco","Lia Domingues","Nelson Valente",
  "Letícia Vasconcelos","Ítalo Bezerra","Miriam Paiva","Otton Coutinho","Raquel Trindade",
  "Wendel Magalhães","Heloísa Barreto","Caetano Soares","Milena Sá","Josué Maciel",
  "Lorena Dornelas","Murilo Carneiro","Sueli Torres","Davi Ferraz","Fabiana Bonfim"
];
const VIZINHO_CPFS = [
  "***.234.567-**","***.891.012-**","***.456.789-**","***.123.654-**","***.987.321-**",
  "***.412.553-**","***.882.119-**","***.321.774-**","***.675.238-**","***.194.667-**",
  "***.548.391-**","***.763.825-**","***.217.946-**","***.836.512-**","***.459.173-**",
  "***.628.347-**","***.185.729-**","***.974.163-**","***.342.586-**","***.716.438-**",
  "***.293.851-**","***.567.214-**","***.831.479-**","***.148.635-**","***.479.362-**",
  "***.654.128-**","***.218.543-**","***.965.271-**","***.537.894-**","***.183.426-**",
  "***.742.615-**","***.316.958-**","***.894.237-**","***.461.573-**","***.825.149-**",
  "***.573.461-**","***.149.826-**","***.638.274-**","***.271.938-**","***.486.152-**",
  "***.952.347-**","***.314.568-**","***.768.423-**","***.527.196-**","***.693.814-**",
  "***.241.679-**","***.856.312-**","***.419.753-**","***.782.146-**","***.365.827-**",
  "***.128.594-**","***.974.263-**","***.543.817-**","***.617.342-**","***.286.951-**",
  "***.831.624-**","***.472.158-**","***.615.439-**","***.359.872-**","***.724.516-**",
  "***.196.743-**","***.843.269-**","***.567.391-**","***.231.684-**","***.918.527-**",
  "***.684.213-**","***.352.978-**","***.719.345-**","***.463.891-**","***.297.536-**",
  "***.836.174-**","***.571.429-**","***.148.763-**","***.925.618-**","***.413.952-**",
  "***.769.384-**","***.284.537-**","***.651.829-**","***.937.146-**","***.512.673-**",
  "***.346.291-**","***.879.534-**","***.423.867-**","***.198.745-**","***.764.312-**",
  "***.531.498-**","***.847.623-**","***.275.981-**","***.618.357-**","***.493.712-**",
  "***.156.849-**","***.729.436-**","***.384.571-**","***.962.183-**","***.517.264-**",
  "***.643.918-**","***.238.475-**","***.871.532-**","***.426.197-**","***.793.648-**"
];

function simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function getVizinhoData(envioId: string, clienteNome: string) {
    const idx = simpleHash(envioId) % VIZINHO_NOMES.length;
    const primeiroNome = clienteNome.split(" ")[0];
    return {
        nome: VIZINHO_NOMES[idx],
        cpf: VIZINHO_CPFS[idx],
        label: `Recebedor: ${VIZINHO_NOMES[idx]} (Vizinho(a) de ${primeiroNome})`,
    };
}

/* ─── Types ─── */
interface EnvioData {
    id: string;
    produto: string;
    codigo_rastreio: string;
    cliente_nome: string;
    transportadora: string;
    status: string;
    status_label: string | null;
    ultimo_evento_ordem: number;
    created_at: string;
    updated_at: string;
    cliente_cidade: string | null;
    cliente_estado: string | null;
}

interface OrigemData {
    cidade: string | null;
    estado: string | null;
}

interface EmpresaData {
    nome_fantasia: string;
    razao_social: string;
    logo_url: string;
}

interface EventoData {
    nome: string;
    descricao: string | null;
    status_label: string | null;
    corpo_email: string | null;
    ordem: number;
    delay_horas: number;
}

/* ─── Status Visual Config ─── */
const statusConfig: Record<string, { icon: any; label: string }> = {
    "Postado": { icon: Box, label: "Postado" },
    "Coletado": { icon: Zap, label: "Coletado" },
    "Em Trânsito": { icon: Truck, label: "Em trânsito" },
    "Centro Local": { icon: MapPin, label: "Centro local" },
    "Saiu para Entrega": { icon: Truck, label: "Saiu para entrega" },
    "Entregue": { icon: CheckCircle2, label: "Entregue" },
    "Falha Entrega": { icon: PackageX, label: "Falha na entrega" },
    "Taxação": { icon: AlertTriangle, label: "Fiscalização" },
    "Pago": { icon: ShieldCheck, label: "Taxa paga" },
    "Em Rota": { icon: Truck, label: "Em rota" },
};

/* ─── Page Component ─── */
export default function Rastreio() {
    const { codigoParam } = useParams<{ codigoParam: string }>();
    const [searchParams] = useSearchParams();
    const codigoFromUrl = codigoParam || searchParams.get("codigo") || "";

    const [searchInput, setSearchInput] = useState(codigoFromUrl);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [envio, setEnvio] = useState<EnvioData | null>(null);
    const [empresa, setEmpresa] = useState<EmpresaData | null>(null);
    const [eventos, setEventos] = useState<EventoData[]>([]);
    const [totalEventos, setTotalEventos] = useState(0);
    const [searched, setSearched] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [origem, setOrigem] = useState<OrigemData>({ cidade: null, estado: null });
    const [customPrimaryColor, setCustomPrimaryColor] = useState<string | null>(null);
    const [ativarVizinho, setAtivarVizinho] = useState(true);

    const fetchData = useCallback(async (trackingCode: string) => {
        if (!trackingCode || trackingCode.trim().length < 3) return;
        setLoading(true);
        setError(null);
        try {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
            const response = await fetch(
                `${supabaseUrl}/functions/v1/rastreio-info?codigo=${encodeURIComponent(trackingCode.trim())}`,
                {
                    method: "GET",
                    headers: { "Authorization": `Bearer ${anonKey}`, "apikey": anonKey },
                }
            );
            if (!response.ok) {
                const errBody = await response.json().catch(() => ({}));
                setError(errBody.error || "Código não identificado no sistema");
                setEnvio(null);
                setEventos([]);
            } else {
                const result = await response.json();
                setEnvio(result.envio || null);
                setEmpresa(result.empresa || null);
                setEventos(result.eventos || []);
                setTotalEventos(result.totalEventos || 0);
                setOrigem(result.origem || { cidade: null, estado: null });
                if (result.cor_primaria) setCustomPrimaryColor(result.cor_primaria);
                setAtivarVizinho(result.ativar_vizinho ?? true);
                if (!result.envio) setError("Certifique-se de que o código está correto");
            }
        } catch {
            setError("Ocorreu uma falha na conexão com os servidores");
        } finally {
            setLoading(false);
            setSearched(true);
        }
    }, []);

    useEffect(() => {
        if (codigoFromUrl) {
            setSearchInput(codigoFromUrl);
            fetchData(codigoFromUrl);
        }
    }, [codigoFromUrl, fetchData]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const cleaned = searchInput.trim().toUpperCase();
        if (cleaned.length < 3) return;
        fetchData(cleaned);
        window.history.replaceState(null, "", `/r/${cleaned}`);
    };

    const isJadlog = useMemo(() => {
        if (envio?.transportadora?.toUpperCase().includes("JADLOG")) return true;
        const code = envio?.codigo_rastreio || codigoFromUrl || "";
        return code.toUpperCase().trim().endsWith("JD");
    }, [codigoFromUrl, envio]);

    const isVetor = useMemo(() => {
        const host = window.location.hostname;
        if (host === 'vetortransportesltda.com' || host === 'www.vetortransportesltda.com') return true;
        if (envio?.transportadora?.toUpperCase().includes("VETOR")) return true;
        const code = envio?.codigo_rastreio || codigoFromUrl || "";
        return code.toUpperCase().trim().endsWith("VT");
    }, [codigoFromUrl, envio]);

    const empresaNome = isVetor ? "Vetor Transportes" : isJadlog ? "JADLOG Logística" : (empresa?.nome_fantasia || empresa?.razao_social || "Logística JL Transportes");
    const logoUrl = isVetor ? "/logovetor.png" : isJadlog ? "/logojadlog.png" : "/logojltransportes.png";
    const primaryColor = isVetor ? "#1B5E20" : isJadlog ? "#D71920" : (customPrimaryColor || "#6366f1");

    useEffect(() => {
        const title = isVetor ? "Vetor Transportes - Rastreio" : isJadlog ? "JADLOG - Rastreio" : "JL Transportes - Rastreio";
        document.title = title;
        return () => { document.title = "Rastreio de Encomendas"; };
    }, [isVetor, isJadlog]);

    const progress = totalEventos > 0 && envio
        ? Math.min(100, Math.round((envio.ultimo_evento_ordem / totalEventos) * 100))
        : 0;

    const formatStatus = (status: string) => {
        const cfg = statusConfig[status];
        return cfg?.label || status;
    };

    /* ═══════════════════════════════════════════════════════════════
       VETOR TRANSPORTES — Green/Graphite tech design
       ═══════════════════════════════════════════════════════════════ */
    if (isVetor) {
        return (
            <div className="vt-page">
                <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

                {/* ── Nav ── */}
                <nav className="vt-nav">
                    <div className="vt-nav-inner">
                        <img src={logoUrl} alt={empresaNome} className="vt-nav-logo" />
                        <div className="vt-nav-links">
                            <a href="#">Início</a>
                            <a href="#rastrear">Rastrear</a>
                            <a href="#contato">Contato</a>
                        </div>
                        <button className="vt-nav-mobile" onClick={() => setMobileMenuOpen(p => !p)} aria-label="Menu">
                            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>
                    </div>
                </nav>

                {mobileMenuOpen && (
                    <>
                        <div className="vt-overlay" onClick={() => setMobileMenuOpen(false)} />
                        <div className="vt-drawer">
                            <div className="vt-drawer-head">
                                <img src={logoUrl} alt={empresaNome} style={{ width: 120 }} />
                                <button onClick={() => setMobileMenuOpen(false)}><X size={22} /></button>
                            </div>
                            <a href="#" onClick={() => setMobileMenuOpen(false)}>Início</a>
                            <a href="#rastrear" onClick={() => setMobileMenuOpen(false)}>Rastrear</a>
                            <a href="#contato" onClick={() => setMobileMenuOpen(false)}>Contato</a>
                        </div>
                    </>
                )}

                {/* ── Hero ── */}
                <section className="vt-hero" id="rastrear">
                    <div className="vt-hero-decor" />
                    <div className="vt-hero-content">
                        <div className="vt-hero-badge">
                            <MapPin size={14} />
                            <span>Logística estratégica</span>
                        </div>
                        <h1>Rastreie sua encomenda<br />com precisão</h1>
                        <p className="vt-hero-sub">
                            Parceira oficial Jadlog, Correios, Loggi, LATAM Cargo, Azul Cargo e Total Express — integração logística completa.
                        </p>
                        <p className="vt-hero-desc">
                            Monitoramento em tempo real com atualizações automáticas em cada etapa do transporte.
                        </p>

                        <form onSubmit={handleSearch} className="vt-search-form">
                            <div className="vt-search-wrapper">
                                <Search size={20} className="vt-search-icon" />
                                <input
                                    type="text"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                                    placeholder="Digite seu código de rastreio"
                                    className="vt-search-input"
                                />
                                <button type="submit" disabled={loading} className="vt-search-btn-inline">
                                    {loading ? <div className="vt-spinner" /> : (<><Search size={16} /><span>Rastrear</span></>)}
                                </button>
                            </div>
                            <button type="submit" disabled={loading} className="vt-search-btn-mobile">
                                {loading ? <div className="vt-spinner" /> : (<><Package size={16} /><span>Rastrear encomenda</span><ArrowRight size={16} /></>)}
                            </button>
                        </form>
                    </div>
                </section>

                {/* ── Benefits ── */}
                {!searched && (
                    <section className="vt-benefits">
                        <div className="vt-benefits-grid">
                            <div className="vt-benefit-card">
                                <div className="vt-benefit-icon"><Zap size={24} /></div>
                                <h3>Rastreamento preciso</h3>
                                <p>Cada movimentação registrada com precisão e transparência total.</p>
                            </div>
                            <div className="vt-benefit-card">
                                <div className="vt-benefit-icon"><Globe size={24} /></div>
                                <h3>Cobertura regional</h3>
                                <p>Presença estratégica em toda a região com eficiência operacional.</p>
                            </div>
                            <div className="vt-benefit-card">
                                <div className="vt-benefit-icon"><ShieldCheck size={24} /></div>
                                <h3>Parceiro oficial</h3>
                                <p>Integração direta com Jadlog, Correios e Loggi.</p>
                            </div>
                        </div>
                    </section>
                )}

                {/* ── Stats Bar ── */}
                {!searched && (
                    <section className="vt-stats-bar">
                        <div className="vt-stats-grid">
                            <div className="vt-stat-item">
                                <BarChart3 size={28} />
                                <div>
                                    <span className="vt-stat-number">10.000+</span>
                                    <span className="vt-stat-label">Entregas/mês</span>
                                </div>
                            </div>
                            <div className="vt-stat-item">
                                <ThumbsUp size={28} />
                                <div>
                                    <span className="vt-stat-number">99%</span>
                                    <span className="vt-stat-label">Satisfação</span>
                                </div>
                            </div>
                            <div className="vt-stat-item">
                                <Radio size={28} />
                                <div>
                                    <span className="vt-stat-number">24/7</span>
                                    <span className="vt-stat-label">Rastreamento</span>
                                </div>
                            </div>
                            <div className="vt-stat-item">
                                <Users size={28} />
                                <div>
                                    <span className="vt-stat-number">6+</span>
                                    <span className="vt-stat-label">Transportadoras</span>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* ── Como Funciona ── */}
                {!searched && (
                    <section className="vt-howit">
                        <div className="vt-howit-inner">
                            <h2 className="vt-howit-title">Como funciona?</h2>
                            <p className="vt-howit-sub">Rastreie sua encomenda em 3 passos simples</p>
                            <div className="vt-howit-steps">
                                <div className="vt-step">
                                    <div className="vt-step-num">1</div>
                                    <div className="vt-step-line" />
                                    <h3>Obtenha o código</h3>
                                    <p>Você recebe o código de rastreio ao despachar sua encomenda.</p>
                                </div>
                                <div className="vt-step">
                                    <div className="vt-step-num">2</div>
                                    <div className="vt-step-line" />
                                    <h3>Digite no campo</h3>
                                    <p>Cole ou digite o código no campo de busca acima.</p>
                                </div>
                                <div className="vt-step">
                                    <div className="vt-step-num">3</div>
                                    <h3>Acompanhe tudo</h3>
                                    <p>Veja cada etapa em tempo real até a entrega final.</p>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* ── Sobre Nós / Por que escolher ── */}
                {!searched && (
                    <section className="vt-about">
                        <div className="vt-about-inner">
                            <div className="vt-about-left">
                                <div className="vt-about-card-dark">
                                    <span className="vt-about-badge">SOBRE NÓS</span>
                                    <h2>Por que escolher a<br />Vetor Transportes?</h2>
                                    <p>Somos referência em logística e transporte, oferecendo soluções completas de rastreamento e entrega com eficiência e tecnologia de ponta.</p>
                                    <div className="vt-about-tag">
                                        <Users size={16} />
                                        <span>6+ Transportadoras parceiras</span>
                                    </div>
                                </div>
                                <img src="/vetor-truck.png" alt="Caminhão Vetor Transportes" className="vt-about-truck" />
                            </div>
                            <div className="vt-about-right">
                                <div className="vt-about-bullet">
                                    <div className="vt-about-bullet-icon"><Clock size={22} /></div>
                                    <div>
                                        <h4>Rastreamento 24h</h4>
                                        <p>Acompanhe sua encomenda a qualquer hora, de qualquer lugar, com atualizações em tempo real.</p>
                                    </div>
                                </div>
                                <div className="vt-about-bullet">
                                    <div className="vt-about-bullet-icon"><Globe size={22} /></div>
                                    <div>
                                        <h4>Cobertura nacional</h4>
                                        <p>Presença estratégica em todo o Brasil com parceiros logísticos de confiança.</p>
                                    </div>
                                </div>
                                <div className="vt-about-bullet">
                                    <div className="vt-about-bullet-icon"><ShieldCheck size={22} /></div>
                                    <div>
                                        <h4>Simples e sem cadastro</h4>
                                        <p>Basta digitar seu código de rastreio — sem login, sem complicação.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* ── Recursos ── */}
                {!searched && (
                    <section className="vt-features">
                        <div className="vt-features-inner">
                            <span className="vt-features-badge">RECURSOS</span>
                            <h2 className="vt-features-title">Tudo que você precisa em um só lugar</h2>
                            <div className="vt-features-grid">
                                <div className="vt-feature-card">
                                    <div className="vt-feature-icon"><Eye size={26} /></div>
                                    <h3>Rastreamento em tempo real</h3>
                                    <p>Acompanhe cada movimentação do seu pacote com atualizações automáticas e precisas.</p>
                                </div>
                                <div className="vt-feature-card">
                                    <div className="vt-feature-icon"><MapPinned size={26} /></div>
                                    <h3>Localização precisa</h3>
                                    <p>Saiba exatamente onde seu pacote está, com informações detalhadas de cada centro de distribuição.</p>
                                </div>
                                <div className="vt-feature-card">
                                    <div className="vt-feature-icon"><History size={26} /></div>
                                    <h3>Histórico completo</h3>
                                    <p>Acesse todo o histórico de movimentações, desde a postagem até a entrega final.</p>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* ── Partners ── */}
                {(
                    <section className="vt-partners">
                        <h2 className="vt-partners-title">Nossos Parceiros</h2>
                        <div className="vt-partners-overflow">
                            <div className="vt-partners-track">
                                {[...Array(4)].map((_, i) => (
                                    <Fragment key={i}>
                                        <div className="vt-partner-card">
                                            <img src="/logo-jadlog.svg" alt="Jadlog" className="vt-partner-logo" />
                                        </div>
                                        <div className="vt-partner-card">
                                            <img src="/logo-correios.svg" alt="Correios" className="vt-partner-logo" />
                                        </div>
                                        <div className="vt-partner-card">
                                            <img src="/logo-loggi.svg" alt="Loggi" className="vt-partner-logo" />
                                        </div>
                                        <div className="vt-partner-card">
                                            <img src="/logo-latam.svg" alt="LATAM Cargo" className="vt-partner-logo" />
                                        </div>
                                        <div className="vt-partner-card">
                                            <img src="/logo-azul.svg" alt="Azul Cargo Express" className="vt-partner-logo" />
                                        </div>
                                        <div className="vt-partner-card">
                                            <img src="/logo-total.svg" alt="Total Express" className="vt-partner-logo" />
                                        </div>
                                    </Fragment>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* ── Results ── */}
                {searched && (
                    <section className="vt-results">
                        <div className="vt-results-inner">
                            {error && !envio ? (
                                <div className="vt-error-card">
                                    <AlertTriangle size={40} />
                                    <h2>Informação não localizada</h2>
                                    <p>{error}</p>
                                    <button onClick={() => window.location.reload()}>Tentar novamente</button>
                                </div>
                            ) : envio && (
                                <div className="vt-data-grid">
                                    {/* ── Sidebar ── */}
                                    <div className="vt-sidebar">
                                        <div className="vt-info-card">
                                            <div className="vt-card-header">
                                                <Package size={18} />
                                                <span>Detalhes do envio</span>
                                            </div>
                                            <div className="vt-info-row">
                                                <span className="vt-label">Código de rastreamento</span>
                                                <span className="vt-tracking-code">{envio.codigo_rastreio}</span>
                                            </div>
                                            <div className="vt-info-row">
                                                <span className="vt-label">Produto</span>
                                                <span className="vt-value">{formatProduto(envio.produto) || "Encomenda"}</span>
                                            </div>
                                            <div className="vt-info-row">
                                                <span className="vt-label">Transportadora</span>
                                                <span className="vt-value">{envio.transportadora}</span>
                                            </div>
                                            <div className="vt-info-row">
                                                <span className="vt-label">Status da entrega</span>
                                                <span className="vt-status-badge">{formatStatus(envio.status_label || envio.status)}</span>
                                            </div>
                                            <div className="vt-progress-area">
                                                <div className="vt-progress-header">
                                                    <span>Progresso da entrega</span>
                                                    <span>{progress}%</span>
                                                </div>
                                                <div className="vt-progress-track">
                                                    <div className="vt-progress-fill" style={{ width: `${progress}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="vt-meta-card">
                                            <UserIcon />
                                            <div>
                                                <span className="vt-label">Destinatário</span>
                                                <span className="vt-value">{envio.cliente_nome}</span>
                                            </div>
                                        </div>
                                        <div className="vt-meta-card">
                                            <CalendarIcon />
                                            <div>
                                                <span className="vt-label">Despachado em</span>
                                                <span className="vt-value">{new Date(envio.created_at).toLocaleDateString("pt-BR")}</span>
                                            </div>
                                        </div>
                                        <div className="vt-meta-card">
                                            <Clock size={18} />
                                            <div>
                                                <span className="vt-label">Última atualização</span>
                                                <span className="vt-value">{new Date(envio.updated_at).toLocaleDateString("pt-BR")}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── Timeline ── */}
                                    <div className="vt-timeline-card">
                                        <div className="vt-timeline-header">
                                            <span>Histórico de movimentações</span>
                                        </div>
                                        {eventos.length === 0 ? (
                                            <div className="vt-timeline-empty">
                                                <p>Aguardando atualizações da transportadora.</p>
                                            </div>
                                        ) : (
                                            <div className="vt-timeline">
                                                {[...eventos].reverse().map((ev, idx) => {
                                                    const cfg = statusConfig[ev.status_label || ""] || { icon: MapPin, label: "Atualização" };
                                                    const Icon = cfg.icon;
                                                    const eventDate = new Date(new Date(envio.updated_at).getTime() - (idx * 24 * 60 * 60 * 1000));
                                                    const isFirst = idx === 0;

                                                    const origemLabel = origem.cidade && origem.estado ? `${origem.cidade} - ${origem.estado}` : null;
                                                    const destLabel = envio.cliente_cidade && envio.cliente_estado ? `${envio.cliente_cidade} - ${envio.cliente_estado}` : null;
                                                    let locationText: string | null = null;
                                                    switch (ev.status_label) {
                                                        case "Postado": locationText = origemLabel ? `Unidade de Postagem, ${origemLabel}` : null; break;
                                                        case "Coletado": locationText = origemLabel ? `Unidade de Tratamento, ${origemLabel}` : null; break;
                                                        case "Em Trânsito": case "Em Rota":
                                                            if (origemLabel && destLabel) locationText = `de ${origemLabel} para ${destLabel}`; break;
                                                        case "Centro Local": locationText = destLabel ? `Unidade de Distribuição, ${destLabel}` : null; break;
                                                        case "Saiu para Entrega": locationText = destLabel ? `Unidade de Distribuição, ${destLabel}` : null; break;
                                                        case "Entregue": locationText = destLabel ? `Pela Unidade de Distribuição, ${destLabel}` : null; break;
                                                        default: locationText = ev.descricao || ev.status_label || null;
                                                    }

                                                    const vizinhoData = (ev.status_label === "Entregue" && ativarVizinho) ? getVizinhoData(envio.id, envio.cliente_nome) : null;

                                                    return (
                                                        <div key={ev.ordem} className={`vt-tl-item ${isFirst ? 'vt-tl-active' : ''}`}>
                                                            <div className="vt-tl-indicator">
                                                                <div className={`vt-tl-dot ${isFirst ? 'active' : ''}`}>
                                                                    <Icon size={14} />
                                                                </div>
                                                                {idx < eventos.length - 1 && <div className="vt-tl-line" />}
                                                            </div>
                                                            <div className="vt-tl-content">
                                                                <h4>{ev.nome}</h4>
                                                                {locationText && <p className="vt-tl-location">{locationText}</p>}
                                                                {vizinhoData && (
                                                                    <div style={{ marginTop: 6, fontSize: 13, color: '#4B5563', lineHeight: 1.6 }}>
                                                                        <p style={{ margin: 0, fontWeight: 600 }}>{vizinhoData.label}</p>
                                                                        <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>Documento: {vizinhoData.cpf}</p>
                                                                    </div>
                                                                )}
                                                                <span className="vt-tl-date">
                                                                    {eventDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                                </span>
                                                                {ev.status_label === "Taxação" && envio && (
                                                                    <a href={`/p/${envio.id}`} className="vt-action-btn">Pagar taxa</a>
                                                                )}
                                                                {(ev.status_label === "Falha Entrega" || ev.nome === "Falha na Entrega") && envio && (
                                                                    <a href={`/f/${envio.id}`} className="vt-action-btn">Pagar reenvio / frete</a>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* ── Footer ── */}
                <footer className="vt-footer" id="contato">
                    <div className="vt-footer-inner">
                        <div className="vt-footer-top">
                            <div className="vt-footer-brand">
                                <img src={logoUrl} alt={empresaNome} />
                                <p>Logística estratégica com rastreamento preciso e eficiente.</p>
                            </div>
                            <div className="vt-footer-cols">
                                <div>
                                    <h5>Contato</h5>
                                    <a href="mailto:contato@vetortransportes.com.br">contato@vetortransportes.com.br</a>
                                </div>
                                <div>
                                    <h5>Informações</h5>
                                     <a href="/termos">Termos de serviço</a>
                                     <a href="/privacidade">Política de privacidade</a>
                                </div>
                            </div>
                        </div>
                        <div className="vt-footer-bottom">
                            <span>© {new Date().getFullYear()} {empresaNome}. Todos os direitos reservados.</span>
                        </div>
                    </div>
                </footer>

                <NotificationPrompt codigoRastreio={envio?.codigo_rastreio} />
                <style>{vetorStyles}</style>
            </div>
        );
    }

    /* ═══════════════════════════════════════════════════════════════
       JADLOG — Clean corporate redesign
       ═══════════════════════════════════════════════════════════════ */
    if (isJadlog) {
        return (
            <div className="jadlog-page">
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />

                {/* ── Nav ── */}
                <nav className="jd-nav">
                    <div className="jd-nav-inner">
                        <img src={logoUrl} alt={empresaNome} className="jd-nav-logo" />
                        <div className="jd-nav-links">
                            <a href="#">Início</a>
                            <a href="#rastrear">Rastrear</a>
                            <a href="#contato">Contato</a>
                        </div>
                        <button className="jd-nav-mobile" onClick={() => setMobileMenuOpen(p => !p)} aria-label="Menu">
                            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>
                    </div>
                </nav>

                {mobileMenuOpen && (
                    <>
                        <div className="jd-overlay" onClick={() => setMobileMenuOpen(false)} />
                        <div className="jd-drawer">
                            <div className="jd-drawer-head">
                                <img src={logoUrl} alt={empresaNome} style={{ width: 120 }} />
                                <button onClick={() => setMobileMenuOpen(false)}><X size={22} /></button>
                            </div>
                            <a href="#" onClick={() => setMobileMenuOpen(false)}>Início</a>
                            <a href="#rastrear" onClick={() => setMobileMenuOpen(false)}>Rastrear</a>
                            <a href="#contato" onClick={() => setMobileMenuOpen(false)}>Contato</a>
                        </div>
                    </>
                )}

                {/* ── Hero ── */}
                <section className="jd-hero" id="rastrear">
                    <div className="jd-hero-bg-decor" />
                    <div className="jd-hero-content">
                        <div className="jd-hero-badge">
                            <Truck size={14} />
                            <span>Rastreamento inteligente</span>
                        </div>
                        <h1>Acompanhe sua entrega<br />em tempo real</h1>
                        <p className="jd-hero-sub">
                            Rastreamento inteligente com atualização automática em cada etapa da entrega.
                        </p>
                        <p className="jd-hero-desc">
                            Visualize o status do seu pedido desde o envio até a entrega final com total transparência.
                        </p>

                        <form onSubmit={handleSearch} className="jd-search-form">
                            <div className="jd-search-wrapper">
                                <Search size={20} className="jd-search-icon" />
                                <input
                                    type="text"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                                    placeholder="Digite seu código de rastreio"
                                    className="jd-search-input"
                                />
                                <button type="submit" disabled={loading} className="jd-search-btn-inline">
                                    {loading ? <div className="jd-spinner" /> : (<><Search size={16} /><span>Rastrear</span></>)}
                                </button>
                            </div>
                            <button type="submit" disabled={loading} className="jd-search-btn-mobile">
                                {loading ? <div className="jd-spinner" /> : (<><Package size={16} /><span>Rastrear encomenda</span><ArrowRight size={16} /></>)}
                            </button>
                        </form>
                    </div>
                </section>

                {/* ── Benefits ── */}
                {!searched && (
                    <section className="jd-benefits">
                        <div className="jd-benefits-grid">
                            <div className="jd-benefit-card">
                                <div className="jd-benefit-icon"><RefreshCw size={24} /></div>
                                <h3>Atualização em tempo real</h3>
                                <p>Status da entrega atualizado automaticamente em cada movimentação do pedido.</p>
                            </div>
                            <div className="jd-benefit-card">
                                <div className="jd-benefit-icon"><Globe size={24} /></div>
                                <h3>Cobertura nacional</h3>
                                <p>Monitoramento de envios em todo o território nacional.</p>
                            </div>
                            <div className="jd-benefit-card">
                                <div className="jd-benefit-icon"><ShieldCheck size={24} /></div>
                                <h3>Sistema seguro</h3>
                                <p>Dados protegidos e sincronizados com as transportadoras.</p>
                            </div>
                        </div>
                    </section>
                )}

                {/* ── Results ── */}
                {searched && (
                    <section className="jd-results">
                        <div className="jd-results-inner">
                            {error && !envio ? (
                                <div className="jd-error-card">
                                    <AlertTriangle size={40} />
                                    <h2>Informação não localizada</h2>
                                    <p>{error}</p>
                                    <button onClick={() => window.location.reload()}>Tentar novamente</button>
                                </div>
                            ) : envio && (
                                <div className="jd-data-grid">
                                    {/* ── Sidebar ── */}
                                    <div className="jd-sidebar">
                                        <div className="jd-info-card">
                                            <div className="jd-card-header">
                                                <Package size={18} />
                                                <span>Detalhes do envio</span>
                                            </div>

                                            <div className="jd-info-row">
                                                <span className="jd-label">Código de rastreamento</span>
                                                <span className="jd-tracking-code">{envio.codigo_rastreio}</span>
                                            </div>
                                            <div className="jd-info-row">
                                                <span className="jd-label">Produto</span>
                                                <span className="jd-value">{formatProduto(envio.produto) || "Encomenda"}</span>
                                            </div>
                                            <div className="jd-info-row">
                                                <span className="jd-label">Transportadora</span>
                                                <span className="jd-value">{envio.transportadora}</span>
                                            </div>
                                            <div className="jd-info-row">
                                                <span className="jd-label">Status da entrega</span>
                                                <span className="jd-status-badge">{formatStatus(envio.status_label || envio.status)}</span>
                                            </div>

                                            <div className="jd-progress-area">
                                                <div className="jd-progress-header">
                                                    <span>Progresso da entrega</span>
                                                    <span>{progress}%</span>
                                                </div>
                                                <div className="jd-progress-track">
                                                    <div className="jd-progress-fill" style={{ width: `${progress}%` }} />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="jd-meta-card">
                                            <UserIcon />
                                            <div>
                                                <span className="jd-label">Destinatário</span>
                                                <span className="jd-value">{envio.cliente_nome}</span>
                                            </div>
                                        </div>
                                        <div className="jd-meta-card">
                                            <CalendarIcon />
                                            <div>
                                                <span className="jd-label">Despachado em</span>
                                                <span className="jd-value">{new Date(envio.created_at).toLocaleDateString("pt-BR")}</span>
                                            </div>
                                        </div>
                                        <div className="jd-meta-card">
                                            <Clock size={18} />
                                            <div>
                                                <span className="jd-label">Última atualização</span>
                                                <span className="jd-value">{new Date(envio.updated_at).toLocaleDateString("pt-BR")}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── Timeline ── */}
                                    <div className="jd-timeline-card">
                                        <div className="jd-timeline-header">
                                            <span>Histórico de movimentações</span>
                                        </div>
                                        {eventos.length === 0 ? (
                                            <div className="jd-timeline-empty">
                                                <p>Aguardando atualizações da transportadora.</p>
                                            </div>
                                        ) : (
                                            <div className="jd-timeline">
                                                {[...eventos].reverse().map((ev, idx) => {
                                                    const cfg = statusConfig[ev.status_label || ""] || { icon: MapPin, label: "Atualização" };
                                                    const Icon = cfg.icon;
                                                    const eventDate = new Date(new Date(envio.updated_at).getTime() - (idx * 24 * 60 * 60 * 1000));
                                                    const isFirst = idx === 0;

                                                    const origemLabel = origem.cidade && origem.estado ? `${origem.cidade} - ${origem.estado}` : null;
                                                    const destLabel = envio.cliente_cidade && envio.cliente_estado ? `${envio.cliente_cidade} - ${envio.cliente_estado}` : null;
                                                    let locationText: string | null = null;
                                                    switch (ev.status_label) {
                                                        case "Postado": locationText = origemLabel ? `Unidade de Postagem, ${origemLabel}` : null; break;
                                                        case "Coletado": locationText = origemLabel ? `Unidade de Tratamento, ${origemLabel}` : null; break;
                                                        case "Em Trânsito": case "Em Rota":
                                                            if (origemLabel && destLabel) locationText = `de ${origemLabel} para ${destLabel}`; break;
                                                        case "Centro Local": locationText = destLabel ? `Unidade de Distribuição, ${destLabel}` : null; break;
                                                        case "Saiu para Entrega": locationText = destLabel ? `Unidade de Distribuição, ${destLabel}` : null; break;
                                                         case "Entregue": locationText = destLabel ? `Pela Unidade de Distribuição, ${destLabel}` : null; break;
                                                        default: locationText = ev.descricao || ev.status_label || null;
                                                    }

                                                    const vizinhoData = (ev.status_label === "Entregue" && ativarVizinho) ? getVizinhoData(envio.id, envio.cliente_nome) : null;

                                                    return (
                                                        <div key={ev.ordem} className={`jd-tl-item ${isFirst ? 'jd-tl-active' : ''}`}>
                                                            <div className="jd-tl-indicator">
                                                                <div className={`jd-tl-dot ${isFirst ? 'active' : ''}`}>
                                                                    <Icon size={14} />
                                                                </div>
                                                                {idx < eventos.length - 1 && <div className="jd-tl-line" />}
                                                            </div>
                                                            <div className="jd-tl-content">
                                                                <h4>{ev.nome}</h4>
                                                                {locationText && <p className="jd-tl-location">{locationText}</p>}
                                                                {vizinhoData && (
                                                                    <div style={{ marginTop: 6, fontSize: 13, color: '#4B5563', lineHeight: 1.6 }}>
                                                                        <p style={{ margin: 0, fontWeight: 600 }}>{vizinhoData.label}</p>
                                                                        <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>Documento: {vizinhoData.cpf}</p>
                                                                    </div>
                                                                )}
                                                                <span className="jd-tl-date">
                                                                    {eventDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                                </span>
                                                                {ev.status_label === "Taxação" && envio && (
                                                                    <a href={`/p/${envio.id}`} className="jd-action-btn">Pagar taxa</a>
                                                                )}
                                                                {(ev.status_label === "Falha Entrega" || ev.nome === "Falha na Entrega") && envio && (
                                                                    <a href={`/f/${envio.id}`} className="jd-action-btn">Pagar reenvio / frete</a>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* ── Footer ── */}
                <footer className="jd-footer" id="contato">
                    <div className="jd-footer-inner">
                        <div className="jd-footer-top">
                            <div className="jd-footer-brand">
                                <img src={logoUrl} alt={empresaNome} />
                                <p>Logística expressa com rastreamento em tempo real.</p>
                            </div>
                            <div className="jd-footer-cols">
                                <div>
                                    <h5>Contato</h5>
                                    <a href="mailto:contato@jltransportelogistica.com">contato@jltransportelogistica.com</a>
                                    <a href="tel:08007251560">0800 725 1560</a>
                                </div>
                                <div>
                                    <h5>Informações</h5>
                                     <a href="/termos">Termos de serviço</a>
                                     <a href="/privacidade">Política de privacidade</a>
                                </div>
                            </div>
                        </div>
                        <div className="jd-footer-bottom">
                            <span>© {new Date().getFullYear()} {empresaNome}. Todos os direitos reservados.</span>
                        </div>
                    </div>
                </footer>

                <NotificationPrompt codigoRastreio={envio?.codigo_rastreio} />
                <style>{jadlogStyles}</style>
            </div>
        );
    }

    /* ═══════════════════════════════════════════════════════════════
       JL TRANSPORTES — Keep the original dark/indigo theme
       ═══════════════════════════════════════════════════════════════ */
    return (
        <div className="rastreio-container theme-jl">
            <style dangerouslySetInnerHTML={{
                __html: `
                .theme-jl {
                    --primary: 239 84% 67%;
                    --primary-rgb: 99, 102, 241;
                    --primary-hover: #4f46e5;
                    --accent: #8b5cf6;
                    --hero-bg: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
                    --glow-color: rgba(99, 102, 241, 0.12);
                    --badge-bg: rgba(99, 102, 241, 0.08);
                    --badge-border: rgba(99, 102, 241, 0.18);
                    --badge-text: #818cf8;
                    --highlight-from: #818cf8;
                    --highlight-to: #c084fc;
                    --btn-gradient: linear-gradient(135deg, #6366f1, #7c3aed);
                    --btn-shadow: rgba(99, 102, 241, 0.3);
                    --focus-ring: rgba(99, 102, 241, 0.12);
                    --focus-border: rgba(129, 140, 248, 0.6);
                    --mobile-link-hover: rgba(99, 102, 241, 0.08);
                    --timeline-header: #005a96;
                    --timeline-title: #005a96;
                }
            `}} />
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

            {/* ═══════════ NAVIGATION ═══════════ */}
            <nav className="main-nav">
                <div className="nav-inner">
                    <div className="nav-brand">
                        <img src={logoUrl} alt={empresaNome} className="nav-logo" />
                    </div>
                    <div className="nav-links">
                        <a href="#" className="nav-link">Início</a>
                        <a href="#rastrear" className="nav-link">Rastrear</a>
                        <a href="#contato" className="nav-link">Contato</a>
                    </div>
                    <button className="nav-mobile-toggle" onClick={() => setMobileMenuOpen(prev => !prev)} aria-label="Menu">
                        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </nav>
            {mobileMenuOpen && (
                <>
                    <div className="nav-mobile-overlay" onClick={() => setMobileMenuOpen(false)} />
                    <div className="nav-mobile-drawer">
                        <div className="nav-mobile-drawer-header">
                            <img src={logoUrl} alt={empresaNome} style={{ width: 120 }} />
                            <button className="nav-mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Fechar">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="nav-mobile-drawer-links">
                            <a href="#" className="nav-mobile-link" onClick={() => setMobileMenuOpen(false)}>Início</a>
                            <a href="#rastrear" className="nav-mobile-link" onClick={() => setMobileMenuOpen(false)}>Rastrear</a>
                            <a href="#contato" className="nav-mobile-link" onClick={() => setMobileMenuOpen(false)}>Contato</a>
                        </div>
                    </div>
                </>
            )}

            {/* ═══════════ HERO SECTION ═══════════ */}
            <section className="hero-section">
                <div className="industrial-grid" />
                <div className="hero-decoration"><div className="glow-orb" /></div>
                <div className="hero-content">
                    <div className="title-area">
                        <div className="badge">
                            <Zap size={14} className="text-primary" strokeWidth={3} />
                            <span>GLOBAL TRACKING ENGINE</span>
                        </div>
                        <h1 className="main-title">
                            Monitore sua <span className="highlight">entrega</span> <br />
                            em cada etapa do caminho
                        </h1>
                        <p className="hero-desc">
                            Parceira oficial Jadlog, Correios, Loggi, LATAM Cargo, Azul Cargo e Total Express — integração logística completa. <br />
                            Monitoramento em tempo real com atualizações automáticas em cada etapa do transporte.
                        </p>
                    </div>

                    <form onSubmit={handleSearch} className="search-box">
                        <div className="search-input-wrapper">
                            <Search className="search-icon" size={20} />
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                                placeholder="DIGITE O CÓDIGO DE RASTREIO"
                                className="main-input"
                            />
                            <button type="submit" disabled={loading} className="search-submit">
                                {loading ? <div className="spinner" /> : (<><span>RASTREAR</span><ArrowRight size={18} /></>)}
                            </button>
                        </div>
                    </form>

                    <div className="quick-stats">
                        <div className="q-stat"><Zap size={20} className="q-icon" /><div className="q-text"><span className="q-val">99.8%</span><span className="q-lab">Precisão de Rota</span></div></div>
                        <div className="q-stat"><Globe size={20} className="q-icon" /><div className="q-text"><span className="q-val">+2M</span><span className="q-lab">Envios Mensais</span></div></div>
                        <div className="q-stat"><ShieldCheck size={20} className="q-icon" /><div className="q-text"><span className="q-val">24/7</span><span className="q-lab">Suporte Ativo</span></div></div>
                    </div>
                </div>
            </section>

            {/* ═══════════ RESULTS ═══════════ */}
            {searched && (
                <section className="results-section">
                    <div className="results-wrapper">
                        {error && !envio ? (
                            <div className="error-state">
                                <div className="error-visual"><AlertTriangle size={48} /></div>
                                <h2>Informação não localizada</h2>
                                <p>{error}</p>
                                <button onClick={() => window.location.reload()} className="retry-btn">Tentar novamente</button>
                            </div>
                        ) : envio && (
                            <div className="data-layout">
                                <div className="data-sidebar">
                                    <div className="package-label-card">
                                        <div className="label-header">
                                            <div className="label-status"><div className="pulse-dot" /><span>{formatStatus(envio.status_label || envio.status)}</span></div>
                                            <Package size={20} />
                                        </div>
                                        <div className="label-tracking">
                                            <span className="label-tag">Código de rastreamento</span>
                                            <div className="tracking-number">{envio.codigo_rastreio}</div>
                                        </div>
                                        <div className="label-grid">
                                            <div className="label-item"><span className="label-tag">Produto</span><span className="label-val">{formatProduto(envio.produto) || "Encomenda"}</span></div>
                                            <div className="label-item"><span className="label-tag">Transportadora</span><span className="label-val">{envio.transportadora}</span></div>
                                        </div>
                                        <div className="progress-container">
                                            <div className="progress-info"><span>Progresso da entrega</span><span>{progress}%</span></div>
                                            <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
                                        </div>
                                    </div>
                                    <div className="meta-info-area">
                                        <div className="meta-tile"><UserIcon /><div className="meta-content"><span className="meta-label">Destinatário</span><span className="meta-value">{envio.cliente_nome}</span></div></div>
                                        <div className="meta-tile"><CalendarIcon /><div className="meta-content"><span className="meta-label">Despachado em</span><span className="meta-value">{new Date(envio.created_at).toLocaleDateString("pt-BR")}</span></div></div>
                                    </div>
                                </div>

                                <div className="data-main" style={{ padding: 0, overflow: 'hidden' }}>
                                    <div className="correios-table-header">
                                        <div className="c-th c-th-objeto">Objeto</div>
                                        <div className="c-th c-th-status">Status</div>
                                        <div className="c-th c-th-data">Data da entrega</div>
                                    </div>
                                    {eventos.length === 0 ? (
                                        <div className="empty-timeline"><p>Aguardando atualizações da transportadora para este código.</p></div>
                                    ) : (
                                        <div className="journey-line-correios">
                                            {[...eventos].reverse().map((ev, idx) => {
                                                const cfg = statusConfig[ev.status_label || ""] || { icon: MapPin, label: "Atualização" };
                                                const Icon = cfg.icon;
                                                const eventDate = new Date(new Date(envio.updated_at).getTime() - (idx * 24 * 60 * 60 * 1000));
                                                const origemLabel = origem.cidade && origem.estado ? `${origem.cidade} - ${origem.estado}` : null;
                                                const destLabel = envio.cliente_cidade && envio.cliente_estado ? `${envio.cliente_cidade} - ${envio.cliente_estado}` : null;
                                                let locationText: string | null = null;
                                                switch (ev.status_label) {
                                                    case "Postado": locationText = origemLabel ? `Unidade de Postagem, ${origemLabel}` : null; break;
                                                    case "Coletado": locationText = origemLabel ? `Unidade de Tratamento, ${origemLabel}` : null; break;
                                                    case "Em Trânsito": case "Em Rota":
                                                        if (origemLabel && destLabel) locationText = `de Unidade de Tratamento, ${origemLabel} para Unidade de Distribuição, ${destLabel}`; break;
                                                    case "Centro Local": locationText = destLabel ? `Unidade de Distribuição, ${destLabel}` : null; break;
                                                    case "Saiu para Entrega": locationText = destLabel ? `Unidade de Distribuição, ${destLabel}` : null; break;
                                                     case "Entregue": locationText = destLabel ? `Pela Unidade de Distribuição, ${destLabel}` : null; break;
                                                    default: locationText = ev.descricao || ev.status_label || null;
                                                }

                                                const vizinhoData = (ev.status_label === "Entregue" && ativarVizinho) ? getVizinhoData(envio.id, envio.cliente_nome) : null;
                                                return (
                                                    <div key={ev.ordem} className="journey-point-correios">
                                                        <div className="point-indicator-correios">
                                                            <div className="indicator-line-correios" />
                                                            <div className="indicator-node-correios" style={{ background: '#e2e8f0' }}>
                                                                <Icon size={16} color={primaryColor} />
                                                            </div>
                                                        </div>
                                                        <div className="point-content-correios">
                                                            <div className="point-col-status">
                                                                <h4 className="point-title-correios">{ev.nome}</h4>
                                                                {locationText && <p className="point-desc-correios">{locationText}</p>}
                                                                {vizinhoData && (
                                                                    <div style={{ marginTop: 6, fontSize: 13, color: '#4B5563', lineHeight: 1.6 }}>
                                                                        <p style={{ margin: 0, fontWeight: 600 }}>{vizinhoData.label}</p>
                                                                        <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>Documento: {vizinhoData.cpf}</p>
                                                                    </div>
                                                                )}
                                                                {ev.status_label === "Taxação" && envio && (
                                                                    <a href={`/p/${envio.id}`} style={{ display:'inline-block', marginTop:8, padding:'8px 20px', background:'#ef4444', color:'#fff', borderRadius:8, fontSize:13, fontWeight:700, textDecoration:'none' }}>Pagar taxa</a>
                                                                )}
                                                                {(ev.status_label === "Falha Entrega" || ev.nome === "Falha na Entrega") && envio && (
                                                                    <a href={`/f/${envio.id}`} style={{ display:'inline-block', marginTop:8, padding:'8px 20px', background:'#ea580c', color:'#fff', borderRadius:8, fontSize:13, fontWeight:700, textDecoration:'none' }}>Pagar reenvio / frete</a>
                                                                )}
                                                                <span className="point-date-correios">
                                                                    {eventDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* ═══════════ STATS BAR ═══════════ */}
            {!searched && (
                <section className="jl-stats-bar">
                    <div className="jl-stats-grid">
                        <div className="jl-stat-item">
                            <BarChart3 size={28} />
                            <div>
                                <span className="jl-stat-number">10.000+</span>
                                <span className="jl-stat-label">Entregas/mês</span>
                            </div>
                        </div>
                        <div className="jl-stat-item">
                            <ThumbsUp size={28} />
                            <div>
                                <span className="jl-stat-number">99%</span>
                                <span className="jl-stat-label">Satisfação</span>
                            </div>
                        </div>
                        <div className="jl-stat-item">
                            <Radio size={28} />
                            <div>
                                <span className="jl-stat-number">24/7</span>
                                <span className="jl-stat-label">Rastreamento</span>
                            </div>
                        </div>
                        <div className="jl-stat-item">
                            <Users size={28} />
                            <div>
                                <span className="jl-stat-number">6+</span>
                                <span className="jl-stat-label">Transportadoras</span>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ═══════════ COMO FUNCIONA ═══════════ */}
            {!searched && (
                <section className="jl-howit">
                    <div className="jl-howit-inner">
                        <h2 className="jl-howit-title">Como funciona?</h2>
                        <p className="jl-howit-sub">Rastreie sua encomenda em 3 passos simples</p>
                        <div className="jl-howit-steps">
                            <div className="jl-step">
                                <div className="jl-step-num">1</div>
                                <div className="jl-step-line" />
                                <h3>Obtenha o código</h3>
                                <p>Você recebe o código de rastreio ao despachar sua encomenda.</p>
                            </div>
                            <div className="jl-step">
                                <div className="jl-step-num">2</div>
                                <div className="jl-step-line" />
                                <h3>Digite no campo</h3>
                                <p>Cole ou digite o código no campo de busca acima.</p>
                            </div>
                            <div className="jl-step">
                                <div className="jl-step-num">3</div>
                                <h3>Acompanhe tudo</h3>
                                <p>Veja cada etapa em tempo real até a entrega final.</p>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ═══════════ SOBRE NÓS ═══════════ */}
            {!searched && (
                <section className="jl-about">
                    <div className="jl-about-inner">
                        <div className="jl-about-left">
                            <div className="jl-about-card-dark">
                                <span className="jl-about-badge">SOBRE NÓS</span>
                                <h2>Por que escolher a<br />JL Transportes?</h2>
                                <p>Somos referência em logística e transporte, oferecendo soluções completas de rastreamento e entrega com eficiência e tecnologia de ponta.</p>
                                <div className="jl-about-tag">
                                    <Users size={16} />
                                    <span>6+ Transportadoras parceiras</span>
                                </div>
                            </div>
                            <img src="/jl-truck.png" alt="Caminhão JL Transportes" className="jl-about-truck" />
                        </div>
                        <div className="jl-about-right">
                            <div className="jl-about-bullet">
                                <div className="jl-about-bullet-icon"><Clock size={22} /></div>
                                <div>
                                    <h4>Rastreamento 24h</h4>
                                    <p>Acompanhe sua encomenda a qualquer hora, de qualquer lugar, com atualizações em tempo real.</p>
                                </div>
                            </div>
                            <div className="jl-about-bullet">
                                <div className="jl-about-bullet-icon"><Globe size={22} /></div>
                                <div>
                                    <h4>Cobertura nacional</h4>
                                    <p>Presença estratégica em todo o Brasil com parceiros logísticos de confiança.</p>
                                </div>
                            </div>
                            <div className="jl-about-bullet">
                                <div className="jl-about-bullet-icon"><ShieldCheck size={22} /></div>
                                <div>
                                    <h4>Simples e sem cadastro</h4>
                                    <p>Basta digitar seu código de rastreio — sem login, sem complicação.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ═══════════ RECURSOS ═══════════ */}
            {!searched && (
                <section className="jl-features">
                    <div className="jl-features-inner">
                        <span className="jl-features-badge">RECURSOS</span>
                        <h2 className="jl-features-title">Tudo que você precisa em um só lugar</h2>
                        <div className="jl-features-grid">
                            <div className="jl-feature-card">
                                <div className="jl-feature-icon"><Eye size={26} /></div>
                                <h3>Rastreamento em tempo real</h3>
                                <p>Acompanhe cada movimentação do seu pacote com atualizações automáticas e precisas.</p>
                            </div>
                            <div className="jl-feature-card">
                                <div className="jl-feature-icon"><MapPinned size={26} /></div>
                                <h3>Localização precisa</h3>
                                <p>Saiba exatamente onde seu pacote está, com informações detalhadas de cada centro de distribuição.</p>
                            </div>
                            <div className="jl-feature-card">
                                <div className="jl-feature-icon"><History size={26} /></div>
                                <h3>Histórico completo</h3>
                                <p>Acesse todo o histórico de movimentações, desde a postagem até a entrega final.</p>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* ═══════════ PARTNERS CAROUSEL ═══════════ */}
            <section className="jl-partners">
                <h2 className="jl-partners-title">Nossos Parceiros</h2>
                <div className="jl-partners-overflow">
                    <div className="jl-partners-track">
                        {[...Array(4)].map((_, i) => (
                            <Fragment key={i}>
                                <div className="jl-partner-card">
                                    <img src="/logo-jadlog.svg" alt="Jadlog" className="jl-partner-logo" />
                                </div>
                                <div className="jl-partner-card">
                                    <img src="/logo-correios.svg" alt="Correios" className="jl-partner-logo" />
                                </div>
                                <div className="jl-partner-card">
                                    <img src="/logo-loggi.svg" alt="Loggi" className="jl-partner-logo" />
                                </div>
                                <div className="jl-partner-card">
                                    <img src="/logo-latam.svg" alt="LATAM Cargo" className="jl-partner-logo" />
                                </div>
                                <div className="jl-partner-card">
                                    <img src="/logo-azul.svg" alt="Azul Cargo Express" className="jl-partner-logo" />
                                </div>
                                <div className="jl-partner-card">
                                    <img src="/logo-total.svg" alt="Total Express" className="jl-partner-logo" />
                                </div>
                            </Fragment>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════ FOOTER ═══════════ */}
            <footer className="site-footer" id="contato">
                <div className="footer-content">
                    <div className="footer-top">
                        <div className="f-brand">
                            <img src={logoUrl} alt={empresaNome} style={{ width: 220 }} />
                            <p>Soluções completas em logística e transporte de encomendas.</p>
                        </div>
                        <div className="f-links">
                            <div className="f-col">
                                <h5>CONTATO</h5>
                                <a href="mailto:contato@jltransportelogistica.com">contato@jltransportelogistica.com</a>
                                <a href="tel:08006589589">0800 658 9589</a>
                            </div>
                            <div className="f-col">
                                <h5>INFORMAÇÕES</h5>
                                 <a href="/termos">Termos de Serviço</a>
                                 <a href="/privacidade">Política de Privacidade</a>
                            </div>
                        </div>
                    </div>
                    <div className="footer-bottom">
                        <span>© {new Date().getFullYear()} {empresaNome}. Todos os direitos reservados.</span>
                        <div className="security-capsules">
                            <div className="cap"><ShieldCheck size={12} /> 256-BIT SSL</div>
                            <div className="cap"><CheckCircle2 size={12} /> VERIFICADO</div>
                        </div>
                    </div>
                </div>
            </footer>

            <NotificationPrompt codigoRastreio={envio?.codigo_rastreio} />
            <style>{jlStyles}</style>
        </div>
    );
}

/* ─── Inline Icons ─── */
const UserIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
);
const CalendarIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
);

/* ═══════════════════════════════════════════════
   JADLOG STYLES — Clean corporate
   ═══════════════════════════════════════════════ */
const jadlogStyles = `
.jadlog-page {
  min-height: 100vh;
  background: #F5F6F7;
  color: #2B2B2B;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

/* ── Nav ── */
.jd-nav {
  position: fixed; top: 0; width: 100%; height: 64px;
  background: #ffffff; border-bottom: 1px solid #E5E7EB;
  z-index: 1000; display: flex; align-items: center;
}
.jd-nav-inner {
  max-width: 1200px; width: 100%; margin: 0 auto; padding: 0 32px;
  display: flex; align-items: center; justify-content: space-between;
}
.jd-nav-logo { height: 36px; width: auto; }
.jd-nav-links { display: flex; gap: 32px; }
.jd-nav-links a {
  font-size: 14px; font-weight: 500; color: #6B7280;
  text-decoration: none; transition: color 0.2s;
}
.jd-nav-links a:hover { color: #D71920; }
.jd-nav-mobile {
  display: none; background: none; border: none;
  cursor: pointer; color: #2B2B2B; padding: 8px;
}

/* Mobile drawer */
.jd-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1100;
}
.jd-drawer {
  position: fixed; top: 0; right: 0; width: 280px; max-width: 80vw;
  height: 100vh; background: #fff; z-index: 1200;
  display: flex; flex-direction: column;
  box-shadow: -4px 0 24px rgba(0,0,0,0.1);
  animation: jdSlide 0.25s ease-out;
}
@keyframes jdSlide { from { transform: translateX(100%); } to { transform: translateX(0); } }
.jd-drawer-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid #E5E7EB;
}
.jd-drawer-head button { background: none; border: none; cursor: pointer; color: #6B7280; }
.jd-drawer a {
  font-size: 15px; font-weight: 500; color: #2B2B2B;
  text-decoration: none; padding: 14px 24px;
  border-bottom: 1px solid #F5F6F7; transition: background 0.2s;
}
.jd-drawer a:hover { background: #FEF2F2; color: #D71920; }

/* ── Hero ── */
.jd-hero {
  padding: 130px 32px 90px; 
  background: linear-gradient(135deg, #D71920 0%, #a51117 50%, #8B0F14 100%);
  color: white; text-align: center; position: relative;
  overflow: hidden;
}
.jd-hero-bg-decor {
  position: absolute; inset: 0; z-index: 0;
  background: 
    radial-gradient(ellipse 800px 400px at 20% 80%, rgba(255,255,255,0.06) 0%, transparent 70%),
    radial-gradient(ellipse 600px 300px at 80% 20%, rgba(255,255,255,0.04) 0%, transparent 70%);
}
.jd-hero-content { 
  max-width: 680px; margin: 0 auto; position: relative; z-index: 2; 
}
.jd-hero-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 16px; border-radius: 100px;
  background: rgba(255,255,255,0.15); backdrop-filter: blur(4px);
  font-size: 12px; font-weight: 600; letter-spacing: 0.5px;
  text-transform: uppercase; margin-bottom: 24px;
  border: 1px solid rgba(255,255,255,0.2);
}
.jd-hero h1 {
  font-size: 40px; font-weight: 800; line-height: 1.15;
  margin-bottom: 18px; letter-spacing: -0.5px;
}
.jd-hero-sub {
  font-size: 17px; font-weight: 400; opacity: 0.92;
  margin-bottom: 8px; line-height: 1.6;
}
.jd-hero-desc {
  font-size: 14px; font-weight: 400; opacity: 0.7;
  margin-bottom: 44px; line-height: 1.6;
}

/* ── Search ── */
.jd-search-form {
  max-width: 540px; margin: 0 auto;
  display: flex; flex-direction: column; gap: 0;
}
.jd-search-wrapper {
  display: flex; align-items: center; gap: 12px;
  background: #ffffff; border-radius: 16px;
  padding: 6px 6px 6px 20px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1);
  transition: box-shadow 0.3s;
}
.jd-search-wrapper:focus-within {
  box-shadow: 0 8px 32px rgba(0,0,0,0.2), 0 0 0 3px rgba(255,255,255,0.3);
}
.jd-search-icon { color: #9CA3AF; flex-shrink: 0; }
.jd-search-input {
  flex: 1; border: none; background: transparent;
  height: 52px; font-size: 15px; font-weight: 500;
  color: #2B2B2B; outline: none; font-family: inherit;
}
.jd-search-input::placeholder { color: #BFBFBF; }
.jd-search-btn-inline {
  display: flex; align-items: center; gap: 8px;
  height: 44px; padding: 0 24px; background: #D71920;
  color: white; border: none; border-radius: 12px;
  font-weight: 700; font-size: 14px; cursor: pointer;
  transition: all 0.2s; white-space: nowrap;
  box-shadow: 0 2px 8px rgba(215,25,32,0.4);
}
.jd-search-btn-inline:hover:not(:disabled) { 
  background: #B7151B; transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(215,25,32,0.5);
}
.jd-search-btn-inline:active:not(:disabled) { transform: translateY(0); }
.jd-search-btn-inline:disabled { opacity: 0.6; cursor: not-allowed; }
.jd-search-btn-mobile {
  display: none; align-items: center; justify-content: center; gap: 8px;
  height: 52px; width: 100%; margin-top: 12px;
  background: rgba(255,255,255,0.15); backdrop-filter: blur(4px);
  color: white; border: 2px solid rgba(255,255,255,0.3);
  border-radius: 14px; font-weight: 700; font-size: 15px;
  cursor: pointer; transition: all 0.2s;
}
.jd-search-btn-mobile:hover:not(:disabled) {
  background: rgba(255,255,255,0.25); border-color: rgba(255,255,255,0.5);
}
.jd-search-btn-mobile:disabled { opacity: 0.6; cursor: not-allowed; }

/* ── Benefits ── */
.jd-benefits {
  padding: 80px 32px; background: #ffffff;
  border-bottom: 1px solid #E5E7EB;
}
.jd-benefits-grid {
  max-width: 1100px; margin: 0 auto;
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px;
}
.jd-benefit-card {
  text-align: center; padding: 40px 28px;
  border-radius: 16px; border: 1px solid #F0F0F0;
  transition: all 0.3s;
}
.jd-benefit-card:hover {
  border-color: rgba(215,25,32,0.15);
  box-shadow: 0 8px 24px rgba(215,25,32,0.06);
  transform: translateY(-2px);
}
.jd-benefit-icon {
  width: 60px; height: 60px; border-radius: 16px;
  background: linear-gradient(135deg, rgba(215,25,32,0.08), rgba(215,25,32,0.04));
  color: #D71920;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 20px;
}
.jd-benefit-card h3 {
  font-size: 16px; font-weight: 700; color: #2B2B2B; margin-bottom: 10px;
}
.jd-benefit-card p {
  font-size: 14px; color: #6B7280; line-height: 1.7;
}

/* ── Results ── */
.jd-results { padding: 60px 32px 100px; }
.jd-results-inner { max-width: 1100px; margin: 0 auto; }

.jd-data-grid {
  display: grid; grid-template-columns: 380px 1fr;
  gap: 32px; align-items: start;
}

/* Sidebar */
.jd-sidebar { display: flex; flex-direction: column; gap: 12px; }
.jd-info-card {
  background: #ffffff; border-radius: 16px;
  padding: 28px; border: 1px solid #E5E7EB;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.jd-card-header {
  display: flex; align-items: center; gap: 10px;
  font-size: 14px; font-weight: 600; color: #2B2B2B;
  margin-bottom: 24px; padding-bottom: 16px;
  border-bottom: 1px solid #E5E7EB;
}
.jd-info-row {
  display: flex; flex-direction: column; gap: 4px;
  margin-bottom: 20px;
}
.jd-info-row:last-of-type { margin-bottom: 0; }
.jd-label {
  font-size: 12px; font-weight: 500; color: #6B7280;
  letter-spacing: 0.3px;
}
.jd-tracking-code {
  font-size: 22px; font-weight: 700; color: #2B2B2B;
  letter-spacing: 1px; font-family: 'Inter', monospace;
}
.jd-value { font-size: 15px; font-weight: 600; color: #2B2B2B; }
.jd-status-badge {
  display: inline-block; padding: 4px 12px;
  background: rgba(215,25,32,0.1); color: #D71920;
  border-radius: 6px; font-size: 13px; font-weight: 600;
  width: fit-content;
}

.jd-progress-area { margin-top: 24px; padding-top: 20px; border-top: 1px solid #E5E7EB; }
.jd-progress-header {
  display: flex; justify-content: space-between;
  font-size: 12px; font-weight: 600; color: #6B7280;
  margin-bottom: 8px;
}
.jd-progress-track {
  height: 8px; background: #E5E7EB; border-radius: 4px; overflow: hidden;
}
.jd-progress-fill {
  height: 100%; background: #D71920; border-radius: 4px;
  transition: width 1s ease-out;
}

.jd-meta-card {
  background: #ffffff; border-radius: 12px; padding: 16px 20px;
  display: flex; align-items: center; gap: 14px;
  border: 1px solid #E5E7EB;
}
.jd-meta-card svg { color: #D71920; flex-shrink: 0; }
.jd-meta-card div { display: flex; flex-direction: column; }

/* Timeline */
.jd-timeline-card {
  background: #ffffff; border-radius: 16px;
  border: 1px solid #E5E7EB; overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.jd-timeline-header {
  background: #D71920; color: white;
  padding: 14px 24px; font-size: 14px; font-weight: 600;
}
.jd-timeline-empty {
  padding: 40px 24px; text-align: center;
  color: #6B7280; font-size: 14px;
}
.jd-timeline { padding: 24px; }
.jd-tl-item {
  display: flex; gap: 16px; position: relative;
  padding-bottom: 24px;
}
.jd-tl-item:last-child { padding-bottom: 0; }
.jd-tl-indicator {
  display: flex; flex-direction: column; align-items: center;
  position: relative; flex-shrink: 0;
}
.jd-tl-dot {
  width: 36px; height: 36px; border-radius: 50%;
  background: #F5F6F7; border: 2px solid #E5E7EB;
  display: flex; align-items: center; justify-content: center;
  color: #6B7280; z-index: 2;
}
.jd-tl-dot.active {
  background: rgba(215,25,32,0.1); border-color: #D71920; color: #D71920;
}
.jd-tl-line {
  position: absolute; top: 38px; bottom: -2px;
  width: 2px; background: #E5E7EB;
}
.jd-tl-content { flex: 1; padding-top: 6px; }
.jd-tl-content h4 {
  font-size: 14px; font-weight: 600; color: #2B2B2B; margin: 0 0 4px;
}
.jd-tl-active .jd-tl-content h4 { color: #D71920; }
.jd-tl-location {
  font-size: 13px; color: #6B7280; margin: 0 0 4px; line-height: 1.4;
}
.jd-tl-date {
  font-size: 12px; color: #9CA3AF; font-family: 'Inter', monospace;
}
.jd-action-btn {
  display: inline-block; margin-top: 8px; padding: 8px 20px;
  background: #D71920; color: #fff; border-radius: 8px;
  font-size: 13px; font-weight: 600; text-decoration: none;
  transition: background 0.2s;
}
.jd-action-btn:hover { background: #B7151B; }

/* Error */
.jd-error-card {
  text-align: center; padding: 60px 24px;
  background: #ffffff; border-radius: 16px;
  border: 1px solid #E5E7EB;
}
.jd-error-card svg { color: #D71920; margin-bottom: 16px; }
.jd-error-card h2 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
.jd-error-card p { color: #6B7280; margin-bottom: 24px; }
.jd-error-card button {
  padding: 12px 28px; background: #D71920; color: white;
  border: none; border-radius: 10px; font-weight: 600;
  cursor: pointer; transition: background 0.2s;
}
.jd-error-card button:hover { background: #B7151B; }

/* ── Footer ── */
.jd-footer {
  background: #ffffff; padding: 60px 32px 32px;
  border-top: 1px solid #E5E7EB;
}
.jd-footer-inner { max-width: 1100px; margin: 0 auto; }
.jd-footer-top {
  display: flex; justify-content: space-between; margin-bottom: 48px;
}
.jd-footer-brand img { height: 36px; width: auto; margin-bottom: 16px; }
.jd-footer-brand p { font-size: 14px; color: #6B7280; line-height: 1.6; max-width: 300px; }
.jd-footer-cols { display: flex; gap: 64px; }
.jd-footer-cols h5 {
  font-size: 12px; font-weight: 700; color: #2B2B2B;
  letter-spacing: 1px; text-transform: uppercase; margin-bottom: 16px;
}
.jd-footer-cols a {
  display: block; font-size: 14px; color: #6B7280;
  text-decoration: none; margin-bottom: 10px; transition: color 0.2s;
}
.jd-footer-cols a:hover { color: #D71920; }
.jd-footer-bottom {
  padding-top: 24px; border-top: 1px solid #E5E7EB;
  font-size: 13px; color: #9CA3AF;
}

/* Spinner */
.jd-spinner {
  width: 20px; height: 20px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white; border-radius: 50%;
  animation: jdSpin 0.8s linear infinite;
  margin: 0 auto;
}
@keyframes jdSpin { to { transform: rotate(360deg); } }

/* ── Mobile ── */
@media (max-width: 768px) {
  .jd-nav-links { display: none; }
  .jd-nav-mobile { display: block; }
  .jd-hero { padding: 100px 20px 60px; }
  .jd-hero h1 { font-size: 28px; }
  .jd-hero-sub { font-size: 15px; }
  .jd-hero-desc { font-size: 13px; margin-bottom: 32px; }
  .jd-search-wrapper { padding: 12px 16px; }
  .jd-search-btn-inline { display: none; }
  .jd-search-btn-mobile { display: flex; }
  .jd-search-input { height: 44px; text-align: center; }
  .jd-search-icon { display: none; }
  .jd-benefits-grid { grid-template-columns: 1fr; gap: 16px; }
  .jd-data-grid { grid-template-columns: 1fr; }
  .jd-results { padding: 24px 16px 60px; }
  .jd-info-card { padding: 20px; }
  .jd-tracking-code { font-size: 18px; }
  .jd-footer-top { flex-direction: column; gap: 32px; }
  .jd-footer-cols { flex-direction: column; gap: 24px; }
}
`;

/* ═══════════════════════════════════════════════
   VETOR TRANSPORTES STYLES — Green/Graphite tech
   ═══════════════════════════════════════════════ */
const vetorStyles = `
.vt-page {
  min-height: 100vh;
  background: #F5F7F5;
  color: #2B2B2B;
  font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
}
.vt-nav {
  position: fixed; top: 0; width: 100%; height: 64px;
  background: #ffffff; border-bottom: 1px solid #E5E7EB;
  z-index: 1000; display: flex; align-items: center;
}
.vt-nav-inner {
  max-width: 1200px; width: 100%; margin: 0 auto; padding: 0 32px;
  display: flex; align-items: center; justify-content: space-between;
}
.vt-nav-logo { height: 64px; width: auto; }
.vt-nav-links { display: flex; gap: 32px; }
.vt-nav-links a {
  font-size: 14px; font-weight: 500; color: #37474F;
  text-decoration: none; transition: color 0.2s;
}
.vt-nav-links a:hover { color: #1B5E20; }
.vt-nav-mobile {
  display: none; background: none; border: none;
  cursor: pointer; color: #37474F; padding: 8px;
}
.vt-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1100;
}
.vt-drawer {
  position: fixed; top: 0; right: 0; width: 280px; max-width: 80vw;
  height: 100vh; background: #fff; z-index: 1200;
  display: flex; flex-direction: column;
  box-shadow: -4px 0 24px rgba(0,0,0,0.1);
  animation: vtSlide 0.25s ease-out;
}
@keyframes vtSlide { from { transform: translateX(100%); } to { transform: translateX(0); } }
.vt-drawer-head {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid #E5E7EB;
}
.vt-drawer-head button { background: none; border: none; cursor: pointer; color: #6B7280; }
.vt-drawer a {
  font-size: 15px; font-weight: 500; color: #2B2B2B;
  text-decoration: none; padding: 14px 24px;
  border-bottom: 1px solid #F5F6F7; transition: background 0.2s;
}
.vt-drawer a:hover { background: #E8F5E9; color: #1B5E20; }
.vt-hero {
  padding: 130px 32px 90px;
  background: linear-gradient(135deg, #1B5E20 0%, #2E7D32 40%, #263238 100%);
  color: white; text-align: center; position: relative; overflow: hidden;
}
.vt-hero-decor {
  position: absolute; inset: 0; z-index: 0;
  background:
    linear-gradient(45deg, rgba(255,255,255,0.03) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.03) 75%, transparent 75%),
    radial-gradient(ellipse 800px 400px at 20% 80%, rgba(76,175,80,0.08) 0%, transparent 70%),
    radial-gradient(ellipse 600px 300px at 80% 20%, rgba(255,255,255,0.04) 0%, transparent 70%);
  background-size: 60px 60px, 100% 100%, 100% 100%;
}
.vt-hero-content { max-width: 680px; margin: 0 auto; position: relative; z-index: 2; }
.vt-hero-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 16px; border-radius: 100px;
  background: rgba(76,175,80,0.2); backdrop-filter: blur(4px);
  font-size: 12px; font-weight: 600; letter-spacing: 0.5px;
  text-transform: uppercase; margin-bottom: 24px;
  border: 1px solid rgba(76,175,80,0.3);
}
.vt-hero h1 {
  font-size: 40px; font-weight: 700; line-height: 1.15;
  margin-bottom: 18px; letter-spacing: -0.5px;
}
.vt-hero-sub {
  font-size: 17px; font-weight: 400; opacity: 0.92;
  margin-bottom: 8px; line-height: 1.6;
}
.vt-hero-desc {
  font-size: 14px; font-weight: 400; opacity: 0.7;
  margin-bottom: 44px; line-height: 1.6;
}
.vt-search-form {
  max-width: 540px; margin: 0 auto;
  display: flex; flex-direction: column; gap: 0;
}
.vt-search-wrapper {
  display: flex; align-items: center; gap: 12px;
  background: #ffffff; border-radius: 16px;
  padding: 6px 6px 6px 20px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15), 0 2px 8px rgba(0,0,0,0.1);
  transition: box-shadow 0.3s;
}
.vt-search-wrapper:focus-within {
  box-shadow: 0 8px 32px rgba(0,0,0,0.2), 0 0 0 3px rgba(76,175,80,0.3);
}
.vt-search-icon { color: #9CA3AF; flex-shrink: 0; }
.vt-search-input {
  flex: 1; border: none; background: transparent;
  height: 52px; font-size: 15px; font-weight: 500;
  color: #2B2B2B; outline: none; font-family: inherit;
}
.vt-search-input::placeholder { color: #BFBFBF; }
.vt-search-btn-inline {
  display: flex; align-items: center; gap: 8px;
  height: 44px; padding: 0 24px; background: #1B5E20;
  color: white; border: none; border-radius: 12px;
  font-weight: 700; font-size: 14px; cursor: pointer;
  transition: all 0.2s; white-space: nowrap;
  box-shadow: 0 2px 8px rgba(27,94,32,0.4);
}
.vt-search-btn-inline:hover:not(:disabled) {
  background: #145218; transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(27,94,32,0.5);
}
.vt-search-btn-inline:active:not(:disabled) { transform: translateY(0); }
.vt-search-btn-inline:disabled { opacity: 0.6; cursor: not-allowed; }
.vt-search-btn-mobile {
  display: none; align-items: center; justify-content: center; gap: 8px;
  height: 52px; width: 100%; margin-top: 12px;
  background: rgba(255,255,255,0.15); backdrop-filter: blur(4px);
  color: white; border: 2px solid rgba(255,255,255,0.3);
  border-radius: 14px; font-weight: 700; font-size: 15px;
  cursor: pointer; transition: all 0.2s;
}
.vt-search-btn-mobile:hover:not(:disabled) {
  background: rgba(255,255,255,0.25); border-color: rgba(255,255,255,0.5);
}
.vt-search-btn-mobile:disabled { opacity: 0.6; cursor: not-allowed; }
.vt-benefits {
  padding: 80px 32px 40px; background: #ffffff;
}
@keyframes vt-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.vt-partners {
  padding: 0 32px 80px; background: #ffffff;
  border-bottom: 1px solid #E5E7EB;
  text-align: center;
}
.vt-partners-title {
  font-size: 24px; font-weight: 700; color: #1B5E20;
  margin-bottom: 32px;
}
.vt-partners-overflow {
  overflow: hidden; max-width: 1100px; margin: 0 auto;
  mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%);
  -webkit-mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%);
}
.vt-partners-track {
  display: flex; gap: 2rem; width: max-content;
  animation: vt-scroll 25s linear infinite;
}
.vt-partners-track:hover { animation-play-state: paused; }
.vt-partner-card {
  flex-shrink: 0; background: #fff;
  border: 1px solid #f0f0f0; border-radius: 20px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  padding: 24px 32px;
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.3s, box-shadow 0.3s;
}
.vt-partner-card:hover {
  transform: scale(1.05);
  box-shadow: 0 8px 24px rgba(27,94,32,0.1);
}
.vt-partner-logo {
  height: 60px; width: auto; object-fit: contain;
}
.vt-benefits-grid {
  max-width: 1100px; margin: 0 auto;
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px;
}
.vt-benefit-card {
  text-align: center; padding: 40px 28px;
  border-radius: 16px; border: 1px solid #F0F0F0;
  transition: all 0.3s;
}
.vt-benefit-card:hover {
  border-color: rgba(27,94,32,0.15);
  box-shadow: 0 8px 24px rgba(27,94,32,0.06);
  transform: translateY(-2px);
}
.vt-benefit-icon {
  width: 60px; height: 60px; border-radius: 16px;
  background: linear-gradient(135deg, rgba(27,94,32,0.1), rgba(76,175,80,0.06));
  color: #1B5E20;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 20px;
}
.vt-benefit-card h3 { font-size: 16px; font-weight: 700; color: #37474F; margin-bottom: 10px; }
.vt-benefit-card p { font-size: 14px; color: #6B7280; line-height: 1.7; }
.vt-results { padding: 60px 32px 100px; }
.vt-results-inner { max-width: 1100px; margin: 0 auto; }
.vt-data-grid {
  display: grid; grid-template-columns: 380px 1fr;
  gap: 32px; align-items: start;
}
.vt-sidebar { display: flex; flex-direction: column; gap: 12px; }
.vt-info-card {
  background: #ffffff; border-radius: 16px;
  padding: 28px; border: 1px solid #E5E7EB;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.vt-card-header {
  display: flex; align-items: center; gap: 10px;
  font-size: 14px; font-weight: 600; color: #37474F;
  margin-bottom: 24px; padding-bottom: 16px;
  border-bottom: 1px solid #E5E7EB;
}
.vt-info-row { display: flex; flex-direction: column; gap: 4px; margin-bottom: 20px; }
.vt-info-row:last-of-type { margin-bottom: 0; }
.vt-label { font-size: 12px; font-weight: 500; color: #6B7280; letter-spacing: 0.3px; }
.vt-tracking-code {
  font-size: 22px; font-weight: 700; color: #37474F;
  letter-spacing: 1px; font-family: 'JetBrains Mono', monospace;
}
.vt-value { font-size: 15px; font-weight: 600; color: #37474F; }
.vt-status-badge {
  display: inline-block; padding: 4px 12px;
  background: rgba(27,94,32,0.1); color: #1B5E20;
  border-radius: 6px; font-size: 13px; font-weight: 600; width: fit-content;
}
.vt-progress-area { margin-top: 24px; padding-top: 20px; border-top: 1px solid #E5E7EB; }
.vt-progress-header {
  display: flex; justify-content: space-between;
  font-size: 12px; font-weight: 600; color: #6B7280; margin-bottom: 8px;
}
.vt-progress-track { height: 8px; background: #E5E7EB; border-radius: 4px; overflow: hidden; }
.vt-progress-fill {
  height: 100%; background: linear-gradient(90deg, #1B5E20, #4CAF50); border-radius: 4px;
  transition: width 1s ease-out;
}
.vt-meta-card {
  background: #ffffff; border-radius: 12px; padding: 16px 20px;
  display: flex; align-items: center; gap: 14px; border: 1px solid #E5E7EB;
}
.vt-meta-card svg { color: #1B5E20; flex-shrink: 0; }
.vt-meta-card div { display: flex; flex-direction: column; }
.vt-timeline-card {
  background: #ffffff; border-radius: 16px;
  border: 1px solid #E5E7EB; overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
.vt-timeline-header {
  background: #37474F; color: white;
  padding: 14px 24px; font-size: 14px; font-weight: 600;
}
.vt-timeline-empty { padding: 40px 24px; text-align: center; color: #6B7280; font-size: 14px; }
.vt-timeline { padding: 24px; }
.vt-tl-item { display: flex; gap: 16px; position: relative; padding-bottom: 24px; }
.vt-tl-item:last-child { padding-bottom: 0; }
.vt-tl-indicator {
  display: flex; flex-direction: column; align-items: center;
  position: relative; flex-shrink: 0;
}
.vt-tl-dot {
  width: 36px; height: 36px; border-radius: 50%;
  background: #F5F6F7; border: 2px solid #E5E7EB;
  display: flex; align-items: center; justify-content: center;
  color: #6B7280; z-index: 2;
}
.vt-tl-dot.active { background: rgba(27,94,32,0.1); border-color: #1B5E20; color: #1B5E20; }
.vt-tl-line { position: absolute; top: 38px; bottom: -2px; width: 2px; background: #4CAF50; }
.vt-tl-content { flex: 1; padding-top: 6px; }
.vt-tl-content h4 { font-size: 14px; font-weight: 600; color: #37474F; margin: 0 0 4px; }
.vt-tl-active .vt-tl-content h4 { color: #1B5E20; }
.vt-tl-location { font-size: 13px; color: #6B7280; margin: 0 0 4px; line-height: 1.4; }
.vt-tl-date { font-size: 12px; color: #9CA3AF; font-family: 'JetBrains Mono', monospace; }
.vt-action-btn {
  display: inline-block; margin-top: 8px; padding: 8px 20px;
  background: #1B5E20; color: #fff; border-radius: 8px;
  font-size: 13px; font-weight: 600; text-decoration: none; transition: background 0.2s;
}
.vt-action-btn:hover { background: #145218; }
.vt-error-card {
  text-align: center; padding: 60px 24px;
  background: #ffffff; border-radius: 16px; border: 1px solid #E5E7EB;
}
.vt-error-card svg { color: #1B5E20; margin-bottom: 16px; }
.vt-error-card h2 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
.vt-error-card p { color: #6B7280; margin-bottom: 24px; }
.vt-error-card button {
  padding: 12px 28px; background: #1B5E20; color: white;
  border: none; border-radius: 10px; font-weight: 600;
  cursor: pointer; transition: background 0.2s;
}
.vt-error-card button:hover { background: #145218; }
.vt-footer {
  background: #ffffff; padding: 60px 32px 32px; border-top: 1px solid #E5E7EB;
}
.vt-footer-inner { max-width: 1100px; margin: 0 auto; }
.vt-footer-top { display: flex; justify-content: space-between; margin-bottom: 48px; }
.vt-footer-brand img { height: 40px; width: auto; margin-bottom: 16px; }
.vt-footer-brand p { font-size: 14px; color: #6B7280; line-height: 1.6; max-width: 300px; }
.vt-footer-cols { display: flex; gap: 64px; }
.vt-footer-cols h5 {
  font-size: 12px; font-weight: 700; color: #37474F;
  letter-spacing: 1px; text-transform: uppercase; margin-bottom: 16px;
}
.vt-footer-cols a {
  display: block; font-size: 14px; color: #6B7280;
  text-decoration: none; margin-bottom: 10px; transition: color 0.2s;
}
.vt-footer-cols a:hover { color: #1B5E20; }
.vt-footer-bottom { padding-top: 24px; border-top: 1px solid #E5E7EB; font-size: 13px; color: #9CA3AF; }
.vt-spinner {
  width: 20px; height: 20px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white; border-radius: 50%;
  animation: vtSpin 0.8s linear infinite; margin: 0 auto;
}
@keyframes vtSpin { to { transform: rotate(360deg); } }

/* ── Stats Bar ── */
.vt-stats-bar {
  background: linear-gradient(135deg, #1B5E20 0%, #263238 100%);
  padding: 40px 32px;
}
.vt-stats-grid {
  max-width: 1100px; margin: 0 auto;
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px;
}
.vt-stat-item {
  display: flex; align-items: center; gap: 16px; color: white;
  justify-content: center;
}
.vt-stat-item svg { opacity: 0.85; flex-shrink: 0; }
.vt-stat-item div { display: flex; flex-direction: column; }
.vt-stat-number { font-size: 28px; font-weight: 700; line-height: 1.1; }
.vt-stat-label { font-size: 13px; font-weight: 400; opacity: 0.75; }

/* ── Como Funciona ── */
.vt-howit {
  background: linear-gradient(135deg, #263238 0%, #1B5E20 100%);
  padding: 80px 32px; text-align: center; color: white;
}
.vt-howit-inner { max-width: 900px; margin: 0 auto; }
.vt-howit-title { font-size: 32px; font-weight: 700; margin-bottom: 8px; }
.vt-howit-sub { font-size: 15px; opacity: 0.75; margin-bottom: 56px; }
.vt-howit-steps { display: flex; justify-content: center; gap: 0; position: relative; }
.vt-step {
  flex: 1; max-width: 260px; text-align: center; position: relative; padding: 0 16px;
}
.vt-step-num {
  width: 56px; height: 56px; border-radius: 50%;
  background: linear-gradient(135deg, #4CAF50, #1B5E20);
  color: white; font-size: 22px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 20px; position: relative; z-index: 2;
  box-shadow: 0 4px 16px rgba(76,175,80,0.4);
}
.vt-step-line {
  position: absolute; top: 28px; left: calc(50% + 28px); width: calc(100% - 56px);
  height: 2px; background: rgba(76,175,80,0.4); z-index: 1;
}
.vt-step:last-child .vt-step-line { display: none; }
.vt-step h3 { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
.vt-step p { font-size: 13px; opacity: 0.7; line-height: 1.6; }

/* ── Sobre Nós ── */
.vt-about {
  padding: 80px 32px; background: #F5F7F5;
}
.vt-about-inner {
  max-width: 1100px; margin: 0 auto;
  display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center;
}
.vt-about-left { display: flex; flex-direction: column; gap: 24px; }
.vt-about-card-dark {
  background: linear-gradient(135deg, #263238, #37474F);
  border-radius: 20px; padding: 40px; color: white;
}
.vt-about-badge {
  display: inline-block; padding: 4px 14px; border-radius: 100px;
  background: rgba(76,175,80,0.2); border: 1px solid rgba(76,175,80,0.3);
  font-size: 11px; font-weight: 700; letter-spacing: 1.5px; margin-bottom: 20px;
}
.vt-about-card-dark h2 { font-size: 28px; font-weight: 700; line-height: 1.3; margin-bottom: 16px; }
.vt-about-card-dark p { font-size: 14px; opacity: 0.8; line-height: 1.7; margin-bottom: 20px; }
.vt-about-tag {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 16px; border-radius: 10px;
  background: rgba(76,175,80,0.15); font-size: 13px; font-weight: 600;
}
.vt-about-truck {
  width: 100%; border-radius: 16px; object-fit: cover;
  max-height: 260px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
}
.vt-about-right { display: flex; flex-direction: column; gap: 28px; }
.vt-about-bullet { display: flex; gap: 18px; align-items: flex-start; }
.vt-about-bullet-icon {
  width: 52px; height: 52px; border-radius: 14px; flex-shrink: 0;
  background: linear-gradient(135deg, rgba(27,94,32,0.1), rgba(76,175,80,0.06));
  color: #1B5E20;
  display: flex; align-items: center; justify-content: center;
}
.vt-about-bullet h4 { font-size: 16px; font-weight: 700; color: #37474F; margin-bottom: 6px; }
.vt-about-bullet p { font-size: 13px; color: #6B7280; line-height: 1.6; }

/* ── Recursos ── */
.vt-features {
  padding: 80px 32px; background: #ffffff; text-align: center;
}
.vt-features-inner { max-width: 1100px; margin: 0 auto; }
.vt-features-badge {
  display: inline-block; padding: 4px 16px; border-radius: 100px;
  background: rgba(27,94,32,0.08); color: #1B5E20;
  font-size: 11px; font-weight: 700; letter-spacing: 1.5px; margin-bottom: 16px;
}
.vt-features-title { font-size: 28px; font-weight: 700; color: #37474F; margin-bottom: 48px; }
.vt-features-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px;
}
.vt-feature-card {
  padding: 40px 28px; border-radius: 16px;
  border: 1px solid #F0F0F0; text-align: center;
  transition: all 0.3s;
}
.vt-feature-card:hover {
  border-color: rgba(27,94,32,0.15);
  box-shadow: 0 8px 24px rgba(27,94,32,0.06);
  transform: translateY(-2px);
}
.vt-feature-icon {
  width: 60px; height: 60px; border-radius: 16px;
  background: linear-gradient(135deg, #1B5E20, #4CAF50);
  color: white;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 20px;
}
.vt-feature-card h3 { font-size: 16px; font-weight: 700; color: #37474F; margin-bottom: 10px; }
.vt-feature-card p { font-size: 14px; color: #6B7280; line-height: 1.7; }

@media (max-width: 768px) {
  .vt-nav-links { display: none; }
  .vt-nav-mobile { display: block; }
  .vt-hero { padding: 100px 20px 60px; }
  .vt-hero h1 { font-size: 28px; }
  .vt-hero-sub { font-size: 15px; }
  .vt-hero-desc { font-size: 13px; margin-bottom: 32px; }
  .vt-search-wrapper { padding: 12px 16px; }
  .vt-search-btn-inline { display: none; }
  .vt-search-btn-mobile { display: flex; }
  .vt-search-input { height: 44px; text-align: center; }
  .vt-search-icon { display: none; }
  .vt-benefits-grid { grid-template-columns: 1fr; gap: 16px; }
  .vt-partners { padding: 0 16px 60px; }
  .vt-partners-title { font-size: 20px; margin-bottom: 24px; }
  .vt-partners-track { gap: 1rem; }
  .vt-partner-card { padding: 16px 20px; }
  .vt-partner-logo { height: 45px; }
  .vt-data-grid { grid-template-columns: 1fr; }
  .vt-results { padding: 24px 16px 60px; }
  .vt-info-card { padding: 20px; }
  .vt-tracking-code { font-size: 18px; }
  .vt-footer-top { flex-direction: column; gap: 32px; }
  .vt-footer-cols { flex-direction: column; gap: 24px; }
  .vt-stats-grid { grid-template-columns: repeat(2, 1fr); gap: 20px; }
  .vt-stat-number { font-size: 22px; }
  .vt-stats-bar { padding: 32px 20px; }
  .vt-howit { padding: 60px 20px; }
  .vt-howit-title { font-size: 24px; }
  .vt-howit-steps { flex-direction: column; align-items: center; gap: 32px; }
  .vt-step-line { display: none !important; }
  .vt-about { padding: 60px 20px; }
  .vt-about-inner { grid-template-columns: 1fr; gap: 32px; }
  .vt-about-card-dark { padding: 28px; }
  .vt-about-card-dark h2 { font-size: 22px; }
  .vt-features { padding: 60px 20px; }
  .vt-features-title { font-size: 22px; margin-bottom: 32px; }
  .vt-features-grid { grid-template-columns: 1fr; gap: 16px; }
}
`;

/* ═══════════════════════════════════════════════
   JL TRANSPORTES STYLES — Original dark theme
   ═══════════════════════════════════════════════ */
const jlStyles = `
.rastreio-container {
  min-height: 100vh;
  background: white;
  color: #0f172a;
  font-family: 'Plus Jakarta Sans', sans-serif;
}

.main-nav {
  position: fixed; top: 0; width: 100%; height: 64px;
  backdrop-filter: blur(16px); background: rgba(248,250,252,0.9);
  border-bottom: 1px solid rgba(0,0,0,0.06); z-index: 1000;
  display: flex; align-items: center;
}
.nav-inner {
  max-width: 1280px; width: 100%; margin: 0 auto; padding: 0 32px;
  display: flex; align-items: center; justify-content: space-between;
}
.nav-brand { display: flex; align-items: center; }
.nav-logo { height: auto; width: 130px; filter: brightness(1.1); }
.nav-links { display: flex; gap: 28px; align-items: center; }
.nav-link {
  font-size: 13px; font-weight: 600; color: #475569;
  text-decoration: none; transition: color 0.2s;
}
.nav-link:hover { color: #0f172a; }
.nav-mobile-toggle {
  display: none; background: none; border: none;
  cursor: pointer; color: #1e293b; padding: 8px;
}
.nav-mobile-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 1100;
}
.nav-mobile-drawer {
  position: fixed; top: 0; right: 0; width: 280px; max-width: 80vw;
  height: 100vh; background: #f1f5f9; z-index: 1200;
  display: flex; flex-direction: column;
  box-shadow: -4px 0 30px rgba(0,0,0,0.15);
  animation: slideIn 0.25s ease-out;
}
@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
.nav-mobile-drawer-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid rgba(0,0,0,0.08);
}
.nav-mobile-close { background: none; border: none; cursor: pointer; color: #475569; padding: 4px; }
.nav-mobile-drawer-links { display: flex; flex-direction: column; padding: 8px 0; }
.nav-mobile-link {
  font-size: 15px; font-weight: 600; color: #334155;
  text-decoration: none; padding: 14px 24px;
  border-bottom: 1px solid rgba(0,0,0,0.04); transition: background 0.2s, color 0.2s;
}
.nav-mobile-link:hover { color: #0f172a; background: var(--mobile-link-hover); }

.hero-section {
  padding: 120px 40px 80px; background: var(--hero-bg, #020617);
  color: white; position: relative; overflow: hidden; text-align: center;
}
.industrial-grid {
  position: absolute; inset: 0;
  background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
  background-size: 60px 60px;
}
.glow-orb {
  position: absolute; top: -100px; right: -100px; width: 600px; height: 600px;
  background: radial-gradient(circle, var(--glow-color) 0%, transparent 70%);
  filter: blur(80px);
}
.hero-content { position: relative; z-index: 10; max-width: 900px; margin: 0 auto; }
.badge {
  display: inline-flex; align-items: center; gap: 8px;
  background: var(--badge-bg); border: 1px solid var(--badge-border);
  padding: 6px 14px; border-radius: 100px;
  font-size: 10px; font-weight: 800; letter-spacing: 1.8px;
  color: var(--badge-text); margin-bottom: 28px;
}
.main-title {
  font-size: clamp(28px, 5vw, 56px); font-weight: 800;
  line-height: 1.08; letter-spacing: -1.5px; margin-bottom: 20px;
}
.main-title .highlight {
  background: linear-gradient(135deg, var(--highlight-from), var(--highlight-to));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.hero-desc {
  font-size: 16px; color: #64748b; max-width: 520px;
  margin: 0 auto 40px; line-height: 1.7;
}
.search-box { max-width: 560px; margin: 0 auto 56px; }
.search-input-wrapper {
  background: rgba(255,255,255,0.07); border: 1.5px solid rgba(255,255,255,0.18);
  border-radius: 16px; display: flex; align-items: center;
  padding: 6px 6px 6px 20px; transition: all 0.3s;
  box-shadow: 0 4px 24px rgba(0,0,0,0.2);
}
.search-input-wrapper:focus-within {
  background: rgba(255,255,255,0.1);
  border-color: var(--focus-border);
  box-shadow: 0 0 0 4px var(--focus-ring), 0 8px 32px rgba(0,0,0,0.3);
}
.search-icon { color: #64748b; }
.main-input {
  flex: 1; background: transparent; border: none; height: 50px;
  padding: 0 16px; font-family: 'JetBrains Mono', monospace;
  font-size: 16px; font-weight: 600; color: #f1f5f9;
  outline: none; letter-spacing: 1.5px;
}
.main-input::placeholder { color: #475569; letter-spacing: 0.5px; font-family: 'Plus Jakarta Sans'; font-weight: 500; font-size: 14px; }
.search-submit {
  height: 50px; padding: 0 28px; background: var(--btn-gradient);
  color: white; border: none; border-radius: 12px;
  font-weight: 800; font-size: 13px; letter-spacing: 1px;
  display: flex; align-items: center; gap: 8px;
  cursor: pointer; transition: all 0.2s;
  box-shadow: 0 4px 12px var(--btn-shadow);
}
.search-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px var(--btn-shadow); }
.search-submit:disabled { opacity: 0.5; cursor: not-allowed; }
.quick-stats { display: flex; justify-content: center; gap: 48px; }
.q-stat { display: flex; align-items: center; gap: 16px; }
.q-icon { color: #334155; }
.q-text { display: flex; flex-direction: column; text-align: left; }
.q-val { font-size: 20px; font-weight: 800; color: white; line-height: 1; }
.q-lab { font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase; margin-top: 4px; }

.results-section { padding: 60px 40px 100px; background: #f8fafc; }
.results-wrapper { max-width: 1200px; margin: 0 auto; }
.data-layout { display: grid; grid-template-columns: 380px 1fr; gap: 40px; align-items: start; }
@media (max-width: 1024px) { .data-layout { grid-template-columns: 1fr; } }

.package-label-card {
  background: #0f172a; color: white; border-radius: 24px; padding: 32px;
  position: relative; box-shadow: 0 20px 40px rgba(0,0,0,0.1);
}
.label-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
.label-status { display: flex; align-items: center; gap: 10px; font-size: 11px; font-weight: 800; letter-spacing: 1px; background: rgba(255,255,255,0.05); padding: 6px 12px; border-radius: 8px; }
.pulse-dot { width: 6px; height: 6px; background: #10b981; border-radius: 50%; box-shadow: 0 0 10px #10b981; animation: pulse 2s infinite; }
@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
.label-tracking { margin-bottom: 32px; }
.label-tag { display: block; font-size: 10px; font-weight: 700; color: #475569; letter-spacing: 1.5px; margin-bottom: 8px; }
.tracking-number { font-family: 'JetBrains Mono', monospace; font-size: 28px; font-weight: 700; letter-spacing: -1px; }
.label-grid { display: grid; grid-template-columns: 1fr; gap: 20px; margin-bottom: 32px; }
.label-val { font-size: 16px; font-weight: 600; display: block; }
.progress-container { margin-top: 24px; }
.progress-info { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 8px; }
.progress-track { height: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; overflow: hidden; }
.progress-fill { height: 100%; background: hsl(var(--primary)); border-radius: 4px; transition: width 1s ease-out; }
.meta-info-area { margin-top: 24px; display: grid; gap: 12px; }
.meta-tile { background: white; padding: 20px; border-radius: 20px; display: flex; align-items: center; gap: 16px; border: 1px solid rgba(0,0,0,0.03); }
.meta-content { display: flex; flex-direction: column; }
.meta-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
.meta-value { font-size: 15px; font-weight: 700; color: #1e293b; }

.data-main { background: white; border-radius: 24px; padding: 40px; border: 1px solid rgba(0,0,0,0.03); }
.correios-table-header { background: var(--timeline-header); color: white; display: grid; grid-template-columns: 80px 1fr 150px; padding: 12px 20px; font-weight: 700; font-size: 15px; }
.c-th-status { grid-column: 2; text-align: left; padding-left: 20px; }
.c-th-data { text-align: right; }
.journey-line-correios { position: relative; padding: 30px 20px 30px 40px; background: white; }
.journey-point-correios { position: relative; padding-bottom: 24px; display: flex; flex-direction: column; }
.journey-point-correios:last-child { padding-bottom: 0; }
.point-indicator-correios { position: absolute; left: -20px; top: 4px; bottom: 0; width: 32px; display: flex; justify-content: center; }
.indicator-line-correios { position: absolute; top: 32px; bottom: -8px; width: 3px; background: #f1c40f; }
.journey-point-correios:last-child .indicator-line-correios { display: none; }
.indicator-node-correios { width: 38px; height: 38px; border-radius: 50%; background: #f1f5f9; border: 3px solid #e2e8f0; display: flex; align-items: center; justify-content: center; z-index: 5; position: absolute; top: -2px; box-shadow: 0 2px 4px rgba(0,0,0,0.06); }
.point-content-correios { margin-left: 36px; display: flex; flex-direction: column; gap: 2px; }
.point-title-correios { font-size: 15px; font-weight: 800; color: var(--timeline-title); margin: 0 0 2px; }
.point-desc-correios { font-size: 14px; color: #334155; margin: 0; line-height: 1.4; font-weight: 500; }
.point-date-correios { font-size: 13px; color: #64748b; margin-top: 2px; font-family: 'JetBrains Mono', monospace; }
.empty-timeline { padding: 40px; text-align: center; color: #64748b; }

@media (max-width: 600px) { .correios-table-header { display: none; } .hero-section { padding: 90px 20px 60px; } .results-section { padding: 40px 20px; } }

.site-footer { background: #f1f5f9; padding: 80px 40px 40px; color: #1e293b; border-top: 1px solid #e2e8f0; }
.footer-content { max-width: 1200px; margin: 0 auto; }
.footer-top { display: flex; justify-content: space-between; margin-bottom: 60px; }
.f-brand img { height: auto; width: 220px; margin-bottom: 20px; object-fit: contain; }
.f-brand p { font-size: 14px; color: #64748b; line-height: 1.6; }
.f-links { display: flex; gap: 80px; }
.f-col h5 { font-size: 12px; font-weight: 800; color: #1e293b; letter-spacing: 1px; margin-bottom: 20px; }
.f-col a { display: block; font-size: 14px; color: #64748b; text-decoration: none; margin-bottom: 12px; }
.f-col a:hover { color: hsl(var(--primary)); }
.footer-bottom { display: flex; justify-content: space-between; align-items: center; padding-top: 40px; border-top: 1px solid rgba(0,0,0,0.05); font-size: 13px; color: #334155; }
.security-capsules { display: flex; gap: 12px; }
.cap { display: flex; align-items: center; gap: 6px; background: rgba(0,0,0,0.03); padding: 6px 12px; border-radius: 6px; font-size: 10px; font-weight: 800; }
.spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.error-state { text-align: center; padding: 60px 20px; background: white; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.02); }
.error-visual { width: 80px; height: 80px; background: #fef2f2; color: #ef4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
.error-state h2 { font-size: 24px; font-weight: 800; margin-bottom: 8px; }
.error-state p { color: #64748b; margin-bottom: 32px; }
.retry-btn { padding: 12px 32px; background: #0f172a; color: white; border: none; border-radius: 12px; font-weight: 700; cursor: pointer; }

@media (max-width: 768px) {
  .main-nav { height: 52px; } .nav-inner { padding: 0 16px; } .nav-logo { width: 110px; }
  .nav-links { display: none; } .nav-mobile-toggle { display: block; }
  .hero-section { padding: 80px 20px 50px; }
  .badge { font-size: 9px; padding: 5px 10px; margin-bottom: 20px; }
  .main-title { font-size: 26px; letter-spacing: -0.8px; margin-bottom: 14px; }
  .hero-desc { font-size: 13px; margin-bottom: 28px; }
  .search-input-wrapper { flex-direction: column; padding: 10px; border-radius: 14px; gap: 6px; }
  .search-icon { display: none; }
  .main-input { font-size: 14px; height: 44px; padding: 0 12px; text-align: center; width: 100%; min-width: 0; letter-spacing: 2px; }
  .search-submit { width: 100%; justify-content: center; border-radius: 10px; height: 46px; flex-shrink: 0; font-size: 13px; }
  .search-box { margin: 0 auto 32px; padding: 0; }
  .quick-stats { flex-direction: column; gap: 12px; align-items: center; }
  .q-val { font-size: 18px; } .q-lab { font-size: 10px; }
  .results-section { padding: 20px 12px; }
  .package-label-card { padding: 20px; border-radius: 16px; }
  .tracking-number { font-size: 18px; }
  .data-main { border-radius: 16px; }
  .site-footer { padding: 40px 16px 24px; }
  .footer-top { flex-direction: column; gap: 32px; }
  .f-links { flex-direction: column; gap: 24px; }
  .footer-bottom { flex-direction: column; gap: 12px; text-align: center; }
  .jl-partners { padding: 0 16px 60px; }
  .jl-partners-title { font-size: 20px; margin-bottom: 24px; }
  .jl-partners-track { gap: 1rem; }
  .jl-partner-card { padding: 16px 20px; }
  .jl-partner-logo { height: 45px; }
}

/* ── JL Stats Bar ── */
.jl-stats-bar {
  background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%);
  padding: 40px 32px;
}
.jl-stats-grid {
  max-width: 1100px; margin: 0 auto;
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px;
}
.jl-stat-item {
  display: flex; align-items: center; gap: 16px; color: white;
  justify-content: center;
}
.jl-stat-item svg { opacity: 0.85; flex-shrink: 0; }
.jl-stat-item div { display: flex; flex-direction: column; }
.jl-stat-number { font-size: 28px; font-weight: 700; line-height: 1.1; }
.jl-stat-label { font-size: 13px; font-weight: 400; opacity: 0.75; }

/* ── JL Como Funciona ── */
.jl-howit {
  background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
  padding: 80px 32px; text-align: center; color: white;
}
.jl-howit-inner { max-width: 900px; margin: 0 auto; }
.jl-howit-title { font-size: 32px; font-weight: 700; margin-bottom: 8px; }
.jl-howit-sub { font-size: 15px; opacity: 0.75; margin-bottom: 56px; }
.jl-howit-steps { display: flex; justify-content: center; gap: 0; position: relative; }
.jl-step {
  flex: 1; max-width: 260px; text-align: center; position: relative; padding: 0 16px;
}
.jl-step-num {
  width: 56px; height: 56px; border-radius: 50%;
  background: linear-gradient(135deg, #818cf8, #6366f1);
  color: white; font-size: 22px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 20px; position: relative; z-index: 2;
  box-shadow: 0 4px 16px rgba(99,102,241,0.4);
}
.jl-step-line {
  position: absolute; top: 28px; left: calc(50% + 28px); width: calc(100% - 56px);
  height: 2px; background: rgba(99,102,241,0.4); z-index: 1;
}
.jl-step:last-child .jl-step-line { display: none; }
.jl-step h3 { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
.jl-step p { font-size: 13px; opacity: 0.7; line-height: 1.6; }

/* ── JL Sobre Nós ── */
.jl-about {
  padding: 80px 32px; background: #f1f5f9;
}
.jl-about-inner {
  max-width: 1100px; margin: 0 auto;
  display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center;
}
.jl-about-left { display: flex; flex-direction: column; gap: 24px; }
.jl-about-card-dark {
  background: linear-gradient(135deg, #0f172a, #1e1b4b);
  border-radius: 20px; padding: 40px; color: white;
}
.jl-about-badge {
  display: inline-block; padding: 4px 14px; border-radius: 100px;
  background: rgba(99,102,241,0.2); border: 1px solid rgba(99,102,241,0.3);
  font-size: 11px; font-weight: 700; letter-spacing: 1.5px; margin-bottom: 20px;
}
.jl-about-card-dark h2 { font-size: 28px; font-weight: 700; line-height: 1.3; margin-bottom: 16px; }
.jl-about-card-dark p { font-size: 14px; opacity: 0.8; line-height: 1.7; margin-bottom: 20px; }
.jl-about-tag {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 16px; border-radius: 10px;
  background: rgba(99,102,241,0.15); font-size: 13px; font-weight: 600;
}
.jl-about-truck {
  width: 100%; border-radius: 16px; object-fit: cover;
  max-height: 260px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
}
.jl-about-right { display: flex; flex-direction: column; gap: 28px; }
.jl-about-bullet { display: flex; gap: 18px; align-items: flex-start; }
.jl-about-bullet-icon {
  width: 52px; height: 52px; border-radius: 14px; flex-shrink: 0;
  background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(129,140,248,0.06));
  color: #6366f1;
  display: flex; align-items: center; justify-content: center;
}
.jl-about-bullet h4 { font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 6px; }
.jl-about-bullet p { font-size: 13px; color: #6B7280; line-height: 1.6; }

/* ── JL Recursos ── */
.jl-features {
  padding: 80px 32px; background: #ffffff; text-align: center;
}
.jl-features-inner { max-width: 1100px; margin: 0 auto; }
.jl-features-badge {
  display: inline-block; padding: 4px 16px; border-radius: 100px;
  background: rgba(99,102,241,0.08); color: #6366f1;
  font-size: 11px; font-weight: 700; letter-spacing: 1.5px; margin-bottom: 16px;
}
.jl-features-title { font-size: 28px; font-weight: 700; color: #1e293b; margin-bottom: 48px; }
.jl-features-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px;
}
.jl-feature-card {
  padding: 40px 28px; border-radius: 16px;
  border: 1px solid #e2e8f0; text-align: center;
  transition: all 0.3s;
}
.jl-feature-card:hover {
  border-color: rgba(99,102,241,0.2);
  box-shadow: 0 8px 24px rgba(99,102,241,0.08);
  transform: translateY(-2px);
}
.jl-feature-icon {
  width: 60px; height: 60px; border-radius: 16px;
  background: linear-gradient(135deg, #6366f1, #818cf8);
  color: white;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 20px;
}
.jl-feature-card h3 { font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 10px; }
.jl-feature-card p { font-size: 14px; color: #6B7280; line-height: 1.7; }

/* ── JL Partners Carousel ── */
@keyframes jl-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.jl-partners {
  padding: 40px 32px 80px; background: #0f172a;
  text-align: center;
}
.jl-partners-title {
  font-size: 24px; font-weight: 700; color: #818cf8;
  margin-bottom: 32px;
}
.jl-partners-overflow {
  overflow: hidden; max-width: 1100px; margin: 0 auto;
  mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%);
  -webkit-mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%);
}
.jl-partners-track {
  display: flex; gap: 2rem; width: max-content;
  animation: jl-scroll 25s linear infinite;
}
.jl-partners-track:hover { animation-play-state: paused; }
.jl-partner-card {
  flex-shrink: 0; background: rgba(255,255,255,0.95);
  border-radius: 20px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  padding: 20px 32px; min-width: 160px;
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.3s, box-shadow 0.3s;
}
.jl-partner-card:hover {
  transform: scale(1.05);
  box-shadow: 0 8px 24px rgba(99,102,241,0.25);
}
.jl-partner-logo {
  height: 50px; width: auto; object-fit: contain;
}

@media (max-width: 768px) {
  .jl-stats-grid { grid-template-columns: repeat(2, 1fr); gap: 20px; }
  .jl-stat-number { font-size: 22px; }
  .jl-stats-bar { padding: 32px 20px; }
  .jl-howit { padding: 60px 20px; }
  .jl-howit-title { font-size: 24px; }
  .jl-howit-sub { font-size: 13px; margin-bottom: 36px; }
  .jl-howit-steps { flex-direction: column; align-items: center; gap: 32px; }
  .jl-step { max-width: 100%; }
  .jl-step-line { display: none !important; }
  .jl-about { padding: 48px 20px; }
  .jl-about-inner { grid-template-columns: 1fr; gap: 32px; }
  .jl-about-card-dark { padding: 28px; }
  .jl-about-card-dark h2 { font-size: 22px; }
  .jl-about-truck { max-height: 200px; }
  .jl-features { padding: 48px 20px; }
  .jl-features-title { font-size: 22px; margin-bottom: 32px; }
  .jl-features-grid { grid-template-columns: 1fr; gap: 16px; }
  .jl-feature-card { padding: 28px 20px; }
  .jl-partners { padding: 40px 16px 60px; }
  .jl-partners-title { font-size: 20px; margin-bottom: 24px; }
  .jl-partners-track { gap: 1rem; }
  .jl-partner-card { padding: 16px 20px; min-width: 120px; }
  .jl-partner-logo { height: 40px; }
}
`;
