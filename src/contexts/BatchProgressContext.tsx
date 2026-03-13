import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from "react";

const STORAGE_KEY = "batch_progress_state";

interface BatchProgressState {
  processing: boolean;
  current: number;
  total: number;
  startedAt: number;
}

interface BatchProgressContextType {
  progress: BatchProgressState | null;
  cancelRef: React.MutableRefObject<boolean>;
  startBatch: (total: number) => void;
  updateProgress: (current: number) => void;
  finishBatch: () => void;
  cancelBatch: () => void;
  getEstimatedTime: () => string;
  interruptibleSleep: (ms: number) => Promise<void>;
}

const BatchProgressContext = createContext<BatchProgressContextType | null>(null);

function loadPersistedState(): BatchProgressState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as BatchProgressState;
    if (state.processing) return state;
    return null;
  } catch {
    return null;
  }
}

function persistState(state: BatchProgressState | null) {
  if (state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function BatchProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<BatchProgressState | null>(loadPersistedState);
  const cancelRef = useRef(false);
  const sleepResolveRef = useRef<(() => void) | null>(null);

  // Persist to localStorage on every change
  useEffect(() => {
    persistState(progress);
  }, [progress]);

  const startBatch = useCallback((total: number) => {
    cancelRef.current = false;
    setProgress({ processing: true, current: 0, total, startedAt: Date.now() });
  }, []);

  const updateProgress = useCallback((current: number) => {
    setProgress((prev) => prev ? { ...prev, current } : null);
  }, []);

  const finishBatch = useCallback(() => {
    setProgress(null);
  }, []);

  const cancelBatch = useCallback(() => {
    cancelRef.current = true;
    setProgress(null);
    // Wake up any sleeping interval immediately
    if (sleepResolveRef.current) {
      sleepResolveRef.current();
      sleepResolveRef.current = null;
    }
  }, []);

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
    // Fixed estimate: 60 seconds per item (the interval between each batch step)
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
    <BatchProgressContext.Provider value={{ progress, cancelRef, startBatch, updateProgress, finishBatch, cancelBatch, getEstimatedTime, interruptibleSleep }}>
      {children}
    </BatchProgressContext.Provider>
  );
}

export function useBatchProgress() {
  const ctx = useContext(BatchProgressContext);
  if (!ctx) throw new Error("useBatchProgress must be used within BatchProgressProvider");
  return ctx;
}
