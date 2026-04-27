import { useEffect, useRef } from "react";
import createGlobe from "cobe";

export interface GlobeMarker {
  location: [number, number]; // [lat, lng]
  size: number;
}

interface LogisticsGlobeProps {
  markers?: GlobeMarker[];
  className?: string;
}

export default function LogisticsGlobe({ markers = [], className }: LogisticsGlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pointerInteracting = useRef<number | null>(null);
  const pointerInteractionMovement = useRef(0);
  const phiRef = useRef(0);
  const widthRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let phi = 0;
    let visible = true;
    const onVis = () => {
      visible = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", onVis);

    const resize = () => {
      widthRef.current = container.offsetWidth;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const globe = createGlobe(canvas, {
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      width: widthRef.current * 2,
      height: widthRef.current * 2,
      phi: 0,
      theta: 0.25,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.1, 0.2, 0.4],
      markerColor: [0.06, 0.72, 0.51],
      glowColor: [0.3, 0.4, 0.6],
      markers: markers.length > 0 ? markers : [{ location: [0, 0], size: 0 }],
      onRender: (state) => {
        if (!visible) return;
        if (pointerInteracting.current === null) {
          phi += 0.004;
        }
        state.phi = phi + pointerInteractionMovement.current;
        phiRef.current = state.phi;
        state.width = widthRef.current * 2;
        state.height = widthRef.current * 2;
      },
    });

    // Fade in
    requestAnimationFrame(() => {
      canvas.style.opacity = "1";
    });

    return () => {
      globe.destroy();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
    // Re-create when marker set length changes meaningfully
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(markers.map((m) => [...m.location, m.size]))]);

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
        onPointerDown={(e) => {
          pointerInteracting.current = e.clientX - pointerInteractionMovement.current;
          (e.currentTarget as HTMLCanvasElement).style.cursor = "grabbing";
        }}
        onPointerUp={(e) => {
          pointerInteracting.current = null;
          (e.currentTarget as HTMLCanvasElement).style.cursor = "grab";
        }}
        onPointerOut={() => {
          pointerInteracting.current = null;
        }}
        onMouseMove={(e) => {
          if (pointerInteracting.current !== null) {
            const delta = e.clientX - pointerInteracting.current;
            pointerInteractionMovement.current = delta / 100;
          }
        }}
        onTouchMove={(e) => {
          if (pointerInteracting.current !== null && e.touches[0]) {
            const delta = e.touches[0].clientX - pointerInteracting.current;
            pointerInteractionMovement.current = delta / 100;
          }
        }}
        style={{
          width: "100%",
          height: "100%",
          cursor: "grab",
          contain: "layout paint size",
          opacity: 0,
          transition: "opacity 0.6s ease",
        }}
      />
    </div>
  );
}
