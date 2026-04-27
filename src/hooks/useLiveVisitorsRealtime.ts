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

export function useLiveVisitorsRealtime(opts: UseLiveVisitorsRealtimeOptions) {
  const { lojaId, paused = false, onNewVisitor } = opts;

  const [pings, setPings] = useState<PingRow[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [peak24h, setPeak24h] = useState(0);
  const [lastUpdateAt, setLastUpdateAt] = useState(Date.now());

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
        setRecentActivity((prev) => {
          const adds: RecentActivity[] = newOnes.map((r) => ({
            id: r.id,
            city: r.cidade || "Localização desconhecida",
            country: r.pais || "—",
            countryCode: r.pais_codigo || "",
            trackingCode: r.codigo_rastreio || "—",
            status: "Visualizando rastreio",
            at: new Date(r.last_seen_at).getTime(),
          }));
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

  // Aggregate markers by city
  const markersMap = new Map<string, AggregatedMarker>();
  for (const p of pings) {
    if (p.lat == null || p.lng == null) continue;
    const key = p.cidade || `${p.lat},${p.lng}`;
    const existing = markersMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      markersMap.set(key, {
        city: p.cidade || "—",
        location: [p.lat, p.lng],
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
