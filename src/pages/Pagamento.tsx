import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

/* ─── Types ─── */
interface EnvioData {
    id: string;
    produto: string;
    codigo_rastreio: string;
    cliente_nome: string;
    transportadora: string;
    valor: number;
}

interface EmpresaData {
    nome_fantasia: string;
    razao_social: string;
    logo_url: string;
}

interface TaxSettings {
    mensagem_taxa: string;
    texto_botao: string;
    valor_exemplo: string;
    prazo_dias: string;
    url_pagamento: string;
    cor_botao: string;
    cor_header: string;
    mostrar_valor: boolean;
    mostrar_prazo: boolean;
}

const DEFAULT_TAX: TaxSettings = {
    mensagem_taxa: "Fiscalização aduaneira concluída - aguardando pagamento",
    texto_botao: "PAGUE AGORA",
    valor_exemplo: "0.00",
    prazo_dias: "5",
    url_pagamento: "",
    cor_botao: "#2563eb",
    cor_header: "#f59e0b",
    mostrar_valor: true,
    mostrar_prazo: true,
};

/* ─── Page Component ─── */
export default function Pagamento() {
    const { envioId } = useParams<{ envioId: string }>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [envio, setEnvio] = useState<EnvioData | null>(null);
    const [empresa, setEmpresa] = useState<EmpresaData | null>(null);
    const [tax, setTax] = useState<TaxSettings>(DEFAULT_TAX);

    useEffect(() => {
        if (!envioId) {
            setError("Link inválido");
            setLoading(false);
            return;
        }

        (async () => {
            try {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
                const response = await fetch(
                    `${supabaseUrl}/functions/v1/pagamento-info?envio_id=${envioId}`,
                    {
                        method: "GET",
                        headers: { "Authorization": `Bearer ${anonKey}`, "apikey": anonKey },
                    }
                );
                if (!response.ok) {
                    const errBody = await response.json().catch(() => ({}));
                    setError(errBody.error || "Envio não encontrado");
                    setLoading(false);
                    return;
                }
                const result = await response.json();
                if (result.envio) setEnvio(result.envio);
                if (result.empresa) setEmpresa(result.empresa);
                if (result.tax) setTax(result.tax);
                if (!result.envio) setError("Envio não encontrado");
            } catch {
                setError("Erro ao carregar dados");
            } finally {
                setLoading(false);
            }
        })();
    }, [envioId]);

    const empresaNome = empresa?.nome_fantasia || empresa?.razao_social || "Magnus Frete";
    const logoUrl = empresa?.logo_url || "";
    const accentColor = tax.cor_botao || "#2563eb";

    // Loading
    if (loading) {
        return (
            <div className="pag-root">
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
                <div className="pag-loading">
                    <div className="pag-spinner" />
                    <p>Carregando...</p>
                </div>
                <style>{pagStyles}</style>
            </div>
        );
    }

    // Error
    if (error || !envio) {
        return (
            <div className="pag-root">
                <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
                <PagHeader empresaNome="Pagamento" logoUrl="" />
                <div className="pag-error-wrap">
                    <div className="pag-error-card">
                        <div className="pag-error-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 8v4" />
                                <path d="M12 16h.01" />
                            </svg>
                        </div>
                        <h2>Página não encontrada</h2>
                        <p>{error || "Este link pode ter expirado ou ser inválido."}</p>
                    </div>
                </div>
                <style>{pagStyles}</style>
            </div>
        );
    }

    const valor = parseFloat(tax.valor_exemplo) || 0;
    const valorFormatted = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="pag-root">
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

            {/* Header */}
            <PagHeader empresaNome={empresaNome} logoUrl={logoUrl} />

            {/* Hero */}
            <section className="pag-hero">
                <div className="pag-hero-bg-grid" />
                <div className="pag-hero-glow pag-glow-1" />
                <div className="pag-hero-glow pag-glow-2" />

                <div className="pag-hero-content">
                    <div className="pag-hero-badge">
                        <span>⚠️</span>
                        <span>Taxa de Importação</span>
                    </div>
                    <h1 className="pag-hero-title">
                        Pagamento <span className="pag-accent">Pendente</span>
                    </h1>
                    <p className="pag-hero-subtitle">
                        Olá <strong>{envio.cliente_nome || "Cliente"}</strong>, há uma taxa pendente no seu envio
                    </p>
                </div>
            </section>

            {/* Content */}
            <section className="pag-content">
                <div className="pag-content-inner">
                    {/* Tax message */}
                    <div className="pag-msg-card">
                        <div className="pag-msg-icon">📋</div>
                        <div>
                            <h3 className="pag-msg-title">Informações sobre a taxa</h3>
                            <p className="pag-msg-text">{tax.mensagem_taxa}</p>
                        </div>
                    </div>

                    {/* Payment CTA */}
                    <div className="pag-cta-card">
                        <div className="pag-cta-strip" style={{ background: `linear-gradient(90deg, ${tax.cor_header || "#f59e0b"}, ${accentColor})` }} />

                        <div className="pag-cta-body">
                            {tax.mostrar_valor && (
                                <div className="pag-cta-valor">
                                    <span className="pag-cta-label">Valor da taxa</span>
                                    <span className="pag-cta-amount">
                                        <span className="pag-cta-currency">R$ </span>
                                        {valorFormatted}
                                    </span>
                                </div>
                            )}

                            <a
                                href={tax.url_pagamento || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="pag-cta-btn"
                                style={{
                                    background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
                                    boxShadow: `0 4px 24px ${accentColor}44`,
                                }}
                            >
                                {tax.texto_botao}
                            </a>

                            {tax.mostrar_prazo && tax.prazo_dias && (
                                <p className="pag-cta-prazo">
                                    ⏰ Prazo: <strong>{tax.prazo_dias} dias</strong> para pagamento
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Info grid */}
                    <div className="pag-info-grid">
                        <div className="pag-info-tile">
                            <span className="pag-info-label">📦 Produto</span>
                            <span className="pag-info-value">{envio.produto || "—"}</span>
                        </div>
                        <div className="pag-info-tile">
                            <span className="pag-info-label">🚛 Transportadora</span>
                            <span className="pag-info-value">{envio.transportadora || "—"}</span>
                        </div>
                    </div>

                    {/* Tracking code */}
                    {envio.codigo_rastreio && (
                        <div className="pag-tracking-card">
                            <span className="pag-tracking-label">🔍 Código de Rastreio</span>
                            <Link to={`/r/${envio.codigo_rastreio}`} className="pag-tracking-code">
                                {envio.codigo_rastreio}
                            </Link>
                            <span className="pag-tracking-hint">Clique para rastrear seu envio →</span>
                        </div>
                    )}
                </div>
            </section>

            {/* Footer */}
            <footer className="pag-footer">
                <div className="pag-footer-inner">
                    <p>© {new Date().getFullYear()} {empresaNome}. Todos os direitos reservados.</p>
                    <p className="pag-footer-sub">Rastreamento inteligente • Atualizações em tempo real</p>
                </div>
            </footer>

            <style>{pagStyles}</style>
        </div>
    );
}

/* ─── Header Component ─── */
function PagHeader({ empresaNome, logoUrl }: { empresaNome: string; logoUrl: string }) {
    return (
        <header className="pag-header">
            <div className="pag-header-inner">
                <div className="pag-brand">
                    {logoUrl ? (
                        <img src={logoUrl} alt={empresaNome} className="pag-logo" />
                    ) : (
                        <img src="/logo-magnus.png" alt="Magnus Frete" className="pag-logo" />
                    )}
                    <span className="pag-brand-name">{empresaNome}</span>
                </div>
                <nav className="pag-nav">
                    <Link to="/r" className="pag-nav-link">📦 Rastrear</Link>
                </nav>
            </div>
        </header>
    );
}

/* ─── Styles ─── */
const pagStyles = `
    .pag-root {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        background: #f8fafc;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        -webkit-font-smoothing: antialiased;
        color: #1e293b;
    }

    /* Loading */
    .pag-loading {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
    }
    .pag-spinner {
        width: 40px; height: 40px;
        border: 3px solid #e2e8f0;
        border-top-color: #3b82f6;
        border-radius: 50%;
        animation: pag-spin 0.8s linear infinite;
    }
    @keyframes pag-spin { to { transform: rotate(360deg); } }
    .pag-loading p { color: #94a3b8; font-size: 14px; margin: 0; }

    /* Error */
    .pag-error-wrap {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 40px 24px;
    }
    .pag-error-card {
        background: #fff;
        border: 1px solid #fecaca;
        border-radius: 20px;
        padding: 48px 40px;
        text-align: center;
        max-width: 420px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .pag-error-icon {
        width: 56px; height: 56px;
        border-radius: 50%;
        background: #fef2f2;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px;
    }
    .pag-error-icon svg { width: 28px; height: 28px; color: #ef4444; }
    .pag-error-card h2 { margin: 0 0 8px; font-size: 18px; font-weight: 700; color: #1e293b; }
    .pag-error-card p { margin: 0; font-size: 14px; color: #64748b; }

    /* Header */
    .pag-header {
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
    .pag-header-inner {
        max-width: 1200px;
        width: 100%;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    .pag-brand {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .pag-logo {
        height: 44px;
        width: auto;
        object-fit: contain;
    }
    .pag-brand-name {
        font-size: 20px;
        font-weight: 800;
        color: #0f172a;
        letter-spacing: -0.5px;
    }
    .pag-nav { display: flex; gap: 8px; }
    .pag-nav-link {
        padding: 8px 20px;
        font-size: 14px;
        font-weight: 600;
        color: #64748b;
        text-decoration: none;
        border-radius: 10px;
        transition: all 0.2s;
    }
    .pag-nav-link:hover { color: #0f172a; background: #f1f5f9; }

    /* Hero */
    .pag-hero {
        position: relative;
        overflow: hidden;
        padding: 60px 24px 50px;
        background: linear-gradient(135deg, #0a1628 0%, #0f2847 40%, #0c1f3d 70%, #0a1628 100%);
    }
    .pag-hero-bg-grid {
        position: absolute;
        inset: 0;
        background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
        background-size: 60px 60px;
        pointer-events: none;
    }
    .pag-hero-glow {
        position: absolute;
        border-radius: 50%;
        pointer-events: none;
        filter: blur(80px);
    }
    .pag-glow-1 {
        width: 400px; height: 400px;
        top: -150px; right: -80px;
        background: radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%);
    }
    .pag-glow-2 {
        width: 300px; height: 300px;
        bottom: -120px; left: -60px;
        background: radial-gradient(circle, rgba(37,99,235,0.1) 0%, transparent 70%);
    }
    .pag-hero-content {
        max-width: 640px;
        margin: 0 auto;
        text-align: center;
        position: relative;
        z-index: 2;
    }
    .pag-hero-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(245, 158, 11, 0.1);
        border: 1px solid rgba(245, 158, 11, 0.25);
        border-radius: 20px;
        padding: 6px 16px;
        margin-bottom: 16px;
        font-size: 12px;
        font-weight: 600;
        color: #fbbf24;
        letter-spacing: 0.5px;
        text-transform: uppercase;
    }
    .pag-hero-title {
        margin: 0 0 12px;
        font-size: clamp(24px, 4vw, 40px);
        font-weight: 800;
        color: #ffffff;
        letter-spacing: -0.5px;
    }
    .pag-accent {
        background: linear-gradient(135deg, #f59e0b, #f97316);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }
    .pag-hero-subtitle {
        margin: 0;
        font-size: 15px;
        color: rgba(148, 163, 184, 0.9);
    }
    .pag-hero-subtitle strong { color: #e2e8f0; }

    /* Content */
    .pag-content {
        padding: 40px 24px 60px;
    }
    .pag-content-inner {
        max-width: 560px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    /* Message card */
    .pag-msg-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 24px;
        display: flex;
        gap: 16px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .pag-msg-icon {
        font-size: 24px;
        flex-shrink: 0;
        margin-top: 2px;
    }
    .pag-msg-title {
        margin: 0 0 6px;
        font-size: 14px;
        font-weight: 700;
        color: #0f172a;
    }
    .pag-msg-text {
        margin: 0;
        font-size: 14px;
        color: #64748b;
        line-height: 1.7;
    }

    /* CTA card */
    .pag-cta-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 20px;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    }
    .pag-cta-strip {
        height: 4px;
    }
    .pag-cta-body {
        padding: 36px 32px;
        text-align: center;
    }
    .pag-cta-valor {
        margin-bottom: 28px;
    }
    .pag-cta-label {
        display: block;
        font-size: 11px;
        font-weight: 600;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 4px;
    }
    .pag-cta-amount {
        font-size: 44px;
        font-weight: 800;
        color: #0f172a;
        letter-spacing: -1.5px;
    }
    .pag-cta-currency {
        font-size: 22px;
        color: #94a3b8;
        font-weight: 600;
    }
    .pag-cta-btn {
        display: inline-block;
        color: #fff;
        text-decoration: none;
        padding: 16px 56px;
        border-radius: 14px;
        font-size: 16px;
        font-weight: 800;
        letter-spacing: 0.5px;
        transition: all 0.25s;
        cursor: pointer;
    }
    .pag-cta-btn:hover {
        transform: translateY(-3px);
        filter: brightness(1.1);
    }
    .pag-cta-prazo {
        margin: 16px 0 0;
        font-size: 12px;
        color: #94a3b8;
    }
    .pag-cta-prazo strong { color: #64748b; }

    /* Info grid */
    .pag-info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
    }
    .pag-info-tile {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }
    .pag-info-label {
        display: block;
        font-size: 10px;
        font-weight: 600;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 6px;
    }
    .pag-info-value {
        display: block;
        font-size: 14px;
        font-weight: 600;
        color: #1e293b;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* Tracking card */
    .pag-tracking-card {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 20px;
        text-align: center;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .pag-tracking-label {
        display: block;
        font-size: 10px;
        font-weight: 600;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 6px;
    }
    .pag-tracking-code {
        display: block;
        font-size: 22px;
        font-weight: 800;
        color: #3b82f6;
        font-family: 'Courier New', Courier, monospace;
        letter-spacing: 2px;
        text-decoration: none;
        transition: color 0.2s;
    }
    .pag-tracking-code:hover { color: #60a5fa; }
    .pag-tracking-hint {
        display: block;
        font-size: 11px;
        color: #94a3b8;
        margin-top: 4px;
    }

    /* Footer */
    .pag-footer {
        background: #0a1628;
        padding: 32px 24px;
        text-align: center;
        margin-top: auto;
    }
    .pag-footer-inner p {
        margin: 0;
        font-size: 12px;
        color: #475569;
    }
    .pag-footer-sub {
        margin-top: 6px !important;
        font-size: 11px !important;
        color: #334155 !important;
    }
`;
