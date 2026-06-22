import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Globe, Edit2, Mail, MessageSquare } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type Lang = "en" | "es";

interface GlobalTpl {
  id: string;
  step_order: number;
  lang: Lang;
  step_key: string;
  status_label: string;
  subject: string;
  preview: string;
  headline: string;
  intro: string;
  body: string;
  hint: string | null;
  cta_label: string;
  closing: string;
  sms_texto: string;
}

const VARS = ["{{name}}", "{{empresa}}", "{{originCountry}}", "{{tracking}}", "{{link}}"];

export function GlobalTemplatesCard() {
  const qc = useQueryClient();
  const [lang, setLang] = useState<Lang>("en");
  const [editing, setEditing] = useState<GlobalTpl | null>(null);

  const { data: rows } = useQuery({
    queryKey: ["admin-global-system-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("global_flow_system_templates" as any)
        .select("*")
        .order("lang")
        .order("step_order");
      if (error) throw error;
      return data as unknown as GlobalTpl[];
    },
  });

  const update = useMutation({
    mutationFn: async (tpl: GlobalTpl) => {
      const { error } = await supabase
        .from("global_flow_system_templates" as any)
        .update({
          subject: tpl.subject,
          preview: tpl.preview,
          headline: tpl.headline,
          intro: tpl.intro,
          body: tpl.body,
          hint: tpl.hint,
          cta_label: tpl.cta_label,
          closing: tpl.closing,
          sms_texto: tpl.sms_texto,
        })
        .eq("id", tpl.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-global-system-templates"] });
      setEditing(null);
      toast({ title: "Template atualizado!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err?.message, variant: "destructive" });
    },
  });

  const filtered = (rows || []).filter((r) => r.lang === lang);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Templates Globais (Internacional)</CardTitle>
              <CardDescription className="text-sm">
                Templates de e-mail e SMS do Fluxo Global em inglês e espanhol. Compartilhados por todas as lojas.
              </CardDescription>
            </div>
          </div>
          <Tabs value={lang} onValueChange={(v) => setLang(v as Lang)}>
            <TabsList>
              <TabsTrigger value="en">🇺🇸 English</TabsTrigger>
              <TabsTrigger value="es">🇪🇸 Español</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="mt-3 text-xs bg-muted/50 border rounded-md p-3 text-muted-foreground">
          O idioma de cada envio é definido pela loja em <strong>Global → Idioma</strong> e travado no momento da criação do envio.
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {filtered.map((tpl) => (
          <div key={tpl.id} className="flex items-center gap-4 py-3 px-4 rounded-lg border">
            <Badge variant="outline" className="shrink-0 font-mono">
              {tpl.step_order}/10
            </Badge>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{tpl.status_label}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                <Mail className="inline h-3 w-3 mr-1" />
                {tpl.subject}
              </p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                <MessageSquare className="inline h-3 w-3 mr-1" />
                {tpl.sms_texto}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setEditing(tpl)}>
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[92vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 pt-5 pb-3 border-b">
            <DialogTitle>
              Editar passo {editing?.step_order}/10 — {editing?.status_label} ({editing?.lang.toUpperCase()})
            </DialogTitle>
            <DialogDescription>
              Variáveis disponíveis: <code className="text-xs">{VARS.join(" ")}</code>
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1">
            {editing && (
              <div className="p-6 space-y-4">
                <Field label="Assunto do e-mail" value={editing.subject} onChange={(v) => setEditing({ ...editing, subject: v })} />
                <Field label="Texto de preview (inbox)" value={editing.preview} onChange={(v) => setEditing({ ...editing, preview: v })} />
                <Field label="Headline (título grande)" value={editing.headline} onChange={(v) => setEditing({ ...editing, headline: v })} />
                <FieldArea label="Intro (parágrafo de abertura)" value={editing.intro} onChange={(v) => setEditing({ ...editing, intro: v })} />
                <FieldArea label="Corpo (mensagem principal)" rows={4} value={editing.body} onChange={(v) => setEditing({ ...editing, body: v })} />
                <FieldArea label="Hint (callout opcional)" rows={2} value={editing.hint || ""} onChange={(v) => setEditing({ ...editing, hint: v || null })} />
                <Field label="Texto do botão (CTA)" value={editing.cta_label} onChange={(v) => setEditing({ ...editing, cta_label: v })} />
                <Field label="Despedida" value={editing.closing} onChange={(v) => setEditing({ ...editing, closing: v })} />
                <div className="pt-3 border-t">
                  <FieldArea
                    label="Mensagem SMS"
                    rows={2}
                    value={editing.sms_texto}
                    onChange={(v) => setEditing({ ...editing, sms_texto: v })}
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    SMS é enviado sem acentos. Use {"{{link}}"} para o link de rastreio.
                  </p>
                </div>
              </div>
            )}
          </ScrollArea>
          <DialogFooter className="px-6 py-4 border-t">
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button onClick={() => editing && update.mutate(editing)} disabled={update.isPending}>
              {update.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="text-sm" />
    </div>
  );
}

function FieldArea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold">{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="text-sm resize-none" />
    </div>
  );
}
