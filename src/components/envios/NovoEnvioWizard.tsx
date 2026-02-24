import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLoja } from "@/contexts/LojaContext";
import { triggerShipmentEmail } from "@/lib/email-trigger";
import { fetchCep } from "@/lib/cep-utils";
import { Loader2 } from "lucide-react";

const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const steps = ["Dados do Cliente", "Endereço de Entrega", "Produto & Fiscal"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NovoEnvioWizard({ open, onOpenChange }: Props) {
  const [step, setStep] = useState(0);
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    cliente_nome: "",
    cliente_cpf: "",
    cliente_email: "",
    cliente_telefone: "",
    cliente_cep: "",
    cliente_endereco: "",
    cliente_numero: "",
    cliente_bairro: "",
    cliente_cidade: "",
    cliente_estado: "",
    cliente_complemento: "",
    produto: "",
    quantidade: "1",
    valor: "",
    cfop: "",
    ncm_sh: "",
    cst: "",
    unidade: "UN",
  });

  const { loja } = useLoja();
  const [buscandoCep, setBuscandoCep] = useState(false);

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const handleCepBlur = useCallback(async () => {
    if (!form.cliente_cep || form.cliente_cep.replace(/\D/g, "").length !== 8) return;
    setBuscandoCep(true);
    const result = await fetchCep(form.cliente_cep);
    setBuscandoCep(false);
    if (result) {
      setForm((f) => ({
        ...f,
        cliente_endereco: result.logradouro || f.cliente_endereco,
        cliente_bairro: result.bairro || f.cliente_bairro,
        cliente_cidade: result.localidade || f.cliente_cidade,
        cliente_estado: result.uf || f.cliente_estado,
      }));
      toast.success("Endereço preenchido pelo CEP!");
    }
  }, [form.cliente_cep]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!loja?.id) throw new Error("Loja não selecionada");

      // Buscar a empresa vinculada a esta loja
      const { data: empresa } = await supabase
        .from("empresas")
        .select("*")
        .eq("loja_id", loja.id)
        .maybeSingle();

      const { data: newEnvio, error } = await supabase.from("envios").insert({
        loja_id: loja.id,
        empresa_id: empresa?.id || null,
        cliente_nome: form.cliente_nome,
        cliente_email: form.cliente_email,
        cliente_cpf: form.cliente_cpf || null,
        cliente_telefone: form.cliente_telefone || null,
        cliente_cep: form.cliente_cep || null,
        cliente_endereco: form.cliente_endereco || null,
        cliente_numero: form.cliente_numero || null,
        cliente_bairro: form.cliente_bairro || null,
        cliente_cidade: form.cliente_cidade || null,
        cliente_estado: form.cliente_estado || null,
        cliente_complemento: form.cliente_complemento || null,
        produto: form.produto,
        valor: parseFloat(form.valor) || 0,
        quantidade: parseInt(form.quantidade) || 1,
        cfop: form.cfop || null,
        ncm_sh: form.ncm_sh || null,
        cst: form.cst || null,
        unidade: form.unidade || "UN",
        status: "pendente"
      } as any).select().single();

      if (error) throw error;

      // Email será disparado apenas quando o usuário avançar o status manualmente
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["envios"] });
      resetAndClose();
      toast.success("Pedido salvo com sucesso!");
    },
    onError: (error: any) => {
      console.error("Erro ao salvar envio:", error);
      toast.error(error.message || "Erro ao salvar pedido.");
    },
  });

  const resetAndClose = () => {
    setStep(0);
    setForm({
      cliente_nome: "", cliente_cpf: "", cliente_email: "", cliente_telefone: "",
      cliente_cep: "", cliente_endereco: "", cliente_numero: "", cliente_bairro: "",
      cliente_cidade: "", cliente_estado: "", cliente_complemento: "",
      produto: "", quantidade: "1", valor: "", cfop: "", ncm_sh: "", cst: "", unidade: "UN",
    });
    onOpenChange(false);
  };

  const canNext = () => {
    if (step === 0) return !!form.cliente_nome && !!form.cliente_email;
    if (step === 1) return !!form.cliente_cep && !!form.cliente_endereco && !!form.cliente_cidade && !!form.cliente_estado;
    return !!form.produto && !!form.valor;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Envio</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${i <= step
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
                  }`}
              >
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-8 h-0.5 ${i < step ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>
        <p className="text-center text-sm font-medium text-foreground">{steps[step]}</p>

        {/* Step 1 */}
        {step === 0 && (
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome *</Label>
                <Input value={form.cliente_nome} onChange={(e) => set("cliente_nome", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CPF</Label>
                <Input value={form.cliente_cpf} onChange={(e) => set("cliente_cpf", e.target.value)} placeholder="Opcional" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Email *</Label>
                <Input type="email" value={form.cliente_email} onChange={(e) => set("cliente_email", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telefone</Label>
                <Input value={form.cliente_telefone} onChange={(e) => set("cliente_telefone", e.target.value)} placeholder="Opcional" />
              </div>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 1 && (
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">CEP *</Label>
                <div className="relative">
                  <Input value={form.cliente_cep} onChange={(e) => set("cliente_cep", e.target.value)} onBlur={handleCepBlur} />
                  {buscandoCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Endereço *</Label>
                <Input value={form.cliente_endereco} onChange={(e) => set("cliente_endereco", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Número *</Label>
                <Input value={form.cliente_numero} onChange={(e) => set("cliente_numero", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bairro *</Label>
                <Input value={form.cliente_bairro} onChange={(e) => set("cliente_bairro", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Complemento</Label>
                <Input value={form.cliente_complemento} onChange={(e) => set("cliente_complemento", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cidade *</Label>
                <Input value={form.cliente_cidade} onChange={(e) => set("cliente_cidade", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">UF *</Label>
                <Select value={form.cliente_estado} onValueChange={(v) => set("cliente_estado", v)}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    {UF_OPTIONS.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 2 && (
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Produto *</Label>
                <Input value={form.produto} onChange={(e) => set("produto", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Qtd</Label>
                <Input type="number" min="1" value={form.quantidade} onChange={(e) => set("quantidade", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Preço (R$) *</Label>
                <Input type="number" step="0.01" value={form.valor} onChange={(e) => set("valor", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unidade</Label>
                <Input value={form.unidade} onChange={(e) => set("unidade", e.target.value)} />
              </div>
            </div>

            <div className="border-t pt-3 mt-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Dados Fiscais (DANFE)</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">CFOP</Label>
                  <Input value={form.cfop} onChange={(e) => set("cfop", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">NCM/SH</Label>
                  <Input value={form.ncm_sh} onChange={(e) => set("ncm_sh", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CST</Label>
                  <Input value={form.cst} onChange={(e) => set("cst", e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={() => (step === 0 ? onOpenChange(false) : setStep(step - 1))}>
            {step === 0 ? "Cancelar" : "Voltar"}
          </Button>
          {step < 2 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
              Próximo
            </Button>
          ) : (
            <Button onClick={() => createMutation.mutate()} disabled={!canNext() || createMutation.isPending}>
              {createMutation.isPending ? "Salvando..." : "Salvar Pedido"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
