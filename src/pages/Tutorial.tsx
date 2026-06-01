import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GraduationCap, Search } from "lucide-react";
import {
  TUTORIALS,
  TUTORIAL_CATEGORIES,
  type Tutorial,
  type TutorialCategory,
} from "@/data/tutorials";
import { TutorialCard } from "@/components/tutorial/TutorialCard";
import { TutorialDialog } from "@/components/tutorial/TutorialDialog";

export default function TutorialPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<TutorialCategory | "Todos">("Todos");
  const [selected, setSelected] = useState<Tutorial | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return TUTORIALS.filter((t) => {
      const matchCat = activeCategory === "Todos" || t.category === activeCategory;
      if (!matchCat) return false;
      if (!term) return true;
      return (
        t.title.toLowerCase().includes(term) ||
        t.summary.toLowerCase().includes(term) ||
        t.purpose.toLowerCase().includes(term) ||
        t.steps.some((s) => s.toLowerCase().includes(term))
      );
    });
  }, [search, activeCategory]);

  const handleOpen = (t: Tutorial) => {
    setSelected(t);
    setOpen(true);
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Central de Tutoriais
            </h1>
            <p className="text-sm text-muted-foreground">
              Aprenda a usar cada funcionalidade do painel — explicado passo a passo, sem enrolação.
            </p>
          </div>
        </div>
      </div>

      {/* Busca */}
      <div className="relative mb-5 max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar tutorial (ex: envios, whatsapp, moedas)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-11"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-8">
        {(["Todos", ...TUTORIAL_CATEGORIES] as const).map((cat) => (
          <Button
            key={cat}
            variant={activeCategory === cat ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(cat)}
            className="rounded-full"
          >
            {cat}
          </Button>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/50 p-12 text-center">
          <p className="text-muted-foreground">Nenhum tutorial encontrado para esta busca.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <TutorialCard key={t.id} tutorial={t} onOpen={() => handleOpen(t)} />
          ))}
        </div>
      )}

      <TutorialDialog tutorial={selected} open={open} onOpenChange={setOpen} />
    </div>
  );
}
