import { useState, useEffect, ReactNode } from "react";
import { Monitor } from "lucide-react";

const MOBILE_BREAKPOINT = 768;

export function MobileBlocker({ children }: { children: ReactNode }) {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  if (isMobile === undefined) return null;

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a0a0a] p-8 text-center">
        <h1 className="text-xl font-semibold text-[#888] mb-2">
          503
        </h1>
        <p className="text-[#666] text-sm">
          Serviço temporariamente indisponível. Tente novamente mais tarde.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
