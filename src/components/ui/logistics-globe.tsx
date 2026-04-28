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
  className,
  speed = 0.003,
}: LogisticsGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const labelsLayerRef = useRef<HTMLDivElement | null>(null);
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null);
  const dragOffset = useRef({ phi: 0, theta: 0 });
  const phiOffsetRef = useRef(0);
  const thetaOffsetRef = useRef(0);
  const isPausedRef = useRef(false);
  const phiRef = useRef(0);

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

    const safeMarkers =
      markers.length > 0
        ? markers.map((m) => ({ location: m.location, size: 0.08 }))
        : [{ location: [0, 0] as [number, number], size: 0 }];

    function init() {
      const width = canvas!.offsetWidth;
      if (width === 0 || globe) return;

      globe = createGlobe(canvas!, {
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        width: width * 2,
        height: width * 2,
        phi: 0,
        theta: 0.2,
        dark: 0,
        diffuse: 1.2,
        mapSamples: 16000,
        mapBrightness: 6,
        baseColor: [0.92, 0.92, 0.94],
        markerColor: [1, 0.23, 0.19],
        glowColor: [0.6, 0.65, 0.75],
        markers: safeMarkers,
      } as Parameters<typeof createGlobe>[1]);

      function animate() {
        if (!isPausedRef.current && document.visibilityState === "visible") {
          phi += speed;
        }
        phiRef.current = phi + phiOffsetRef.current + dragOffset.current.phi;
        globe!.update?.({
          phi: phiRef.current,
          theta: 0.2 + thetaOffsetRef.current + dragOffset.current.theta,
        } as never);
        animationId = requestAnimationFrame(animate);
      }
      animate();

      requestAnimationFrame(() => {
        if (canvas) canvas.style.opacity = "1";
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    JSON.stringify(markers.map((m) => [m.id, ...m.location])),
    speed,
  ]);

  // Project markers from lat/lng to screen coords using current rotation.
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
        const currentPhi = phiRef.current;
        const currentTheta = 0.2 + thetaOffsetRef.current + dragOffset.current.theta;

        const markerEls = layer.querySelectorAll<HTMLElement>("[data-marker-id]");
        markerEls.forEach((el) => {
          const lat = parseFloat(el.dataset.lat || "0");
          const lng = parseFloat(el.dataset.lng || "0");
          const latRad = (lat * Math.PI) / 180;
          const lngRad = (lng * Math.PI) / 180;
          const cosLat = Math.cos(latRad);
          let x = cosLat * Math.sin(lngRad + currentPhi);
          let y = Math.sin(latRad);
          let z = cosLat * Math.cos(lngRad + currentPhi);
          const cosT = Math.cos(currentTheta);
          const sinT = Math.sin(currentTheta);
          const y2 = y * cosT - z * sinT;
          const z2 = y * sinT + z * cosT;
          y = y2;
          z = z2;
          const screenX = cx + x * r * 0.92;
          const screenY = cy - y * r * 0.92;
          const vis = z > 0.05;
          el.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%, -130%)`;
          el.style.opacity = vis ? "1" : "0";
          el.style.filter = vis ? "blur(0)" : "blur(8px)";
        });
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, []);

  const labelStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    pointerEvents: "none",
    transition: "opacity 0.4s, filter 0.4s",
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.35rem 0.6rem",
    background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
    borderRadius: 4,
    boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
    whiteSpace: "nowrap",
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
      <style>{`
        @keyframes lv-live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerOut={handlePointerUp}
        style={{
          width: "100%",
          height: "100%",
          cursor: "grab",
          opacity: 0,
          transition: "opacity 0.6s ease",
        }}
      />
      <div
        ref={labelsLayerRef}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        {markers.map((m) => {
          const label = m.count > 1 ? `${m.count} watching` : "1 watching";
          return (
            <div
              key={m.id}
              data-marker-id={m.id}
              data-lat={m.location[0]}
              data-lng={m.location[1]}
              style={labelStyle}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  background: "#ff3b30",
                  borderRadius: "50%",
                  boxShadow: "0 0 8px #ff3b30",
                  animation: "lv-live-pulse 1.5s ease-in-out infinite",
                }}
              />
              <span
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: "0.6rem",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  color: "#ff3b30",
                  textTransform: "uppercase",
                }}
              >
                LIVE
              </span>
              <span
                style={{
                  fontFamily: "system-ui, sans-serif",
                  fontSize: "0.6rem",
                  color: "rgba(255,255,255,0.85)",
                  paddingLeft: "0.4rem",
                  borderLeft: "1px solid rgba(255,255,255,0.2)",
                  fontWeight: 500,
                }}
              >
                {m.city}
              </span>
              <span
                style={{
                  fontFamily: "system-ui, sans-serif",
                  fontSize: "0.55rem",
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                · {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
