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
                        headers: {
                            "Authorization": `Bearer ${anonKey}`,
                            "apikey": anonKey,
                        },
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

    const empresaNome = empresa?.nome_fantasia || empresa?.razao_social || "Loja";
    const logoUrl = empresa?.logo_url || "";
    const accentColor = tax.cor_botao || "#2563eb";
    const headerColor = tax.cor_header || "#f59e0b";

    // ─── Loading State ───
    if (loading) {
        return (
            <PageShell empresaNome="Carregando..." logoUrl="" accentColor="#6366f1">
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "80px 24px",
                }}>
                    <div style={{ textAlign: "center" }}>
                        <div style={{
                            width: 40, height: 40,
                            border: "3px solid rgba(255,255,255,0.1)",
                            borderTopColor: "#6366f1",
                            borderRadius: "50%",
                            animation: "spin 0.8s linear infinite",
                            margin: "0 auto 16px",
                        }} />
                        <p style={{ color: "#94a3b8", fontSize: 14 }}>Carregando...</p>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                </div>
            </PageShell>
        );
    }

    // ─── Error State ───
    if (error || !envio) {
        return (
            <PageShell empresaNome="Pagamento" logoUrl="" accentColor="#6366f1">
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "80px 24px",
                }}>
                    <div style={{
                        textAlign: "center" as const,
                        background: "rgba(30, 41, 59, 0.6)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        padding: 48,
                        borderRadius: 24,
                        maxWidth: 420,
                        backdropFilter: "blur(20px)",
                    }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
                        <h2 style={{ color: "#f8fafc", fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>
                            Página não encontrada
                        </h2>
                        <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>
                            {error || "Este link pode ter expirado ou ser inválido."}
                        </p>
                    </div>
                </div>
            </PageShell>
        );
    }

    // ─── Values ───
    const valor = parseFloat(tax.valor_exemplo) || 0;
    const valorFormatted = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <PageShell empresaNome={empresaNome} logoUrl={logoUrl} accentColor={accentColor}>
            {/* Hero gradient */}
            <section style={{
                position: "relative" as const,
                overflow: "hidden",
                padding: "60px 24px 40px",
                background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
            }}>
                {/* Decorative orb */}
                <div style={{
                    position: "absolute" as const,
                    top: -80, right: -60,
                    width: 300, height: 300,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${headerColor}15 0%, transparent 70%)`,
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
                        background: "rgba(245, 158, 11, 0.1)",
                        border: "1px solid rgba(245, 158, 11, 0.25)",
                        borderRadius: 20,
                        padding: "6px 16px",
                        marginBottom: 16,
                    }}>
                        <span style={{ fontSize: 14 }}>⚠️</span>
                        <span style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#fbbf24",
                            letterSpacing: 0.5,
                            textTransform: "uppercase" as const,
                        }}>
                            Taxa de Importação
                        </span>
                    </div>

                    <h1 style={{
                        margin: "0 0 8px",
                        fontSize: "clamp(24px, 4vw, 36px)",
                        fontWeight: 800,
                        color: "#f8fafc",
                        letterSpacing: -0.5,
                    }}>
                        Pagamento Pendente
                    </h1>
                    <p style={{
                        margin: 0,
                        fontSize: 15,
                        color: "#94a3b8",
                    }}>
                        Olá <strong style={{ color: "#e2e8f0" }}>{envio.cliente_nome || "Cliente"}</strong>, há uma taxa pendente no seu envio
                    </p>
                </div>
            </section>

            {/* Content */}
            <section style={{
                padding: "0 24px 60px",
                marginTop: -10,
            }}>
                <div style={{
                    maxWidth: 520,
                    margin: "0 auto",
                    display: "flex",
                    flexDirection: "column" as const,
                    gap: 20,
                }}>
                    {/* Tax Message Card */}
                    <div style={{
                        background: "rgba(30, 41, 59, 0.6)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 20,
                        padding: "28px 32px",
                        backdropFilter: "blur(20px)",
                    }}>
                        <p style={{
                            margin: 0,
                            fontSize: 15,
                            color: "#cbd5e1",
                            lineHeight: 1.7,
                        }}>
                            {tax.mensagem_taxa}
                        </p>
                    </div>

                    {/* Payment CTA Card */}
                    <div style={{
                        background: "rgba(30, 41, 59, 0.6)",
                        border: `2px solid ${accentColor}33`,
                        borderRadius: 20,
                        overflow: "hidden",
                        backdropFilter: "blur(20px)",
                    }}>
                        {/* Header strip */}
                        <div style={{
                            height: 4,
                            background: `linear-gradient(90deg, ${headerColor}, ${accentColor})`,
                        }} />

                        <div style={{
                            padding: "32px 32px",
                            textAlign: "center" as const,
                        }}>
                            {tax.mostrar_valor && (
                                <>
                                    <p style={{
                                        margin: "0 0 2px",
                                        fontSize: 11,
                                        color: "#64748b",
                                        fontWeight: 600,
                                        textTransform: "uppercase" as const,
                                        letterSpacing: 1,
                                    }}>
                                        Valor da taxa
                                    </p>
                                    <p style={{
                                        margin: "0 0 28px",
                                        fontSize: 42,
                                        fontWeight: 800,
                                        color: "#f8fafc",
                                        letterSpacing: -1.5,
                                    }}>
                                        <span style={{ fontSize: 22, color: "#94a3b8", fontWeight: 600 }}>R$ </span>
                                        {valorFormatted}
                                    </p>
                                </>
                            )}

                            <a
                                href={tax.url_pagamento || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: "inline-block",
                                    background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
                                    color: "#fff",
                                    textDecoration: "none",
                                    padding: "16px 56px",
                                    borderRadius: 14,
                                    fontSize: 16,
                                    fontWeight: 800,
                                    letterSpacing: 0.5,
                                    boxShadow: `0 4px 24px ${accentColor}44`,
                                    transition: "all 0.25s",
                                    cursor: "pointer",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = "translateY(-3px)";
                                    e.currentTarget.style.boxShadow = `0 8px 32px ${accentColor}55`;
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = "translateY(0)";
                                    e.currentTarget.style.boxShadow = `0 4px 24px ${accentColor}44`;
                                }}
                            >
                                {tax.texto_botao}
                            </a>

                            {tax.mostrar_prazo && tax.prazo_dias && (
                                <p style={{
                                    margin: "16px 0 0",
                                    fontSize: 12,
                                    color: "#64748b",
                                }}>
                                    ⏰ Prazo: <strong style={{ color: "#94a3b8" }}>{tax.prazo_dias} dias</strong> para pagamento
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Order Info */}
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 12,
                    }}>
                        <InfoCard icon="📦" label="Produto" value={envio.produto || "—"} />
                        <InfoCard icon="🚛" label="Transportadora" value={envio.transportadora || "JL Transportes"} />
                    </div>

                    {/* Tracking Code */}
                    {envio.codigo_rastreio && (
                        <div style={{
                            background: "rgba(30, 41, 59, 0.6)",
                            border: "1px solid rgba(255,255,255,0.06)",
                            borderRadius: 16,
                            padding: "16px 20px",
                            textAlign: "center" as const,
                            backdropFilter: "blur(20px)",
                        }}>
                            <p style={{
                                margin: "0 0 4px",
                                fontSize: 10,
                                fontWeight: 600,
                                color: "#64748b",
                                letterSpacing: 1,
                                textTransform: "uppercase" as const,
                            }}>
                                🔍 Código de Rastreio
                            </p>
                            <Link
                                to={`/r/${envio.codigo_rastreio}`}
                                style={{
                                    fontSize: 20,
                                    fontWeight: 800,
                                    color: "#818cf8",
                                    letterSpacing: 2,
                                    fontFamily: "'Courier New', Courier, monospace",
                                    textDecoration: "none",
                                    transition: "color 0.2s",
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = "#a5b4fc"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = "#818cf8"; }}
                            >
                                {envio.codigo_rastreio}
                            </Link>
                            <p style={{
                                margin: "4px 0 0",
                                fontSize: 11,
                                color: "#475569",
                            }}>
                                Clique para rastrear seu envio
                            </p>
                        </div>
                    )}
                </div>
            </section>
        </PageShell>
    );
}

/* ─── Shared Layout Shell (same as Rastreio) ─── */
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
                        {logoUrl ? (
                            <img
                                src={logoUrl}
                                alt={empresaNome}
                                style={{
                                    height: 40, width: 40,
                                    borderRadius: 10,
                                    objectFit: "cover" as const,
                                    border: "2px solid rgba(255,255,255,0.1)",
                                }}
                            />
                        ) : (
                            <div style={{
                                height: 40, width: 40,
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
                            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f8fafc", letterSpacing: -0.3 }}>
                                {empresaNome}
                            </p>
                            <p style={{ margin: 0, fontSize: 11, color: "#64748b", fontWeight: 500, letterSpacing: 0.5, textTransform: "uppercase" as const }}>
                                Pagamento de Taxa
                            </p>
                        </div>
                    </div>

                    <nav style={{ display: "flex", gap: 8 }}>
                        <NavLink href="/r" label="Rastreio" icon="📦" />
                    </nav>
                </div>
            </header>

            <main style={{ flex: 1 }}>{children}</main>

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

function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
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
                color: "#94a3b8",
                background: "transparent",
                textDecoration: "none",
                transition: "all 0.2s",
                border: "1px solid transparent",
            }}
        >
            <span style={{ fontSize: 14 }}>{icon}</span>
            {label}
        </Link>
    );
}

function InfoCard({ icon, label, value }: { icon: string; label: string; value: string }) {
    return (
        <div style={{
            background: "rgba(30, 41, 59, 0.6)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14,
            padding: "14px 16px",
            backdropFilter: "blur(20px)",
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
