import { useEffect, useState, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Building2, MapPin, ImagePlus, Trash2, Eye, RotateCcw, Upload } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DanfePreview } from "@/components/danfe/DanfePreview";

const UF_OPTIONS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export default function Empresa() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [danfeOpen, setDanfeOpen] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

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
    queryKey: ["empresa"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (empresa) {
      setForm({
        razao_social: empresa.razao_social || "",
        nome_fantasia: (empresa as any).nome_fantasia || "",
        cnpj: empresa.cnpj || "",
        inscricao_estadual: empresa.inscricao_estadual || "",
        email: empresa.email || "",
        endereco: empresa.endereco || "",
        numero: (empresa as any).numero || "",
        bairro: (empresa as any).bairro || "",
        cidade: empresa.cidade || "",
        estado: empresa.estado || "",
        cep: empresa.cep || "",
        complemento: (empresa as any).complemento || "",
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
      const payload = { ...form, logo_url } as any;
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

  return (
    <AppLayout title="Dados da Empresa">
      <div className="max-w-3xl space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Configure os dados que aparecerão na Nota Fiscal.</p>
          <Badge variant="secondary" className="text-xs">🇧🇷 Nacional (BR)</Badge>
        </div>

        {/* Section 1: Logo */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ImagePlus className="h-4 w-4" />
              Logo da Empresa
            </CardTitle>
            <CardDescription>PNG, JPG ou WEBP — máximo 2MB</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo" className="w-24 h-24 object-contain rounded-md border border-border" />
              ) : (
                <div className="w-24 h-24 bg-muted rounded-md flex items-center justify-center text-muted-foreground text-xs">
                  Sem logo
                </div>
              )}
              <div className="flex flex-col gap-2">
                <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoSelect} />
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-3 w-3 mr-2" />
                  {logoPreview ? "Alterar Logo" : "Enviar Logo"}
                </Button>
                {logoPreview && (
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={handleRemoveLogo}>
                    <Trash2 className="h-3 w-3 mr-2" />
                    Remover
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Company Data */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Dados da Empresa
            </CardTitle>
            <CardDescription>Informações fiscais para emissão de NFE</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Razão Social *</Label>
                <Input value={form.razao_social} onChange={(e) => handleChange("razao_social", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nome Fantasia</Label>
                <Input value={form.nome_fantasia} onChange={(e) => handleChange("nome_fantasia", e.target.value)} placeholder="Opcional" />
              </div>
              <div className="space-y-2">
                <Label>CNPJ *</Label>
                <Input value={form.cnpj} onChange={(e) => handleChange("cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
              </div>
              <div className="space-y-2">
                <Label>Inscrição Estadual</Label>
                <Input value={form.inscricao_estadual} onChange={(e) => handleChange("inscricao_estadual", e.target.value)} placeholder="Opcional" />
              </div>
              <div className="space-y-2">
                <Label>Email de Contato</Label>
                <Input type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} placeholder="Opcional" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Address */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Endereço da Empresa
            </CardTitle>
            <CardDescription>Endereço completo para a NFE</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Endereço (Rua) *</Label>
                <Input value={form.endereco} onChange={(e) => handleChange("endereco", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Número *</Label>
                <Input value={form.numero} onChange={(e) => handleChange("numero", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Bairro *</Label>
                <Input value={form.bairro} onChange={(e) => handleChange("bairro", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cidade *</Label>
                <Input value={form.cidade} onChange={(e) => handleChange("cidade", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Estado *</Label>
                <Select value={form.estado} onValueChange={(v) => handleChange("estado", v)}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    {UF_OPTIONS.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>CEP *</Label>
                <Input value={form.cep} onChange={(e) => handleChange("cep", e.target.value)} placeholder="00000-000" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Complemento</Label>
                <Input value={form.complemento} onChange={(e) => handleChange("complemento", e.target.value)} placeholder="Opcional" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-end gap-3 pb-6">
          <Button variant="outline" onClick={handleClear}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Limpar Dados
          </Button>
          <Button variant="outline" onClick={() => setDanfeOpen(true)}>
            <Eye className="h-4 w-4 mr-2" />
            Pré-visualizar NFE
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!form.razao_social || !form.cnpj || saveMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </div>
      </div>

      <DanfePreview open={danfeOpen} onOpenChange={setDanfeOpen} empresa={form} />
    </AppLayout>
  );
}
