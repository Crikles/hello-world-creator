import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";

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

/* ─── Status → Emoji / Color mapping ─── */
const statusIcon: Record<string, string> = {
    "Postado": "📦",
    "Coletado": "📋",
    "Em Trânsito": "🚛",
    "Centro Local": "📍",
    "Saiu para Entrega": "🏍️",
    "Entregue": "✅",
    "Taxação": "⚠️",
    "Pago": "💳",
    "Em Rota": "🚚",
};

const statusColor: Record<string, string> = {
    "Postado": "#3b82f6",
    "Coletado": "#6366f1",
    "Em Trânsito": "#f59e0b",
    "Centro Local": "#8b5cf6",
    "Saiu para Entrega": "#f97316",
    "Entregue": "#22c55e",
    "Taxação": "#ef4444",
    "Pago": "#10b981",
    "Em Rota": "#eab308",
};

const shipmentStatusLabels: Record<string, string> = {
    pendente: "Pendente",
    em_transito: "Em Trânsito",
    saiu_para_entrega: "Saiu para Entrega",
    entregue: "Entregue",
};

/* ─── Shared Layout Shell ─── */
function PageShell({
    children,
    empresaNome,
    logoUrl,
    accentColor,
}: {
    children: React.ReactNode;
    empresaNome: string;
    logoUrl: string;
    accentColor: string;
}) {
    return (
        <div style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column" as const,
            background: "#0f172a",
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            WebkitFontSmoothing: "antialiased",
        }}>
            {/* Google Fonts */}
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />

            {/* Header */}
            <header style={{
                background: "rgba(15, 23, 42, 0.95)",
                backdropFilter: "blur(20px)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                padding: "0 24px",
                height: 72,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "sticky" as const,
                top: 0,
                zIndex: 50,
            }}>
                <div style={{
                    maxWidth: 1100,
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        {/* Logo placeholder — company can upload their own */}
                        {logoUrl ? (
                            <img
                                src={logoUrl}
                                alt={empresaNome}
                                style={{
                                    height: 40,
                                    width: 40,
                                    borderRadius: 10,
                                    objectFit: "cover" as const,
                                    border: "2px solid rgba(255,255,255,0.1)",
                                }}
                            />
                        ) : (
                            <div style={{
                                height: 40,
                                width: 40,
                                borderRadius: 10,
                                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}aa)`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 18,
                                fontWeight: 800,
                                color: "#fff",
                                border: "2px solid rgba(255,255,255,0.1)",
                            }}>
                                {empresaNome.charAt(0)}
                            </div>
                        )}
                        <div>
                            <p style={{
                                margin: 0,
                                fontSize: 16,
                                fontWeight: 700,
                                color: "#f8fafc",
                                letterSpacing: -0.3,
                            }}>
                                {empresaNome}
                            </p>
                            <p style={{
                                margin: 0,
                                fontSize: 11,
                                color: "#64748b",
                                fontWeight: 500,
                                letterSpacing: 0.5,
                                textTransform: "uppercase" as const,
                            }}>
                                Rastreamento de Envios
                            </p>
                        </div>
                    </div>

                    {/* Nav */}
                    <nav style={{ display: "flex", gap: 8 }}>
                        <NavLink href="/r" label="Rastreio" icon="📦" active />
                    </nav>
                </div>
            </header>

            {/* Content */}
            <main style={{ flex: 1 }}>
                {children}
            </main>

            {/* Footer */}
            <footer style={{
                borderTop: "1px solid rgba(255,255,255,0.06)",
                padding: "40px 24px",
                textAlign: "center" as const,
            }}>
                <p style={{ margin: "0 0 8px", fontSize: 13, color: "#475569" }}>
                    © {new Date().getFullYear()} {empresaNome}. Todos os direitos reservados.
                </p>
                <p style={{ margin: 0, fontSize: 11, color: "#334155" }}>
                    Rastreamento inteligente • Atualizações em tempo real
                </p>
            </footer>
        </div>
    );
}

function NavLink({ href, label, icon, active }: { href: string; label: string; icon: string; active?: boolean }) {
    return (
        <Link
            to={href}
            style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                color: active ? "#f8fafc" : "#94a3b8",
                background: active ? "rgba(99, 102, 241, 0.15)" : "transparent",
                textDecoration: "none",
                transition: "all 0.2s",
                border: active ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid transparent",
            }}
        >
            <span style={{ fontSize: 14 }}>{icon}</span>
            {label}
        </Link>
    );
}

/* ─── Page Component ─── */
export default function Rastreio() {
    const { codigoParam } = useParams<{ codigoParam: string }>();
    const [searchParams] = useSearchParams();
    const codigoFromUrl = codigoParam || searchParams.get("codigo") || "";

    const [codigo, setCodigo] = useState(codigoFromUrl);
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
                    headers: {
                        "Authorization": `Bearer ${anonKey}`,
                        "apikey": anonKey,
                    },
                }
            );

            if (!response.ok) {
                const errBody = await response.json().catch(() => ({}));
                setError(errBody.error || "Código não encontrado");
                setEnvio(null);
                setEventos([]);
                setLoading(false);
                setSearched(true);
                return;
            }

            const result = await response.json();
            setEnvio(result.envio || null);
            setEmpresa(result.empresa || null);
            setEventos(result.eventos || []);
            setTotalEventos(result.totalEventos || 0);
            setSearched(true);

            if (!result.envio) {
                setError("Código não encontrado");
            }
        } catch {
            setError("Erro ao buscar dados do rastreio");
        } finally {
            setLoading(false);
        }
    }, []);

    // Auto-search when URL has code
    useEffect(() => {
        if (codigoFromUrl) {
            setCodigo(codigoFromUrl);
            setSearchInput(codigoFromUrl);
            fetchData(codigoFromUrl);
        }
    }, [codigoFromUrl, fetchData]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const cleaned = searchInput.trim().toUpperCase();
        if (cleaned.length < 3) return;
        setCodigo(cleaned);
        fetchData(cleaned);
        // Update URL without reload
        window.history.replaceState(null, "", `/r/${cleaned}`);
    };

    const empresaNome = empresa?.nome_fantasia || empresa?.razao_social || "Rastreamento";
    const logoUrl = empresa?.logo_url || "";
    const accentColor = "#6366f1";

    const progress = totalEventos > 0 && envio
        ? Math.round((envio.ultimo_evento_ordem / totalEventos) * 100)
        : 0;

    return (
        <PageShell empresaNome={empresaNome} logoUrl={logoUrl} accentColor={accentColor}>
            {/* Hero Section */}
            <section style={{
                position: "relative" as const,
                overflow: "hidden",
                padding: "80px 24px 60px",
                background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
            }}>
                {/* Decorative gradient orbs */}
                <div style={{
                    position: "absolute" as const,
                    top: -100, right: -100,
                    width: 400, height: 400,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
                    pointerEvents: "none" as const,
                }} />
                <div style={{
                    position: "absolute" as const,
                    bottom: -150, left: -100,
                    width: 500, height: 500,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)",
                    pointerEvents: "none" as const,
                }} />

                <div style={{
                    maxWidth: 640,
                    margin: "0 auto",
                    textAlign: "center" as const,
                    position: "relative" as const,
                    zIndex: 1,
                }}>
                    <div style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        background: "rgba(99, 102, 241, 0.1)",
                        border: "1px solid rgba(99, 102, 241, 0.2)",
                        borderRadius: 20,
                        padding: "6px 16px",
                        marginBottom: 20,
                    }}>
                        <span style={{ fontSize: 14 }}>📦</span>
                        <span style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#818cf8",
                            letterSpacing: 0.5,
                            textTransform: "uppercase" as const,
                        }}>
                            Rastreamento em Tempo Real
                        </span>
                    </div>

                    <h1 style={{
                        margin: "0 0 12px",
                        fontSize: "clamp(28px, 5vw, 42px)",
                        fontWeight: 800,
                        color: "#f8fafc",
                        letterSpacing: -1,
                        lineHeight: 1.15,
                    }}>
                        Rastreie seu{" "}
                        <span style={{
                            background: "linear-gradient(135deg, #818cf8, #c084fc)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                        }}>
                            envio
                        </span>
                    </h1>
                    <p style={{
                        margin: "0 0 32px",
                        fontSize: 16,
                        color: "#94a3b8",
                        lineHeight: 1.6,
                    }}>
                        Insira seu código de rastreio para acompanhar a entrega em tempo real
                    </p>

                    {/* Search Box */}
                    <form onSubmit={handleSearch} style={{
                        display: "flex",
                        gap: 0,
                        maxWidth: 520,
                        margin: "0 auto",
                    }}>
                        <div style={{
                            flex: 1,
                            position: "relative" as const,
                        }}>
                            <span style={{
                                position: "absolute" as const,
                                left: 18,
                                top: "50%",
                                transform: "translateY(-50%)",
                                fontSize: 18,
                                opacity: 0.5,
                            }}>🔍</span>
                            <input
                                id="tracking-input"
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                                placeholder="Ex: JL123456789BR"
                                style={{
                                    width: "100%",
                                    height: 56,
                                    padding: "0 16px 0 52px",
                                    fontSize: 16,
                                    fontWeight: 600,
                                    fontFamily: "'Courier New', Courier, monospace",
                                    letterSpacing: 1.5,
                                    border: "2px solid rgba(99, 102, 241, 0.3)",
                                    borderRight: "none",
                                    borderRadius: "16px 0 0 16px",
                                    background: "rgba(30, 41, 59, 0.8)",
                                    color: "#f8fafc",
                                    outline: "none",
                                    transition: "border-color 0.2s",
                                    boxSizing: "border-box" as const,
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.6)";
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.3)";
                                }}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading || searchInput.trim().length < 3}
                            style={{
                                height: 56,
                                padding: "0 32px",
                                fontSize: 15,
                                fontWeight: 700,
                                color: "#fff",
                                background: loading
                                    ? "#475569"
                                    : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                                border: "2px solid rgba(99, 102, 241, 0.5)",
                                borderLeft: "none",
                                borderRadius: "0 16px 16px 0",
                                cursor: loading ? "wait" : "pointer",
                                transition: "all 0.2s",
                                whiteSpace: "nowrap" as const,
                                letterSpacing: 0.3,
                            }}
                        >
                            {loading ? "Buscando..." : "Rastrear"}
                        </button>
                    </form>
                </div>
            </section>

            {/* Results Section */}
            {searched && (
                <section style={{
                    padding: "0 24px 60px",
                    marginTop: -20,
                }}>
                    <div style={{ maxWidth: 680, margin: "0 auto" }}>
                        {/* Error */}
                        {error && !envio && (
                            <div style={{
                                background: "rgba(30, 41, 59, 0.6)",
                                border: "1px solid rgba(239, 68, 68, 0.3)",
                                borderRadius: 20,
                                padding: 40,
                                textAlign: "center" as const,
                                backdropFilter: "blur(20px)",
                            }}>
                                <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
                                <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#f8fafc" }}>
                                    Código não encontrado
                                </h3>
                                <p style={{ margin: 0, fontSize: 14, color: "#94a3b8" }}>
                                    Verifique o código digitado e tente novamente
                                </p>
                            </div>
                        )}

                        {/* Results */}
                        {envio && (
                            <div style={{ display: "flex", flexDirection: "column" as const, gap: 20 }}>
                                {/* Status Overview Card */}
                                <div style={{
                                    background: "rgba(30, 41, 59, 0.6)",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                    borderRadius: 20,
                                    overflow: "hidden",
                                    backdropFilter: "blur(20px)",
                                }}>
                                    {/* Progress bar at top */}
                                    <div style={{
                                        height: 4,
                                        background: "rgba(255,255,255,0.05)",
                                    }}>
                                        <div style={{
                                            height: "100%",
                                            width: `${progress}%`,
                                            background: envio.status === "entregue"
                                                ? "linear-gradient(90deg, #22c55e, #4ade80)"
                                                : "linear-gradient(90deg, #6366f1, #8b5cf6)",
                                            borderRadius: 4,
                                            transition: "width 0.5s ease",
                                        }} />
                                    </div>

                                    <div style={{ padding: "28px 32px" }}>
                                        {/* Status badge */}
                                        <div style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            marginBottom: 20,
                                            flexWrap: "wrap" as const,
                                            gap: 12,
                                        }}>
                                            <div style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: 8,
                                                padding: "6px 16px",
                                                borderRadius: 12,
                                                background: envio.status === "entregue"
                                                    ? "rgba(34, 197, 94, 0.12)"
                                                    : "rgba(99, 102, 241, 0.12)",
                                                border: `1px solid ${envio.status === "entregue" ? "rgba(34, 197, 94, 0.3)" : "rgba(99, 102, 241, 0.3)"}`,
                                            }}>
                                                <span style={{ fontSize: 14 }}>
                                                    {envio.status === "entregue" ? "✅" : "📦"}
                                                </span>
                                                <span style={{
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    color: envio.status === "entregue" ? "#4ade80" : "#818cf8",
                                                    letterSpacing: 0.5,
                                                    textTransform: "uppercase" as const,
                                                }}>
                                                    {shipmentStatusLabels[envio.status] || envio.status}
                                                </span>
                                            </div>
                                            <span style={{
                                                fontSize: 13,
                                                color: "#64748b",
                                                fontWeight: 500,
                                            }}>
                                                {progress}% concluído
                                            </span>
                                        </div>

                                        {/* Tracking Code */}
                                        <h2 style={{
                                            margin: "0 0 4px",
                                            fontSize: 11,
                                            fontWeight: 600,
                                            color: "#64748b",
                                            letterSpacing: 1,
                                            textTransform: "uppercase" as const,
                                        }}>
                                            Código de Rastreio
                                        </h2>
                                        <p style={{
                                            margin: "0 0 24px",
                                            fontSize: 24,
                                            fontWeight: 800,
                                            color: "#818cf8",
                                            letterSpacing: 2,
                                            fontFamily: "'Courier New', Courier, monospace",
                                        }}>
                                            {envio.codigo_rastreio}
                                        </p>

                                        {/* Info grid */}
                                        <div style={{
                                            display: "grid",
                                            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                                            gap: 12,
                                        }}>
                                            <InfoCard icon="📦" label="Produto" value={envio.produto || "—"} />
                                            <InfoCard icon="🚛" label="Transportadora" value={envio.transportadora} />
                                            <InfoCard icon="👤" label="Destinatário" value={envio.cliente_nome} />
                                            <InfoCard
                                                icon="📅"
                                                label="Data Envio"
                                                value={new Date(envio.created_at).toLocaleDateString("pt-BR")}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Timeline Card */}
                                <div style={{
                                    background: "rgba(30, 41, 59, 0.6)",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                    borderRadius: 20,
                                    padding: "28px 32px",
                                    backdropFilter: "blur(20px)",
                                }}>
                                    <h3 style={{
                                        margin: "0 0 24px",
                                        fontSize: 16,
                                        fontWeight: 700,
                                        color: "#f8fafc",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                    }}>
                                        <span>📋</span> Histórico de Movimentação
                                    </h3>

                                    {eventos.length === 0 ? (
                                        <p style={{
                                            textAlign: "center" as const,
                                            color: "#64748b",
                                            fontSize: 14,
                                            padding: "20px 0",
                                        }}>
                                            Nenhuma movimentação registrada ainda
                                        </p>
                                    ) : (
                                        <div style={{ position: "relative" as const }}>
                                            {/* Vertical line */}
                                            <div style={{
                                                position: "absolute" as const,
                                                left: 19,
                                                top: 8,
                                                bottom: 8,
                                                width: 2,
                                                background: "rgba(255,255,255,0.06)",
                                                borderRadius: 1,
                                            }} />

                                            {[...eventos].reverse().map((ev, idx) => {
                                                const isLatest = idx === 0;
                                                const icon = statusIcon[ev.status_label || ""] || "📌";
                                                const color = statusColor[ev.status_label || ""] || "#64748b";

                                                return (
                                                    <div
                                                        key={ev.ordem}
                                                        style={{
                                                            display: "flex",
                                                            gap: 16,
                                                            padding: "12px 0",
                                                            position: "relative" as const,
                                                        }}
                                                    >
                                                        {/* Dot */}
                                                        <div style={{
                                                            width: 40,
                                                            height: 40,
                                                            borderRadius: 12,
                                                            background: isLatest
                                                                ? `linear-gradient(135deg, ${color}, ${color}cc)`
                                                                : "rgba(30, 41, 59, 0.8)",
                                                            border: `2px solid ${isLatest ? color : "rgba(255,255,255,0.1)"}`,
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            fontSize: 16,
                                                            flexShrink: 0,
                                                            zIndex: 1,
                                                            boxShadow: isLatest ? `0 0 20px ${color}33` : "none",
                                                        }}>
                                                            {icon}
                                                        </div>

                                                        {/* Content */}
                                                        <div style={{ flex: 1, paddingTop: 2 }}>
                                                            <div style={{
                                                                display: "flex",
                                                                alignItems: "center",
                                                                gap: 8,
                                                                marginBottom: 4,
                                                            }}>
                                                                <span style={{
                                                                    fontSize: 14,
                                                                    fontWeight: isLatest ? 700 : 600,
                                                                    color: isLatest ? "#f8fafc" : "#cbd5e1",
                                                                }}>
                                                                    {ev.nome}
                                                                </span>
                                                                {isLatest && (
                                                                    <span style={{
                                                                        fontSize: 10,
                                                                        fontWeight: 700,
                                                                        color: color,
                                                                        background: `${color}15`,
                                                                        border: `1px solid ${color}30`,
                                                                        padding: "2px 8px",
                                                                        borderRadius: 6,
                                                                        textTransform: "uppercase" as const,
                                                                        letterSpacing: 0.5,
                                                                    }}>
                                                                        Atual
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {ev.descricao && (
                                                                <p style={{
                                                                    margin: "0 0 2px",
                                                                    fontSize: 13,
                                                                    color: "#94a3b8",
                                                                    lineHeight: 1.5,
                                                                }}>
                                                                    {ev.descricao}
                                                                </p>
                                                            )}
                                                            <span style={{
                                                                fontSize: 11,
                                                                color: "#475569",
                                                                fontWeight: 500,
                                                            }}>
                                                                {ev.status_label || "Atualização"}
                                                            </span>
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

            {/* CSS Animations */}
            <style>{`
                @keyframes pulse-ring {
                    0% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(1.5); opacity: 0; }
                }
                input::placeholder {
                    color: #475569 !important;
                    font-weight: 400 !important;
                    letter-spacing: 0 !important;
                    font-family: 'Inter', -apple-system, sans-serif !important;
                }
            `}</style>
        </PageShell>
    );
}

/* ─── Sub-components ─── */

function InfoCard({ icon, label, value }: { icon: string; label: string; value: string }) {
    return (
        <div style={{
            background: "rgba(15, 23, 42, 0.5)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14,
            padding: "14px 16px",
        }}>
            <p style={{
                margin: "0 0 4px",
                fontSize: 10,
                fontWeight: 600,
                color: "#64748b",
                letterSpacing: 0.5,
                textTransform: "uppercase" as const,
            }}>
                <span style={{ marginRight: 4 }}>{icon}</span>
                {label}
            </p>
            <p style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 600,
                color: "#e2e8f0",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap" as const,
            }}>
                {value}
            </p>
        </div>
    );
}
