import { useState, useEffect } from "react";
import { Download, X, Share, Plus } from "lucide-react";

/**
 * PWA Install Prompt — allows one-click install on Android/Chrome
 * and shows guided instructions on iOS Safari.
 *
 * Uses the `beforeinstallprompt` event (Chromium browsers) to trigger
 * the native install dialog. On iOS, detects Safari and shows step-by-step
 * instructions to "Add to Home Screen".
 */

interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
    interface WindowEventMap {
        beforeinstallprompt: BeforeInstallPromptEvent;
    }
}

function isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isSafari(): boolean {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as any).standalone === true
    );
}

export function InstallAppPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showBanner, setShowBanner] = useState(false);
    const [showIOSGuide, setShowIOSGuide] = useState(false);
    const [installing, setInstalling] = useState(false);

    useEffect(() => {
        // Don't show if already installed or already dismissed
        if (isStandalone()) return;
        if (localStorage.getItem("pwa_install_dismissed")) return;

        // Android/Chrome: capture the beforeinstallprompt event
        const handleBeforeInstall = (e: BeforeInstallPromptEvent) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setTimeout(() => setShowBanner(true), 5000); // show after 5s
        };

        window.addEventListener("beforeinstallprompt", handleBeforeInstall);

        // iOS Safari: show custom instructions after delay
        if (isIOS()) {
            const timer = setTimeout(() => setShowBanner(true), 5000);
            return () => {
                clearTimeout(timer);
                window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
            };
        }

        return () => {
            window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
        };
    }, []);

    const handleInstall = async () => {
        if (isIOS()) {
            setShowIOSGuide(true);
            return;
        }

        if (!deferredPrompt) return;

        setInstalling(true);
        try {
            await deferredPrompt.prompt();
            const result = await deferredPrompt.userChoice;
            if (result.outcome === "accepted") {
                localStorage.setItem("pwa_install_dismissed", "installed");
                setShowBanner(false);
            }
        } catch (err) {
            console.error("Install failed:", err);
        } finally {
            setInstalling(false);
            setDeferredPrompt(null);
        }
    };

    const handleDismiss = () => {
        setShowBanner(false);
        setShowIOSGuide(false);
        localStorage.setItem("pwa_install_dismissed", "dismissed");
    };

    if (!showBanner) return null;

    return (
        <>
            {/* iOS Guide Modal */}
            {showIOSGuide && (
                <>
                    <div className="install-overlay" onClick={() => setShowIOSGuide(false)} />
                    <div className="install-ios-guide">
                        <button className="install-close" onClick={() => setShowIOSGuide(false)} aria-label="Fechar">
                            <X size={18} />
                        </button>
                        <h4 className="install-ios-title">Instalar no iPhone/iPad</h4>
                        <div className="install-ios-steps">
                            <div className="install-ios-step">
                                <div className="install-ios-step-num">1</div>
                                <div className="install-ios-step-text">
                                    Toque no ícone <Share size={16} className="install-ios-inline-icon" /> na barra inferior do Safari
                                </div>
                            </div>
                            <div className="install-ios-step">
                                <div className="install-ios-step-num">2</div>
                                <div className="install-ios-step-text">
                                    Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong> <Plus size={14} className="install-ios-inline-icon" />
                                </div>
                            </div>
                            <div className="install-ios-step">
                                <div className="install-ios-step-num">3</div>
                                <div className="install-ios-step-text">
                                    Toque em <strong>"Adicionar"</strong> para confirmar
                                </div>
                            </div>
                        </div>
                        <p className="install-ios-note">
                            Pronto! O app aparecerá na sua tela inicial como um atalho.
                        </p>
                    </div>
                </>
            )}

            {/* Install Banner */}
            <div className="install-banner">
                <div className="install-banner-icon">
                    <Download size={22} className="install-banner-dl" />
                </div>
                <div className="install-banner-content">
                    <h4 className="install-banner-title">📲 Instalar Atalho</h4>
                    <p className="install-banner-text">
                        Adicione à sua tela inicial para acessar rapidamente.
                    </p>
                </div>
                <div className="install-banner-actions">
                    <button
                        className="install-banner-btn install-banner-btn-accept"
                        onClick={handleInstall}
                        disabled={installing}
                    >
                        {installing ? "Instalando..." : "Instalar"}
                    </button>
                    <button
                        className="install-banner-btn install-banner-btn-dismiss"
                        onClick={handleDismiss}
                    >
                        Depois
                    </button>
                </div>
                <button className="install-close install-close-banner" onClick={handleDismiss} aria-label="Fechar">
                    <X size={16} />
                </button>
            </div>

            <style>{installStyles}</style>
        </>
    );
}

const installStyles = `
.install-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 10000;
  animation: installFadeIn 0.25s ease-out;
}

.install-banner {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9997;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 16px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  max-width: 500px;
  width: calc(100% - 32px);
  box-shadow:
    0 16px 50px rgba(0,0,0,0.35),
    0 0 30px rgba(34,197,94,0.1);
  animation: installSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}

.install-banner-icon {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #22c55e, #16a34a);
  display: flex;
  align-items: center;
  justify-content: center;
}

.install-banner-dl { color: white; }

.install-banner-content {
  flex: 1;
  min-width: 0;
}

.install-banner-title {
  font-size: 14px;
  font-weight: 700;
  color: #f8fafc;
  margin: 0 0 2px;
}

.install-banner-text {
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
  line-height: 1.3;
}

.install-banner-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}

.install-banner-btn {
  border: none;
  border-radius: 8px;
  padding: 7px 16px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  white-space: nowrap;
}

.install-banner-btn-accept {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: white;
}

.install-banner-btn-accept:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(34,197,94,0.4);
}

.install-banner-btn-accept:disabled {
  opacity: 0.7;
  cursor: wait;
}

.install-banner-btn-dismiss {
  background: rgba(255,255,255,0.06);
  color: #64748b;
  font-size: 11px;
}

.install-banner-btn-dismiss:hover {
  background: rgba(255,255,255,0.1);
  color: #94a3b8;
}

.install-close {
  background: none;
  border: none;
  color: #475569;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  transition: all 0.2s;
}

.install-close:hover {
  color: #94a3b8;
  background: rgba(255,255,255,0.05);
}

.install-close-banner {
  position: absolute;
  top: 6px;
  right: 6px;
}

/* ─── iOS Guide Modal ─── */
.install-ios-guide {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10001;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid rgba(99,102,241,0.3);
  border-radius: 20px;
  padding: 24px;
  max-width: 380px;
  width: calc(100% - 32px);
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  animation: installSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}

.install-ios-title {
  font-size: 17px;
  font-weight: 800;
  color: #f8fafc;
  margin: 0 0 16px;
  text-align: center;
}

.install-ios-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.install-ios-step {
  display: flex;
  align-items: center;
  gap: 12px;
}

.install-ios-step-num {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  font-size: 13px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}

.install-ios-step-text {
  font-size: 13px;
  color: #cbd5e1;
  line-height: 1.4;
}

.install-ios-inline-icon {
  display: inline-block;
  vertical-align: middle;
  color: #6366f1;
  margin: 0 2px;
}

.install-ios-note {
  font-size: 12px;
  color: #22c55e;
  text-align: center;
  margin: 0;
  font-weight: 600;
}

@keyframes installSlideUp {
  from { opacity: 0; transform: translateX(-50%) translateY(30px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

@keyframes installFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (max-width: 480px) {
  .install-banner {
    flex-wrap: wrap;
    gap: 10px;
    padding: 14px;
  }
  .install-banner-actions {
    flex-direction: row;
    width: 100%;
  }
  .install-banner-btn {
    flex: 1;
    text-align: center;
  }
}
`;
