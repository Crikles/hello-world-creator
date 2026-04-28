import { Link, useParams } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowRight, CheckCircle2, Lightbulb, AlertTriangle } from "lucide-react";
import type { Tutorial } from "@/data/tutorials";

interface Props {
  tutorial: Tutorial | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TutorialDialog({ tutorial, open, onOpenChange }: Props) {
  const { lojaId } = useParams();
  if (!tutorial) return null;
  const Icon = tutorial.icon;

  const targetPath =
    tutorial.route !== undefined
      ? `/loja/${lojaId}${tutorial.route ? `/${tutorial.route}` : ""}`
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border/40">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <Badge variant="secondary" className="mb-2 text-[10px] uppercase tracking-wider">
                {tutorial.category}
              </Badge>
              <DialogTitle className="text-xl">{tutorial.title}</DialogTitle>
              <DialogDescription className="mt-1">{tutorial.summary}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] px-6 py-5">
          <div className="space-y-6">
            <section>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                Para que serve
              </h4>
              <p className="text-sm text-foreground/90 leading-relaxed">{tutorial.purpose}</p>
            </section>

            <section>
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5" /> Como usar (passo a passo)
              </h4>
              <ol className="space-y-2.5">
                {tutorial.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-foreground/90">
                    <span className="h-5 w-5 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </section>

            {tutorial.tips && tutorial.tips.length > 0 && (
              <section className="rounded-xl border border-primary/15 bg-primary/5 p-4">
                <h4 className="text-xs uppercase tracking-wider text-primary font-semibold mb-2 flex items-center gap-2">
                  <Lightbulb className="h-3.5 w-3.5" /> Dicas importantes
                </h4>
                <ul className="space-y-1.5">
                  {tutorial.tips.map((tip, i) => (
                    <li key={i} className="text-sm text-foreground/90 leading-relaxed">
                      • {tip}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {tutorial.warnings && tutorial.warnings.length > 0 && (
              <section className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                <h4 className="text-xs uppercase tracking-wider text-destructive font-semibold mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5" /> Atenção
                </h4>
                <ul className="space-y-1.5">
                  {tutorial.warnings.map((w, i) => (
                    <li key={i} className="text-sm text-foreground/90 leading-relaxed">
                      • {w}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </ScrollArea>

        {targetPath && (
          <div className="p-4 border-t border-border/40 bg-muted/20 flex justify-end">
            <Button asChild onClick={() => onOpenChange(false)}>
              <Link to={targetPath}>
                Abrir agora <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
