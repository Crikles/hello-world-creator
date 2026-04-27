import { useEffect, useRef, useCallback, CSSProperties } from "react";
import createGlobe from "cobe";

export interface GlobeMarker {
  id: string;
  location: [number, number]; // [lat, lng]
  city: string;
  count: number;
}

export interface GlobeArc {
  id: string;
  from: [number, number];
  to: [number, number];
}

interface LogisticsGlobeProps {
  markers?: GlobeMarker[];
  arcs?: GlobeArc[];
  className?: string;
  speed?: number;
}

export default function LogisticsGlobe({
  markers = [],
  arcs = [],
  className,
  speed = 0.003,
}: LogisticsGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null);
  const dragOffset = useRef({ phi: 0, theta: 0 });
  const phiOffsetRef = useRef(0);
  const thetaOffsetRef = useRef(0);
  const isPausedRef = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    pointerInteracting.current = { x: e.clientX, y: e.clientY };
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
    isPausedRef.current = true;
  }, []);

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi;
      thetaOffsetRef.current += dragOffset.current.theta;
      dragOffset.current = { phi: 0, theta: 0 };
    }
    pointerInteracting.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = "grab";
    isPausedRef.current = false;
  }, []);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (pointerInteracting.current !== null) {
        dragOffset.current = {
          phi: (e.clientX - pointerInteracting.current.x) / 300,
          theta: (e.clientY - pointerInteracting.current.y) / 1000,
        };
      }
    };
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerup", handlePointerUp, { passive: true });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerUp]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let globe: ReturnType<typeof createGlobe> | null = null;
    let animationId = 0;
    let phi = 0;
    let visible = true;

    const onVis = () => {
      visible = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVis);

    function init() {
      const width = canvas!.offsetWidth;
      if (width === 0 || globe) return;

      globe = createGlobe(canvas!, {
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        width,
        height: width,
        phi: 0,
        theta: 0.25,
        dark: 1,
        diffuse: 1.2,
        mapSamples: 16000,
        mapBrightness: 6,
        baseColor: [0.1, 0.2, 0.4],
        markerColor: [0.06, 0.72, 0.51], // emerald
        glowColor: [0.3, 0.4, 0.6],
        markers: markers.length
          ? markers.map((m) => ({ location: m.location, size: Math.min(0.12, 0.04 + m.count * 0.012) }))
          : [{ location: [0, 0], size: 0 }],
        // arcs are supported at runtime; not in v2 typings
        ...(arcs.length
          ? {
              arcs: arcs.map((a) => ({ from: a.from, to: a.to })),
              arcColor: [0.06, 0.72, 0.51],
              arcWidth: 0.6,
              arcHeight: 0.3,
              opacity: 0.85,
            }
          : {}),
        onRender: (state: Record<string, number>) => {
          if (!visible) return;
          if (!isPausedRef.current) phi += speed;
          state.phi = phi + phiOffsetRef.current + dragOffset.current.phi;
          state.theta = 0.25 + thetaOffsetRef.current + dragOffset.current.theta;
        },
      } as Parameters<typeof createGlobe>[1]);

      requestAnimationFrame(() => {
        canvas!.style.opacity = "1";
      });
    }

    if (canvas.offsetWidth > 0) {
      init();
    } else {
      const ro = new ResizeObserver((entries) => {
        if (entries[0]?.contentRect.width > 0) {
          ro.disconnect();
          init();
        }
      });
      ro.observe(canvas);
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (globe) globe.destroy();
      document.removeEventListener("visibilitychange", onVis);
    };
    // Re-create when marker/arc set changes meaningfully
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    JSON.stringify(markers.map((m) => [m.id, ...m.location, m.count])),
    JSON.stringify(arcs.map((a) => [a.id, ...a.from, ...a.to])),
    speed,
  ]);

  // Project lat/lng to 2D x/y on the canvas, considering current rotation.
  // Returns null if the point is on the back side of the globe.
  // We update labels via requestAnimationFrame in a separate effect below.
  const labelsLayerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      const canvas = canvasRef.current;
      const layer = labelsLayerRef.current;
      if (canvas && layer) {
        const size = canvas.offsetWidth;
        const cx = size / 2;
        const cy = size / 2;
        const r = size / 2;
        // current rotation (matches what's pushed in onRender)
        const phi =
          (performance.now() / 1000) * 0; // not used directly
        // We can't read globe internal phi reliably; instead, we listen by reading
        // the same offsets we push. Approximate using a shared ref via window event.
        const currentPhi = (window as any).__lvGlobePhi ?? 0;
        const currentTheta = 0.25 + thetaOffsetRef.current + dragOffset.current.theta;

        const children = layer.querySelectorAll<HTMLElement>("[data-marker-id]");
        children.forEach((el) => {
          const lat = parseFloat(el.dataset.lat || "0");
          const lng = parseFloat(el.dataset.lng || "0");

          // Convert lat/lng to 3D unit vector (cobe convention: phi rotates around Y)
          const latRad = (lat * Math.PI) / 180;
          const lngRad = (lng * Math.PI) / 180;
          // Apply phi (yaw) and theta (pitch)
          const cosLat = Math.cos(latRad);
          let x = cosLat * Math.sin(lngRad + currentPhi);
          let y = Math.sin(latRad);
          let z = cosLat * Math.cos(lngRad + currentPhi);
          // Pitch (theta) rotates around X
          const cosT = Math.cos(currentTheta);
          const sinT = Math.sin(currentTheta);
          const y2 = y * cosT - z * sinT;
          const z2 = y * sinT + z * cosT;
          y = y2;
          z = z2;

          const screenX = cx + x * r * 0.92;
          const screenY = cy - y * r * 0.92;
          const visibleSide = z > 0.05;
          el.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%, -110%)`;
          el.style.opacity = visibleSide ? "1" : "0";
          el.style.filter = visibleSide ? "blur(0)" : "blur(6px)";
        });
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Wrap the onRender to also expose current phi to the label updater.
  // We do this by patching after init: re-bind onRender via a sibling effect.
  // Simpler: track phi locally in the same render loop (already incremented here):
  useEffect(() => {
    let raf = 0;
    let localPhi = 0;
    const tick = () => {
      if (!isPausedRef.current && document.visibilityState === "visible") {
        localPhi += speed;
      }
      (window as any).__lvGlobePhi = localPhi + phiOffsetRef.current + dragOffset.current.phi;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [speed]);

  const labelStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    pointerEvents: "none",
    transition: "opacity 0.25s ease, filter 0.25s ease",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.65rem",
    color: "hsl(var(--foreground))",
    background: "hsl(var(--background) / 0.85)",
    border: "1px solid hsl(var(--border))",
    padding: "3px 8px",
    borderRadius: 6,
    whiteSpace: "nowrap",
    boxShadow: "0 4px 14px hsl(var(--background) / 0.6)",
    backdropFilter: "blur(6px)",
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: "100%",
        aspectRatio: "1",
        maxWidth: 700,
        margin: "0 auto",
        position: "relative",
      }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerOut={handlePointerUp}
        style={{
          width: "100%",
          height: "100%",
          cursor: "grab",
          contain: "layout paint size",
          opacity: 0,
          transition: "opacity 0.6s ease",
        }}
      />
      <div
        ref={labelsLayerRef}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
      >
        {markers.map((m) => {
          const label =
            m.count > 1 ? `${m.count} rastreios` : "1 visitante";
          return (
            <div
              key={m.id}
              data-marker-id={m.id}
              data-lat={m.location[0]}
              data-lng={m.location[1]}
              style={labelStyle}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "hsl(160 84% 45%)",
                    boxShadow: "0 0 8px hsl(160 84% 45% / 0.8)",
                  }}
                />
                <span style={{ fontWeight: 600 }}>{m.city}</span>
                <span style={{ opacity: 0.7 }}>· {label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
