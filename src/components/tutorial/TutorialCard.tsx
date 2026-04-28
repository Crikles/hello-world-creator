import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import type { Tutorial } from "@/data/tutorials";

interface Props {
  tutorial: Tutorial;
  onOpen: () => void;
}

export function TutorialCard({ tutorial, onOpen }: Props) {
  const Icon = tutorial.icon;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group text-left rounded-2xl border border-border/50 bg-card hover:border-primary/40 hover:bg-primary/[0.03] transition-all duration-200 p-5 flex flex-col gap-4 h-full"
    >
      <div className="flex items-start justify-between">
        <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:scale-105 transition-transform">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
          {tutorial.category}
        </Badge>
      </div>
      <div className="flex-1">
        <h3 className="text-base font-semibold text-foreground mb-1.5">{tutorial.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
          {tutorial.summary}
        </p>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-border/30">
        <span className="text-xs text-muted-foreground">
          {tutorial.steps.length} passos
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="text-primary hover:text-primary hover:bg-primary/10 -mr-2 h-8"
        >
          Ver detalhes <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </button>
  );
}
