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
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background p-8 text-center">
        <Monitor className="h-16 w-16 text-muted-foreground mb-6" />
        <h1 className="text-2xl font-bold text-foreground mb-3">
          Acesso Indisponível
        </h1>
        <p className="text-muted-foreground max-w-sm">
          Esta plataforma está disponível apenas para computadores. Acesse pelo seu desktop para continuar.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
