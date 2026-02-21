import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Empresa() {
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    razao_social: "",
    cnpj: "",
    inscricao_estadual: "",
    endereco: "",
    cidade: "",
    estado: "",
    cep: "",
    telefone: "",
    email: "",
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
        cnpj: empresa.cnpj || "",
        inscricao_estadual: empresa.inscricao_estadual || "",
        endereco: empresa.endereco || "",
        cidade: empresa.cidade || "",
        estado: empresa.estado || "",
        cep: empresa.cep || "",
        telefone: empresa.telefone || "",
        email: empresa.email || "",
      });
    }
  }, [empresa]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (empresa) {
        const { error } = await supabase.from("empresas").update(form).eq("id", empresa.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("empresas").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresa"] });
      toast.success("Dados da empresa salvos!");
    },
    onError: () => toast.error("Erro ao salvar dados."),
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <AppLayout title="Dados da Empresa">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Informações Fiscais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Razão Social</Label>
                <Input value={form.razao_social} onChange={(e) => handleChange("razao_social", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input value={form.cnpj} onChange={(e) => handleChange("cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
              </div>
              <div className="space-y-2">
                <Label>Inscrição Estadual</Label>
                <Input value={form.inscricao_estadual} onChange={(e) => handleChange("inscricao_estadual", e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Endereço</Label>
                <Input value={form.endereco} onChange={(e) => handleChange("endereco", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={form.cidade} onChange={(e) => handleChange("cidade", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Input value={form.estado} onChange={(e) => handleChange("estado", e.target.value)} placeholder="SP" />
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input value={form.cep} onChange={(e) => handleChange("cep", e.target.value)} placeholder="00000-000" />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => handleChange("telefone", e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} />
              </div>
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.razao_social || !form.cnpj || saveMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? "Salvando..." : "Salvar Dados"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
