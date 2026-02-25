import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";

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

/* ─── Status config ─── */
const statusConfig: Record<string, { icon: string; color: string; bg: string }> = {
    "Postado": { icon: "📦", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
    "Coletado": { icon: "📋", color: "#6366f1", bg: "rgba(99,102,241,0.1)" },
    "Em Trânsito": { icon: "🚛", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
    "Centro Local": { icon: "📍", color: "#8b5cf6", bg: "rgba(139,92,246,0.1)" },
    "Saiu para Entrega": { icon: "🏍️", color: "#f97316", bg: "rgba(249,115,22,0.1)" },
    "Entregue": { icon: "✅", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
    "Taxação": { icon: "⚠️", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
    "Pago": { icon: "💳", color: "#10b981", bg: "rgba(16,185,129,0.1)" },
    "Em Rota": { icon: "🚚", color: "#eab308", bg: "rgba(234,179,8,0.1)" },
};

const shipmentLabels: Record<string, string> = {
    pendente: "Pendente",
    em_transito: "Em Trânsito",
    saiu_para_entrega: "Saiu para Entrega",
    entregue: "Entregue",
};

/* ─── Page ─── */
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
                setError(errBody.error || "Código não encontrado");
                setEnvio(null);
                setEventos([]);
            } else {
                const result = await response.json();
                setEnvio(result.envio || null);
                setEmpresa(result.empresa || null);
                setEventos(result.eventos || []);
                setTotalEventos(result.totalEventos || 0);
                if (!result.envio) setError("Código não encontrado");
            }
        } catch {
            setError("Erro ao buscar dados do rastreio");
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

    const empresaNome = empresa?.nome_fantasia || empresa?.razao_social || "Magnus Frete";
    const logoUrl = empresa?.logo_url || "";
    const progress = totalEventos > 0 && envio
        ? Math.round((envio.ultimo_evento_ordem / totalEventos) * 100)
        : 0;

    return (
        <div className="rastreio-root">
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

            {/* ═══════════ HEADER ═══════════ */}
            <header className="rastreio-header">
                <div className="rastreio-header-inner">
                    <div className="rastreio-brand">
                        {logoUrl ? (
                            <img src={logoUrl} alt={empresaNome} className="rastreio-logo" />
                        ) : (
                            <img src="/logo-magnus.png" alt="Magnus Frete" className="rastreio-logo" />
                        )}
                        <span className="rastreio-brand-name">{empresaNome}</span>
                    </div>
                    <nav className="rastreio-nav">
                        <a href="#rastrear" className="rastreio-nav-link active">Rastrear</a>
                        <a href="#contato" className="rastreio-nav-link">Contato</a>
                    </nav>
                </div>
            </header>

            {/* ═══════════ HERO ═══════════ */}
            <section className="rastreio-hero">
                {/* Background decorations */}
                <div className="hero-bg-grid" />
                <div className="hero-glow hero-glow-1" />
                <div className="hero-glow hero-glow-2" />
                <div className="hero-particles">
                    <div className="particle p1">📦</div>
                    <div className="particle p2">🚛</div>
                    <div className="particle p3">✈️</div>
                </div>

                <div className="hero-content" id="rastrear">
                    <h1 className="hero-title">
                        Rastreie sua encomenda<br />
                        <span className="hero-title-accent">em tempo real</span>
                    </h1>
                    <p className="hero-subtitle">
                        Digite o código abaixo e acompanhe sua encomenda
                    </p>

                    {/* Search */}
                    <form onSubmit={handleSearch} className="hero-search">
                        <div className="hero-search-inner">
                            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.3-4.3" />
                            </svg>
                            <input
                                id="tracking-input"
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                                placeholder="Ex: JL123456789BR"
                                className="hero-input"
                            />
                            <button
                                type="submit"
                                disabled={loading || searchInput.trim().length < 3}
                                className="hero-btn"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                                    <circle cx="11" cy="11" r="8" />
                                    <path d="m21 21-4.3-4.3" />
                                </svg>
                                {loading ? "Buscando..." : "Rastrear"}
                            </button>
                        </div>
                    </form>

                    {/* Stats */}
                    <div className="hero-stats">
                        <div className="hero-stat">
                            <div className="stat-icon">🎯</div>
                            <div className="stat-value">98%</div>
                            <div className="stat-label">Satisfação garantida</div>
                        </div>
                        <div className="hero-stat">
                            <div className="stat-icon">📈</div>
                            <div className="stat-value">+12k</div>
                            <div className="stat-label">Entregas realizadas</div>
                        </div>
                        <div className="hero-stat">
                            <div className="stat-icon">⭐</div>
                            <div className="stat-value">4.7/5</div>
                            <div className="stat-label">Avaliação média</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════ RESULTS ═══════════ */}
            {searched && (
                <section className="rastreio-results">
                    <div className="results-container">
                        {/* Error */}
                        {error && !envio && (
                            <div className="result-error">
                                <div className="error-icon-wrap">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="error-icon">
                                        <circle cx="12" cy="12" r="10" />
                                        <path d="M12 8v4" />
                                        <path d="M12 16h.01" />
                                    </svg>
                                </div>
                                <h3 className="error-title">Não encontrado</h3>
                                <p className="error-desc">Código de rastreamento inválido ou não registrado.</p>
                            </div>
                        )}

                        {/* Results */}
                        {envio && (
                            <div className="results-grid">
                                {/* Left: Info */}
                                <div className="result-card result-info">
                                    {/* Status badge + progress */}
                                    <div className="info-status-row">
                                        <div className="status-badge" data-delivered={envio.status === "entregue" ? "true" : "false"}>
                                            <span>{envio.status === "entregue" ? "✅" : "📦"}</span>
                                            {shipmentLabels[envio.status] || envio.status}
                                        </div>
                                        <span className="progress-text">{progress}%</span>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="progress-bar-track">
                                        <div
                                            className="progress-bar-fill"
                                            data-delivered={envio.status === "entregue" ? "true" : "false"}
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>

                                    {/* Tracking code */}
                                    <div className="tracking-code-section">
                                        <label className="field-label">Código de rastreio</label>
                                        <div className="tracking-code">{envio.codigo_rastreio}</div>
                                    </div>

                                    {/* Info grid */}
                                    <div className="info-grid">
                                        <InfoTile icon="📦" label="Produto" value={envio.produto || "—"} />
                                        <InfoTile icon="🚛" label="Transportadora" value={envio.transportadora} />
                                        <InfoTile icon="👤" label="Destinatário" value={envio.cliente_nome} />
                                        <InfoTile icon="📅" label="Data Envio" value={new Date(envio.created_at).toLocaleDateString("pt-BR")} />
                                    </div>
                                </div>

                                {/* Right: Timeline */}
                                <div className="result-card result-timeline">
                                    <h3 className="timeline-title">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
                                            <path d="M12 8v4l3 3" />
                                            <circle cx="12" cy="12" r="10" />
                                        </svg>
                                        Histórico de movimentação
                                    </h3>

                                    {eventos.length === 0 ? (
                                        <p className="timeline-empty">Nenhuma movimentação registrada ainda.</p>
                                    ) : (
                                        <div className="timeline">
                                            {[...eventos].reverse().map((ev, idx) => {
                                                const isLatest = idx === 0;
                                                const cfg = statusConfig[ev.status_label || ""] || { icon: "📌", color: "#64748b", bg: "rgba(100,116,139,0.1)" };

                                                return (
                                                    <div key={ev.ordem} className={`timeline-item ${isLatest ? "latest" : ""}`}>
                                                        <div className="timeline-line" />
                                                        <div
                                                            className="timeline-dot"
                                                            style={{
                                                                background: isLatest ? cfg.color : "transparent",
                                                                borderColor: isLatest ? cfg.color : "rgba(100,116,139,0.3)",
                                                                boxShadow: isLatest ? `0 0 16px ${cfg.color}40` : "none",
                                                            }}
                                                        >
                                                            <span className="timeline-dot-icon">{cfg.icon}</span>
                                                        </div>
                                                        <div className="timeline-content">
                                                            <div className="timeline-header">
                                                                <span className="timeline-name">{ev.nome}</span>
                                                                {isLatest && (
                                                                    <span className="timeline-badge" style={{ color: cfg.color, borderColor: `${cfg.color}40`, background: cfg.bg }}>
                                                                        Atual
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {ev.descricao && <p className="timeline-desc">{ev.descricao}</p>}
                                                            <span className="timeline-label">{ev.status_label || "Atualização"}</span>
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
            <footer className="rastreio-footer" id="contato">
                <div className="footer-inner">
                    <div className="footer-grid">
                        <div className="footer-col footer-about">
                            <div className="footer-brand">
                                {logoUrl ? (
                                    <img src={logoUrl} alt={empresaNome} className="footer-logo" />
                                ) : (
                                    <img src="/logo-magnus.png" alt="Magnus Frete" className="footer-logo" />
                                )}
                                <span className="footer-brand-name">{empresaNome}</span>
                            </div>
                            <p className="footer-desc">
                                Transportadora líder em operações logísticas. Reconhecida de todos os Portos por segurança e eficiência.
                            </p>
                        </div>
                        <div className="footer-col">
                            <h4 className="footer-heading">Links Rápidos</h4>
                            <a href="#rastrear" className="footer-link">Rastrear Encomenda</a>
                            <a href="#contato" className="footer-link">Sobre a Empresa</a>
                        </div>
                        <div className="footer-col">
                            <h4 className="footer-heading">Contato</h4>
                            <p className="footer-contact">📧 suporte@magnusfrete.com</p>
                            <p className="footer-contact">📞 (11) 9999-9999</p>
                        </div>
                        <div className="footer-col">
                            <h4 className="footer-heading">Certificações</h4>
                            <div className="footer-badges">
                                <span className="footer-cert">🔒 SSL/HTTPS</span>
                                <span className="footer-cert">✅ Confiável</span>
                            </div>
                        </div>
                    </div>
                    <div className="footer-bottom">
                        <p>© {new Date().getFullYear()} {empresaNome}. Todos os direitos reservados.</p>
                    </div>
                </div>
            </footer>

            {/* ═══════════ STYLES ═══════════ */}
            <style>{`
                /* ─── Reset & Base ─── */
                .rastreio-root {
                    min-height: 100vh;
                    display: flex;
                    flex-direction: column;
                    background: #f8fafc;
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    -webkit-font-smoothing: antialiased;
                    color: #1e293b;
                }

                /* ─── HEADER ─── */
                .rastreio-header {
                    background: #fff;
                    border-bottom: 1px solid #e2e8f0;
                    position: sticky;
                    top: 0;
                    z-index: 100;
                    height: 72px;
                    display: flex;
                    align-items: center;
                    padding: 0 24px;
                }
                .rastreio-header-inner {
                    max-width: 1200px;
                    width: 100%;
                    margin: 0 auto;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .rastreio-brand {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .rastreio-logo {
                    height: 44px;
                    width: auto;
                    object-fit: contain;
                }
                .rastreio-brand-name {
                    font-size: 20px;
                    font-weight: 800;
                    color: #0f172a;
                    letter-spacing: -0.5px;
                }
                .rastreio-nav {
                    display: flex;
                    gap: 8px;
                }
                .rastreio-nav-link {
                    padding: 8px 20px;
                    font-size: 14px;
                    font-weight: 600;
                    color: #64748b;
                    text-decoration: none;
                    border-radius: 10px;
                    transition: all 0.2s;
                }
                .rastreio-nav-link:hover {
                    color: #0f172a;
                    background: #f1f5f9;
                }
                .rastreio-nav-link.active {
                    color: #0f172a;
                    background: #f1f5f9;
                }

                /* ─── HERO ─── */
                .rastreio-hero {
                    position: relative;
                    overflow: hidden;
                    padding: 80px 24px 70px;
                    background: linear-gradient(135deg, #0a1628 0%, #0f2847 40%, #0c1f3d 70%, #0a1628 100%);
                }
                .hero-bg-grid {
                    position: absolute;
                    inset: 0;
                    background-image:
                        linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
                    background-size: 60px 60px;
                    pointer-events: none;
                }
                .hero-glow {
                    position: absolute;
                    border-radius: 50%;
                    pointer-events: none;
                    filter: blur(80px);
                }
                .hero-glow-1 {
                    width: 500px; height: 500px;
                    top: -200px; right: -100px;
                    background: radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%);
                }
                .hero-glow-2 {
                    width: 400px; height: 400px;
                    bottom: -200px; left: -100px;
                    background: radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%);
                }
                .hero-particles {
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                    overflow: hidden;
                }
                .particle {
                    position: absolute;
                    font-size: 20px;
                    opacity: 0.15;
                    animation: float 12s ease-in-out infinite;
                }
                .p1 { top: 15%; left: 10%; animation-delay: 0s; }
                .p2 { top: 60%; right: 8%; animation-delay: -4s; }
                .p3 { bottom: 20%; left: 25%; animation-delay: -8s; }
                @keyframes float {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    33% { transform: translateY(-15px) rotate(5deg); }
                    66% { transform: translateY(8px) rotate(-3deg); }
                }

                .hero-content {
                    max-width: 680px;
                    margin: 0 auto;
                    text-align: center;
                    position: relative;
                    z-index: 2;
                }
                .hero-title {
                    margin: 0 0 16px;
                    font-size: clamp(30px, 5vw, 48px);
                    font-weight: 800;
                    color: #ffffff;
                    line-height: 1.15;
                    letter-spacing: -1px;
                }
                .hero-title-accent {
                    background: linear-gradient(135deg, #38bdf8, #06b6d4);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .hero-subtitle {
                    margin: 0 0 36px;
                    font-size: 16px;
                    color: rgba(148, 163, 184, 0.9);
                    line-height: 1.6;
                }

                /* Search */
                .hero-search {
                    max-width: 560px;
                    margin: 0 auto 40px;
                }
                .hero-search-inner {
                    display: flex;
                    align-items: center;
                    background: rgba(255,255,255,0.07);
                    border: 2px solid rgba(255,255,255,0.1);
                    border-radius: 16px;
                    overflow: hidden;
                    transition: border-color 0.3s, box-shadow 0.3s;
                    position: relative;
                }
                .hero-search-inner:focus-within {
                    border-color: rgba(56,189,248,0.5);
                    box-shadow: 0 0 30px rgba(56,189,248,0.12);
                }
                .search-icon {
                    width: 20px; height: 20px;
                    margin-left: 20px;
                    color: rgba(148,163,184,0.6);
                    flex-shrink: 0;
                }
                .hero-input {
                    flex: 1;
                    height: 56px;
                    padding: 0 16px;
                    background: transparent;
                    border: none;
                    outline: none;
                    font-size: 16px;
                    font-weight: 600;
                    font-family: 'Courier New', Courier, monospace;
                    letter-spacing: 1.5px;
                    color: #f1f5f9;
                }
                .hero-input::placeholder {
                    color: rgba(100,116,139,0.6);
                    font-weight: 400;
                    letter-spacing: 0;
                    font-family: 'Inter', sans-serif;
                }
                .hero-btn {
                    height: 44px;
                    padding: 0 28px;
                    margin-right: 6px;
                    font-size: 14px;
                    font-weight: 700;
                    font-family: 'Inter', sans-serif;
                    color: #fff;
                    background: linear-gradient(135deg, #0ea5e9, #0284c7);
                    border: none;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s;
                    white-space: nowrap;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-shrink: 0;
                }
                .hero-btn:hover:not(:disabled) {
                    background: linear-gradient(135deg, #38bdf8, #0ea5e9);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 20px rgba(14,165,233,0.3);
                }
                .hero-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                /* Stats */
                .hero-stats {
                    display: flex;
                    justify-content: center;
                    gap: 24px;
                    flex-wrap: wrap;
                }
                .hero-stat {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 16px;
                    padding: 18px 28px;
                    min-width: 140px;
                    text-align: center;
                    backdrop-filter: blur(8px);
                    transition: transform 0.2s, border-color 0.2s;
                }
                .hero-stat:hover {
                    transform: translateY(-2px);
                    border-color: rgba(56,189,248,0.2);
                }
                .stat-icon {
                    font-size: 18px;
                    margin-bottom: 6px;
                }
                .stat-value {
                    font-size: 24px;
                    font-weight: 800;
                    color: #f1f5f9;
                    letter-spacing: -0.5px;
                }
                .stat-label {
                    font-size: 11px;
                    color: rgba(148,163,184,0.7);
                    font-weight: 500;
                    margin-top: 2px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                /* ─── RESULTS ─── */
                .rastreio-results {
                    padding: 40px 24px 60px;
                    background: #f8fafc;
                }
                .results-container {
                    max-width: 1100px;
                    margin: 0 auto;
                }

                /* Error */
                .result-error {
                    max-width: 480px;
                    margin: 0 auto;
                    background: #fff;
                    border: 1px solid #fecaca;
                    border-radius: 20px;
                    padding: 48px 32px;
                    text-align: center;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
                }
                .error-icon-wrap {
                    margin: 0 auto 16px;
                    width: 56px; height: 56px;
                    border-radius: 50%;
                    background: #fef2f2;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .error-icon { width: 28px; height: 28px; color: #ef4444; }
                .error-title { margin: 0 0 8px; font-size: 18px; font-weight: 700; color: #1e293b; }
                .error-desc { margin: 0; font-size: 14px; color: #64748b; }

                /* Results grid */
                .results-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 24px;
                }
                @media (max-width: 800px) {
                    .results-grid { grid-template-columns: 1fr; }
                }

                .result-card {
                    background: #fff;
                    border: 1px solid #e2e8f0;
                    border-radius: 20px;
                    padding: 32px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
                }

                /* Info card */
                .info-status-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }
                .status-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 16px;
                    border-radius: 10px;
                    font-size: 12px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    background: rgba(59,130,246,0.08);
                    color: #3b82f6;
                    border: 1px solid rgba(59,130,246,0.15);
                }
                .status-badge[data-delivered="true"] {
                    background: rgba(34,197,94,0.08);
                    color: #16a34a;
                    border-color: rgba(34,197,94,0.15);
                }
                .progress-text {
                    font-size: 14px;
                    font-weight: 700;
                    color: #64748b;
                }
                .progress-bar-track {
                    height: 6px;
                    background: #f1f5f9;
                    border-radius: 3px;
                    margin-bottom: 28px;
                    overflow: hidden;
                }
                .progress-bar-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #3b82f6, #0ea5e9);
                    border-radius: 3px;
                    transition: width 0.6s ease;
                }
                .progress-bar-fill[data-delivered="true"] {
                    background: linear-gradient(90deg, #22c55e, #4ade80);
                }

                .tracking-code-section {
                    margin-bottom: 24px;
                }
                .field-label {
                    display: block;
                    font-size: 10px;
                    font-weight: 600;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    margin-bottom: 4px;
                }
                .tracking-code {
                    font-size: 22px;
                    font-weight: 800;
                    color: #0f172a;
                    font-family: 'Courier New', Courier, monospace;
                    letter-spacing: 2px;
                }

                .info-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                }
                .info-tile {
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 14px 16px;
                }
                .info-tile-label {
                    margin: 0 0 4px;
                    font-size: 10px;
                    font-weight: 600;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .info-tile-value {
                    margin: 0;
                    font-size: 13px;
                    font-weight: 600;
                    color: #1e293b;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                /* Timeline */
                .result-timeline {
                    max-height: 500px;
                    overflow-y: auto;
                }
                .timeline-title {
                    margin: 0 0 24px;
                    font-size: 16px;
                    font-weight: 700;
                    color: #0f172a;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .timeline-empty {
                    text-align: center;
                    color: #94a3b8;
                    font-size: 14px;
                    padding: 32px 0;
                }

                .timeline {
                    position: relative;
                }
                .timeline-item {
                    display: flex;
                    gap: 16px;
                    padding: 14px 0;
                    position: relative;
                }
                .timeline-line {
                    position: absolute;
                    left: 19px;
                    top: 50px;
                    bottom: -14px;
                    width: 2px;
                    background: #e2e8f0;
                }
                .timeline-item:last-child .timeline-line { display: none; }

                .timeline-dot {
                    width: 40px; height: 40px;
                    border-radius: 12px;
                    border: 2px solid;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    z-index: 1;
                    background: #fff;
                    transition: all 0.2s;
                }
                .timeline-dot-icon { font-size: 16px; }

                .timeline-content { flex: 1; padding-top: 4px; }
                .timeline-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 4px;
                    flex-wrap: wrap;
                }
                .timeline-name {
                    font-size: 14px;
                    font-weight: 600;
                    color: #334155;
                }
                .timeline-item.latest .timeline-name {
                    color: #0f172a;
                    font-weight: 700;
                }
                .timeline-badge {
                    font-size: 10px;
                    font-weight: 700;
                    padding: 2px 10px;
                    border-radius: 6px;
                    border: 1px solid;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .timeline-desc {
                    margin: 0 0 4px;
                    font-size: 13px;
                    color: #64748b;
                    line-height: 1.5;
                }
                .timeline-label {
                    font-size: 11px;
                    color: #94a3b8;
                    font-weight: 500;
                }

                /* ─── FOOTER ─── */
                .rastreio-footer {
                    background: #0a1628;
                    color: #94a3b8;
                    padding: 60px 24px 0;
                    margin-top: auto;
                }
                .footer-inner {
                    max-width: 1100px;
                    margin: 0 auto;
                }
                .footer-grid {
                    display: grid;
                    grid-template-columns: 1.5fr 1fr 1fr 1fr;
                    gap: 40px;
                    padding-bottom: 40px;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                }
                @media (max-width: 800px) {
                    .footer-grid { grid-template-columns: 1fr 1fr; }
                }
                @media (max-width: 500px) {
                    .footer-grid { grid-template-columns: 1fr; }
                }
                .footer-brand {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 14px;
                }
                .footer-logo {
                    height: 36px;
                    width: auto;
                    object-fit: contain;
                    filter: brightness(1.2);
                }
                .footer-brand-name {
                    font-size: 18px;
                    font-weight: 800;
                    color: #f1f5f9;
                    letter-spacing: -0.3px;
                }
                .footer-desc {
                    font-size: 13px;
                    line-height: 1.7;
                    color: #64748b;
                    margin: 0;
                }
                .footer-heading {
                    font-size: 13px;
                    font-weight: 700;
                    color: #e2e8f0;
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                    margin: 0 0 16px;
                }
                .footer-link {
                    display: block;
                    font-size: 13px;
                    color: #64748b;
                    text-decoration: none;
                    margin-bottom: 10px;
                    transition: color 0.2s;
                }
                .footer-link:hover { color: #38bdf8; }
                .footer-contact {
                    font-size: 13px;
                    color: #64748b;
                    margin: 0 0 8px;
                }
                .footer-badges {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                }
                .footer-cert {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 11px;
                    font-weight: 600;
                    color: #94a3b8;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 8px;
                    padding: 6px 14px;
                }
                .footer-bottom {
                    padding: 24px 0;
                    text-align: center;
                }
                .footer-bottom p {
                    margin: 0;
                    font-size: 12px;
                    color: #475569;
                }
            `}</style>
        </div>
    );
}

/* ─── Sub-components ─── */
function InfoTile({ icon, label, value }: { icon: string; label: string; value: string }) {
    return (
        <div className="info-tile">
            <p className="info-tile-label">
                <span style={{ marginRight: 4 }}>{icon}</span>
                {label}
            </p>
            <p className="info-tile-value">{value}</p>
        </div>
    );
}
