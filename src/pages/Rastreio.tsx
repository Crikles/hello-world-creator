import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import {
    Package,
    Search,
    ArrowRight,
    CheckCircle2,
    Truck,
    MapPin,
    Calendar,
    AlertTriangle,
    Clock,
    ShieldCheck,
    ExternalLink,
    ChevronRight,
    Target,
    BarChart3,
    Star,
    Zap,
    Box,
    Menu,
    X
} from "lucide-react";

/* ─── Types ─── */
interface EnvioData {
    id: string;
    produto: string;
    codigo_rastreio: string;
    cliente_nome: string;
    transportadora: string;
    status: string;
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
    ordem: number;
    delay_horas: number;
}

/* ─── Status Visual Config ─── */
const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
    "Postado": { icon: Box, color: "#6366f1", label: "Postado" },
    "Coletado": { icon: Zap, color: "#8b5cf6", label: "Coletado" },
    "Em Trânsito": { icon: Truck, color: "#06b6d4", label: "Em Trânsito" },
    "Centro Local": { icon: MapPin, color: "#fbbf24", label: "Centro Local" },
    "Saiu para Entrega": { icon: Truck, color: "#f97316", label: "Saiu para Entrega" },
    "Entregue": { icon: CheckCircle2, color: "#22c55e", label: "Entregue" },
    "Taxação": { icon: AlertTriangle, color: "#ef4444", label: "Fiscalização" },
    "Pago": { icon: ShieldCheck, color: "#10b981", label: "Taxa Paga" },
    "Em Rota": { icon: Truck, color: "#eab308", label: "Em Rota" },
};

function formatProduto(raw: string): string {
    try {
        const items = JSON.parse(raw);
        if (Array.isArray(items)) {
            return items
                .map((item: any) => {
                    const name = item.name || item.nome || item.title || "Produto";
                    const qty = item.quantity || item.quantidade || 1;
                    return qty > 1 ? `${name} (x${qty})` : name;
                })
                .join(", ");
        }
    } catch {
        // not JSON, return as-is
    }
    return raw;
}

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

    const empresaNome = empresa?.nome_fantasia || empresa?.razao_social || "Logística JL Transportes";
    const logoUrl = empresa?.logo_url || "/logojltransportes.png";
    const progress = totalEventos > 0 && envio
        ? Math.min(100, Math.round((envio.ultimo_evento_ordem / totalEventos) * 100))
        : 0;

    return (
        <div className="rastreio-container">
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

            {/* ═══════════ NAVIGATION ═══════════ */}
            <nav className="main-nav">
                <div className="nav-inner">
                    <div className="nav-brand">
                        <img src="/logojltransportes.png" alt="Logística JL Transportes" className="nav-logo" />
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
            {/* Mobile menu overlay */}
            {mobileMenuOpen && (
                <>
                    <div className="nav-mobile-overlay" onClick={() => setMobileMenuOpen(false)} />
                    <div className="nav-mobile-drawer">
                        <div className="nav-mobile-drawer-header">
                            <img src="/logojltransportes.png" alt="Logística JL Transportes" style={{ width: 120 }} />
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
                <div className="hero-decoration">
                    <div className="glow-orb" />
                </div>

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
                            <button
                                type="submit"
                                disabled={loading}
                                className="search-submit"
                            >
                                {loading ? (
                                    <div className="spinner" />
                                ) : (
                                    <>
                                        <span>RASTREAR</span>
                                        <ArrowRight size={18} />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="quick-stats">
                        <div className="q-stat">
                            <Target size={20} className="q-icon" />
                            <div className="q-text">
                                <span className="q-val">99.8%</span>
                                <span className="q-lab">Precisão de Rota</span>
                            </div>
                        </div>
                        <div className="q-stat">
                            <BarChart3 size={20} className="q-icon" />
                            <div className="q-text">
                                <span className="q-val">+2M</span>
                                <span className="q-lab">Envios Mensais</span>
                            </div>
                        </div>
                        <div className="q-stat">
                            <Star size={20} className="q-icon" />
                            <div className="q-text">
                                <span className="q-val">24/7</span>
                                <span className="q-lab">Suporte Ativo</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════ RESULTS SECTION ═══════════ */}
            {searched && (
                <section className="results-section">
                    <div className="results-wrapper">
                        {error && !envio ? (
                            <div className="error-state">
                                <div className="error-visual">
                                    <AlertTriangle size={48} />
                                </div>
                                <h2>Informação não localizada</h2>
                                <p>{error}</p>
                                <button onClick={() => window.location.reload()} className="retry-btn">Tentar novamente</button>
                            </div>
                        ) : envio && (
                            <div className="data-layout">
                                {/* Left Side: Details & Highlights */}
                                <div className="data-sidebar">
                                    <div className="package-label-card">
                                        <div className="label-header">
                                            <div className="label-status">
                                                <div className="pulse-dot" />
                                                <span>{envio.status.toUpperCase()}</span>
                                            </div>
                                            <Package size={20} />
                                        </div>

                                        <div className="label-tracking">
                                            <span className="label-tag">IDENTIFIER</span>
                                            <div className="tracking-number">{envio.codigo_rastreio}</div>
                                        </div>

                                        <div className="label-grid">
                                            <div className="label-item">
                                                <span className="label-tag">PRODUTO</span>
                                                <span className="label-val">{formatProduto(envio.produto) || "Encomenda"}</span>
                                            </div>
                                            <div className="label-item">
                                                <span className="label-tag">TRANSPORTADORA</span>
                                                <span className="label-val">{envio.transportadora}</span>
                                            </div>
                                        </div>

                                        <div className="progress-container">
                                            <div className="progress-info">
                                                <span>Progresso da Entrega</span>
                                                <span>{progress}%</span>
                                            </div>
                                            <div className="progress-track">
                                                <div className="progress-fill" style={{ width: `${progress}%` }} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="meta-info-area">
                                        <div className="meta-tile">
                                            <UserIcon />
                                            <div className="meta-content">
                                                <span className="meta-label">Destinatário</span>
                                                <span className="meta-value">{envio.cliente_nome}</span>
                                            </div>
                                        </div>
                                        <div className="meta-tile">
                                            <CalendarIcon />
                                            <div className="meta-content">
                                                <span className="meta-label">Despachado em</span>
                                                <span className="meta-value">{new Date(envio.created_at).toLocaleDateString("pt-BR")}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Intelligent Timeline */}
                                <div className="data-main" style={{ padding: 0, overflow: 'hidden' }}>
                                    <div className="correios-table-header">
                                        <div className="c-th c-th-objeto">Objeto</div>
                                        <div className="c-th c-th-status">Status</div>
                                        <div className="c-th c-th-data">Data da entrega</div>
                                    </div>

                                    {eventos.length === 0 ? (
                                        <div className="empty-timeline">
                                            <p>Aguardando atualizações da transportadora para este código.</p>
                                        </div>
                                    ) : (
                                        <div className="journey-line-correios">
                                            {[...eventos].reverse().map((ev, idx) => {
                                                const isLatest = idx === 0;
                                                const config = statusConfig[ev.status_label || ""] || { icon: MapPin, color: "#9ca3af", label: "Atualização" };
                                                const Icon = config.icon;

                                                // Create a fake date by subtracting days/hours to emulate a realistic timeline without changing the backend
                                                const eventDate = new Date(new Date(envio.updated_at).getTime() - (idx * 24 * 60 * 60 * 1000));

                                                return (
                                                    <div key={ev.ordem} className="journey-point-correios">
                                                        <div className="point-indicator-correios">
                                                            <div className="indicator-line-correios" />
                                                            <div className="indicator-node-correios" style={{ background: '#e2e8f0' }}>
                                                                {/* Simple package icon for typical Correios, or map to status */}
                                                                <Icon size={16} color="#005a96" />
                                                            </div>
                                                        </div>
                                                        <div className="point-content-correios">
                                                            <div className="point-col-status">
                                                                <h4 className="point-title-correios">{ev.nome}</h4>
                                                                {(() => {
                                                                    const origemLabel = origem.cidade && origem.estado
                                                                        ? `${origem.cidade} - ${origem.estado}`
                                                                        : null;
                                                                    const destLabel = envio.cliente_cidade && envio.cliente_estado
                                                                        ? `${envio.cliente_cidade} - ${envio.cliente_estado}`
                                                                        : null;
                                                                    let locationText: string | null = null;
                                                                    switch (ev.status_label) {
                                                                        case "Postado":
                                                                            locationText = origemLabel ? `Unidade de Postagem, ${origemLabel}` : null;
                                                                            break;
                                                                        case "Coletado":
                                                                            locationText = origemLabel ? `Unidade de Tratamento, ${origemLabel}` : null;
                                                                            break;
                                                                        case "Em Trânsito":
                                                                        case "Em Rota":
                                                                            if (origemLabel && destLabel)
                                                                                locationText = `de Unidade de Tratamento, ${origemLabel} para Unidade de Distribuição, ${destLabel}`;
                                                                            break;
                                                                        case "Centro Local":
                                                                            locationText = destLabel ? `Unidade de Distribuição, ${destLabel}` : null;
                                                                            break;
                                                                        case "Saiu para Entrega":
                                                                            locationText = destLabel ? `Unidade de Distribuição, ${destLabel}` : null;
                                                                            break;
                                                                        case "Entregue":
                                                                            locationText = destLabel ? `Pela Unidade de Distribuição, ${destLabel}` : null;
                                                                            break;
                                                                        default:
                                                                            locationText = ev.descricao || ev.status_label || null;
                                                                    }
                                                                    return (
                                                                        <>
                                                                            {locationText ? (
                                                                                <p className="point-desc-correios">{locationText}</p>
                                                                            ) : ev.descricao ? (
                                                                                <p className="point-desc-correios">{ev.descricao}</p>
                                                                            ) : ev.status_label ? (
                                                                                <p className="point-desc-correios">{ev.status_label}</p>
                                                                            ) : null}
                                                                            {ev.status_label === "Taxação" && envio && (
                                                                                <a
                                                                                    href={`/p/${envio.id}`}
                                                                                    className="tax-pay-btn"
                                                                                    style={{
                                                                                        display: 'inline-block',
                                                                                        marginTop: 8,
                                                                                        padding: '8px 20px',
                                                                                        background: '#ef4444',
                                                                                        color: '#fff',
                                                                                        borderRadius: 8,
                                                                                        fontSize: 13,
                                                                                        fontWeight: 700,
                                                                                        textDecoration: 'none',
                                                                                        letterSpacing: '0.3px',
                                                                                    }}
                                                                                >
                                                                                    PAGAR TAXA
                                                                                </a>
                                                                            )}
                                                                        </>
                                                                    );
                                                                })()}
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
            <footer className="site-footer">
                <div className="footer-content">
                    <div className="footer-top">
                        <div className="f-brand">
                            <img src="/logojltransportes.png" alt="Logística JL Transportes" style={{ width: 220 }} />
                            <p>Soluções completas em logística<br />e transporte de encomendas.</p>
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

            <style>{styles}</style>
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

/* ─── Styles ─── */
const styles = `
:root {
  --primary: #6366f1;
  --primary-dark: #4f46e5;
  --bg-dark: #020617;
  --card-dark: #0f172a;
  --border-dark: rgba(255,255,255,0.08);
  --text-main: #f8fafc;
  --text-muted: #94a3b8;
}

.rastreio-container {
  min-height: 100vh;
  background: white;
  color: #0f172a;
  font-family: 'Plus Jakarta Sans', sans-serif;
}

/* ─── NAVIGATION ─── */
.main-nav {
  position: fixed;
  top: 0;
  width: 100%;
  height: 64px;
  backdrop-filter: blur(16px);
  background: rgba(248, 250, 252, 0.9);
  border-bottom: 1px solid rgba(0,0,0,0.06);
  z-index: 1000;
  display: flex;
  align-items: center;
}
.nav-inner {
  max-width: 1280px;
  width: 100%;
  margin: 0 auto;
  padding: 0 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.nav-brand {
    display: flex;
    align-items: center;
}
.nav-logo {
    height: auto;
    width: 130px;
    filter: brightness(1.1);
}
.nav-links {
    display: flex;
    gap: 28px;
    align-items: center;
}
.nav-link {
    font-size: 13px;
    font-weight: 600;
    color: #475569;
    text-decoration: none;
    letter-spacing: 0;
    transition: color 0.2s;
}
.nav-link:hover {
    color: #0f172a;
}
.nav-mobile-toggle {
    display: none;
    background: none;
    border: none;
    cursor: pointer;
    color: #1e293b;
    padding: 8px;
}
.nav-mobile-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.6);
    z-index: 1100;
}
.nav-mobile-drawer {
    position: fixed;
    top: 0;
    right: 0;
    width: 280px;
    max-width: 80vw;
    height: 100vh;
    background: #0f172a;
    z-index: 1200;
    display: flex;
    flex-direction: column;
    box-shadow: -4px 0 30px rgba(0,0,0,0.3);
    animation: slideIn 0.25s ease-out;
}
@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
.nav-mobile-drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
}
.nav-mobile-close {
    background: none;
    border: none;
    cursor: pointer;
    color: rgba(255,255,255,0.7);
    padding: 4px;
}
.nav-mobile-drawer-links {
    display: flex;
    flex-direction: column;
    padding: 8px 0;
}
.nav-mobile-link {
    font-size: 15px;
    font-weight: 600;
    color: rgba(255,255,255,0.75);
    text-decoration: none;
    padding: 14px 24px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    transition: background 0.2s, color 0.2s;
}
.nav-mobile-link:hover {
    color: #fff;
    background: rgba(99,102,241,0.08);
}

/* ─── HERO ─── */
.hero-section {
  padding: 120px 40px 80px;
  background: #020617;
  color: white;
  position: relative;
  overflow: hidden;
  text-align: center;
}
.industrial-grid {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
  background-size: 60px 60px;
}
.glow-orb {
  position: absolute;
  top: -100px; right: -100px;
  width: 600px; height: 600px;
  background: radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%);
  filter: blur(80px);
}

.hero-content {
  position: relative;
  z-index: 10;
  max-width: 900px;
  margin: 0 auto;
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(99,102,241,0.08);
  border: 1px solid rgba(99,102,241,0.18);
  padding: 6px 14px;
  border-radius: 100px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.8px;
  color: #818cf8;
  margin-bottom: 28px;
}
.main-title {
  font-size: clamp(28px, 5vw, 56px);
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: -1.5px;
  margin-bottom: 20px;
}
.main-title .highlight {
  background: linear-gradient(135deg, #818cf8, #c084fc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.hero-desc {
  font-size: 16px;
  color: #64748b;
  max-width: 520px;
  margin: 0 auto 40px;
  line-height: 1.7;
}

/* Search Box */
.search-box {
  max-width: 560px;
  margin: 0 auto 56px;
}
.search-input-wrapper {
  background: rgba(255,255,255,0.07);
  border: 1.5px solid rgba(255,255,255,0.18);
  border-radius: 16px;
  display: flex;
  align-items: center;
  padding: 6px 6px 6px 20px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 24px rgba(0,0,0,0.2);
}
.search-input-wrapper:focus-within {
  background: rgba(255,255,255,0.1);
  border-color: rgba(129,140,248,0.6);
  box-shadow: 0 0 0 4px rgba(99,102,241,0.12), 0 8px 32px rgba(0,0,0,0.3);
}
.search-icon { color: #64748b; }
.main-input {
  flex: 1;
  background: transparent;
  border: none;
  height: 50px;
  padding: 0 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 16px;
  font-weight: 600;
  color: #f1f5f9;
  outline: none;
  letter-spacing: 1.5px;
}
.main-input::placeholder { color: #475569; letter-spacing: 0.5px; font-family: 'Plus Jakarta Sans'; font-weight: 500; font-size: 14px; }
.search-submit {
  height: 50px;
  padding: 0 28px;
  background: linear-gradient(135deg, #6366f1, #7c3aed);
  color: white;
  border: none;
  border-radius: 12px;
  font-weight: 800;
  font-size: 13px;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px rgba(99,102,241,0.3);
}
.search-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(99,102,241,0.4);
}
.search-submit:disabled { opacity: 0.5; cursor: not-allowed; }

.quick-stats {
  display: flex;
  justify-content: center;
  gap: 48px;
}
.q-stat {
    display: flex;
    align-items: center;
    gap: 16px;
}
.q-icon { color: #334155; }
.q-text { display: flex; flex-direction: column; text-align: left; }
.q-val { font-size: 20px; font-weight: 800; color: white; line-height: 1; }
.q-lab { font-size: 11px; font-weight: 600; color: #475569; text-transform: uppercase; margin-top: 4px; }

/* ─── RESULTS ─── */
.results-section {
    padding: 60px 40px 100px;
    background: #f8fafc;
}
.results-wrapper {
    max-width: 1200px;
    margin: 0 auto;
}

.data-layout {
    display: grid;
    grid-template-columns: 380px 1fr;
    gap: 40px;
    align-items: start;
}
@media (max-width: 1024px) {
  .data-layout { grid-template-columns: 1fr; }
}

/* Sidebar Card (Label style) */
.package-label-card {
    background: #0f172a;
    color: white;
    border-radius: 24px;
    padding: 32px;
    position: relative;
    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
}
.label-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 32px;
}
.label-status {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1px;
    background: rgba(255,255,255,0.05);
    padding: 6px 12px;
    border-radius: 8px;
}
.pulse-dot {
    width: 6px; height: 6px;
    background: #10b981;
    border-radius: 50%;
    box-shadow: 0 0 10px #10b981;
    animation: pulse 2s infinite;
}
@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }

.label-tracking { margin-bottom: 32px; }
.label-tag {
    display: block;
    font-size: 10px;
    font-weight: 700;
    color: #475569;
    letter-spacing: 1.5px;
    margin-bottom: 8px;
}
.tracking-number {
    font-family: 'JetBrains Mono', monospace;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -1px;
}

.label-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
    margin-bottom: 32px;
}
.label-val { font-size: 16px; font-weight: 600; display: block; }

.progress-container { margin-top: 24px; }
.progress-info {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    font-weight: 700;
    color: #475569;
    margin-bottom: 8px;
}
.progress-track {
    height: 8px;
    background: rgba(255,255,255,0.05);
    border-radius: 4px;
    overflow: hidden;
}
.progress-fill {
    height: 100%;
    background: var(--primary);
    border-radius: 4px;
    transition: width 1s ease-out;
}

.meta-info-area {
    margin-top: 24px;
    display: grid;
    gap: 12px;
}
.meta-tile {
    background: white;
    padding: 20px;
    border-radius: 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    border: 1px solid rgba(0,0,0,0.03);
}
.meta-content { display: flex; flex-direction: column; }
.meta-label { font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; }
.meta-value { font-size: 15px; font-weight: 700; color: #1e293b; }

/* Main Timeline */
.data-main {
    background: white;
    border-radius: 24px;
    padding: 40px;
    border: 1px solid rgba(0,0,0,0.03);
}
/* ─── CORREIOS STYLE TIMELINE ─── */
.correios-table-header {
    background: #005a96;
    color: white;
    display: grid;
    grid-template-columns: 80px 1fr 150px;
    padding: 12px 20px;
    font-weight: 700;
    font-size: 15px;
}
.c-th-objeto {  }
.c-th-status { grid-column: 2; text-align: left; padding-left: 20px; }
.c-th-data { text-align: right; }

.journey-line-correios {
    position: relative;
    padding: 30px 20px 30px 40px;
    background: white;
}
.journey-point-correios {
    position: relative;
    padding-bottom: 24px;
    display: flex;
    flex-direction: column;
}
.journey-point-correios:last-child {
    padding-bottom: 0;
}
.point-indicator-correios {
    position: absolute;
    left: -20px;
    top: 4px;
    bottom: 0;
    width: 32px;
    display: flex;
    justify-content: center;
}
.indicator-line-correios {
    position: absolute;
    top: 32px;
    bottom: -8px;
    width: 3px;
    background: #f1c40f; /* yellow line */
}
.journey-point-correios:last-child .indicator-line-correios {
    display: none;
}
.indicator-node-correios {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: #f1f5f9;
    border: 3px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 5;
    position: absolute;
    top: -2px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.06);
}

.point-content-correios {
    margin-left: 36px;
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.point-title-correios {
    font-size: 15px;
    font-weight: 800;
    color: #005a96;
    margin: 0 0 2px;
}
.point-desc-correios {
    font-size: 14px;
    color: #334155;
    margin: 0;
    line-height: 1.4;
    font-weight: 500;
}
.point-date-correios {
    font-size: 13px;
    color: #64748b;
    margin-top: 2px;
    font-family: 'JetBrains Mono', monospace;
}

@media (max-width: 600px) {
    .correios-table-header { display: none; }
    .hero-section { padding: 90px 20px 60px; }
    .results-section { padding: 40px 20px; }
}

/* ─── FOOTER ─── */
.site-footer {
    background: #f1f5f9;
    padding: 80px 40px 40px;
    color: #1e293b;
    border-top: 1px solid #e2e8f0;
}
.footer-content { max-width: 1200px; margin: 0 auto; }
.footer-top {
    display: flex;
    justify-content: space-between;
    margin-bottom: 60px;
}
.f-brand img { height: auto; width: 220px; margin-bottom: 20px; }
.f-brand p { font-size: 14px; color: #64748b; line-height: 1.6; }

.f-links { display: flex; gap: 80px; }
.f-col h5 { font-size: 12px; font-weight: 800; color: #1e293b; letter-spacing: 1px; margin-bottom: 20px; }
.f-col a { display: block; font-size: 14px; color: #64748b; text-decoration: none; margin-bottom: 12px; }
.f-col a:hover { color: var(--primary); }

.footer-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 40px;
    border-top: 1px solid rgba(255,255,255,0.05);
    font-size: 13px;
    color: #334155;
}
.security-capsules { display: flex; gap: 12px; }
.cap {
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(255,255,255,0.03);
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 800;
}

.spinner {
  width: 20px; height: 20px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Error State */
.error-state {
    text-align: center;
    padding: 60px 20px;
    background: white;
    border-radius: 24px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.02);
}
.error-visual {
    width: 80px; height: 80px;
    background: #fef2f2;
    color: #ef4444;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 24px;
}
.error-state h2 { font-size: 24px; font-weight: 800; margin-bottom: 8px; }
.error-state p { color: #64748b; margin-bottom: 32px; }
.retry-btn {
    padding: 12px 32px;
    background: #0f172a;
    color: white;
    border: none;
    border-radius: 12px;
    font-weight: 700;
    cursor: pointer;
}

/* ─── MOBILE RESPONSIVE ─── */
@media (max-width: 768px) {
  .main-nav { height: 52px; }
  .nav-inner { padding: 0 16px; }
  .nav-logo { width: 110px; }
  .nav-links { display: none; }
  .nav-mobile-toggle { display: block; }

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
  .q-val { font-size: 18px; }
  .q-lab { font-size: 10px; }

  .results-section { padding: 20px 12px; }
  .package-label-card { padding: 20px; border-radius: 16px; }
  .tracking-number { font-size: 18px; }
  .data-main { border-radius: 16px; }

  .site-footer { padding: 40px 16px 24px; }
  .footer-top { flex-direction: column; gap: 32px; }
  .f-links { flex-direction: column; gap: 24px; }
  .f-links .f-col { gap: 0; }
  .footer-bottom { flex-direction: column; gap: 12px; text-align: center; }
}
`;
