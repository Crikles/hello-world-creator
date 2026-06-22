import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Plus, Search, Truck, Trash2, Play, FastForward, Package, Clock, Navigation, CheckCircle2, Calendar, ExternalLink, FileText, CreditCard, Square, Zap, PackageX, ChevronLeft, ChevronRight, Download, FileSpreadsheet, PackageCheck } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import * as XLSX from "xlsx";
import { ImportarPlanilha } from "@/components/envios/ImportarPlanilha";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { toast } from "sonner";
import { getTrackingBaseUrl, getTrackingUrl, resolveMarca } from "@/lib/tracking-url";
import { BloqueioCobrancaBanner } from "@/components/BloqueioCobrancaBanner";
import { format, startOfDay, endOfDay } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { NovoEnvioWizard } from "@/components/envios/NovoEnvioWizard";
import { triggerNextEmail, InsufficientBalanceError } from "@/lib/email-trigger";
import { generateDanfePdfBase64 } from "@/lib/nfe-utils";
import { useBatchProgress } from "@/contexts/BatchProgressContext";
import type { EmpresaData, EnvioData } from "@/components/danfe/DanfePreview";

import { formatProduto } from "@/lib/format-produto";

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200, 300, 400, 500, 700, 800];

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  coletado: "Coletado",
  em_transito: "Em Trânsito",
  centro_local: "Centro Local",
  saiu_para_entrega: "Saiu p/ Entrega",
  entregue: "Entregue",
  taxacao: "Taxação",
  pagamento_confirmado: "Pgto. Confirmado",
  // status_label based
  "Pendente": "Pendente",
  "Postado": "Postado (NF-e)",
  "Coletado": "Coletado",
  "Em Trânsito": "Em Trânsito",
  "Centro Local": "Centro Local",
  "Taxação": "Taxação",
  "Pgto. Confirmado": "Pgto. Confirmado",
  "Saiu para Entrega": "Saiu p/ Entrega",
  "Falha Entrega": "Falha Entrega",
  "Reenvio Pago": "Reenvio Pago",
  "Reenvio Saiu": "Reenvio Saiu",
  "Entregue": "Entregue",
};

const statusColors: Record<string, string> = {
  pendente: "bg-primary/20 text-primary",
  coletado: "bg-accent text-accent-foreground",
  em_transito: "bg-accent text-accent-foreground",
  centro_local: "bg-primary/25 text-primary",
  saiu_para_entrega: "bg-primary/30 text-primary",
  entregue: "bg-primary/15 text-primary",
  taxacao: "bg-destructive/20 text-destructive",
  pagamento_confirmado: "bg-primary/20 text-primary",
  // status_label based
  "Pendente": "bg-primary/20 text-primary",
  "Postado": "bg-accent text-accent-foreground",
  "Coletado": "bg-accent text-accent-foreground",
  "Em Trânsito": "bg-accent text-accent-foreground",
  "Centro Local": "bg-primary/25 text-primary",
  "Taxação": "bg-destructive/20 text-destructive",
  "Pgto. Confirmado": "bg-primary/20 text-primary",
  "Saiu para Entrega": "bg-primary/30 text-primary",
  "Falha Entrega": "bg-destructive/20 text-destructive",
  "Reenvio Pago": "bg-primary/20 text-primary",
  "Reenvio Saiu": "bg-accent text-accent-foreground",
  "Entregue": "bg-primary/15 text-primary",
};

// Os values batem 1:1 com `envios.status` (enum) ou `envios.status_label` (texto).
// A RPC get_envios_paginated aceita ambos via `OR e.status::text=p_status OR e.status_label=p_status`.
const statusOptions: { value: string; label: string; group?: string }[] = [
  // Status internos (enum)
  { value: "pendente", label: "Pendente", group: "Status" },
  { value: "coletado", label: "Coletado", group: "Status" },
  { value: "em_transito", label: "Em Trânsito", group: "Status" },
  { value: "centro_local", label: "Centro Local", group: "Status" },
  { value: "saiu_para_entrega", label: "Saiu para Entrega", group: "Status" },
  { value: "entregue", label: "Entregue", group: "Status" },
  { value: "taxacao", label: "Taxação", group: "Status" },
  { value: "pagamento_confirmado", label: "Pgto. Confirmado", group: "Status" },

  // Etapas detalhadas (status_label)
  { value: "NF-e", label: "NF-e Emitida", group: "Etapa" },
  { value: "Postado", label: "Postado", group: "Etapa" },
  { value: "Postado no exterior", label: "Postado no exterior", group: "Etapa" },
  { value: "Coletado", label: "Coletado (etapa)", group: "Etapa" },
  { value: "Saiu da unidade de origem", label: "Saiu da unidade de origem", group: "Etapa" },
  { value: "Em Trânsito", label: "Em Trânsito (etapa)", group: "Etapa" },
  { value: "Em trânsito internacional", label: "Em trânsito internacional", group: "Etapa" },
  { value: "Chegou ao Brasil", label: "Chegou ao Brasil", group: "Etapa" },
  { value: "Liberado pela alfândega", label: "Liberado pela alfândega", group: "Etapa" },
  { value: "Passando por centro de triagem", label: "Passando por centro de triagem", group: "Etapa" },
  { value: "Chegou ao estado vizinho", label: "Chegou ao estado vizinho", group: "Etapa" },
  { value: "Em redistribuição", label: "Em redistribuição", group: "Etapa" },
  { value: "Retornou ao centro de distribuição", label: "Retornou ao centro de distribuição", group: "Etapa" },
  { value: "Centro de Distribuição", label: "Centro de Distribuição", group: "Etapa" },
  { value: "Chegou no centro local", label: "Chegou no centro local", group: "Etapa" },
  { value: "Chegou perto de você", label: "Chegou perto de você", group: "Etapa" },
  { value: "Unidade final", label: "Unidade final", group: "Etapa" },
  { value: "Entrega reprogramada", label: "Entrega reprogramada", group: "Etapa" },
  { value: "Em rota", label: "Em rota", group: "Etapa" },
  { value: "Em rota final", label: "Em rota final", group: "Etapa" },
  { value: "Saiu para Entrega", label: "Saiu para Entrega (etapa)", group: "Etapa" },
  { value: "Saiu para Entrega (2ª tentativa)", label: "Saiu para Entrega (2ª tent.)", group: "Etapa" },
  { value: "Saiu para Entrega (reenvio)", label: "Saiu para Entrega (reenvio)", group: "Etapa" },
  { value: "Retido na alfândega — pagamento necessário", label: "Retido na alfândega (taxa)", group: "Etapa" },
  { value: "Falha na entrega — pagar reenvio", label: "Falha na entrega (reenvio)", group: "Etapa" },
  { value: "Pagamento da taxa confirmado", label: "Taxa paga", group: "Etapa" },
  { value: "Reenvio pago", label: "Reenvio pago", group: "Etapa" },
  { value: "Entregue ✅", label: "Entregue (etapa)", group: "Etapa" },
];

export default function Envios() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterMetodo, setFilterMetodo] = useState<string>("todos");
  const [filterOrigem, setFilterOrigem] = useState<string>("todos");
  const [autoEnvio, setAutoEnvio] = useState(false);
  const [autoEnvioLoading, setAutoEnvioLoading] = useState(false);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [batchCooldown, setBatchCooldown] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedIdsRef = useRef<Set<string>>(selectedIds);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [batchConfirm, setBatchConfirm] = useState<{ type: "avancar" | "forcar"; count: number; label: string } | null>(null);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [, setTick] = useState(0);
  const queryClient = useQueryClient();
  const { loja } = useLoja();
  const [downloadingNfe, setDownloadingNfe] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('envios_per_page');
    return saved ? Number(saved) : 20;
  });

  const isJadlog = useCallback((envio: { transportadora?: string | null; codigo_rastreio?: string | null }) => {
    if (envio.transportadora) {
      return envio.transportadora.toUpperCase().includes('JADLOG');
    }
    if (envio.codigo_rastreio) {
      return envio.codigo_rastreio.toUpperCase().endsWith('JD');
    }
    return false;
  }, []);

  const isVetor = useCallback((envio: { transportadora?: string | null; codigo_rastreio?: string | null }) => {
    if (envio.transportadora) {
      return envio.transportadora.toUpperCase().includes('VETOR');
    }
    if (envio.codigo_rastreio) {
      return envio.codigo_rastreio.toUpperCase().endsWith('VT');
    }
    return false;
  }, []);

  const isAtlas = useCallback((envio: { transportadora?: string | null; codigo_rastreio?: string | null }) => {
    if (envio.transportadora) {
      return envio.transportadora.toUpperCase().includes('ATLAS');
    }
    if (envio.codigo_rastreio) {
      return envio.codigo_rastreio.toUpperCase().endsWith('AT');
    }
    return false;
  }, []);

  const getTrackingDomain = useCallback((envio: { transportadora?: string | null; codigo_rastreio?: string | null; marca?: string | null; is_international?: boolean | null; global_flow_lang?: string | null }) => {
    const marca = resolveMarca({
      marca: envio.marca,
      is_international: envio.is_international,
      global_flow_lang: envio.global_flow_lang,
      codigo_rastreio: envio.codigo_rastreio,
    });
    return getTrackingBaseUrl(marca).replace(/^https?:\/\//, "");
  }, []);

  // Batch advance state (global context)
  const { progress: batchProgress, cancelRef: batchCancelRef, startBatch, updateProgress, finishBatch, cancelBatch, interruptibleSleep, checkCancelled } = useBatchProgress();

  const handleDownloadNfe = useCallback(async (envio: any) => {
    if (!loja?.id) return;
    setDownloadingNfe(envio.id);
    try {
      const { data: empresa } = await supabase
        .from("empresas")
        .select("*")
        .eq("loja_id", loja.id)
        .maybeSingle();

      const empresaData: EmpresaData = empresa || {
        razao_social: "Empresa",
        cnpj: "00.000.000/0000-00",
      };

      const envioData: EnvioData = {
        cliente_nome: envio.cliente_nome,
        cliente_cpf: envio.cliente_cpf,
        cliente_endereco: envio.cliente_endereco,
        cliente_numero: envio.cliente_numero,
        cliente_bairro: envio.cliente_bairro,
        cliente_cidade: envio.cliente_cidade,
        cliente_estado: envio.cliente_estado,
        cliente_cep: envio.cliente_cep,
        cliente_telefone: envio.cliente_telefone,
        produto: envio.produto,
        quantidade: envio.quantidade,
        valor: envio.valor,
        cfop: envio.cfop,
        ncm_sh: envio.ncm_sh,
        cst: envio.cst,
        unidade: envio.unidade,
      };

      const base64 = await generateDanfePdfBase64(empresaData, envioData);
      const link = document.createElement("a");
      link.href = `data:application/pdf;base64,${base64}`;
      link.download = `DANFE_${envio.cliente_nome.replace(/\s+/g, "_")}.pdf`;
      link.click();
      toast.success("DANFE baixada com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao gerar DANFE: " + (err.message || "erro desconhecido"));
    } finally {
      setDownloadingNfe(null);
    }
  }, [loja?.id]);

  // Load auto_envio from DB
  useEffect(() => {
    if (!loja?.id) return;
    const loadAutoEnvio = async () => {
      const { data } = await supabase
        .from("postagem_config")
        .select("auto_envio")
        .eq("loja_id", loja.id)
        .maybeSingle();
      if (data && data.auto_envio !== undefined) {
        setAutoEnvio(data.auto_envio ?? false);
      }
    };
    loadAutoEnvio();
  }, [loja?.id]);

  const handleToggleAutoEnvio = async (checked: boolean) => {
    if (!loja?.id) return;
    setAutoEnvioLoading(true);
    setAutoEnvio(checked);
    const { error } = await supabase
      .from("postagem_config")
      .update({ auto_envio: checked })
      .eq("loja_id", loja.id);
    setAutoEnvioLoading(false);
    if (error) {
      toast.error("Erro ao salvar configuração AUTO");
      setAutoEnvio(!checked);
    } else {
      toast.success(checked ? "AUTO ativado — funciona 24h mesmo com PC desligado" : "AUTO desativado");
    }
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Force re-render every second for countdown display
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatCooldown = (expiresAt: number) => {
    const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return `${m}m ${s.toString().padStart(2, "0")}s`;
  };

  // Stats via server-side RPC (instant counts)
  const { data: stats } = useQuery({
    queryKey: ["envios-stats", loja?.id],
    queryFn: async () => {
      if (!loja) return { total: 0, pendentes: 0, em_transito: 0, entregues: 0 };
      const { data, error } = await supabase.rpc("get_envios_stats", { p_loja_id: loja.id });
      if (error) throw error;
      return (data as any)?.[0] || { total: 0, pendentes: 0, em_transito: 0, entregues: 0 };
    },
    enabled: !!loja,
  });

  // Paginated envios via server-side RPC (with filters + pedido join)
  const { data: paginatedResult = [] } = useQuery({
    queryKey: ["envios-paginated", loja?.id, debouncedSearch, filterStatus, filterMetodo, filterOrigem, dateRange.from?.toISOString(), dateRange.to?.toISOString(), currentPage, itemsPerPage],
    queryFn: async () => {
      if (!loja) return [];
      const { data, error } = await supabase.rpc("get_envios_paginated", {
        p_loja_id: loja.id,
        p_search: debouncedSearch || '',
        p_status: filterStatus,
        p_metodo: filterMetodo,
        p_origem: filterOrigem,
        p_date_from: dateRange.from ? startOfDay(dateRange.from).toISOString() : null,
        p_date_to: dateRange.to ? endOfDay(dateRange.to).toISOString() : dateRange.from ? endOfDay(dateRange.from).toISOString() : null,
        p_page: currentPage,
        p_per_page: itemsPerPage,
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!loja,
  });

  const paginatedEnvios = paginatedResult as any[];
  const totalFilteredCount = paginatedEnvios.length > 0 ? Number(paginatedEnvios[0].total_count) : 0;
  const totalPages = Math.ceil(totalFilteredCount / itemsPerPage);

  // Derive origem/metodo maps from paginated data
  const pedidoOrigemMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const e of paginatedEnvios) {
      if (e.origem) map[e.id] = e.origem;
    }
    return map;
  }, [paginatedEnvios]);

  const pedidoMetodoMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const e of paginatedEnvios) {
      const m = e.metodo ?? e.metodo_pagamento;
      if (m) map[e.id] = m;
    }
    return map;
  }, [paginatedEnvios]);

  const getMetodoLabel = (method: string) => {
    const m = method.toLowerCase();
    if (m.includes("pix")) return "PIX";
    if (m.includes("card") || m.includes("cartao") || m.includes("cartão") || m.includes("credit")) return "Cartão";
    if (m.includes("boleto")) return "Boleto";
    return method;
  };

  const getMetodoBadgeClass = (method: string) => {
    const m = method.toLowerCase();
    if (m.includes("pix")) return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
    if (m.includes("card") || m.includes("cartao") || m.includes("cartão") || m.includes("credit")) return "bg-blue-500/15 text-blue-600 border-blue-500/30";
    if (m.includes("boleto")) return "bg-amber-500/15 text-amber-600 border-amber-500/30";
    return "bg-muted text-muted-foreground border-border/50";
  };

  const getOrigemLabel = (provider: string) => {
    const labels: Record<string, string> = {
      vega: "Vega", zedy: "Zedy", luna: "Luna", corvex: "Corvex",
      adoorei: "Adoorei", shopify: "Shopify", api_externa: "API",
    };
    return labels[provider.toLowerCase()] || provider;
  };

  // Fetch event counts per template_id for progress calculation
  const templateIdsKey = paginatedEnvios.map(e => e.postagem_template_id).filter(Boolean).join(",");
  const { data: eventCountMap = {} } = useQuery<Record<string, number>>({
    queryKey: ["event-count-map", loja?.id, templateIdsKey],
    queryFn: async () => {
      if (!loja) return {};
      const { data: config } = await supabase
        .from("postagem_config")
        .select("template_ativo_id, enviar_nfe_email")
        .eq("loja_id", loja.id)
        .maybeSingle();
      if (!config) return {};

      const templateIds = [...new Set(
        paginatedEnvios.map(e => e.postagem_template_id).filter(Boolean) as string[]
      )];
      if (config.template_ativo_id && !templateIds.includes(config.template_ativo_id)) {
        templateIds.push(config.template_ativo_id);
      }
      if (templateIds.length === 0) return {};

      const { data: eventos } = await supabase
        .from("postagem_eventos")
        .select("template_id, status_label, enviar_nfe_pdf")
        .in("template_id", templateIds);
      if (!eventos) return {};

      const map: Record<string, number> = {};
      for (const tid of templateIds) {
        const filtered = eventos.filter(e => {
          if (e.template_id !== tid) return false;
          if (!config.enviar_nfe_email && e.enviar_nfe_pdf) return false;
          return true;
        });
        map[tid] = filtered.length;
      }
      return map;
    },
    enabled: !!loja && paginatedEnvios.length > 0,
  });

  // Total de etapas do Fluxo Global (para envios internacionais)
  const { data: globalFlowCount = 0 } = useQuery({
    queryKey: ["global-flow-count", loja?.id],
    queryFn: async () => {
      if (!loja) return 0;
      const { count } = await supabase
        .from("global_flow_eventos")
        .select("id", { count: "exact", head: true })
        .eq("loja_id", loja.id);
      return count ?? 0;
    },
    enabled: !!loja,
  });

  // Realtime listener for envios updates
  useEffect(() => {
    if (!loja?.id) return;
    const channel = supabase
      .channel(`envios-realtime-${loja.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "envios", filter: `loja_id=eq.${loja.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["envios-paginated"] });
          queryClient.invalidateQueries({ queryKey: ["envios-stats"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loja?.id, queryClient]);

  // AUTO: Realtime listener that auto-starts NEW shipments (ultimo_evento_ordem = 0)
  useEffect(() => {
    if (!autoEnvio || !loja?.id) return;
    const channel = supabase
      .channel(`auto-envio-${loja.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "envios", filter: `loja_id=eq.${loja.id}` },
        async (payload) => {
          const newEnvio = payload.new as any;
          if ((newEnvio.ultimo_evento_ordem ?? 0) === 0 && newEnvio.status === "pendente") {
            // Re-check auto_envio from DB to avoid stale state across tabs
            const { data: freshConfig } = await supabase
              .from("postagem_config")
              .select("auto_envio")
              .eq("loja_id", loja.id)
              .maybeSingle();

            if (!freshConfig?.auto_envio) {
              console.log("AUTO: skipped — auto_envio disabled in DB");
              return;
            }

            console.log("AUTO: Starting new shipment", newEnvio.id);
            try {
              await triggerNextEmail(newEnvio.id, loja.id);
              queryClient.invalidateQueries({ queryKey: ["envios-paginated"] }); queryClient.invalidateQueries({ queryKey: ["envios-stats"] });
              toast.success(`Auto: envio ${newEnvio.cliente_nome} iniciado!`);
            } catch (err: any) {
              if (err instanceof InsufficientBalanceError) {
                toast.error("Auto: saldo insuficiente de moedas.");
              } else {
                console.error("AUTO trigger error:", err);
              }
            }
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [autoEnvio, loja?.id, queryClient]);

  const advanceMutation = useMutation({
    mutationFn: async (envioId: string) => {
      if (!loja?.id) throw new Error("No loja");
      const result = await triggerNextEmail(envioId, loja.id);
      if (!result) throw new Error("Nenhum evento para avançar (delay não atingido ou já finalizado)");
      return result;
    },
    onSuccess: (_data, envioId) => {
      queryClient.invalidateQueries({ queryKey: ["envios-paginated"] }); queryClient.invalidateQueries({ queryKey: ["envios-stats"] });
      setCooldowns((prev) => ({ ...prev, [envioId]: Date.now() + 120000 }));
      toast.success("Avançado!");
    },
    onError: (err: any) => {
      if (err instanceof InsufficientBalanceError) {
        toast.error("Saldo insuficiente de moedas. Adicione créditos para continuar.");
      } else {
        toast.error(err.message || "Erro ao avançar");
      }
    },
  });

  const forceAdvanceMutation = useMutation({
    mutationFn: async (envioId: string) => {
      if (!loja?.id) throw new Error("No loja");
      const result = await triggerNextEmail(envioId, loja.id, false, true);
      if (!result) throw new Error("Nenhum evento para avançar");
      return result;
    },
    onSuccess: (_data, envioId) => {
      queryClient.invalidateQueries({ queryKey: ["envios-paginated"] }); queryClient.invalidateQueries({ queryKey: ["envios-stats"] });
      setCooldowns((prev) => ({ ...prev, [envioId]: Date.now() + 120000 }));
      toast.success("Avanço forçado!");
    },
    onError: (err: any) => {
      if (err instanceof InsufficientBalanceError) {
        toast.error("Saldo insuficiente de moedas. Adicione créditos para continuar.");
      } else {
        toast.error(err.message || "Erro ao forçar avanço");
      }
    },
  });

  const markDeliveredMutation = useMutation({
    mutationFn: async (envioId: string) => {
      if (!loja?.id) throw new Error("No loja");
      // forceAdvance=true permite avançar para "Entregue" (último evento)
      // E-mail e SMS são automaticamente pulados nesse evento (regra do triggerNextEmail)
      const result = await triggerNextEmail(envioId, loja.id, false, true);
      if (!result) throw new Error("Não foi possível marcar como entregue");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["envios-paginated"] });
      queryClient.invalidateQueries({ queryKey: ["envios-stats"] });
      toast.success("Marcado como Entregue ✅");
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao marcar como entregue");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("envios").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["envios-paginated"] }); queryClient.invalidateQueries({ queryKey: ["envios-stats"] });
      queryClient.invalidateQueries({ queryKey: ["taxacao-envios"] });
      toast.success("Envio removido.");
      setSelectedIds((prev) => {
        const next = new Set(prev);
        // Note: the original logic here was slightly flawed for a generic delete, 
        // but cleaning it up.
        return next;
      });
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const chunkSize = 50;
      const deletedAt = new Date().toISOString();
      for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const { error } = await supabase
          .from("envios")
          .update({ deleted_at: deletedAt })
          .in("id", chunk);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["envios-paginated"] }); queryClient.invalidateQueries({ queryKey: ["envios-stats"] });
      queryClient.invalidateQueries({ queryKey: ["taxacao-envios"] });
      toast.success(`${selectedIds.size} envio(s) removido(s).`);
      setSelectedIds(new Set());
    },
    onError: (err: any) => {
      toast.error("Erro ao excluir em massa: " + err.message);
    }
  });

  const canAdvanceNow = (e: any) => {
    const pa = (e as any).proximo_avanco_em;
    return !pa || new Date(pa) <= new Date();
  };

  // INICIAR PENDENTES: only starts envios at stage 0 (from current page)
  const handleIniciarPendentes = async () => {
    const pendentes = paginatedEnvios.filter((e) => (e.ultimo_evento_ordem ?? 0) === 0 && e.status === "pendente");
    if (pendentes.length === 0) return toast.info("Nenhum envio pendente na estaca zero.");
    let count = 0;
    for (const envio of pendentes) {
      if (!loja?.id) continue;
      try {
        const result = await triggerNextEmail(envio.id, loja.id);
        if (result) count++;
      } catch (err: any) {
        if (err instanceof InsufficientBalanceError) {
          toast.error("Saldo insuficiente. Parado.");
          break;
        }
      }
    }
    queryClient.invalidateQueries({ queryKey: ["envios-paginated"] });
    queryClient.invalidateQueries({ queryKey: ["envios-stats"] });
    setBatchCooldown(Date.now() + 120000);
    toast.success(`${count} envio(s) iniciado(s)!`);
  };

  // Pre-click: show confirmation dialog
  const handleAvancarTodosClick = () => {
    const ids = selectedIdsRef.current;
    const base = ids.size > 0 ? paginatedEnvios.filter((e) => ids.has(e.id)) : paginatedEnvios;
    const targets = base.filter((e) => e.status !== "entregue" && (e.ultimo_evento_ordem ?? 0) > 0 && canAdvanceNow(e));
    if (targets.length === 0) return toast.info("Nenhum envio elegível para avançar (verifique os delays).");
    setBatchConfirm({ type: "avancar", count: targets.length, label: ids.size > 0 ? "selecionado(s)" : "da página" });
  };

  const handleForcarTodosClick = () => {
    const ids = selectedIdsRef.current;
    const base = ids.size > 0 ? paginatedEnvios.filter((e) => ids.has(e.id)) : paginatedEnvios;
    const targets = base.filter((e) => e.status !== "entregue" && (e.ultimo_evento_ordem ?? 0) > 0);
    if (targets.length === 0) return toast.info("Nenhum envio elegível para forçar avanço.");
    setBatchConfirm({ type: "forcar", count: targets.length, label: ids.size > 0 ? "selecionado(s)" : "da página" });
  };

  const handleMarcarEntregueTodosClick = async () => {
    if (!loja?.id) return;
    const ids = selectedIdsRef.current;
    const base = ids.size > 0 ? paginatedEnvios.filter((e) => ids.has(e.id)) : paginatedEnvios;
    // Elegíveis: em trânsito ou saiu para entrega (não pendente, não entregue)
    const targets = base.filter((e) => e.status === "em_transito" || e.status === "saiu_para_entrega");
    if (targets.length === 0) return toast.info("Nenhum envio elegível para marcar como entregue.");

    if (!confirm(`Marcar ${targets.length} envio(s) como Entregue? Nenhum e-mail ou SMS será enviado.`)) return;

    const targetIds = targets.map((e) => e.id);
    let ok = 0;
    await startBatch(targetIds.length);
    try {
      for (let i = 0; i < targetIds.length; i++) {
        const cancelled = await checkCancelled();
        if (cancelled) {
          toast.info(`Cancelado. ${ok}/${targetIds.length} marcados.`);
          break;
        }
        try {
          const result = await triggerNextEmail(targetIds[i], loja.id, false, true);
          if (result) ok++;
        } catch (err) {
          console.error("Falha ao marcar entregue:", targetIds[i], err);
        }
        await updateProgress(i + 1);
      }
      if (ok > 0) {
        queryClient.invalidateQueries({ queryKey: ["envios-paginated"] });
        queryClient.invalidateQueries({ queryKey: ["envios-stats"] });
        toast.success(`${ok} envio(s) marcado(s) como Entregue.`);
      }
    } finally {
      await finishBatch();
    }
  };

  const handleBatchConfirmed = async () => {
    if (!batchConfirm || !loja?.id) return;
    const isForce = batchConfirm.type === "forcar";
    setBatchConfirm(null);

    const ids = selectedIdsRef.current;
    const base = ids.size > 0 ? paginatedEnvios.filter((e) => ids.has(e.id)) : paginatedEnvios;
    const targets = isForce
      ? base.filter((e) => e.status !== "entregue" && (e.ultimo_evento_ordem ?? 0) > 0)
      : base.filter((e) => e.status !== "entregue" && (e.ultimo_evento_ordem ?? 0) > 0 && canAdvanceNow(e));
    if (targets.length === 0) return;

    const targetIds = targets.map((e) => e.id);
    const chunkSize = 50;
    let updated = 0;

    await startBatch(targetIds.length);

    try {
      for (let i = 0; i < targetIds.length; i += chunkSize) {
        const cancelled = await checkCancelled();
        if (cancelled) {
          toast.info(`Operação cancelada. ${updated} de ${targetIds.length} agendados.`);
          break;
        }

        const chunk = targetIds.slice(i, i + chunkSize);
        const { error } = await supabase
          .from("envios")
          .update({ proximo_avanco_em: new Date().toISOString() })
          .in("id", chunk);
        if (error) {
          console.error("Batch update error:", error);
          toast.error("Erro ao agendar envios: " + error.message);
          break;
        }
        updated += chunk.length;
        await updateProgress(updated);
      }

      if (updated > 0) {
        queryClient.invalidateQueries({ queryKey: ["envios-paginated"] }); queryClient.invalidateQueries({ queryKey: ["envios-stats"] });
        toast.success(
          `${updated} envio(s) agendado(s) para ${isForce ? "avanço forçado" : "avanço"}. O servidor processará automaticamente em até 5 minutos.`
        );
      }
    } finally {
      await finishBatch();
    }
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterStatus, filterMetodo, filterOrigem, dateRange.from, dateRange.to]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const ROW_HEIGHT = 52;
  const rowVirtualizer = useVirtualizer({
    count: paginatedEnvios.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 15,
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(paginatedEnvios.map((e) => e.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  const handleExportCSV = useCallback(() => {
    if (paginatedEnvios.length === 0) {
      toast.info("Nenhum envio para exportar.");
      return;
    }
    const headers = ["Nome", "Email", "Telefone", "Produto", "Valor", "Código Rastreio", "Link Rastreio", "Status", "Data"];
    const escapeCSV = (val: string) => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };
    const rows = paginatedEnvios.map((e) => {
      const trackingUrl = e.codigo_rastreio
        ? `https://${getTrackingDomain(e)}/rastreio?codigo=${e.codigo_rastreio}`
        : "";
      const displayStatus = e.status_label || statusLabels[e.status] || e.status;
      return [
        e.cliente_nome,
        e.cliente_email,
        e.cliente_telefone || "",
        formatProduto(e.produto),
        e.valor.toFixed(2).replace(".", ","),
        e.codigo_rastreio || "",
        trackingUrl,
        displayStatus,
        format(new Date(e.created_at), "dd/MM/yyyy HH:mm"),
      ].map(escapeCSV).join(",");
    });
    const bom = "\uFEFF";
    const csv = bom + headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `envios_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${paginatedEnvios.length} envio(s) exportado(s) como CSV!`);
  }, [paginatedEnvios, getTrackingDomain]);

  const handleExportXLSX = useCallback(() => {
    if (paginatedEnvios.length === 0) {
      toast.info("Nenhum envio para exportar.");
      return;
    }
    const headers = ["Nome", "Email", "Telefone", "Produto", "Valor", "Código Rastreio", "Link Rastreio", "Status", "Data"];
    const data = paginatedEnvios.map((e) => {
      const trackingUrl = e.codigo_rastreio
        ? `https://${getTrackingDomain(e)}/rastreio?codigo=${e.codigo_rastreio}`
        : "";
      const displayStatus = e.status_label || statusLabels[e.status] || e.status;
      return [
        e.cliente_nome,
        e.cliente_email,
        e.cliente_telefone || "",
        formatProduto(e.produto),
        e.valor,
        e.codigo_rastreio || "",
        trackingUrl,
        displayStatus,
        format(new Date(e.created_at), "dd/MM/yyyy HH:mm"),
      ];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    // Auto-width columns
    const colWidths = headers.map((h, i) => {
      let max = h.length;
      data.forEach((row) => {
        const val = String(row[i] ?? "");
        if (val.length > max) max = val.length;
      });
      return { wch: Math.min(max + 2, 50) };
    });
    ws["!cols"] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Envios");
    XLSX.writeFile(wb, `envios_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success(`${paginatedEnvios.length} envio(s) exportado(s) como Excel!`);
  }, [paginatedEnvios, getTrackingDomain]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getTotalEventos = (envio: any) => {
    const tid = envio.postagem_template_id;
    if (tid && eventCountMap[tid] !== undefined) return eventCountMap[tid];
    // Fallback: try any available count
    const values = Object.values(eventCountMap);
    return values.length > 0 ? values[0] : 0;
  };

  const getProgress = (envio: any) => {
    if (envio.status === "entregue") return 100;
    const total = getTotalEventos(envio);
    if (total === 0) return 0;
    const ordem = envio.ultimo_evento_ordem ?? 0;
    return Math.min(Math.round((ordem / total) * 100), 100);
  };

  const getCurrentStep = (envio: any) => {
    return envio.ultimo_evento_ordem ?? 0;
  };

  const canAdvance = (envio: any) => {
    if (envio.status === "entregue") return false;
    const ordem = envio.ultimo_evento_ordem ?? 0;
    const total = getTotalEventos(envio);
    return total > 0 && ordem < total;
  };

  const getDisplayStatus = (envio: any) => {
    return (envio as any).status_label || statusLabels[envio.status] || envio.status;
  };

  // Metrics
  const totalCount = stats?.total ?? 0;
  const pendentesCount = stats?.pendentes ?? 0;
  const transitoCount = Number(stats?.em_transito ?? 0);
  const entreguesCount = stats?.entregues ?? 0;

  const metrics = [
    { label: "Total", value: totalCount, icon: Package, delay: 0 },
    { label: "Pendentes", value: pendentesCount, icon: Clock, delay: 0.08 },
    { label: "Em Trânsito", value: transitoCount, icon: Navigation, delay: 0.16 },
    { label: "Entregues", value: entreguesCount, icon: CheckCircle2, delay: 0.24 },
  ];

  return (
    <>
      <div className="space-y-6">
        <BloqueioCobrancaBanner />
        {/* Hero + Metrics */}
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Centro de Envios
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitore e gerencie todos os seus envios em tempo real.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {metrics.map((m) => (
              <div
                key={m.label}
                className="glass glow-border rounded-xl p-4 animate-stagger-in"
                style={{ animationDelay: `${m.delay}s` }}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <m.icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground leading-none">{m.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Bar */}
        <div className="glass-strong glow-border rounded-xl p-3">
          <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-3 glass rounded-lg px-3 py-1.5">
                <div className="flex items-center gap-2 border-r border-border/50 pr-2">
                  <Checkbox
                    checked={paginatedEnvios.length > 0 && paginatedEnvios.every(e => selectedIds.has(e.id))}
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    className="h-4 w-4 border-primary/30"
                  />
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Tudo</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={autoEnvio} onCheckedChange={handleToggleAutoEnvio} disabled={autoEnvioLoading} />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Auto {autoEnvio ? "🟢" : ""}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs hover:bg-primary/10 hover:text-primary"
                disabled={batchCooldown > Date.now() || !!batchProgress?.processing}
                onClick={handleIniciarPendentes}
              >
                <Play className="h-3.5 w-3.5 mr-1 text-primary" />
                {batchCooldown > Date.now() ? formatCooldown(batchCooldown) : "Iniciar Pendentes"}
              </Button>
              {batchProgress?.processing ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => cancelBatch()}
                >
                  <Square className="h-3.5 w-3.5 mr-1 text-destructive" />
                  Avançando {batchProgress.current}/{batchProgress.total}... Cancelar
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs hover:bg-primary/10 hover:text-primary"
                    disabled={batchCooldown > Date.now()}
                    onClick={handleAvancarTodosClick}
                  >
                    <FastForward className="h-3.5 w-3.5 mr-1 text-primary" />
                    {batchCooldown > Date.now() ? formatCooldown(batchCooldown) : `Avançar Todos (${selectedIds.size > 0 ? selectedIds.size : paginatedEnvios.length})`}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs hover:bg-yellow-500/10 hover:text-yellow-500"
                    disabled={batchCooldown > Date.now()}
                    onClick={handleForcarTodosClick}
                  >
                    <Zap className="h-3.5 w-3.5 mr-1 text-yellow-500" />
                    {batchCooldown > Date.now() ? formatCooldown(batchCooldown) : `Forçar Todos (${selectedIds.size > 0 ? selectedIds.size : paginatedEnvios.length})`}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs hover:bg-emerald-500/10 hover:text-emerald-600"
                    onClick={handleMarcarEntregueTodosClick}
                    title="Marca como Entregue em massa — sem e-mail/SMS"
                  >
                    <PackageCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                    {`Marcar Entregue (${selectedIds.size > 0 ? selectedIds.size : paginatedEnvios.length})`}
                  </Button>
                </>
              )}
            </div>

            <div className="flex gap-2 items-center w-full lg:w-auto">
              {selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={batchDeleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Excluir ({selectedIds.size})
                </Button>
              )}

              <div className="relative flex-1 lg:w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar nome, produto, preço..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-transparent border-border/50"
                />
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-8 text-xs bg-transparent border-border/50 font-normal",
                      !dateRange.from && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-3.5 w-3.5" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "dd/MM")} - {format(dateRange.to, "dd/MM")}
                        </>
                      ) : (
                        format(dateRange.from, "dd/MM/yyyy")
                      )
                    ) : (
                      <span>Filtrar Data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range: any) => setDateRange({ from: range?.from, to: range?.to })}
                    numberOfMonths={1}
                  />
                  {dateRange.from && (
                    <div className="p-2 border-t border-border flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[10px] h-7"
                        onClick={() => setDateRange({ from: undefined, to: undefined })}
                      >
                        Limpar
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px] h-8 text-xs bg-transparent border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[400px]">
                  <SelectItem value="todos">Todos Status</SelectItem>
                  <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Status</div>
                  {statusOptions.filter(s => s.group === "Status").map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                  <div className="px-2 pt-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Etapas detalhadas</div>
                  {statusOptions.filter(s => s.group === "Etapa").map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterMetodo} onValueChange={setFilterMetodo}>
                <SelectTrigger className="w-[170px] h-8 text-xs bg-transparent border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Pagamentos</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterOrigem} onValueChange={setFilterOrigem}>
                <SelectTrigger className="w-[160px] h-8 text-xs bg-transparent border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas Origens</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="vega">Vega</SelectItem>
                  <SelectItem value="zedy">Zedy</SelectItem>
                  <SelectItem value="luna">Luna</SelectItem>
                  <SelectItem value="corvex">Corvex</SelectItem>
                  <SelectItem value="adoorei">Adoorei</SelectItem>
                  <SelectItem value="shopify">Shopify</SelectItem>
                  <SelectItem value="api_externa">API Externa</SelectItem>
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="h-8 text-xs">
                    <Download className="h-3.5 w-3.5 mr-1" /> Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportCSV}>
                    <FileText className="h-4 w-4 mr-2" /> Exportar CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportXLSX}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" /> Exportar Excel (.xlsx)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {loja && <ImportarPlanilha lojaId={loja.id} />}
              <Button
                size="sm"
                className="shimmer-btn h-8 text-xs"
                onClick={() => setWizardOpen(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Novo Envio
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        {paginatedEnvios.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="relative mb-6">
              <div className="h-20 w-20 rounded-full bg-primary/5 flex items-center justify-center">
                <Truck className="h-10 w-10 text-primary/30" />
              </div>
              <div className="absolute inset-0 animate-orbit">
                <div className="h-2.5 w-2.5 rounded-full bg-primary/40 animate-pulse-dot" />
              </div>
              <div className="absolute inset-0 animate-orbit" style={{ animationDelay: "-2.5s" }}>
                <div className="h-1.5 w-1.5 rounded-full bg-primary/25 animate-pulse-dot" style={{ animationDelay: "1s" }} />
              </div>
            </div>
            <p className="text-foreground font-medium text-lg">Nenhum envio por aqui... ainda</p>
            <p className="text-muted-foreground text-sm mt-1 max-w-xs">
              Crie seu primeiro envio e acompanhe todo o fluxo de entrega em tempo real.
            </p>
            <Button className="shimmer-btn mt-5" onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Criar Primeiro Envio
            </Button>
          </div>
        ) : (
          <>
          {/* Envio Rows - Virtualized */}
          <div
            ref={scrollContainerRef}
            className="overflow-auto"
            style={{ maxHeight: 'calc(100vh - 320px)' }}
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const envio = paginatedEnvios[virtualRow.index];
              if (!envio) return null;
              return (
              <div
                key={envio.id}
                className="glass glow-border-hover rounded-lg px-3 py-2 transition-colors duration-200 hover:bg-primary/5 group absolute w-full"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {/* Single compact row */}
                <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
                  <div className="flex items-center shrink-0">
                    <Checkbox
                      checked={selectedIds.has(envio.id)}
                      onCheckedChange={() => toggleSelect(envio.id)}
                      className="h-4 w-4 border-primary/30"
                    />
                  </div>

                  {/* Name + Email */}
                   <div className="min-w-0 w-48 md:w-64 shrink-0">
                    <p className="text-sm font-medium text-foreground truncate leading-tight">{envio.cliente_nome}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {envio.cliente_email}{envio.cliente_telefone ? ` · ${envio.cliente_telefone}` : ''}
                    </p>
                  </div>

                  {/* Product */}
                  <p className="text-[11px] text-muted-foreground truncate hidden md:block w-28 shrink-0">{formatProduto(envio.produto)}</p>

                  {/* Value */}
                  <span className="text-sm font-bold text-primary whitespace-nowrap shrink-0">R$ {Number(envio.valor).toFixed(2)}</span>

                  {/* Progress mini */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Progress value={getProgress(envio)} className="h-1 w-16" />
                    <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                      {getCurrentStep(envio)}/{envio.status === "entregue" ? Math.max(getCurrentStep(envio), 1) : getTotalEventos(envio)}
                    </span>
                  </div>

                  {/* Status */}
                  <Badge
                    variant="secondary"
                    className={`${statusColors[envio.status_label || ""] || statusColors[envio.status] || "bg-muted text-muted-foreground"} text-[9px] px-1.5 py-0 h-5 whitespace-nowrap shrink-0`}
                  >
                    <span className="inline-block h-1 w-1 rounded-full bg-current mr-1" />
                    {getDisplayStatus(envio)}
                  </Badge>
                  {/* Transportadora tag */}
                  {(() => {
                    const jadlog = isJadlog(envio);
                    const vetor = isVetor(envio);
                    const marca = resolveMarca({
                      marca: envio.marca,
                      is_international: envio.is_international,
                      global_flow_lang: envio.global_flow_lang,
                      codigo_rastreio: envio.codigo_rastreio,
                    });
                    let label = "ATLAS";
                    let cls = "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700";
                    if (jadlog) {
                      label = "JADLOG";
                      cls = "bg-destructive/10 text-destructive border-destructive/30";
                    } else if (vetor) {
                      label = "VETOR";
                      cls = "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700";
                    } else if (marca === "jetline") {
                      label = "JETLINE";
                      cls = "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700";
                    } else if (marca === "trackmaster_us") {
                      label = "GLOBAL US";
                      cls = "bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700";
                    } else if (marca === "trackmaster_es") {
                      label = "GLOBAL ES";
                      cls = "bg-rose-100 text-rose-700 border-rose-300 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700";
                    }
                    return (
                      <Badge
                        variant="outline"
                        className={`text-[8px] px-1.5 py-0 h-4 whitespace-nowrap shrink-0 font-bold ${cls}`}
                      >
                        {label}
                      </Badge>
                    );
                  })()}
                  {/* Código de rastreio */}
                  {envio.codigo_rastreio && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(envio.codigo_rastreio);
                        toast.success("Código copiado!");
                      }}
                      className="hidden md:inline-flex items-center text-[10px] font-mono text-muted-foreground/80 hover:text-primary tracking-wider whitespace-nowrap shrink-0 transition-colors"
                      title="Copiar código de rastreio"
                    >
                      {envio.codigo_rastreio}
                    </button>
                  )}
                  {/* Origem badge */}
                  <Badge
                    variant="outline"
                    className={`text-[8px] px-1.5 py-0 h-4 whitespace-nowrap shrink-0 font-medium ${
                      pedidoOrigemMap[envio.id]
                        ? 'bg-primary/10 text-primary border-primary/30'
                        : 'bg-muted text-muted-foreground border-border/50'
                    }`}
                  >
                    {pedidoOrigemMap[envio.id] ? (
                      <><Zap className="h-2.5 w-2.5 mr-0.5" />{getOrigemLabel(pedidoOrigemMap[envio.id])}</>
                    ) : (
                      'Manual'
                    )}
                  </Badge>
                  {/* Método de pagamento badge */}
                  {pedidoMetodoMap[envio.id] && (
                    <Badge
                      variant="outline"
                      className={`text-[8px] px-1.5 py-0 h-4 whitespace-nowrap shrink-0 font-medium ${getMetodoBadgeClass(pedidoMetodoMap[envio.id])}`}
                    >
                      {getMetodoLabel(pedidoMetodoMap[envio.id])}
                    </Badge>
                  )}

                  <div className="flex items-center gap-0.5 ml-auto shrink-0">
                    {envio.codigo_rastreio && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:bg-primary/10 hover:text-primary"
                        title="Rastreio"
                        onClick={() => window.open(`https://${getTrackingDomain(envio)}/r/${envio.codigo_rastreio}`, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                    {(envio.status === 'taxacao' || envio.status === 'pagamento_confirmado' || envio.status_label === 'Taxação' || envio.status_label === 'Pgto. Confirmado') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 hover:bg-primary/10 hover:text-primary"
                        title="Taxação"
                        onClick={() => window.open(`https://${getTrackingDomain(envio)}/p/${envio.id}`, '_blank')}
                      >
                        <CreditCard className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 hover:bg-primary/10 hover:text-primary"
                      title="Baixar NF-e"
                      disabled={downloadingNfe === envio.id}
                      onClick={() => handleDownloadNfe(envio)}
                    >
                      <FileText className="h-3 w-3" />
                    </Button>
                    <span className="text-[10px] text-muted-foreground mx-1 hidden sm:inline">
                      {format(new Date(envio.created_at), "dd/MM HH:mm")}
                    </span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canAdvance(envio) && (
                        cooldowns[envio.id] > Date.now() ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled
                          >
                            <span className="text-[8px] font-mono">{formatCooldown(cooldowns[envio.id])}</span>
                          </Button>
                        ) : canAdvanceNow(envio) ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-primary/10 hover:text-primary"
                            title="Avançar"
                            disabled={advanceMutation.isPending}
                            onClick={() => advanceMutation.mutate(envio.id)}
                          >
                            <FastForward className="h-3 w-3" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-yellow-500/10 text-yellow-500 hover:text-yellow-600"
                            title="Forçar Avanço (ignora delay atual)"
                            disabled={forceAdvanceMutation.isPending}
                            onClick={() => forceAdvanceMutation.mutate(envio.id)}
                          >
                            <Zap className="h-3 w-3" />
                          </Button>
                        )
                      )}
                      {envio.status !== "entregue" && (envio.ultimo_evento_ordem ?? 0) > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 hover:bg-emerald-500/10 text-emerald-600 hover:text-emerald-700"
                          title="Marcar como Entregue (manual — não envia e-mail/SMS)"
                          disabled={markDeliveredMutation.isPending}
                          onClick={() => markDeliveredMutation.mutate(envio.id)}
                        >
                          <PackageCheck className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Remover"
                        onClick={() => deleteMutation.mutate(envio.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
            </div>
          </div>

          {/* Pagination */}
          {totalFilteredCount > 0 && (
            <div className="flex items-center justify-between glass glow-border rounded-xl px-4 py-3 mt-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  Mostrando {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, totalFilteredCount)} de {totalFilteredCount} envios
                </span>
                <Select value={String(itemsPerPage)} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); localStorage.setItem('envios_per_page', v); }}>
                  <SelectTrigger className="h-7 w-[80px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent side="top">
                    {PAGE_SIZE_OPTIONS.map(n => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {getPageNumbers().map((pg, i) =>
                  pg === "..." ? (
                    <span key={`ellipsis-${i}`} className="text-xs text-muted-foreground px-1">...</span>
                  ) : (
                    <Button
                      key={pg}
                      variant={currentPage === pg ? "default" : "outline"}
                      size="sm"
                      className="h-8 w-8 p-0 text-xs"
                      onClick={() => setCurrentPage(pg as number)}
                    >
                      {pg}
                    </Button>
                  )
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              )}
            </div>
          )}
          </>
        )}

        <NovoEnvioWizard open={wizardOpen} onOpenChange={setWizardOpen} />

        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir envios selecionados</AlertDialogTitle>
              <AlertDialogDescription>
                Realmente deseja apagar todos os seus Clientes? Pedidos irão parar de ser enviados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => batchDeleteMutation.mutate(Array.from(selectedIds))}
              >
                Confirmar exclusão
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!batchConfirm} onOpenChange={(open) => { if (!open) setBatchConfirm(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {batchConfirm?.type === "forcar" ? "Forçar avanço em massa" : "Avançar em massa"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                Você está prestes a {batchConfirm?.type === "forcar" ? "forçar" : "avançar"}{" "}
                <strong>{batchConfirm?.count}</strong> envio(s) {batchConfirm?.label}. Continuar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleBatchConfirmed}>
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}
