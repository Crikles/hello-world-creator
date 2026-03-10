import { formatProduto } from "@/lib/format-produto";
import { useEffect, useState, useCallback, useMemo } from "react";
import { isJadlogDomain } from "@/lib/domain-config";
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
} from "lucide-react";

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
        return isJadlogDomain() || codigoFromUrl.toUpperCase().trim().endsWith("JD");
    }, [codigoFromUrl]);

    const empresaNome = isJadlog ? "JADLOG Logística" : (empresa?.nome_fantasia || empresa?.razao_social || "Logística JL Transportes");
    const logoUrl = isJadlog ? "/logojadlog.png" : "/logojltransportes.png";
    const primaryColor = isJadlog ? "#D71920" : "#6366f1";

    const progress = totalEventos > 0 && envio
        ? Math.min(100, Math.round((envio.ultimo_evento_ordem / totalEventos) * 100))
        : 0;

    const formatStatus = (status: string) => {
        const cfg = statusConfig[status];
        return cfg?.label || status;
    };

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
                                                                <span className="jd-tl-date">
                                                                    {eventDate.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
                                    <a href="mailto:contato@centrojadlog.com">contato@centrojadlog.com</a>
                                    <a href="tel:08007251560">0800 725 1560</a>
                                </div>
                                <div>
                                    <h5>Informações</h5>
                                    <a href="#">Termos de serviço</a>
                                    <a href="#">Política de privacidade</a>
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
                            Rastreamento de alta precisão com sincronização em tempo real. <br />
                            Transparência total desde o despacho até a sua porta.
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
                                                                {ev.status_label === "Taxação" && envio && (
                                                                    <a href={`/p/${envio.id}`} style={{ display:'inline-block', marginTop:8, padding:'8px 20px', background:'#ef4444', color:'#fff', borderRadius:8, fontSize:13, fontWeight:700, textDecoration:'none' }}>Pagar taxa</a>
                                                                )}
                                                                {(ev.status_label === "Falha Entrega" || ev.nome === "Falha na Entrega") && envio && (
                                                                    <a href={`/f/${envio.id}`} style={{ display:'inline-block', marginTop:8, padding:'8px 20px', background:'#ea580c', color:'#fff', borderRadius:8, fontSize:13, fontWeight:700, textDecoration:'none' }}>Pagar reenvio / frete</a>
                                                                )}
                                                                <span className="point-date-correios">
                                                                    {eventDate.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
                                <a href="mailto:contato@logisticajltransportes.com">contato@logisticajltransportes.com</a>
                                <a href="tel:08006589589">0800 658 9589</a>
                            </div>
                            <div className="f-col">
                                <h5>INFORMAÇÕES</h5>
                                <a href="#">Termos de Serviço</a>
                                <a href="#">Política de Privacidade</a>
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
}
`;
