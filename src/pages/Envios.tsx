import { useState, useEffect, useCallback, useRef } from "react";
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
import { Plus, Search, Truck, Trash2, Play, FastForward, Package, Clock, Navigation, CheckCircle2, Calendar, ExternalLink, FileText, CreditCard, Square, Zap, PackageX, ChevronLeft, ChevronRight } from "lucide-react";
import { ImportarPlanilha } from "@/components/envios/ImportarPlanilha";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLoja } from "@/contexts/LojaContext";
import { toast } from "sonner";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { NovoEnvioWizard } from "@/components/envios/NovoEnvioWizard";
import { triggerNextEmail, InsufficientBalanceError } from "@/lib/email-trigger";
import { generateDanfePdfBase64 } from "@/lib/nfe-utils";
import type { EmpresaData, EnvioData } from "@/components/danfe/DanfePreview";

import { formatProduto } from "@/lib/format-produto";

const ITEMS_PER_PAGE = 20;

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

const statusOptions = [
  { value: "Pendente", label: "Pendente" },
  { value: "Postado", label: "Postado (NF-e)" },
  { value: "Coletado", label: "Coletado" },
  { value: "Em Trânsito", label: "Em Trânsito" },
  { value: "Centro Local", label: "Centro Local" },
  { value: "Taxação", label: "Taxação" },
  { value: "Pgto. Confirmado", label: "Pgto. Confirmado" },
  { value: "Saiu para Entrega", label: "Saiu para Entrega" },
  { value: "Falha Entrega", label: "Falha Entrega" },
  { value: "Reenvio Pago", label: "Reenvio Pago" },
  { value: "Reenvio Saiu", label: "Reenvio Saiu" },
  { value: "Entregue", label: "Entregue" },
];

export default function Envios() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [autoEnvio, setAutoEnvio] = useState(false);
  const [autoEnvioLoading, setAutoEnvioLoading] = useState(false);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [batchCooldown, setBatchCooldown] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [, setTick] = useState(0);
  const queryClient = useQueryClient();
  const { loja } = useLoja();
  const [downloadingNfe, setDownloadingNfe] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const isJadlog = useCallback((envio: { transportadora?: string | null; codigo_rastreio?: string | null }) => {
    if (envio.transportadora) {
      return envio.transportadora.toUpperCase().includes('JADLOG');
    }
    if (envio.codigo_rastreio) {
      return envio.codigo_rastreio.toUpperCase().endsWith('JD');
    }
    return false;
  }, []);

  const getTrackingDomain = useCallback((envio: { transportadora?: string | null }) => {
    return isJadlog(envio) ? 'rastreio.centrojadlog.com' : 'rastreio.logisticajltransportes.com';
  }, [isJadlog]);

  // Batch advance state
  const [batchProgress, setBatchProgress] = useState<{ processing: boolean; current: number; total: number } | null>(null);
  const batchCancelRef = useRef(false);

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

  const { data: envios = [] } = useQuery({
    queryKey: ["envios", loja?.id],
    queryFn: async () => {
      if (!loja) return [];
      const all: any[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("envios")
          .select("*")
          .eq("loja_id", loja.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        all.push(...(data || []));
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
    enabled: !!loja,
  });

  // Fetch event counts per template_id for progress calculation
  const templateIdsKey = envios.map(e => e.postagem_template_id).filter(Boolean).join(",");
  const { data: eventCountMap = {} } = useQuery<Record<string, number>>({
    queryKey: ["event-count-map", loja?.id, templateIdsKey],
    queryFn: async () => {
      if (!loja) return {};
      const { data: config } = await supabase
        .from("postagem_config")
        .select("template_ativo_id, ativar_falha_entrega, enviar_nfe_email")
        .eq("loja_id", loja.id)
        .maybeSingle();
      if (!config) return {};

      const templateIds = [...new Set(
        envios.map(e => e.postagem_template_id).filter(Boolean) as string[]
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

      const falhaLabels = ["Falha Entrega", "Reenvio Pago", "Reenvio Saiu"];
      const map: Record<string, number> = {};
      for (const tid of templateIds) {
        const filtered = eventos.filter(e => {
          if (e.template_id !== tid) return false;
          if (!config.ativar_falha_entrega && falhaLabels.includes(e.status_label || "")) return false;
          if (!config.enviar_nfe_email && e.enviar_nfe_pdf) return false;
          return true;
        });
        map[tid] = filtered.length;
      }
      return map;
    },
    enabled: !!loja && envios.length > 0,
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
          queryClient.invalidateQueries({ queryKey: ["envios", loja.id] });
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
            console.log("AUTO: Starting new shipment", newEnvio.id);
            try {
              await triggerNextEmail(newEnvio.id, loja.id);
              queryClient.invalidateQueries({ queryKey: ["envios", loja.id] });
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
      queryClient.invalidateQueries({ queryKey: ["envios"] });
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
      queryClient.invalidateQueries({ queryKey: ["envios"] });
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("envios").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["envios"] });
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
      queryClient.invalidateQueries({ queryKey: ["envios"] });
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

  // INICIAR PENDENTES: only starts envios at stage 0
  const handleIniciarPendentes = async () => {
    const pendentes = envios.filter((e) => (e.ultimo_evento_ordem ?? 0) === 0 && e.status === "pendente");
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
    queryClient.invalidateQueries({ queryKey: ["envios"] });
    setBatchCooldown(Date.now() + 120000);
    toast.success(`${count} envio(s) iniciado(s)!`);
  };

  // AVANÇAR TODOS: advance 1 at a time with 60s interval
  const handleAvancarTodos = async () => {
    const targets = envios.filter((e) => e.status !== "entregue" && (e.ultimo_evento_ordem ?? 0) > 0 && canAdvanceNow(e));
    if (targets.length === 0) return toast.info("Nenhum envio elegível para avançar (verifique os delays).");

    batchCancelRef.current = false;
    setBatchProgress({ processing: true, current: 0, total: targets.length });

    let count = 0;
    for (let i = 0; i < targets.length; i++) {
      if (batchCancelRef.current) {
        toast.info("Processamento cancelado.");
        break;
      }
      setBatchProgress({ processing: true, current: i + 1, total: targets.length });
      if (!loja?.id) continue;
      try {
        const result = await triggerNextEmail(targets[i].id, loja.id);
        if (result) count++;
      } catch (err: any) {
        if (err instanceof InsufficientBalanceError) {
          toast.error("Saldo insuficiente. Parado.");
          break;
        }
      }
      queryClient.invalidateQueries({ queryKey: ["envios"] });
      // Wait 60 seconds between each, except after last
      if (i < targets.length - 1 && !batchCancelRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 60000));
      }
    }

    setBatchProgress(null);
    setBatchCooldown(Date.now() + 120000);
    toast.success(`${count} envio(s) avançado(s)!`);
  };

  // FORÇAR TODOS: force-advance ignoring delays, 1 at a time with 60s interval
  const handleForcarTodos = async () => {
    const base = selectedIds.size > 0 ? envios.filter((e) => selectedIds.has(e.id)) : envios;
    const targets = base.filter((e) => e.status !== "entregue" && (e.ultimo_evento_ordem ?? 0) > 0);
    if (targets.length === 0) return toast.info("Nenhum envio elegível para forçar avanço.");

    batchCancelRef.current = false;
    setBatchProgress({ processing: true, current: 0, total: targets.length });

    let count = 0;
    for (let i = 0; i < targets.length; i++) {
      if (batchCancelRef.current) {
        toast.info("Processamento cancelado.");
        break;
      }
      setBatchProgress({ processing: true, current: i + 1, total: targets.length });
      if (!loja?.id) continue;
      try {
        const result = await triggerNextEmail(targets[i].id, loja.id, false, true);
        if (result) count++;
      } catch (err: any) {
        if (err instanceof InsufficientBalanceError) {
          toast.error("Saldo insuficiente. Parado.");
          break;
        }
      }
      queryClient.invalidateQueries({ queryKey: ["envios"] });
      if (i < targets.length - 1 && !batchCancelRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 60000));
      }
    }

    setBatchProgress(null);
    setBatchCooldown(Date.now() + 120000);
    toast.success(`${count} envio(s) forçado(s)!`);
  };

  const handleCancelBatch = () => {
    batchCancelRef.current = true;
  };

  const filteredEnvios = envios.filter((e) => {
    const searchLower = search.toLowerCase();
    const matchSearch =
      e.cliente_nome.toLowerCase().includes(searchLower) ||
      e.produto.toLowerCase().includes(searchLower) ||
      (e.codigo_rastreio && e.codigo_rastreio.toLowerCase().includes(searchLower)) ||
      e.cliente_email.toLowerCase().includes(searchLower) ||
      e.valor.toString().includes(searchLower);

    const matchStatus = filterStatus === "todos"
      || e.status_label === filterStatus
      || (filterStatus === "Pendente" && e.status === "pendente" && !e.status_label);

    let matchDate = true;
    if (dateRange.from) {
      const envioDate = new Date(e.created_at);
      const start = startOfDay(dateRange.from);
      const end = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
      matchDate = isWithinInterval(envioDate, { start, end });
    }

    return matchSearch && matchStatus && matchDate;
  });

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterStatus, dateRange.from, dateRange.to]);

  const totalPages = Math.ceil(filteredEnvios.length / ITEMS_PER_PAGE);
  const paginatedEnvios = filteredEnvios.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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
  const totalCount = envios.length;
  const pendentesCount = envios.filter((e) => e.status === "pendente").length;
  const transitoCount = envios.filter((e) => e.status === "em_transito" || e.status === "saiu_para_entrega" || e.status === "coletado" || e.status === "centro_local").length;
  const entreguesCount = envios.filter((e) => e.status === "entregue").length;

  const metrics = [
    { label: "Total", value: totalCount, icon: Package, delay: 0 },
    { label: "Pendentes", value: pendentesCount, icon: Clock, delay: 0.08 },
    { label: "Em Trânsito", value: transitoCount, icon: Navigation, delay: 0.16 },
    { label: "Entregues", value: entreguesCount, icon: CheckCircle2, delay: 0.24 },
  ];

  return (
    <>
      <div className="space-y-6">
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
                  onClick={handleCancelBatch}
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
                    onClick={handleAvancarTodos}
                  >
                    <FastForward className="h-3.5 w-3.5 mr-1 text-primary" />
                    {batchCooldown > Date.now() ? formatCooldown(batchCooldown) : "Avançar Todos"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs hover:bg-yellow-500/10 hover:text-yellow-500"
                    disabled={batchCooldown > Date.now()}
                    onClick={handleForcarTodos}
                  >
                    <Zap className="h-3.5 w-3.5 mr-1 text-yellow-500" />
                    {batchCooldown > Date.now() ? formatCooldown(batchCooldown) : "Forçar Todos"}
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
                <SelectContent>
                  <SelectItem value="todos">Todos Status</SelectItem>
                  {statusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        {filteredEnvios.length === 0 ? (
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
          {/* Envio Rows */}
          <div className="flex flex-col gap-1.5">
            {paginatedEnvios.map((envio, idx) => (
              <div
                key={envio.id}
                className="glass glow-border-hover rounded-lg px-3 py-2 transition-all duration-200 hover:bg-primary/5 animate-stagger-in group"
                style={{ animationDelay: `${idx * 0.02}s` }}
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
                  <div className="min-w-0 w-32 md:w-40 shrink-0">
                    <p className="text-sm font-medium text-foreground truncate leading-tight">{envio.cliente_nome}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{envio.cliente_email}</p>
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
                  <Badge
                    variant="outline"
                    className={`text-[8px] px-1.5 py-0 h-4 whitespace-nowrap shrink-0 font-bold ${
                      isJadlog(envio)
                        ? 'bg-destructive/10 text-destructive border-destructive/30'
                        : 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700'
                    }`}
                  >
                    {isJadlog(envio) ? 'JADLOG' : 'JL'}
                  </Badge>

                  {/* Quick links */}
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
                      className="h-6 w-6 hover:bg-orange-500/10 hover:text-orange-500"
                      title="Falha na Entrega"
                      onClick={() => window.open(`https://${getTrackingDomain(envio)}/f/${envio.id}`, '_blank')}
                    >
                      <PackageX className="h-3 w-3" />
                    </Button>
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
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between glass glow-border rounded-xl px-4 py-3 mt-2">
              <span className="text-xs text-muted-foreground">
                Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredEnvios.length)} de {filteredEnvios.length} envios
              </span>
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
      </div>
    </>
  );
}
