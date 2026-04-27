import { useEffect, useRef, useState } from "react";
import { LucideIcon } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface MetricCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  history: number[];
  accent?: "blue" | "green";
  decimals?: number;
}

function useAnimatedNumber(target: number, duration = 600) {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    fromRef.current = display;
    startRef.current = performance.now();
    const animate = (t: number) => {
      const elapsed = t - startRef.current;
      const p = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = fromRef.current + (target - fromRef.current) * eased;
      setDisplay(v);
      if (p < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return display;
}

export function MetricCard({ label, value, icon: Icon, history, accent = "blue", decimals = 0 }: MetricCardProps) {
  const animated = useAnimatedNumber(value);
  const data = history.map((y, i) => ({ x: i, y }));
  const accentColor = accent === "green" ? "#10B981" : "#3B82F6";

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-md p-5 transition-all hover:border-blue-500/50 hover:shadow-[0_0_30px_-10px_rgba(59,130,246,0.4)]">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 text-zinc-400 text-xs uppercase tracking-wider font-medium">
          <Icon className="h-4 w-4" style={{ color: accentColor }} />
          {label}
        </div>
      </div>
      <div className="mt-3 font-mono text-4xl font-bold text-zinc-100 tabular-nums">
        {decimals === 0 ? Math.round(animated).toLocaleString("pt-BR") : animated.toFixed(decimals)}
      </div>
      <div className="mt-3 h-10 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line
              type="monotone"
              dataKey="y"
              stroke={accentColor}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
