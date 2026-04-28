import { useEffect, useRef, useCallback, useState, CSSProperties } from "react";
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
  const labelsLayerRef = useRef<HTMLDivElement | null>(null);
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null);
  const dragOffset = useRef({ phi: 0, theta: 0 });
  const phiOffsetRef = useRef(0);
  const thetaOffsetRef = useRef(0);
  const isPausedRef = useRef(false);
  const phiRef = useRef(0);

  // Live "traffic" values per arc, simulating req/s flowing on routes.
  const [traffic, setTraffic] = useState<Record<string, number>>(() => {
    const seed = [420, 380, 290, 185, 156, 134, 110, 95];
    const out: Record<string, number> = {};
    arcs.forEach((a, i) => {
      out[a.id] = seed[i] ?? 80 + Math.floor(Math.random() * 60);
    });
    return out;
  });

  useEffect(() => {
    const id = setInterval(() => {
      setTraffic((prev) => {
        const next: Record<string, number> = {};
        arcs.forEach((a) => {
          const cur = prev[a.id] ?? 100;
          next[a.id] = Math.max(40, cur + Math.floor(Math.random() * 21) - 10);
        });
        return next;
      });
    }, 350);
    return () => clearInterval(id);
  }, [arcs]);

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
        theta: 0.2,
        dark: 0,
        diffuse: 1.5,
        mapSamples: 16000,
        mapBrightness: 10,
        baseColor: [1, 1, 1],
        markerColor: [0, 0, 0],
        glowColor: [0.94, 0.93, 0.91],
        markers: markers.length
          ? markers.map((m) => ({ location: m.location, size: 0.012 }))
          : [{ location: [0, 0], size: 0 }],
        ...(arcs.length
          ? ({
              arcs: arcs.map((a) => ({ from: a.from, to: a.to })),
              arcColor: [0, 0, 0],
              arcWidth: 0.5,
              arcHeight: 0.25,
              opacity: 0.7,
            } as Record<string, unknown>)
          : {}),
        onRender: (state: Record<string, number>) => {
          if (!visible) return;
          if (!isPausedRef.current) phiRef.current += speed;
          state.phi = phiRef.current + phiOffsetRef.current + dragOffset.current.phi;
          state.theta = 0.2 + thetaOffsetRef.current + dragOffset.current.theta;
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
      if (globe) globe.destroy();
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    JSON.stringify(markers.map((m) => [m.id, ...m.location, m.count])),
    JSON.stringify(arcs.map((a) => [a.id, ...a.from, ...a.to])),
    speed,
  ]);

  // Project a lat/lng (optionally elevated along the great-circle arc) onto
  // 2D screen coords using the same phi/theta as the cobe renderer.
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
        const currentPhi = phiRef.current + phiOffsetRef.current + dragOffset.current.phi;
        const currentTheta = 0.2 + thetaOffsetRef.current + dragOffset.current.theta;

        const project = (lat: number, lng: number, elevation = 1) => {
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
          const screenX = cx + x * r * 0.92 * elevation;
          const screenY = cy - y * r * 0.92 * elevation;
          return { screenX, screenY, visible: z > 0.05 };
        };

        // Marker pyramids + region labels
        const markerEls = layer.querySelectorAll<HTMLElement>("[data-marker-id]");
        markerEls.forEach((el) => {
          const lat = parseFloat(el.dataset.lat || "0");
          const lng = parseFloat(el.dataset.lng || "0");
          const { screenX, screenY, visible: vis } = project(lat, lng, 1);
          el.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%, -100%)`;
          el.style.opacity = vis ? "1" : "0";
          el.style.filter = vis ? "blur(0)" : "blur(6px)";
        });

        // Arc traffic badges — anchored at the apex (midpoint, elevated).
        const arcEls = layer.querySelectorAll<HTMLElement>("[data-arc-id]");
        arcEls.forEach((el) => {
          const fLat = parseFloat(el.dataset.fromLat || "0");
          const fLng = parseFloat(el.dataset.fromLng || "0");
          const tLat = parseFloat(el.dataset.toLat || "0");
          const tLng = parseFloat(el.dataset.toLng || "0");
          const midLat = (fLat + tLat) / 2;
          // Naive midpoint is fine for short labels; elevate above the surface.
          let midLng = (fLng + tLng) / 2;
          // Handle antimeridian crossings to keep midpoint sensible.
          if (Math.abs(fLng - tLng) > 180) midLng += 180;
          const { screenX, screenY, visible: vis } = project(midLat, midLng, 1.18);
          el.style.transform = `translate(${screenX}px, ${screenY}px) translate(-50%, -100%)`;
          el.style.opacity = vis ? "1" : "0";
          el.style.filter = vis ? "blur(0)" : "blur(6px)";
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
    transition: "opacity 0.25s ease, filter 0.25s ease",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
  };

  const regionChipStyle: CSSProperties = {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.6rem",
    color: "#111",
    background: "#fff",
    border: "1px solid #e5e5e5",
    padding: "2px 6px",
    borderRadius: 4,
    whiteSpace: "nowrap",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  };

  const trafficBadgeStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    pointerEvents: "none",
    transition: "opacity 0.25s ease, filter 0.25s ease",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.55rem",
    color: "#fff",
    background: "#000",
    padding: "3px 8px",
    borderRadius: 4,
    whiteSpace: "nowrap",
    boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
  };

  // 3D triangular pyramid (4 faces) rendered with CSS transforms.
  const pyramidFace = (nth: number): CSSProperties => {
    const transforms = [
      "rotateY(0deg) translateZ(4px) rotateX(19.5deg)",
      "rotateY(120deg) translateZ(4px) rotateX(19.5deg)",
      "rotateY(240deg) translateZ(4px) rotateX(19.5deg)",
      "rotateX(-90deg) rotateZ(60deg) translateY(4px)",
    ];
    const colors = ["#111", "#333", "#555", "#222"];
    return {
      position: "absolute",
      left: -0.5,
      top: 0,
      width: 0,
      height: 0,
      borderLeft: "6.5px solid transparent",
      borderRight: "6.5px solid transparent",
      borderBottom: `13px solid ${colors[nth]}`,
      transformOrigin: "center bottom",
      transform: transforms[nth],
    };
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
        @keyframes lv-pyramid-spin {
          0% { transform: rotateX(20deg) rotateY(0deg); }
          100% { transform: rotateX(20deg) rotateY(360deg); }
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
        {markers.map((m) => (
          <div
            key={m.id}
            data-marker-id={m.id}
            data-lat={m.location[0]}
            data-lng={m.location[1]}
            style={labelStyle}
          >
            {/* Spinning pyramid */}
            <div
              style={{
                width: 13,
                height: 13,
                position: "relative",
                transformStyle: "preserve-3d",
                animation: "lv-pyramid-spin 4s linear infinite",
              }}
            >
              {[0, 1, 2, 3].map((n) => (
                <div key={n} style={pyramidFace(n)} />
              ))}
            </div>
            <div style={regionChipStyle}>{m.city}</div>
          </div>
        ))}

        {arcs.map((a) => (
          <div
            key={`badge-${a.id}`}
            data-arc-id={a.id}
            data-from-lat={a.from[0]}
            data-from-lng={a.from[1]}
            data-to-lat={a.to[0]}
            data-to-lng={a.to[1]}
            style={trafficBadgeStyle}
          >
            {traffic[a.id] ?? 100}k req/s
          </div>
        ))}
      </div>
    </div>
  );
}
