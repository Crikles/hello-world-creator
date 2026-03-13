import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from "react";

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
}

const BatchProgressContext = createContext<BatchProgressContextType | null>(null);

export function BatchProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<BatchProgressState | null>(null);
  const cancelRef = useRef(false);

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
  }, []);

  const getEstimatedTime = useCallback(() => {
    if (!progress || progress.current === 0) return "calculando...";
    const elapsed = Date.now() - progress.startedAt;
    const msPerItem = elapsed / progress.current;
    const remainingMs = msPerItem * (progress.total - progress.current);
    const totalSeconds = Math.ceil(remainingMs / 1000);
    if (totalSeconds < 60) return `~${totalSeconds}s`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `~${hours}h ${mins}min`;
    }
    return `~${minutes}min ${seconds}s`;
  }, [progress]);

  return (
    <BatchProgressContext.Provider value={{ progress, cancelRef, startBatch, updateProgress, finishBatch, cancelBatch, getEstimatedTime }}>
      {children}
    </BatchProgressContext.Provider>
  );
}

export function useBatchProgress() {
  const ctx = useContext(BatchProgressContext);
  if (!ctx) throw new Error("useBatchProgress must be used within BatchProgressProvider");
  return ctx;
}
