import { useEffect, useRef, useCallback, useMemo, CSSProperties } from "react";
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

// Anchors espalhados por terra firme em vários continentes para que os
// marcadores fiquem distribuídos pelo globo, não empilhados.
const GLOBAL_ANCHORS: Array<[number, number]> = [
  // América do Sul
  [-23.55, -46.63], [-22.91, -43.17], [-15.79, -47.88], [-3.73, -38.52],
  [-8.05, -34.88], [-30.03, -51.23], [-25.43, -49.27], [-12.97, -38.5],
  [-34.6, -58.38], [-33.45, -70.66], [4.71, -74.07], [-12.05, -77.04],
  // América do Norte
  [40.71, -74.0], [34.05, -118.24], [41.88, -87.63], [29.76, -95.37],
  [19.43, -99.13], [45.5, -73.57], [49.28, -123.12],
  // Europa
  [51.51, -0.13], [48.85, 2.35], [52.52, 13.4], [40.42, -3.7],
  [41.9, 12.5], [38.72, -9.14], [55.75, 37.62], [59.33, 18.07], [50.08, 14.43],
  // África
  [-26.2, 28.04], [6.52, 3.38], [30.04, 31.23], [33.97, -6.85],
  [-1.29, 36.82], [-33.92, 18.42],
  // Ásia
  [35.69, 139.69], [37.57, 126.98], [31.23, 121.47], [22.32, 114.17],
  [1.35, 103.82], [13.75, 100.5], [28.61, 77.21], [25.2, 55.27], [41.01, 28.98],
  // Oceania
  [-33.87, 151.21], [-37.81, 144.96], [-36.85, 174.76],
];

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  let t = seed + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function getScatteredLocation(id: string): [number, number] {
  const hash = hashString(id);
  const anchor = GLOBAL_ANCHORS[hash % GLOBAL_ANCHORS.length];
  const latJitter = (seededRandom(hash) - 0.5) * 6;
  const lngJitter = (seededRandom(hash ^ 0x9e3779b9) - 0.5) * 8;
  return [anchor[0] + latJitter, anchor[1] + lngJitter];
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
  const displayMarkers = useMemo(
    () => markers.map((marker) => ({ ...marker, location: getScatteredLocation(marker.id) })),
    [markers],
  );

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
    // Começa centrado no Atlântico para mostrar América + Europa/África,
    // mas a rotação contínua revela todos os continentes.
    let phi = 0;

    // We render the marker bubble in HTML on top of the globe so it stays
    // visually attached to the badge. We still pass a tiny invisible marker
    // to cobe so the lib initializes properly.
    const safeMarkers = [{ location: [0, 0] as [number, number], size: 0 }];

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
  }, [speed]);

  // Project markers from lat/lng to screen coords using current rotation.
  // Each marker is a single wrapper containing the dot + badge so they always
  // move together.
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

        const markerEls = Array.from(layer.querySelectorAll<HTMLElement>("[data-marker-id]"));
        const placed: Array<{ x: number; y: number; el: HTMLElement }> = [];
        // Ordena por longitude para que badges próximos sejam empilhados verticalmente
        // de forma estável (evita "tremor" entre frames).
        const projected = markerEls.map((el) => {
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
          return { el, screenX, screenY, z, lat, lng };
        });

        // Anti-sobreposição: se dois badges ficarem muito próximos verticalmente,
        // empurra o segundo para baixo. Usa ordem estável (id) para evitar flicker.
        projected.sort((a, b) => (a.el.dataset.markerId || "").localeCompare(b.el.dataset.markerId || ""));

        projected.forEach(({ el, screenX, screenY, z }) => {
          let finalY = screenY;
          const MIN_GAP = 22;
          for (const p of placed) {
            if (Math.abs(p.x - screenX) < 180 && Math.abs(p.y - finalY) < MIN_GAP) {
              finalY = p.y + MIN_GAP;
            }
          }
          placed.push({ x: screenX, y: finalY, el });
          const vis = z > 0.05;
          el.style.transform = `translate(${screenX}px, ${finalY}px)`;
          el.style.opacity = vis ? "1" : "0";
          el.style.filter = vis ? "blur(0)" : "blur(6px)";
        });
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Each marker wrapper is anchored at the projected (lat, lng).
  // Inside it we draw:
  //   - a centered red dot (translated -50%/-50% over the anchor)
  //   - a badge offset to the right of the dot, with a connector line
  // This guarantees dot and badge always share the same anchor.
  const markerWrapperStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    pointerEvents: "none",
    transition: "opacity 0.4s, filter 0.4s",
  };

  const dotStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: 10,
    height: 10,
    marginLeft: -5,
    marginTop: -5,
    borderRadius: "50%",
    background: "#ff3b30",
    boxShadow: "0 0 0 2px rgba(255,255,255,0.85), 0 0 12px rgba(255,59,48,0.9)",
    animation: "lv-live-pulse 1.5s ease-in-out infinite",
  };

  const connectorStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    left: 5,
    width: 14,
    height: 1,
    background: "linear-gradient(to right, rgba(255,255,255,0.6), rgba(255,255,255,0))",
    transform: "translateY(-0.5px)",
  };

  const badgeStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    left: 18,
    transform: "translateY(-50%)",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem",
    padding: "0.3rem 0.55rem",
    background: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 6,
    boxShadow: "0 6px 14px rgba(0,0,0,0.35)",
    whiteSpace: "nowrap",
    pointerEvents: "none",
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
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.65; transform: scale(0.85); }
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
        {displayMarkers.map((m) => {
          const watching =
            m.count > 1 ? `${m.count} assistindo` : "1 assistindo";
          return (
            <div
              key={m.id}
              data-marker-id={m.id}
              data-lat={m.location[0]}
              data-lng={m.location[1]}
              style={markerWrapperStyle}
            >
              <span style={dotStyle} />
              <span style={connectorStyle} />
              <div style={badgeStyle}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    background: "#ff3b30",
                    borderRadius: "50%",
                    boxShadow: "0 0 6px #ff3b30",
                  }}
                />
                <span
                  style={{
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: "0.55rem",
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    color: "#ff3b30",
                    textTransform: "uppercase",
                  }}
                >
                  LIVE
                </span>
                <span
                  style={{
                    fontFamily: "system-ui, sans-serif",
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.95)",
                    paddingLeft: "0.4rem",
                    borderLeft: "1px solid rgba(255,255,255,0.18)",
                    maxWidth: 160,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
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
                  · {watching}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
