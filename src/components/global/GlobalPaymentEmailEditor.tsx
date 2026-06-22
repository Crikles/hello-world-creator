import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RotateCcw, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  GLOBAL_CONFIRM_DEFAULTS,
  mergeTemplate,
  renderGlobalConfirmEmail,
  type GlobalConfirmTemplate,
  type GlobalLang,
} from "@/lib/global-confirm-email";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lojaId: string;
  initialEn?: Partial<GlobalConfirmTemplate> | null;
  initialEs?: Partial<GlobalConfirmTemplate> | null;
  empresaNome?: string;
  origemNome?: string;
}

const PREVIEW_VARS = {
  nome: "John Doe",
  produto: "Wireless Earbuds Pro",
  valor: "199,90",
  empresa: "",
  origem: "",
  tracking_url: "https://us.tracker-master.com/r/TMABC123US",
};

const VARIABLES = [
  { token: "{{nome}}", label: "Nome do cliente" },
  { token: "{{produto}}", label: "Produto" },
  { token: "{{valor}}", label: "Valor (R$)" },
  { token: "{{empresa}}", label: "Nome da empresa" },
  { token: "{{origem}}", label: "País de origem" },
  { token: "{{tracking_url}}", label: "URL de rastreio" },
];

export function GlobalPaymentEmailEditor({
  open,
  onOpenChange,
  lojaId,
  initialEn,
  initialEs,
  empresaNome,
  origemNome,
}: Props) {
  const qc = useQueryClient();
  const [lang, setLang] = useState<GlobalLang>("en");
  const [en, setEn] = useState<GlobalConfirmTemplate>(mergeTemplate("en", initialEn));
  const [es, setEs] = useState<GlobalConfirmTemplate>(mergeTemplate("es", initialEs));

  useEffect(() => {
    if (open) {
      setEn(mergeTemplate("en", initialEn));
      setEs(mergeTemplate("es", initialEs));
    }
  }, [open, initialEn, initialEs]);

  const current = lang === "en" ? en : es;
  const setCurrent = lang === "en" ? setEn : setEs;

  const previewHtml = useMemo(() => {
    return renderGlobalConfirmEmail(lang, current, {
      ...PREVIEW_VARS,
      empresa: empresaNome || "Sua Empresa",
      origem: origemNome || (lang === "es" ? "China" : "China"),
    });
  }, [lang, current, empresaNome, origemNome]);

  const save = useMutation({
    mutationFn: async () => {
      const isEnCustom = JSON.stringify(en) !== JSON.stringify(GLOBAL_CONFIRM_DEFAULTS.en);
      const isEsCustom = JSON.stringify(es) !== JSON.stringify(GLOBAL_CONFIRM_DEFAULTS.es);
      const { error } = await supabase
        .from("global_flow_config")
        .update({
          confirm_email_template_en: isEnCustom ? (en as any) : null,
          confirm_email_template_es: isEsCustom ? (es as any) : null,
        })
        .eq("loja_id", lojaId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Templates salvos", description: "Próximos envios usarão o template personalizado." });
      qc.invalidateQueries({ queryKey: ["global_flow_config", lojaId] });
      onOpenChange(false);
    },
    onError: (e: any) => {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    },
  });

  const resetCurrent = () => {
    setCurrent({ ...GLOBAL_CONFIRM_DEFAULTS[lang] });
    toast({ title: "Restaurado", description: `Template ${lang.toUpperCase()} voltou ao padrão.` });
  };

  const field = (key: keyof GlobalConfirmTemplate, label: string, multiline = false) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {multiline ? (
        <Textarea
          value={current[key]}
          onChange={(e) => setCurrent({ ...current, [key]: e.target.value })}
          rows={2}
          className="text-sm"
        />
      ) : (
        <Input
          value={current[key]}
          onChange={(e) => setCurrent({ ...current, [key]: e.target.value })}
          className="text-sm h-9"
        />
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border/40">
          <DialogTitle>Personalizar Email de Confirmação de Pagamento</DialogTitle>
          <DialogDescription>
            Edite os templates em inglês e espanhol. Após salvar, esses templates serão enviados
            automaticamente quando o pagamento internacional for confirmado.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={lang} onValueChange={(v) => setLang(v as GlobalLang)} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-4">
            <TabsList>
              <TabsTrigger value="en" className="gap-2">
                <img src="https://flagcdn.com/w40/us.png" alt="EN" className="h-3.5 w-5 rounded-sm" />
                English
              </TabsTrigger>
              <TabsTrigger value="es" className="gap-2">
                <img src="https://flagcdn.com/w40/es.png" alt="ES" className="h-3.5 w-5 rounded-sm" />
                Español
              </TabsTrigger>
            </TabsList>
          </div>

          {(["en", "es"] as const).map((l) => (
            <TabsContent key={l} value={l} className="flex-1 min-h-0 mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 h-full min-h-0">
                {/* FORM */}
                <ScrollArea className="border-r border-border/40 h-full">
                  <div className="p-6 space-y-4">
                    {field("header", "Cabeçalho")}
                    {field("preview", "Preview text (linha em cinza no inbox)")}
                    {field("greeting", "Saudação")}
                    {field("intro", "Texto de introdução", true)}
                    <div className="grid grid-cols-2 gap-3">
                      {field("product_label", "Rótulo: Produto")}
                      {field("value_label", "Rótulo: Valor")}
                    </div>
                    {field("cta", "Texto do botão (CTA)")}
                    {field("footer", "Rodapé")}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Cor de destaque</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={current.accent_color}
                          onChange={(e) => setCurrent({ ...current, accent_color: e.target.value })}
                          className="h-9 w-12 rounded border border-border/40 cursor-pointer bg-transparent"
                        />
                        <Input
                          value={current.accent_color}
                          onChange={(e) => setCurrent({ ...current, accent_color: e.target.value })}
                          className="text-sm h-9 font-mono"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <Label className="text-xs font-medium mb-2 block">Variáveis disponíveis</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {VARIABLES.map((v) => (
                          <Badge
                            key={v.token}
                            variant="secondary"
                            className="text-[10px] font-mono cursor-pointer hover:bg-primary/20"
                            onClick={() => navigator.clipboard.writeText(v.token)}
                            title={`Clique para copiar — ${v.label}`}
                          >
                            {v.token}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Use estas variáveis em qualquer campo de texto. Clique para copiar.
                      </p>
                    </div>

                    <div className="pt-3">
                      <Button variant="outline" size="sm" onClick={resetCurrent} className="gap-2">
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restaurar padrão ({l.toUpperCase()})
                      </Button>
                    </div>
                  </div>
                </ScrollArea>

                {/* PREVIEW */}
                <div className="bg-muted/30 h-full overflow-hidden flex flex-col">
                  <div className="px-4 py-2 border-b border-border/40 flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs text-muted-foreground">Pré-visualização ao vivo</span>
                  </div>
                  <iframe
                    title={`preview-${l}`}
                    srcDoc={previewHtml}
                    sandbox=""
                    className="flex-1 w-full bg-white"
                  />
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <DialogFooter className="px-6 py-3 border-t border-border/40">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
            <Save className="h-4 w-4" />
            {save.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
