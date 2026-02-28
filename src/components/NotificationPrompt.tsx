import { useState, useEffect } from "react";
import { Bell, Download, X, Share, Plus } from "lucide-react";

/**
 * Unified Notification / Install Prompt
 * - Android/Chrome/Desktop: asks for push notification permission directly
 * - iOS Safari: guides user to install PWA first (required for push on iOS)
 * - Already installed or already dismissed: hidden
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

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as any).standalone === true;

const STORAGE_KEY = "notification_prompt_state";

interface NotificationPromptProps {
  codigoRastreio?: string;
}

export function NotificationPrompt({ codigoRastreio }: NotificationPromptProps) {
  const [visible, setVisible] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [working, setWorking] = useState(false);
  const [mode, setMode] = useState<"push" | "install">("push");

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    if (isStandalone() && "Notification" in window && Notification.permission === "granted") return;

    if (isIOS() && !isStandalone()) {
      // iOS not installed: show install prompt
      setMode("install");
      const t = setTimeout(() => setVisible(true), 4000);
      return () => clearTimeout(t);
    }

    // Android/Desktop: check push capability
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission === "granted" || Notification.permission === "denied") {
      // Already decided, don't show
      return;
    }

    setMode("push");
    const t = setTimeout(() => setVisible(true), 4000);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    setVisible(false);
    setShowIOSGuide(false);
    localStorage.setItem(STORAGE_KEY, "dismissed");
  };

  const handleAccept = async () => {
    if (mode === "install" && isIOS()) {
      setShowIOSGuide(true);
      return;
    }

    // Push subscription flow (Android/Desktop)
    setWorking(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        dismiss();
        return;
      }

      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.warn("VITE_VAPID_PUBLIC_KEY not set");
        dismiss();
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
      });

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      await fetch(`${supabaseUrl}/functions/v1/save-push-subscription`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          codigoRastreio: codigoRastreio || null,
        }),
      });

      localStorage.setItem(STORAGE_KEY, "accepted");
      setVisible(false);
    } catch (err) {
      console.error("Push subscription failed:", err);
    } finally {
      setWorking(false);
    }
  };

  if (!visible) return null;

  const isPushMode = mode === "push";
  const Icon = isPushMode ? Bell : Download;
  const title = isPushMode
    ? "🔔 Ative as notificações"
    : "📲 Instale o app";
  const text = isPushMode
    ? "Receba atualizações em tempo real sobre o status dos seus pedidos."
    : "Adicione à tela inicial para receber notificações sobre seus pedidos.";
  const acceptLabel = working
    ? "Ativando..."
    : isPushMode
      ? "Ativar"
      : "Instalar";

  return (
    <>
      {/* iOS Guide Modal */}
      {showIOSGuide && (
        <>
          <div className="nprompt-overlay" onClick={() => setShowIOSGuide(false)} />
          <div className="nprompt-ios-guide">
            <button className="nprompt-close" onClick={() => setShowIOSGuide(false)} aria-label="Fechar">
              <X size={18} />
            </button>
            <h4 className="nprompt-ios-title">Instalar no iPhone/iPad</h4>
            <div className="nprompt-ios-steps">
              <div className="nprompt-ios-step">
                <div className="nprompt-ios-num">1</div>
                <div className="nprompt-ios-text">
                  Toque no ícone <Share size={16} style={{ display: "inline", verticalAlign: "middle", color: "#6366f1", margin: "0 2px" }} /> na barra inferior do Safari
                </div>
              </div>
              <div className="nprompt-ios-step">
                <div className="nprompt-ios-num">2</div>
                <div className="nprompt-ios-text">
                  Role e toque em <strong>"Adicionar à Tela de Início"</strong> <Plus size={14} style={{ display: "inline", verticalAlign: "middle", color: "#6366f1", margin: "0 2px" }} />
                </div>
              </div>
              <div className="nprompt-ios-step">
                <div className="nprompt-ios-num">3</div>
                <div className="nprompt-ios-text">
                  Toque em <strong>"Adicionar"</strong> para confirmar
                </div>
              </div>
            </div>
            <p className="nprompt-ios-note">Pronto! O app aparecerá na sua tela inicial.</p>
          </div>
        </>
      )}

      {/* Banner */}
      <div className="nprompt-banner">
        <div className="nprompt-icon" style={{ background: isPushMode ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "linear-gradient(135deg, #22c55e, #16a34a)" }}>
          <Icon size={22} color="white" />
        </div>
        <div className="nprompt-content">
          <h4 className="nprompt-title">{title}</h4>
          <p className="nprompt-text">{text}</p>
        </div>
        <div className="nprompt-actions">
          <button
            className="nprompt-btn nprompt-btn-accept"
            onClick={handleAccept}
            disabled={working}
            style={{ background: isPushMode ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "linear-gradient(135deg, #22c55e, #16a34a)" }}
          >
            {acceptLabel}
          </button>
          <button className="nprompt-btn nprompt-btn-dismiss" onClick={dismiss}>
            Agora não
          </button>
        </div>
        <button className="nprompt-close nprompt-close-banner" onClick={dismiss} aria-label="Fechar">
          <X size={16} />
        </button>
      </div>

      <style>{styles}</style>
    </>
  );
}

const styles = `
.nprompt-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.4);
  z-index: 10000;
  animation: npFadeIn 0.25s ease-out;
}
.nprompt-banner {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  z-index: 9999;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid rgba(99,102,241,0.25);
  border-radius: 18px; padding: 18px 22px;
  display: flex; align-items: center; gap: 14px;
  max-width: 540px; width: calc(100% - 32px);
  box-shadow: 0 16px 50px rgba(0,0,0,0.4), 0 0 30px rgba(99,102,241,0.1);
  animation: npSlideUp 0.4s cubic-bezier(0.16,1,0.3,1);
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}
.nprompt-icon {
  flex-shrink: 0; width: 46px; height: 46px; border-radius: 13px;
  display: flex; align-items: center; justify-content: center;
}
.nprompt-content { flex: 1; min-width: 0; }
.nprompt-title { font-size: 14px; font-weight: 700; color: #f8fafc; margin: 0 0 3px; }
.nprompt-text { font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.4; }
.nprompt-actions { display: flex; flex-direction: column; gap: 5px; flex-shrink: 0; }
.nprompt-btn {
  border: none; border-radius: 9px; padding: 8px 18px;
  font-size: 12px; font-weight: 700; cursor: pointer;
  transition: all 0.2s; font-family: inherit; white-space: nowrap;
}
.nprompt-btn-accept { color: white; }
.nprompt-btn-accept:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(99,102,241,0.4); }
.nprompt-btn-accept:disabled { opacity: 0.7; cursor: wait; }
.nprompt-btn-dismiss { background: rgba(255,255,255,0.06); color: #64748b; font-size: 11px; }
.nprompt-btn-dismiss:hover { background: rgba(255,255,255,0.1); color: #94a3b8; }
.nprompt-close { background: none; border: none; color: #475569; cursor: pointer; padding: 4px; border-radius: 6px; transition: all 0.2s; }
.nprompt-close:hover { color: #94a3b8; background: rgba(255,255,255,0.05); }
.nprompt-close-banner { position: absolute; top: 6px; right: 6px; }

/* iOS Guide */
.nprompt-ios-guide {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  z-index: 10001;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid rgba(99,102,241,0.3); border-radius: 20px; padding: 24px;
  max-width: 380px; width: calc(100% - 32px);
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  animation: npSlideUp 0.3s cubic-bezier(0.16,1,0.3,1);
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}
.nprompt-ios-title { font-size: 17px; font-weight: 800; color: #f8fafc; margin: 0 0 16px; text-align: center; }
.nprompt-ios-steps { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
.nprompt-ios-step { display: flex; align-items: center; gap: 12px; }
.nprompt-ios-num {
  flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white; font-size: 13px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
}
.nprompt-ios-text { font-size: 13px; color: #cbd5e1; line-height: 1.4; }
.nprompt-ios-note { font-size: 12px; color: #22c55e; text-align: center; margin: 0; font-weight: 600; }

@keyframes npSlideUp {
  from { opacity: 0; transform: translateX(-50%) translateY(30px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
@keyframes npFadeIn { from { opacity: 0; } to { opacity: 1; } }

@media (max-width: 480px) {
  .nprompt-banner { flex-wrap: wrap; gap: 10px; padding: 14px; bottom: 16px; }
  .nprompt-actions { flex-direction: row; width: 100%; }
  .nprompt-btn { flex: 1; text-align: center; }
}
`;
