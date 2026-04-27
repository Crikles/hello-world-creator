import { useEffect, useRef, useState } from "react";

export interface ActiveVisitor {
  id: string;
  location: [number, number]; // [lat, lng]
  city: string;
  country: string;
  countryCode: string;
  trackingCode: string;
  status: string;
  startedAt: number;
}

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
  status: string;
  at: number;
}

interface UseLiveVisitorsOptions {
  paused?: boolean;
  onNewVisitor?: () => void;
}

interface UseLiveVisitorsReturn {
  visitors: ActiveVisitor[];
  markers: AggregatedMarker[];
  totalOnline: number;
  trackingCodesCount: number;
  activeCountries: number;
  peak24h: number;
  recentActivity: RecentActivity[];
  visitorsHistory: number[];
  trackingHistory: number[];
  countriesHistory: number[];
  peakHistory: number[];
  lastUpdateAt: number;
}

const HUBS = [
  { city: "São Paulo", country: "Brasil", countryCode: "BR", lat: -23.55, lng: -46.63 },
  { city: "Rio de Janeiro", country: "Brasil", countryCode: "BR", lat: -22.9, lng: -43.17 },
  { city: "Belo Horizonte", country: "Brasil", countryCode: "BR", lat: -19.92, lng: -43.94 },
  { city: "Curitiba", country: "Brasil", countryCode: "BR", lat: -25.42, lng: -49.27 },
  { city: "Porto Alegre", country: "Brasil", countryCode: "BR", lat: -30.03, lng: -51.22 },
  { city: "Recife", country: "Brasil", countryCode: "BR", lat: -8.05, lng: -34.88 },
  { city: "Salvador", country: "Brasil", countryCode: "BR", lat: -12.97, lng: -38.5 },
  { city: "Brasília", country: "Brasil", countryCode: "BR", lat: -15.78, lng: -47.93 },
  { city: "Manaus", country: "Brasil", countryCode: "BR", lat: -3.1, lng: -60.02 },
  { city: "Fortaleza", country: "Brasil", countryCode: "BR", lat: -3.71, lng: -38.54 },
  { city: "Miami", country: "Estados Unidos", countryCode: "US", lat: 25.76, lng: -80.19 },
  { city: "Lisboa", country: "Portugal", countryCode: "PT", lat: 38.72, lng: -9.13 },
];

const STATUSES = [
  "Em trânsito",
  "Saiu para entrega",
  "Postado",
  "Em rota",
  "Aguardando retirada",
  "Entregue",
  "Em centro de distribuição",
];

const MAX_MARKERS = 50;
const MIN_VISITORS = 15;
const MAX_VISITORS = 80;
const UPDATE_INTERVAL_MS = 2000;
const HISTORY_LENGTH = 30;

function randomTrackingCode(): string {
  let n = "";
  for (let i = 0; i < 9; i++) n += Math.floor(Math.random() * 10);
  return `BR${n}`;
}

function makeVisitor(): ActiveVisitor {
  const hub = HUBS[Math.floor(Math.random() * HUBS.length)];
  return {
    id: crypto.randomUUID(),
    location: [hub.lat, hub.lng],
    city: hub.city,
    country: hub.country,
    countryCode: hub.countryCode,
    trackingCode: randomTrackingCode(),
    status: STATUSES[Math.floor(Math.random() * STATUSES.length)],
    startedAt: Date.now(),
  };
}

export function useLiveVisitors(options: UseLiveVisitorsOptions = {}): UseLiveVisitorsReturn {
  const { paused = false, onNewVisitor } = options;
  const [visitors, setVisitors] = useState<ActiveVisitor[]>(() =>
    Array.from({ length: 35 }, makeVisitor),
  );
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [peak24h, setPeak24h] = useState<number>(35);
  const [lastUpdateAt, setLastUpdateAt] = useState<number>(Date.now());

  const [visitorsHistory, setVisitorsHistory] = useState<number[]>(() =>
    Array.from({ length: HISTORY_LENGTH }, () => 30 + Math.floor(Math.random() * 15)),
  );
  const [trackingHistory, setTrackingHistory] = useState<number[]>(() =>
    Array.from({ length: HISTORY_LENGTH }, () => 25 + Math.floor(Math.random() * 12)),
  );
  const [countriesHistory, setCountriesHistory] = useState<number[]>(() =>
    Array.from({ length: HISTORY_LENGTH }, () => 2 + Math.floor(Math.random() * 2)),
  );
  const [peakHistory, setPeakHistory] = useState<number[]>(() =>
    Array.from({ length: HISTORY_LENGTH }, (_, i) => 30 + Math.floor(Math.random() * 25) + i),
  );

  const visibleRef = useRef(true);
  const onNewVisitorRef = useRef(onNewVisitor);
  onNewVisitorRef.current = onNewVisitor;

  // Visibility listener — pause when tab hidden
  useEffect(() => {
    const handler = () => {
      visibleRef.current = document.visibilityState === "visible";
    };
    handler();
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      if (!visibleRef.current) return;

      setVisitors((prev) => {
        const next = [...prev];
        // Remove 0–3 random
        const removeCount = Math.floor(Math.random() * 4);
        for (let i = 0; i < removeCount && next.length > MIN_VISITORS; i++) {
          next.splice(Math.floor(Math.random() * next.length), 1);
        }
        // Add 0–4 random
        const addCount = Math.floor(Math.random() * 5);
        const newOnes: ActiveVisitor[] = [];
        for (let i = 0; i < addCount && next.length < MAX_VISITORS; i++) {
          const v = makeVisitor();
          newOnes.push(v);
          next.push(v);
        }

        if (newOnes.length > 0) {
          onNewVisitorRef.current?.();
          setRecentActivity((act) => {
            const adds: RecentActivity[] = newOnes.map((v) => ({
              id: v.id,
              city: v.city,
              country: v.country,
              countryCode: v.countryCode,
              trackingCode: v.trackingCode,
              status: v.status,
              at: Date.now(),
            }));
            return [...adds, ...act].slice(0, 20);
          });
        }

        const total = next.length;
        const uniqCountries = new Set(next.map((v) => v.countryCode)).size;
        const uniqCodes = new Set(next.map((v) => v.trackingCode)).size;

        setPeak24h((p) => Math.max(p, total));
        setVisitorsHistory((h) => [...h.slice(-(HISTORY_LENGTH - 1)), total]);
        setTrackingHistory((h) => [...h.slice(-(HISTORY_LENGTH - 1)), uniqCodes]);
        setCountriesHistory((h) => [...h.slice(-(HISTORY_LENGTH - 1)), uniqCountries]);
        setPeakHistory((h) => [...h.slice(-(HISTORY_LENGTH - 1)), Math.max(h[h.length - 1] ?? 0, total)]);
        setLastUpdateAt(Date.now());

        return next;
      });
    }, UPDATE_INTERVAL_MS);

    return () => clearInterval(id);
  }, [paused]);

  // Aggregate markers by city, cap at MAX_MARKERS
  const markersMap = new Map<string, AggregatedMarker>();
  for (const v of visitors) {
    const m = markersMap.get(v.city);
    if (m) m.count += 1;
    else markersMap.set(v.city, { city: v.city, location: v.location, count: 1 });
  }
  const markers = Array.from(markersMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_MARKERS);

  const totalOnline = visitors.length;
  const trackingCodesCount = new Set(visitors.map((v) => v.trackingCode)).size;
  const activeCountries = new Set(visitors.map((v) => v.countryCode)).size;

  return {
    visitors,
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
