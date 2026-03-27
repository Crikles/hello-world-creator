import { useState, useEffect, useMemo, useRef } from "react";
import { useLoja } from "@/contexts/LojaContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Sparkles, Save, Eye, FileText, Package } from "lucide-react";
import { buildEmailHtml, replaceVariables, dadosExemplo, defaultSectionsByEvent } from "@/components/postagens/emailTemplates";

interface UpsellData {
  id?: string;
  loja_id: string;
  tipo: string;
  ativo: boolean;
  headline: string;
  sub_headline: string;
  produto_nome: string;
  produto_descricao: string;
  produto_valor: string;
  produto_imagem_url: string;
  botao_texto: string;
  botao_url: string;
  cor_headline: string;
  cor_sub_headline: string;
  cor_nome_produto: string;
  cor_descricao: string;
  cor_valor: string;
  cor_botao_bg: string;
  cor_botao_texto: string;
  cor_fundo: string;
}

const defaultData = (lojaId: string, tipo: string): UpsellData => ({
  loja_id: lojaId,
  tipo,
  ativo: false,
  headline: "Aproveite esta oferta especial!",
  sub_headline: "Produto selecionado para você",
  produto_nome: "",
  produto_descricao: "",
  produto_valor: "R$ 0,00",
  produto_imagem_url: "",
  botao_texto: "Comprar Agora",
  botao_url: "",
  cor_headline: "#1e293b",
  cor_sub_headline: "#64748b",
  cor_nome_produto: "#0f172a",
  cor_descricao: "#475569",
  cor_valor: "#16a34a",
  cor_botao_bg: "#6366f1",
  cor_botao_texto: "#ffffff",
  cor_fundo: "#f8fafc",
});

function buildUpsellBlockHtml(data: UpsellData): string {
  const imgBlock = data.produto_imagem_url
    ? `<td style="width:120px;vertical-align:top;"><img src="${data.produto_imagem_url}" alt="${data.produto_nome}" style="width:120px;height:120px;object-fit:cover;border-radius:12px;" /></td>`
    : `<td style="width:120px;vertical-align:top;"><div style="width:120px;height:120px;border-radius:12px;background-color:#e2e8f0;"></div></td>`;

  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0;border-radius:16px;overflow:hidden;background-color:${data.cor_fundo};">
    <tr><td style="padding:24px;">
      <p style="margin:0 0 4px;text-align:center;font-size:20px;font-weight:800;color:${data.cor_headline};">${data.headline || "Headline"}</p>
      <p style="margin:0 0 16px;text-align:center;font-size:13px;color:${data.cor_sub_headline};">${data.sub_headline || "Sub headline"}</p>
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        ${imgBlock}
        <td style="vertical-align:top;padding-left:16px;">
          <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:${data.cor_nome_produto};">${data.produto_nome || "Nome do Produto"}</p>
          <p style="margin:0 0 8px;font-size:12px;line-height:1.4;color:${data.cor_descricao};">${data.produto_descricao || "Descrição do produto"}</p>
          <p style="margin:0;font-size:18px;font-weight:800;color:${data.cor_valor};">${data.produto_valor || "R$ 0,00"}</p>
        </td>
      </tr></table>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 0;"><tr><td align="center">
        <a href="${data.botao_url || "#"}" style="display:inline-block;background-color:${data.cor_botao_bg};color:${data.cor_botao_texto};padding:12px 36px;border-radius:50px;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:0.3px;">${data.botao_texto || "Comprar Agora"}</a>
      </td></tr></table>
    </td></tr>
  </table>`;
}

function FullEmailPreview({ data, tipo, empresaNome, empresaLogo }: { data: UpsellData; tipo: string; empresaNome: string; empresaLogo: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const eventName = tipo === "nfe" ? "Postado" : "Coletado";
  const sections = defaultSectionsByEvent[eventName];

  const fullHtml = useMemo(() => {
    const upsellBlock = data.ativo ? buildUpsellBlockHtml(data) : undefined;
    const raw = buildEmailHtml(sections, "#6366f1", eventName, undefined, upsellBlock);
    const previewData = { ...dadosExemplo, empresa_nome: empresaNome, empresa_logo_url: empresaLogo };
    return replaceVariables(raw, previewData);
  }, [data, sections, eventName, empresaNome, empresaLogo]);

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(fullHtml);
        doc.close();
        // Auto-resize iframe to content height
        const resize = () => {
          if (iframeRef.current && doc.body) {
            iframeRef.current.style.height = doc.body.scrollHeight + "px";
          }
        };
        setTimeout(resize, 100);
        setTimeout(resize, 500);
      }
    }
  }, [fullHtml]);

  return (
    <iframe
      ref={iframeRef}
      title="Email Preview"
      className="w-full border-0 rounded-xl"
      sandbox="allow-same-origin"
      style={{ minHeight: 400, overflow: "hidden" }}
      scrolling="no"
    />
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded-lg border border-border cursor-pointer p-0"
        style={{ appearance: "none", WebkitAppearance: "none" }}
      />
      <div className="flex-1 min-w-0">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-7 text-xs mt-0.5" />
      </div>
    </div>
  );
}

function UpsellForm({ tipo, label, icon }: { tipo: string; label: string; icon: React.ReactNode }) {
  const { loja } = useLoja();
  const queryClient = useQueryClient();
  const lojaId = loja?.id || "";

  const { data: empresa } = useQuery({
    queryKey: ["empresa-preview", lojaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("empresas")
        .select("nome_fantasia, razao_social, logo_url")
        .eq("loja_id", lojaId)
        .maybeSingle();
      return data;
    },
    enabled: !!lojaId,
  });

  const empresaNome = empresa?.nome_fantasia || empresa?.razao_social || "Minha Loja";
  const empresaLogo = empresa?.logo_url || "";

  const { data: saved, isLoading } = useQuery({
    queryKey: ["upsell-config", lojaId, tipo],
    queryFn: async () => {
      const { data } = await supabase
        .from("upsell_config")
        .select("*")
        .eq("loja_id", lojaId)
        .eq("tipo", tipo)
        .maybeSingle();
      return data;
    },
    enabled: !!lojaId,
  });

  const [form, setForm] = useState<UpsellData>(defaultData(lojaId, tipo));

  useEffect(() => {
    if (saved) {
      setForm({
        id: saved.id,
        loja_id: saved.loja_id,
        tipo: saved.tipo,
        ativo: saved.ativo,
        headline: saved.headline || "",
        sub_headline: saved.sub_headline || "",
        produto_nome: saved.produto_nome || "",
        produto_descricao: saved.produto_descricao || "",
        produto_valor: saved.produto_valor || "",
        produto_imagem_url: saved.produto_imagem_url || "",
        botao_texto: saved.botao_texto || "",
        botao_url: saved.botao_url || "",
        cor_headline: saved.cor_headline || "#1e293b",
        cor_sub_headline: saved.cor_sub_headline || "#64748b",
        cor_nome_produto: saved.cor_nome_produto || "#0f172a",
        cor_descricao: saved.cor_descricao || "#475569",
        cor_valor: saved.cor_valor || "#16a34a",
        cor_botao_bg: saved.cor_botao_bg || "#6366f1",
        cor_botao_texto: saved.cor_botao_texto || "#ffffff",
        cor_fundo: saved.cor_fundo || "#f8fafc",
      });
    } else if (lojaId) {
      setForm(defaultData(lojaId, tipo));
    }
  }, [saved, lojaId, tipo]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, loja_id: lojaId, tipo, updated_at: new Date().toISOString() };
      delete (payload as any).id;

      if (saved?.id) {
        const { error } = await supabase.from("upsell_config").update(payload).eq("id", saved.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("upsell_config").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["upsell-config", lojaId, tipo] });
      toast({ title: "Salvo!", description: `Upsell ${label} atualizado com sucesso.` });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  const update = (key: keyof UpsellData, value: any) => setForm((p) => ({ ...p, [key]: value }));

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Form */}
      <Card className="glass glow-border">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon}
              <CardTitle className="text-base">{label}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Ativo</Label>
              <Switch checked={form.ativo} onCheckedChange={(v) => update("ativo", v)} />
            </div>
          </div>
          <CardDescription className="text-xs">
            {tipo === "nfe" ? "Exibido no e-mail de Nota Fiscal / Postado" : "Exibido no e-mail de Pedido Coletado"}
            {" · "}Custo: 0,10 moedas por e-mail
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conteúdo</h4>
            <div>
              <Label className="text-xs">Headline</Label>
              <Input value={form.headline} onChange={(e) => update("headline", e.target.value)} placeholder="Aproveite esta oferta especial!" />
            </div>
            <div>
              <Label className="text-xs">Sub Headline</Label>
              <Input value={form.sub_headline} onChange={(e) => update("sub_headline", e.target.value)} placeholder="Produto selecionado para você" />
            </div>
            <div>
              <Label className="text-xs">Nome do Produto</Label>
              <Input value={form.produto_nome} onChange={(e) => update("produto_nome", e.target.value)} placeholder="Ex: Kit Premium" />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea value={form.produto_descricao} onChange={(e) => update("produto_descricao", e.target.value)} placeholder="Breve descrição do produto" className="min-h-[60px]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Valor</Label>
                <Input value={form.produto_valor} onChange={(e) => update("produto_valor", e.target.value)} placeholder="R$ 49,90" />
              </div>
              <div>
                <Label className="text-xs">Texto do Botão</Label>
                <Input value={form.botao_texto} onChange={(e) => update("botao_texto", e.target.value)} placeholder="Comprar Agora" />
              </div>
            </div>
            <div>
              <Label className="text-xs">URL da Imagem do Produto</Label>
              <Input value={form.produto_imagem_url} onChange={(e) => update("produto_imagem_url", e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label className="text-xs">URL do Botão (link de destino)</Label>
              <Input value={form.botao_url} onChange={(e) => update("botao_url", e.target.value)} placeholder="https://sua-oferta.com" />
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-border/30">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cores</h4>
            <div className="grid grid-cols-2 gap-3">
              <ColorField label="Headline" value={form.cor_headline} onChange={(v) => update("cor_headline", v)} />
              <ColorField label="Sub Headline" value={form.cor_sub_headline} onChange={(v) => update("cor_sub_headline", v)} />
              <ColorField label="Nome Produto" value={form.cor_nome_produto} onChange={(v) => update("cor_nome_produto", v)} />
              <ColorField label="Descrição" value={form.cor_descricao} onChange={(v) => update("cor_descricao", v)} />
              <ColorField label="Valor" value={form.cor_valor} onChange={(v) => update("cor_valor", v)} />
              <ColorField label="Fundo da Seção" value={form.cor_fundo} onChange={(v) => update("cor_fundo", v)} />
              <ColorField label="Botão (fundo)" value={form.cor_botao_bg} onChange={(v) => update("cor_botao_bg", v)} />
              <ColorField label="Botão (texto)" value={form.cor_botao_texto} onChange={(v) => update("cor_botao_texto", v)} />
            </div>
          </div>

          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="w-full gap-2">
            <Save className="h-4 w-4" />
            {mutation.isPending ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="glass glow-border">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Preview Completo do E-mail</CardTitle>
          </div>
          <CardDescription className="text-xs">
            {form.ativo ? "E-mail com bloco de upsell ativo" : "E-mail sem upsell (desativado)"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl overflow-hidden border border-border/30">
            <FullEmailPreview data={form} tipo={tipo} empresaNome={empresaNome} empresaLogo={empresaLogo} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Upsell() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl glass glow-border">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Upsell nos E-mails</h1>
          <p className="text-sm text-muted-foreground">Promova produtos adicionais nos e-mails enviados aos seus clientes</p>
        </div>
      </div>

      <Tabs defaultValue="nfe" className="w-full">
        <TabsList className="glass">
          <TabsTrigger value="nfe" className="gap-2">
            <FileText className="h-4 w-4" />
            Nota Fiscal
          </TabsTrigger>
          <TabsTrigger value="coletado" className="gap-2">
            <Package className="h-4 w-4" />
            Pedido Coletado
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nfe" className="mt-4">
          <UpsellForm tipo="nfe" label="Upsell na Nota Fiscal" icon={<FileText className="h-4 w-4 text-primary" />} />
        </TabsContent>

        <TabsContent value="coletado" className="mt-4">
          <UpsellForm tipo="coletado" label="Upsell no Pedido Coletado" icon={<Package className="h-4 w-4 text-primary" />} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
