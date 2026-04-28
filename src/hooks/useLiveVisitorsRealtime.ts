import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AggregatedMarker {
  city: string;
  location: [number, number];
  count: number;
}

export interface RecentActivity {
  id: string;
  city: string;
  country: string;
  countryCode: string;
  trackingCode: string;
  customerName: string;
  status: string;
  at: number;
}

interface UseLiveVisitorsRealtimeOptions {
  lojaId: string | null | undefined;
  paused?: boolean;
  onNewVisitor?: () => void;
}

interface PingRow {
  id: string;
  loja_id: string;
  session_id: string;
  codigo_rastreio: string | null;
  cidade: string | null;
  estado: string | null;
  pais: string | null;
  pais_codigo: string | null;
  lat: number | null;
  lng: number | null;
  last_seen_at: string;
  created_at: string;
}

const ACTIVE_WINDOW_MS = 90_000; // visitor is "online" if seen in last 90s
const REFRESH_INTERVAL_MS = 5_000;
const HISTORY_LENGTH = 30;
const MAX_MARKERS = 50;

const COUNTRY_NAMES: Record<string, string> = {
  BR: "Brasil",
  US: "Estados Unidos",
  CA: "Canadá",
  MX: "México",
  AR: "Argentina",
  CL: "Chile",
  CO: "Colômbia",
  PE: "Peru",
  PT: "Portugal",
  ES: "Espanha",
  FR: "França",
  DE: "Alemanha",
  IT: "Itália",
  GB: "Reino Unido",
  IE: "Irlanda",
  AU: "Austrália",
  NZ: "Nova Zelândia",
  JP: "Japão",
  CN: "China",
  IN: "Índia",
};

const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  BR: [-14.235, -51.9253],
  US: [39.8283, -98.5795],
  CA: [56.1304, -106.3468],
  MX: [23.6345, -102.5528],
  AR: [-38.4161, -63.6167],
  CL: [-35.6751, -71.543],
  CO: [4.5709, -74.2973],
  PE: [-9.19, -75.0152],
  PT: [39.3999, -8.2245],
  ES: [40.4637, -3.7492],
  FR: [46.2276, 2.2137],
  DE: [51.1657, 10.4515],
  IT: [41.8719, 12.5674],
  GB: [55.3781, -3.436],
  IE: [53.1424, -7.6921],
  AU: [-25.2744, 133.7751],
  NZ: [-40.9006, 174.886],
  JP: [36.2048, 138.2529],
  CN: [35.8617, 104.1954],
  IN: [20.5937, 78.9629],
};

const BRAZIL_FALLBACK_POINTS: [number, number][] = [
  [-23.5505, -46.6333],
  [-22.9068, -43.1729],
  [-19.9167, -43.9345],
  [-15.7801, -47.9292],
  [-12.9777, -38.5016],
  [-8.0476, -34.877],
  [-3.7319, -38.5267],
  [-25.4296, -49.2719],
  [-30.0346, -51.2177],
  [-3.119, -60.0217],
  [-1.4558, -48.5044],
  [-16.6864, -49.2643],
];

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function resolveMarkerLocation(ping: PingRow): [number, number] {
  if (typeof ping.lat === "number" && typeof ping.lng === "number") {
    return [ping.lat, ping.lng];
  }

  const seed = hashString(
    `${ping.session_id}|${ping.codigo_rastreio ?? ""}|${ping.pais_codigo ?? ""}`,
  );
  const countryCode = ping.pais_codigo?.toUpperCase() ?? "";

  if (countryCode === "BR") {
    const base = BRAZIL_FALLBACK_POINTS[seed % BRAZIL_FALLBACK_POINTS.length];
    const latJitter = (((seed >> 8) % 1000) / 1000 - 0.5) * 1.8;
    const lngJitter = (((seed >> 18) % 1000) / 1000 - 0.5) * 2.4;
    return [
      clamp(base[0] + latJitter, -33.75, 5.3),
      clamp(base[1] + lngJitter, -73.99, -34.79),
    ];
  }

  const centroid = COUNTRY_CENTROIDS[countryCode];
  if (centroid) {
    const latJitter = (((seed >> 8) % 1000) / 1000 - 0.5) * 6;
    const lngJitter = (((seed >> 18) % 1000) / 1000 - 0.5) * 8;
    return [
      clamp(centroid[0] + latJitter, -60, 75),
      clamp(centroid[1] + lngJitter, -180, 180),
    ];
  }

  return [
    clamp((((seed >> 6) % 1300) / 10) - 55, -55, 75),
    clamp((((seed >> 17) % 3600) / 10) - 180, -180, 180),
  ];
}

function resolveMarkerLabel(ping: PingRow) {
  const countryCode = ping.pais_codigo?.toUpperCase() ?? "";
  return ping.cidade || COUNTRY_NAMES[countryCode] || "Visitante online";
}

export function useLiveVisitorsRealtime(opts: UseLiveVisitorsRealtimeOptions) {
  const { lojaId, paused = false, onNewVisitor } = opts;

  const [pings, setPings] = useState<PingRow[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [peak24h, setPeak24h] = useState(0);
  const [lastUpdateAt, setLastUpdateAt] = useState(Date.now());
  // Cache codigo_rastreio -> cidade do cliente (do envio) para enriquecer
  // o badge do globo quando o ping não vem com cidade resolvida.
  const [envioCityMap, setEnvioCityMap] = useState<Record<string, { city: string | null; state: string | null; name: string | null }>>({});

  const [visitorsHistory, setVisitorsHistory] = useState<number[]>(
    () => Array(HISTORY_LENGTH).fill(0),
  );
  const [trackingHistory, setTrackingHistory] = useState<number[]>(
    () => Array(HISTORY_LENGTH).fill(0),
  );
  const [countriesHistory, setCountriesHistory] = useState<number[]>(
    () => Array(HISTORY_LENGTH).fill(0),
  );
  const [peakHistory, setPeakHistory] = useState<number[]>(
    () => Array(HISTORY_LENGTH).fill(0),
  );

  const knownIdsRef = useRef<Set<string>>(new Set());
  const onNewVisitorRef = useRef(onNewVisitor);
  onNewVisitorRef.current = onNewVisitor;
  const visibleRef = useRef(true);

  useEffect(() => {
    const h = () => {
      visibleRef.current = document.visibilityState === "visible";
    };
    h();
    document.addEventListener("visibilitychange", h);
    return () => document.removeEventListener("visibilitychange", h);
  }, []);

  // Poll active pings
  useEffect(() => {
    if (!lojaId) return;
    let cancelled = false;

    const fetchActive = async () => {
      if (paused || !visibleRef.current) return;
      const since = new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString();
      const { data, error } = await supabase
        .from("live_view_pings")
        .select("*")
        .eq("loja_id", lojaId)
        .gte("last_seen_at", since)
        .order("last_seen_at", { ascending: false })
        .limit(500);
      if (cancelled || error || !data) return;

      const rows = data as PingRow[];

      // Detect new visitors (not seen in previous fetch)
      const newOnes: PingRow[] = [];
      for (const r of rows) {
        if (!knownIdsRef.current.has(r.id)) {
          newOnes.push(r);
        }
      }
      // Refresh known set with current active rows
      knownIdsRef.current = new Set(rows.map((r) => r.id));

      if (newOnes.length > 0) {
        onNewVisitorRef.current?.();

        // Lookup customer name + cidade by tracking codes
        const codes = Array.from(
          new Set(newOnes.map((r) => r.codigo_rastreio).filter(Boolean) as string[]),
        );
        const nameMap = new Map<string, string>();
        const cityMap = new Map<string, { city: string | null; state: string | null; name: string | null }>();
        if (codes.length > 0) {
          const { data: envios } = await supabase
            .from("envios")
            .select("codigo_rastreio, cliente_nome, cliente_cidade, cliente_estado")
            .eq("loja_id", lojaId)
            .in("codigo_rastreio", codes);
          if (envios) {
            for (const e of envios as Array<{
              codigo_rastreio: string;
              cliente_nome: string | null;
              cliente_cidade: string | null;
              cliente_estado: string | null;
            }>) {
              if (!e.codigo_rastreio) continue;
              if (e.cliente_nome) nameMap.set(e.codigo_rastreio, e.cliente_nome);
              cityMap.set(e.codigo_rastreio, {
                city: e.cliente_cidade,
                state: e.cliente_estado,
                name: e.cliente_nome,
              });
            }
            if (cityMap.size > 0) {
              setEnvioCityMap((prev) => {
                const next = { ...prev };
                cityMap.forEach((value, code) => {
                  next[code] = value;
                });
                return next;
              });
            }
          }
        }

        setRecentActivity((prev) => {
          const adds: RecentActivity[] = newOnes.map((r) => {
            const envioInfo = r.codigo_rastreio ? cityMap.get(r.codigo_rastreio) : undefined;
            const displayCity = envioInfo?.city || r.cidade || "Localização desconhecida";
            return {
              id: r.id,
              city: displayCity,
              country: r.pais || "—",
              countryCode: r.pais_codigo || "",
              trackingCode: r.codigo_rastreio || "—",
              customerName:
                (r.codigo_rastreio && nameMap.get(r.codigo_rastreio)) || "Cliente anônimo",
              status: "Visualizando rastreio",
              at: new Date(r.last_seen_at).getTime(),
            };
          });
          return [...adds, ...prev].slice(0, 30);
        });
      }

      setPings(rows);

      const total = rows.length;
      const uniqCodes = new Set(rows.map((r) => r.codigo_rastreio).filter(Boolean)).size;
      const uniqCountries = new Set(rows.map((r) => r.pais_codigo).filter(Boolean)).size;

      setVisitorsHistory((h) => [...h.slice(-(HISTORY_LENGTH - 1)), total]);
      setTrackingHistory((h) => [...h.slice(-(HISTORY_LENGTH - 1)), uniqCodes]);
      setCountriesHistory((h) => [...h.slice(-(HISTORY_LENGTH - 1)), uniqCountries]);
      setPeak24h((p) => {
        const newP = Math.max(p, total);
        setPeakHistory((ph) => [...ph.slice(-(HISTORY_LENGTH - 1)), newP]);
        return newP;
      });
      setLastUpdateAt(Date.now());
    };

    // Initial: load 24h peak baseline
    (async () => {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("live_view_pings")
        .select("session_id", { count: "exact", head: true })
        .eq("loja_id", lojaId)
        .gte("last_seen_at", since24h);
      if (!cancelled && typeof count === "number") {
        setPeak24h((p) => Math.max(p, count));
      }
    })();

    fetchActive();
    const id = setInterval(fetchActive, REFRESH_INTERVAL_MS);

    // Realtime subscription — wakes up immediately on new pings
    const channel = supabase
      .channel(`live-view-${lojaId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_view_pings",
          filter: `loja_id=eq.${lojaId}`,
        },
        () => {
          fetchActive();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      clearInterval(id);
      supabase.removeChannel(channel);
    };
  }, [lojaId, paused]);

  // Aggregate markers by city when precise geo exists.
  // If the backend has no lat/lng for that visitor, generate a deterministic
  // fallback point so each online visitor still appears on the globe in real time.
  const markersMap = new Map<string, AggregatedMarker>();
  for (const p of pings) {
    const location = resolveMarkerLocation(p);
    const hasPreciseGeo = p.lat != null && p.lng != null;
    // Prefer the customer's city stored on the envio over the IP-derived ping city.
    const envioInfo = p.codigo_rastreio ? envioCityMap[p.codigo_rastreio] : undefined;
    const customerCity = envioInfo?.city?.trim() || null;
    const customerState = envioInfo?.state?.trim() || null;
    const cityLabel =
      (customerCity
        ? customerState
          ? `${customerCity} - ${customerState}`
          : customerCity
        : null) || resolveMarkerLabel(p);
    const key = hasPreciseGeo
      ? customerCity || p.cidade || `${location[0].toFixed(2)},${location[1].toFixed(2)}`
      : `session:${p.session_id}:${p.codigo_rastreio || "sem-codigo"}`;
    const existing = markersMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      markersMap.set(key, {
        city: cityLabel,
        location,
        count: 1,
      });
    }
  }
  const markers = Array.from(markersMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_MARKERS);

  const totalOnline = pings.length;
  const trackingCodesCount = new Set(pings.map((p) => p.codigo_rastreio).filter(Boolean)).size;
  const activeCountries = new Set(pings.map((p) => p.pais_codigo).filter(Boolean)).size;

  return {
    markers,
    totalOnline,
    trackingCodesCount,
    activeCountries,
    peak24h,
    recentActivity,
    visitorsHistory,
    trackingHistory,
    countriesHistory,
    peakHistory,
    lastUpdateAt,
  };
}
