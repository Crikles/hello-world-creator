import { useEffect, useState, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Building2, MapPin, ImagePlus, Trash2, RotateCcw, Upload, Download, Maximize2, Loader2 } from "lucide-react";
import { fetchCep } from "@/lib/cep-utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DanfePreview, buildDanfeHtml, getDanfeCssAndBody } from "@/components/danfe/DanfePreview";
import { useLoja } from "@/contexts/LojaContext";

const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export default function Empresa() {
  const queryClient = useQueryClient();
  const { loja } = useLoja();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const [danfeOpen, setDanfeOpen] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);

  const handleCepBlur = async () => {
    if (!form.cep || form.cep.replace(/\D/g, "").length !== 8) return;
    setBuscandoCep(true);
    const result = await fetchCep(form.cep);
    setBuscandoCep(false);
    if (result) {
      setForm((prev) => ({
        ...prev,
        endereco: result.logradouro || prev.endereco,
        bairro: result.bairro || prev.bairro,
        cidade: result.localidade || prev.cidade,
        estado: result.uf || prev.estado,
      }));
      toast.success("Endereço preenchido pelo CEP!");
    }
  };

  const [form, setForm] = useState({
    razao_social: "",
    nome_fantasia: "",
    cnpj: "",
    inscricao_estadual: "",
    email: "",
    endereco: "",
    numero: "",
    bairro: "",
    cidade: "",
    estado: "",
    cep: "",
    complemento: "",
    telefone: "",
  });

  const { data: empresa } = useQuery({
    queryKey: ["empresa", loja?.id],
    queryFn: async () => {
      if (!loja) return null;
      const { data, error } = await supabase.from("empresas").select("*").eq("loja_id", loja.id).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!loja,
  });

  useEffect(() => {
    if (empresa) {
      setForm({
        razao_social: empresa.razao_social || "",
        nome_fantasia: empresa.nome_fantasia || "",
        cnpj: empresa.cnpj || "",
        inscricao_estadual: empresa.inscricao_estadual || "",
        email: empresa.email || "",
        endereco: empresa.endereco || "",
        numero: empresa.numero || "",
        bairro: empresa.bairro || "",
        cidade: empresa.cidade || "",
        estado: empresa.estado || "",
        cep: empresa.cep || "",
        complemento: empresa.complemento || "",
        telefone: empresa.telefone || "",
      });
      if (empresa.logo_url) setLogoPreview(empresa.logo_url);
    }
  }, [empresa]);

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return empresa?.logo_url || null;
    const ext = logoFile.name.split(".").pop();
    const path = `logo_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("logos").upload(path, logoFile, { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const logo_url = await uploadLogo();
      const payload = { ...form, logo_url, loja_id: loja?.id } as any;
      if (empresa) {
        const { error } = await supabase.from("empresas").update(payload).eq("id", empresa.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("empresas").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresa"] });
      setLogoFile(null);
      toast.success("Configuração salva com sucesso!");
    },
    onError: () => toast.error("Erro ao salvar dados."),
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 2MB.");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleRemoveLogo = async () => {
    setLogoPreview(null);
    setLogoFile(null);
    if (empresa) {
      await supabase.from("empresas").update({ logo_url: null } as any).eq("id", empresa.id);
      queryClient.invalidateQueries({ queryKey: ["empresa"] });
      toast.success("Logo removida.");
    }
  };

  const handleClear = () => {
    setForm({
      razao_social: "", nome_fantasia: "", cnpj: "", inscricao_estadual: "", email: "",
      endereco: "", numero: "", bairro: "", cidade: "", estado: "", cep: "", complemento: "", telefone: "",
    });
    setLogoPreview(null);
    setLogoFile(null);
  };

  const handleDownloadPdf = async () => {
    const { css, body } = getDanfeCssAndBody(form, {
      cliente_nome: "Cliente Exemplo",
      cliente_cpf: "000.000.000-00",
      cliente_endereco: "Rua Exemplo",
      cliente_numero: "123",
      cliente_bairro: "Centro",
      cliente_cidade: "São Paulo",
      cliente_estado: "SP",
      cliente_cep: "00000-000",
      produto: "Produto Exemplo",
      quantidade: 1,
      valor: 0,
      cfop: "5102",
      ncm_sh: "00000000",
      unidade: "UN",
    });

    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:700px;overflow:visible;';
    container.innerHTML = `<style>${css}</style>${body}`;
    document.body.appendChild(container);

    // Style is already black, no override needed

    // Wait for layout to fully compute before capturing
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 100);
        });
      });
    });

    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(container, {
      scale: 2, useCORS: true, backgroundColor: '#fff',
      width: 700, windowWidth: 700,
      height: container.scrollHeight,
    });

    const { default: jsPDF } = await import("jspdf");
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();
    const ratio = canvas.width / canvas.height;
    let w = pdfW, h = pdfW / ratio;
    if (h > pdfH) { h = pdfH; w = pdfH * ratio; }
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
    const part1 = Math.floor(Math.random() * 9000000000 + 1000000000).toString();
    pdf.save(`DANFE_${part1}.pdf`);

    document.body.removeChild(container);
  };

  const danfeHtml = buildDanfeHtml(form, {
    cliente_nome: "Cliente Exemplo",
    cliente_cpf: "000.000.000-00",
    cliente_endereco: "Rua Exemplo",
    cliente_numero: "123",
    cliente_bairro: "Centro",
    cliente_cidade: "São Paulo",
    cliente_estado: "SP",
    cliente_cep: "00000-000",
    produto: "Produto Exemplo",
    quantidade: 1,
    valor: 0,
    cfop: "5102",
    ncm_sh: "00000000",
    unidade: "UN",
  });

  // Debounce: only update iframe 300ms after last keystroke
  const [debouncedHtml, setDebouncedHtml] = useState(danfeHtml);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedHtml(danfeHtml), 300);
    return () => clearTimeout(timer);
  }, [danfeHtml]);

  // Write to iframe without refresh
  useEffect(() => {
    const iframe = previewIframeRef.current;
    if (!iframe?.contentWindow) return;
    try {
      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(debouncedHtml);
      doc.close();
    } catch (e) {
      // fallback
    }
  }, [debouncedHtml, iframeReady]);

  return (
    <AppLayout title="Dados da Empresa">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT COLUMN - Form */}
        <div className="lg:col-span-7 space-y-3">
          {/* Header */}
          <div className="rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-5 border border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">Configuração Fiscal</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Dados que aparecerão na sua Nota Fiscal Eletrônica
                </p>
              </div>
              <Badge className="bg-primary/15 text-primary border-primary/30 hover:bg-primary/20">
                🇧🇷 Nacional
              </Badge>
            </div>
          </div>

          {/* Logo Card */}
          <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <ImagePlus className="h-4 w-4 text-primary" />
                </div>
                Logo da Empresa
              </CardTitle>
              <CardDescription>PNG, JPG ou WEBP — máximo 2MB</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                {logoPreview ? (
                  <div className="relative group">
                    <img src={logoPreview} alt="Logo" className="w-24 h-24 object-contain rounded-lg border-2 border-primary/30 bg-card p-1" />
                    <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={handleRemoveLogo}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-24 h-24 rounded-lg border-2 border-dashed border-primary/30 bg-accent/50 hover:bg-accent hover:border-primary/50 transition-all flex flex-col items-center justify-center gap-1 text-primary cursor-pointer"
                  >
                    <Upload className="h-5 w-5" />
                    <span className="text-[10px] font-medium">Upload</span>
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoSelect} />
              </div>
            </CardContent>
          </Card>

          {/* Company Data Card */}
          <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                Dados Fiscais
              </CardTitle>
              <CardDescription>Informações fiscais para emissão de NFE</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">Razão Social *</Label>
                  <Input className="bg-muted/30 focus:bg-background" value={form.razao_social} onChange={(e) => handleChange("razao_social", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Nome Fantasia</Label>
                  <Input className="bg-muted/30 focus:bg-background" value={form.nome_fantasia} onChange={(e) => handleChange("nome_fantasia", e.target.value)} placeholder="Opcional" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">CNPJ *</Label>
                  <Input className="bg-muted/30 focus:bg-background" value={form.cnpj} onChange={(e) => handleChange("cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Inscrição Estadual</Label>
                  <Input className="bg-muted/30 focus:bg-background" value={form.inscricao_estadual} onChange={(e) => handleChange("inscricao_estadual", e.target.value)} placeholder="Opcional" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Email de Contato</Label>
                  <Input className="bg-muted/30 focus:bg-background" type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} placeholder="Opcional" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Telefone</Label>
                  <Input className="bg-muted/30 focus:bg-background" value={form.telefone} onChange={(e) => handleChange("telefone", e.target.value)} placeholder="(00) 00000-0000" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Address Card */}
          <Card className="border-l-4 border-l-primary/60 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                Endereço da Empresa
              </CardTitle>
              <CardDescription>Endereço completo para a NFE</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">Endereço (Rua) *</Label>
                  <Input className="bg-muted/30 focus:bg-background" value={form.endereco} onChange={(e) => handleChange("endereco", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Número *</Label>
                  <Input className="bg-muted/30 focus:bg-background" value={form.numero} onChange={(e) => handleChange("numero", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Bairro *</Label>
                  <Input className="bg-muted/30 focus:bg-background" value={form.bairro} onChange={(e) => handleChange("bairro", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Cidade *</Label>
                  <Input className="bg-muted/30 focus:bg-background" value={form.cidade} onChange={(e) => handleChange("cidade", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Estado *</Label>
                  <Select value={form.estado} onValueChange={(v) => handleChange("estado", v)}>
                    <SelectTrigger className="bg-muted/30 focus:bg-background"><SelectValue placeholder="UF" /></SelectTrigger>
                    <SelectContent>
                      {UF_OPTIONS.map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">CEP *</Label>
                  <div className="relative">
                    <Input className="bg-muted/30 focus:bg-background" value={form.cep} onChange={(e) => handleChange("cep", e.target.value)} onBlur={handleCepBlur} placeholder="00000-000" />
                    {buscandoCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">Complemento</Label>
                  <Input className="bg-muted/30 focus:bg-background" value={form.complemento} onChange={(e) => handleChange("complemento", e.target.value)} placeholder="Opcional" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-3 pb-6">
            <Button variant="outline" onClick={handleClear}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Limpar
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.razao_social || !form.cnpj || saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? "Salvando..." : "Salvar Configuração"}
            </Button>
          </div>
        </div>

        {/* RIGHT COLUMN - DANFE Preview */}
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-4 space-y-3">
            <Card className="shadow-lg border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Nota Fiscal (Preview)</CardTitle>
                  <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] px-2 py-0.5">
                    ● Tempo Real
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Atualiza conforme você preenche o formulário. O preview abaixo mostra exatamente como será gerado o PDF.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-2">
                <div className="rounded-lg border border-border/60 bg-card overflow-hidden" style={{ height: 720 }}>
                  <div style={{ transform: "scale(0.62)", transformOrigin: "top left", width: "161.3%", height: "161.3%" }}>
                    <iframe
                      ref={previewIframeRef}
                      title="DANFE Preview"
                      onLoad={() => setIframeReady(true)}
                      style={{ width: "100%", height: 1300, border: "none", background: "#fff" }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDanfeOpen(true)}>
                <Maximize2 className="h-4 w-4 mr-2" />
                Tela Cheia
              </Button>
              <Button className="flex-1" onClick={handleDownloadPdf}>
                <Download className="h-4 w-4 mr-2" />
                Baixar PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      <DanfePreview open={danfeOpen} onOpenChange={setDanfeOpen} empresa={form} />
    </AppLayout>
  );
}
