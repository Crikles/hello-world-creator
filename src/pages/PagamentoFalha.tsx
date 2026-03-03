import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
    ShieldCheck,
    CreditCard,
    Package,
    Truck,
    ChevronLeft,
    AlertCircle,
    Clock,
    Lock,
    ArrowRight,
    QrCode,
    FileText,
    CheckCircle2
} from "lucide-react";

/* ─── Types ─── */
interface EnvioData {
    id: string;
    produto: string;
    codigo_rastreio: string;
    cliente_nome: string;
    cliente_cpf?: string;
    cliente_endereco?: string;
    cliente_numero?: string;
    cliente_bairro?: string;
    cliente_cidade?: string;
    cliente_estado?: string;
    cliente_cep?: string;
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
    mensagem_taxa: "Houve uma falha na tentativa de entrega do seu pedido.",
    texto_botao: "PAGAR REENVIO",
    valor_exemplo: "0.00",
    prazo_dias: "5",
    url_pagamento: "",
    cor_botao: "#ea580c",
    cor_header: "#ea580c",
    mostrar_valor: true,
    mostrar_prazo: true,
};

function formatCPF(cpf: string): string {
    const digits = cpf.replace(/\D/g, '');
    if (digits.length === 11) {
        return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }
    return cpf;
}

export default function PagamentoFalha() {
    const { envioId } = useParams<{ envioId: string }>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [envio, setEnvio] = useState<EnvioData | null>(null);
    const [empresa, setEmpresa] = useState<EmpresaData | null>(null);
    const [tax, setTax] = useState<TaxSettings>(DEFAULT_TAX);

    useEffect(() => {
        if (!envioId) {
            setError("Link de pagamento inválido ou expirado");
            setLoading(false);
            return;
        }

        (async () => {
            try {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
                const response = await fetch(
                    `${supabaseUrl}/functions/v1/falha-info?envio_id=${envioId}`,
                    {
                        method: "GET",
                        headers: { "Authorization": `Bearer ${anonKey}`, "apikey": anonKey },
                    }
                );
                if (!response.ok) {
                    const errBody = await response.json().catch(() => ({}));
                    setError(errBody.error || "Informações de cobrança não localizadas");
                    setLoading(false);
                    return;
                }
                const result = await response.json();
                if (result.envio) setEnvio(result.envio);
                if (result.empresa) setEmpresa(result.empresa);
                if (result.tax) setTax(result.tax);
                if (!result.envio) setError("Certifique-se de que o link está correto");
            } catch {
                setError("Ocorreu uma falha na conexão com o sistema de pagamentos");
            } finally {
                setLoading(false);
            }
        })();
    }, [envioId]);

    const empresaNome = empresa?.nome_fantasia || empresa?.razao_social || "Logística JL Transportes";
    const logoUrl = empresa?.logo_url || "/logojltransportes.png";
    const accentColor = tax.cor_botao || "#6366f1";

    if (loading) {
        return (
            <div className="mag-pay-root">
                <style>{sharedStyles}</style>
                <div className="mag-loading-container">
                    <div className="mag-loader" style={{ borderColor: `${accentColor}20`, borderTopColor: accentColor }} />
                    <p>Autenticando portal seguro...</p>
                </div>
            </div>
        );
    }

    if (error || !envio) {
        return (
            <div className="mag-pay-root">
                <style>{sharedStyles}</style>
                <div className="mag-error-area">
                    <div className="mag-error-card">
                        <AlertCircle size={48} color="#ef4444" />
                        <h2>Falha na Requisição</h2>
                        <p>{error}</p>
                        <Link to="/r" className="mag-back-btn">Voltar ao Rastreio</Link>
                    </div>
                </div>
            </div>
        );
    }

    const valor = parseFloat(tax.valor_exemplo) || 0;
    const valorFormatted = valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="mag-pay-root">
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
            <style>{sharedStyles}</style>

            {/* Header Area */}
            <header className="mag-pay-header">
                <div className="mag-nav-container">
                    <div className="mag-header-brand">
                        <img src={logoUrl} alt={empresaNome} className="mag-logo-round" />
                        <div className="mag-brand-info">
                            <span className="mag-brand-n">{empresaNome}</span>
                            <span className="mag-secure-tag"><Lock size={10} /> PAGAMENTO SEGURO</span>
                        </div>
                    </div>
                    <Link to={`/r/${envio.codigo_rastreio}`} className="mag-cancel-link">
                        <ChevronLeft size={16} />
                        <span>Voltar ao rastreio</span>
                    </Link>
                </div>
            </header>

            <main className="mag-pay-main">
                <div className="mag-main-wrapper">

                    {/* Progress Step Indicator */}
                    <div className="mag-steps">
                        <div className="mag-step done"><CheckCircle2 size={14} /><span>Pedido</span></div>
                        <div className="mag-step active"><div className="mag-dot" /><span>Falha na Entrega</span></div>
                        <div className="mag-step disabled"><span>Liberação</span></div>
                        <div className="mag-step disabled"><span>Entrega</span></div>
                    </div>

                    <div className="mag-pay-grid">
                        {/* Left: Financial Summary */}
                        <div className="mag-summary-side">
                            <div className="mag-card mag-invoice-card">
                                <div className="mag-card-h">
                                    <FileText size={20} />
                                    <h3>Resumo da Cobrança</h3>
                                </div>

                                <div className="mag-invoice-body">
                                    <div className="mag-inv-row">
                                        <span className="mag-inv-label">Cliente</span>
                                        <span className="mag-inv-val">{envio.cliente_nome}</span>
                                    </div>
                                    {envio.cliente_cpf && (
                                        <div className="mag-inv-row">
                                            <span className="mag-inv-label">CPF</span>
                                            <span className="mag-inv-mono">{formatCPF(envio.cliente_cpf)}</span>
                                        </div>
                                    )}
                                    {(envio.cliente_endereco || envio.cliente_cidade) && (
                                        <div className="mag-inv-row mag-inv-row-address">
                                            <span className="mag-inv-label">Endereço</span>
                                            <span className="mag-inv-val mag-inv-address">
                                                {[envio.cliente_endereco, envio.cliente_numero].filter(Boolean).join(', ')}
                                                {envio.cliente_bairro && ` - ${envio.cliente_bairro}`}
                                                <br />
                                                {[envio.cliente_cidade, envio.cliente_estado].filter(Boolean).join('/')}
                                                {envio.cliente_cep && ` — CEP ${envio.cliente_cep}`}
                                            </span>
                                        </div>
                                    )}
                                    <div className="mag-inv-divider" />
                                    <div className="mag-inv-row">
                                        <span className="mag-inv-label">Produto</span>
                                        <span className="mag-inv-val">{envio.produto || "Encomenda"}</span>
                                    </div>
                                    <div className="mag-inv-row">
                                        <span className="mag-inv-label">Referência</span>
                                        <span className="mag-inv-mono">{envio.codigo_rastreio}</span>
                                    </div>
                                    <div className="mag-inv-row">
                                        <span className="mag-inv-label">Transportadora</span>
                                        <span className="mag-inv-val">{envio.transportadora}</span>
                                    </div>
                                    <div className="mag-inv-divider" />
                                    <div className="mag-inv-row mag-total">
                                        <span>Total a pagar</span>
                                        <div className="mag-total-price">
                                            <span className="mag-curr">R$</span>
                                            <span className="mag-amt">{valorFormatted}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mag-msg-box">
                                    <p>{tax.mensagem_taxa}</p>
                                </div>
                            </div>

                            <div className="mag-trust-v">
                                <ShieldCheck size={20} className="mag-trust-icon" />
                                <div>
                                    <h4>Transação Protegida</h4>
                                    <p>Este portal utiliza criptografia de 256 bits para garantir a segurança dos seus dados financeiros.</p>
                                </div>
                            </div>
                        </div>

                        {/* Right: Payment Action */}
                        <div className="mag-action-side">
                            <div className="mag-card mag-payment-card">
                                <div className="mag-pay-badge">AÇÃO REQUERIDA</div>
                                <h1>Efetuar Pagamento</h1>
                                <p className="mag-pay-desc">Selecione o método de pagamento para liberar o fluxo de entrega da sua encomenda.</p>

                                <div className="mag-payment-methods">
                                    <div className="mag-method-tile active">
                                        <QrCode size={20} />
                                        <span>PIX</span>
                                        <div className="mag-method-check"><CheckCircle2 size={14} /></div>
                                    </div>
                                </div>

                                <a
                                    href={tax.url_pagamento || "#"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mag-large-pay-btn"
                                    style={{ backgroundColor: accentColor }}
                                >
                                    <span>{tax.texto_botao}</span>
                                    <ArrowRight size={20} />
                                </a>

                                {tax.mostrar_prazo && tax.prazo_dias && (
                                    <div className="mag-deadline-info">
                                        <Clock size={14} />
                                        <span>Prazo limite para pagamento: <strong>{tax.prazo_dias} dias</strong></span>
                                    </div>
                                )}
                            </div>

                            <div className="mag-security-stripe">
                                <div className="mag-sec-item"><Lock size={12} /> SSL SECURE</div>
                                <div className="mag-sec-item"><CreditCard size={12} /> ENCRYPTED</div>
                                <div className="mag-sec-item"><ShieldCheck size={12} /> VERIFIED</div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="mag-pay-footer">
                <div className="mag-footer-inner">
                    <p>© {new Date().getFullYear()} {empresaNome}. Todos os serviços protegidos.</p>
                </div>
            </footer>
        </div>
    );
}

const sharedStyles = `
:root {
    --primary: #6366f1;
    --navy: #020617;
    --border: rgba(0,0,0,0.06);
    --text-main: #1e293b;
    --text-muted: #64748b;
}

.mag-pay-root {
    min-height: 100vh;
    background: #f8fafc;
    color: var(--text-main);
    font-family: 'Plus Jakarta Sans', sans-serif;
    display: flex;
    flex-direction: column;
}

/* Header */
.mag-pay-header {
    height: 100px;
    background: white;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 100;
}
.mag-nav-container {
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
    padding: 0 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.mag-header-brand {
    display: flex;
    align-items: center;
    gap: 12px;
}
.mag-header-brand img { height: 48px; width: 48px; border-radius: 50%; object-fit: cover; }
.mag-logo-round { height: 48px !important; width: 48px !important; border-radius: 50% !important; object-fit: cover !important; }
.mag-brand-info { display: flex; flex-direction: column; }
.mag-brand-n { font-size: 16px; font-weight: 800; color: var(--navy); }
.mag-secure-tag { 
    font-size: 9px; 
    font-weight: 800; 
    color: #10b981; 
    display: flex; 
    align-items: center; 
    gap: 4px; 
    letter-spacing: 0.5px;
}
.mag-cancel-link {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
    color: var(--text-muted);
    text-decoration: none;
    transition: color 0.2s;
}
.mag-cancel-link:hover { color: var(--navy); }

/* Main */
.mag-pay-main {
    flex: 1;
    padding: 60px 40px;
}
.mag-main-wrapper {
    max-width: 1100px;
    margin: 0 auto;
}

/* Steps */
.mag-steps {
    display: flex;
    justify-content: center;
    gap: 40px;
    margin-bottom: 48px;
}
.mag-step {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--text-muted);
}
.mag-step.done { color: #10b981; }
.mag-step.active { color: var(--primary); }
.mag-step.disabled { opacity: 0.4; }
.mag-dot { width: 6px; height: 6px; background: var(--primary); border-radius: 50%; }

/* Grid */
.mag-pay-grid {
    display: grid;
    grid-template-columns: 1fr 1.2fr;
    gap: 40px;
    align-items: start;
}
@media (max-width: 900px) {
    .mag-pay-grid { grid-template-columns: 1fr; }
}

.mag-card {
    background: white;
    border-radius: 24px;
    border: 1px solid var(--border);
    box-shadow: 0 10px 30px rgba(0,0,0,0.02);
}

/* Invoice Card */
.mag-invoice-card { padding: 32px; }
.mag-card-h { 
    display: flex; 
    align-items: center; 
    gap: 12px; 
    margin-bottom: 32px;
    padding-bottom: 20px;
    border-bottom: 1px dashed var(--border);
}
.mag-card-h h3 { font-size: 14px; font-weight: 800; letter-spacing: 0.5px; }

.mag-inv-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 16px;
}
.mag-inv-label { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
.mag-inv-val { font-size: 14px; font-weight: 700; color: var(--navy); }
.mag-inv-mono { font-family: 'JetBrains Mono', monospace; font-size: 15px; font-weight: 600; color: var(--primary); }
.mag-inv-divider { height: 1px; background: var(--border); margin: 24px 0; }
.mag-total { align-items: baseline; }
.mag-total span:first-child { font-size: 14px; font-weight: 800; text-transform: uppercase; }
.mag-total-price { display: flex; align-items: baseline; gap: 4px; color: var(--primary); }
.mag-curr { font-size: 18px; font-weight: 800; }
.mag-amt { font-size: 36px; font-weight: 800; letter-spacing: -1px; }

.mag-msg-box {
    margin-top: 32px;
    padding: 20px;
    background: #f1f5f9;
    border-radius: 16px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--text-muted);
}

.mag-trust-v {
    margin-top: 24px;
    display: flex;
    gap: 16px;
    padding: 24px;
}
.mag-trust-icon { color: #10b981; flex-shrink: 0; }
.mag-trust-v h4 { font-size: 13px; font-weight: 800; margin-bottom: 4px; }
.mag-trust-v p { font-size: 12px; color: var(--text-muted); line-height: 1.5; }

/* Payment Action Card */
.mag-payment-card {
    padding: 48px;
    text-align: center;
    background: white;
    position: relative;
    overflow: hidden;
}
.mag-pay-badge {
    display: inline-block;
    background: #fffbeb;
    color: #b45309;
    padding: 6px 14px;
    border-radius: 100px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1px;
    margin-bottom: 24px;
}
.mag-payment-card h1 { font-size: 32px; font-weight: 800; letter-spacing: -1px; margin-bottom: 12px; }
.mag-pay-desc { font-size: 15px; color: var(--text-muted); line-height: 1.6; margin-bottom: 40px; }

.mag-payment-methods { margin-bottom: 40px; }
.mag-method-tile {
    padding: 24px;
    border: 2px solid var(--primary);
    border-radius: 20px;
    background: rgba(99,102,241,0.03);
    display: flex;
    align-items: center;
    gap: 16px;
    position: relative;
}
.mag-method-tile span { font-weight: 800; font-size: 15px; color: var(--navy); }
.mag-method-check { 
    margin-left: auto; 
    width: 24px; height: 24px; 
    background: var(--primary); 
    color: white; 
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
}

.mag-large-pay-btn {
    width: 100%;
    height: 72px;
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: white;
    text-decoration: none;
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.5px;
    transition: transform 0.2s, filter 0.2s;
    box-shadow: 0 15px 30px rgba(99,102,241,0.25);
}
.mag-large-pay-btn:hover { transform: translateY(-2px); filter: brightness(1.1); }

.mag-deadline-info {
    margin-top: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-muted);
}
.mag-deadline-info strong { color: #f43f5e; }

.mag-security-stripe {
    margin-top: 24px;
    display: flex;
    justify-content: center;
    gap: 24px;
}
.mag-sec-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 9px;
    font-weight: 800;
    color: #94a3b8;
    letter-spacing: 1px;
}

/* Footer */
.mag-pay-footer {
    padding: 40px;
    text-align: center;
    border-top: 1px solid var(--border);
    margin-top: auto;
}
.mag-footer-inner p { font-size: 12px; color: #94a3b8; font-weight: 600; }

/* Loader/Error */
.mag-loading-container { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; }
.mag-loader { width: 44px; height: 44px; border: 4px solid #f1f5f9; border-radius: 50%; animation: mag-spin 1s linear infinite; }
@keyframes mag-spin { to { transform: rotate(360deg); } }
.mag-loading-container p { font-size: 14px; font-weight: 700; color: var(--text-muted); }

.mag-error-area { flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px; }
.mag-error-card { text-align: center; max-width: 400px; padding: 48px; background: white; border-radius: 24px; border: 1px solid #fecaca; }
.mag-error-card h2 { margin: 20px 0 10px; font-size: 20px; font-weight: 800; }
.mag-error-card p { color: var(--text-muted); font-size: 14px; margin-bottom: 32px; }
.mag-back-btn { display: inline-block; padding: 12px 24px; background: var(--navy); color: white; border-radius: 12px; text-decoration: none; font-weight: 700; }

.mag-inv-row-address { flex-direction: column; gap: 6px; }
.mag-inv-address { font-size: 13px; line-height: 1.5; }

@media (max-width: 640px) {
    .mag-nav-container { padding: 0 16px; flex-direction: column; gap: 8px; padding-top: 12px; padding-bottom: 12px; }
    .mag-pay-header { height: auto; padding: 8px 0; }
    .mag-pay-main { padding: 24px 16px; }
    .mag-steps { gap: 16px; flex-wrap: wrap; }
    .mag-invoice-card { padding: 20px; }
    .mag-payment-card { padding: 24px; }
    .mag-payment-card h1 { font-size: 24px; }
    .mag-amt { font-size: 28px; }
    .mag-large-pay-btn { height: 60px; font-size: 14px; }
    .mag-security-stripe { gap: 12px; flex-wrap: wrap; }
    .mag-pay-footer { padding: 24px 16px; }
}
`;
