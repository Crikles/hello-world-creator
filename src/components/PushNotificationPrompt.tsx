import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { isJadlogDomain } from "@/lib/domain-config";

interface PushNotificationPromptProps {
  codigoRastreio?: string;
}

/**
 * Converts a URL-safe base64 VAPID key to a Uint8Array for pushManager.subscribe()
 */
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

export function PushNotificationPrompt({ codigoRastreio }: PushNotificationPromptProps) {
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const jadlog = isJadlogDomain();

  useEffect(() => {
    // Don't show if already prompted, or API not available, or permission already decided
    if (localStorage.getItem("push_prompted")) return;
    if (!("Notification" in window)) return;
    if (!("serviceWorker" in navigator)) return;
    if (Notification.permission === "granted" || Notification.permission === "denied") return;

    // Small delay so it doesn't feel aggressive
    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem("push_prompted", "dismissed");
  };

  const handleAccept = async () => {
    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        handleDismiss();
        return;
      }

      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.warn("VITE_VAPID_PUBLIC_KEY not set");
        handleDismiss();
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
      });

      // Send subscription to our backend
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

      localStorage.setItem("push_prompted", "accepted");
      setVisible(false);
    } catch (err) {
      console.error("Push subscription failed:", err);
    } finally {
      setSubscribing(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      <div className="push-prompt-overlay" onClick={handleDismiss} />
      <div className={`push-prompt-banner ${jadlog ? 'jadlog' : ''}`}>
        <div className="push-prompt-icon-wrapper">
          <Bell size={24} className="push-prompt-bell" />
        </div>
        <div className="push-prompt-content">
          <h4 className="push-prompt-title">🔔 Fique por dentro!</h4>
          <p className="push-prompt-text">
            Deseja receber notificações sobre o status dos seus pedidos em tempo real?
          </p>
        </div>
        <div className="push-prompt-actions">
          <button
            className="push-prompt-btn push-prompt-btn-accept"
            onClick={handleAccept}
            disabled={subscribing}
          >
            {subscribing ? "Ativando..." : "Aceitar"}
          </button>
          <button
            className="push-prompt-btn push-prompt-btn-dismiss"
            onClick={handleDismiss}
          >
            Agora não
          </button>
        </div>
        <button className="push-prompt-close" onClick={handleDismiss} aria-label="Fechar">
          <X size={18} />
        </button>
      </div>

      <style>{pushPromptStyles}</style>
    </>
  );
}

const pushPromptStyles = `
.push-prompt-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.3);
  z-index: 9998;
  animation: pushFadeIn 0.3s ease-out;
}

.push-prompt-banner {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 20px;
  padding: 20px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  max-width: 580px;
  width: calc(100% - 32px);
  box-shadow:
    0 20px 60px rgba(0,0,0,0.4),
    0 0 40px rgba(99,102,241,0.15);
  animation: pushSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}

.push-prompt-icon-wrapper {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: pushPulse 2s infinite;
}

.push-prompt-bell {
  color: white;
}

.push-prompt-content {
  flex: 1;
  min-width: 0;
}

.push-prompt-title {
  font-size: 15px;
  font-weight: 700;
  color: #f8fafc;
  margin: 0 0 4px;
}

.push-prompt-text {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
  line-height: 1.4;
}

.push-prompt-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.push-prompt-btn {
  border: none;
  border-radius: 10px;
  padding: 8px 20px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  white-space: nowrap;
}

.push-prompt-btn-accept {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
}

.push-prompt-btn-accept:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 20px rgba(99,102,241,0.4);
}

.push-prompt-btn-accept:disabled {
  opacity: 0.7;
  cursor: wait;
}

.push-prompt-btn-dismiss {
  background: rgba(255,255,255,0.06);
  color: #64748b;
}

.push-prompt-btn-dismiss:hover {
  background: rgba(255,255,255,0.1);
  color: #94a3b8;
}

.push-prompt-close {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  color: #475569;
  cursor: pointer;
  padding: 4px;
  border-radius: 8px;
  transition: all 0.2s;
}

.push-prompt-close:hover {
  color: #94a3b8;
  background: rgba(255,255,255,0.05);
}

@keyframes pushSlideUp {
  from { opacity: 0; transform: translateX(-50%) translateY(40px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

@keyframes pushFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes pushPulse {
  0% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); }
  70% { box-shadow: 0 0 0 10px rgba(99,102,241,0); }
  100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
}

@media (max-width: 540px) {
  .push-prompt-banner {
    flex-wrap: wrap;
    padding: 16px;
    gap: 12px;
    bottom: 16px;
  }
  .push-prompt-icon-wrapper {
    width: 40px;
    height: 40px;
    border-radius: 12px;
  }
  .push-prompt-actions {
    flex-direction: row;
    width: 100%;
  }
  .push-prompt-btn {
    flex: 1;
    text-align: center;
  }
}
`;
