import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";

interface BatchProgressState {
  processing: boolean;
  current: number;
  total: number;
  startedAt: number;
}

interface BatchProgressContextType {
  progress: BatchProgressState | null;
  cancelRef: React.MutableRefObject<boolean>;
  startBatch: (total: number) => Promise<void>;
  updateProgress: (current: number) => Promise<void>;
  finishBatch: () => Promise<void>;
  cancelBatch: () => Promise<void>;
  getEstimatedTime: () => string;
  interruptibleSleep: (ms: number) => Promise<void>;
  checkCancelled: () => Promise<boolean>;
}

const BatchProgressContext = createContext<BatchProgressContextType | null>(null);

export function BatchProgressProvider({ children }: { children: ReactNode }) {
  const { loja } = useLoja();
  const lojaId = loja?.id;
  const [progress, setProgress] = useState<BatchProgressState | null>(null);
  const cancelRef = useRef(false);
  const sleepResolveRef = useRef<(() => void) | null>(null);

  // Load initial state from DB and subscribe to realtime
  useEffect(() => {
    if (!lojaId) return;

    // Fetch current state
    const fetchState = async () => {
      const { data } = await supabase
        .from("batch_progress")
        .select("*")
        .eq("loja_id", lojaId)
        .maybeSingle();

      if (data) {
        setProgress({
          processing: !data.cancelled,
          current: data.current_item,
          total: data.total_items,
          startedAt: new Date(data.started_at).getTime(),
        });
        cancelRef.current = data.cancelled;
      } else {
        setProgress(null);
        cancelRef.current = false;
      }
    };

    fetchState();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`batch-progress-${lojaId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "batch_progress", filter: `loja_id=eq.${lojaId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setProgress(null);
            cancelRef.current = false;
          } else {
            const row = payload.new as any;
            if (row.cancelled) {
              cancelRef.current = true;
              setProgress(null);
              // Wake up any sleeping interval
              if (sleepResolveRef.current) {
                sleepResolveRef.current();
                sleepResolveRef.current = null;
              }
            } else {
              setProgress({
                processing: true,
                current: row.current_item,
                total: row.total_items,
                startedAt: new Date(row.started_at).getTime(),
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lojaId]);

  const startBatch = useCallback(async (total: number) => {
    if (!lojaId) return;
    cancelRef.current = false;

    // Upsert to DB
    await supabase
      .from("batch_progress")
      .upsert({
        loja_id: lojaId,
        current_item: 0,
        total_items: total,
        cancelled: false,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "loja_id" });

    setProgress({ processing: true, current: 0, total, startedAt: Date.now() });
  }, [lojaId]);

  const updateProgress = useCallback(async (current: number) => {
    if (!lojaId) return;

    await supabase
      .from("batch_progress")
      .update({ current_item: current, updated_at: new Date().toISOString() })
      .eq("loja_id", lojaId);

    setProgress((prev) => prev ? { ...prev, current } : null);
  }, [lojaId]);

  const finishBatch = useCallback(async () => {
    if (!lojaId) return;

    await supabase
      .from("batch_progress")
      .delete()
      .eq("loja_id", lojaId);

    setProgress(null);
  }, [lojaId]);

  const cancelBatch = useCallback(async () => {
    if (!lojaId) return;
    cancelRef.current = true;

    // Set cancelled in DB so the processing tab picks it up
    await supabase
      .from("batch_progress")
      .update({ cancelled: true, updated_at: new Date().toISOString() })
      .eq("loja_id", lojaId);

    setProgress(null);

    // Wake up any sleeping interval
    if (sleepResolveRef.current) {
      sleepResolveRef.current();
      sleepResolveRef.current = null;
    }
  }, [lojaId]);

  const checkCancelled = useCallback(async (): Promise<boolean> => {
    if (!lojaId) return false;
    if (cancelRef.current) return true;

    // Poll DB to catch cancellation from another tab
    const { data, error } = await supabase
      .from("batch_progress")
      .select("cancelled")
      .eq("loja_id", lojaId)
      .maybeSingle();

    if (error) {
      console.warn("[batch-progress] Não foi possível checar cancelamento:", error);
      return false;
    }

    if (data?.cancelled) {
      cancelRef.current = true;
      return true;
    }

    return false;
  }, [lojaId]);

  const interruptibleSleep = useCallback((ms: number) => {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        sleepResolveRef.current = null;
        resolve();
      }, ms);

      sleepResolveRef.current = () => {
        clearTimeout(timer);
        sleepResolveRef.current = null;
        resolve();
      };
    });
  }, []);

  const getEstimatedTime = useCallback(() => {
    if (!progress) return "";
    const remaining = progress.total - progress.current;
    const totalSeconds = remaining * 60;
    if (totalSeconds <= 0) return "finalizando...";
    if (totalSeconds < 60) return `~${totalSeconds}s`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `~${hours}h ${mins}min`;
    }
    return seconds > 0 ? `~${minutes}min ${seconds}s` : `~${minutes}min`;
  }, [progress]);

  return (
    <BatchProgressContext.Provider value={{ progress, cancelRef, startBatch, updateProgress, finishBatch, cancelBatch, getEstimatedTime, interruptibleSleep, checkCancelled }}>
      {children}
    </BatchProgressContext.Provider>
  );
}

export function useBatchProgress() {
  const ctx = useContext(BatchProgressContext);
  if (!ctx) throw new Error("useBatchProgress must be used within BatchProgressProvider");
  return ctx;
}
