import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Contact, Search, ChevronLeft, ChevronRight, Download, CalendarIcon } from "lucide-react";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

const PAGE_SIZE = 25;

import { formatProduto } from "@/lib/format-produto";

type LeadRow = {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string;
  produto: string | null;
  valor: number | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  complemento: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  loja_id: string | null;
  envio_id: string | null;
  created_at: string | null;
  lojas: { nome: string; user_id: string } | null;
  user_name?: string;
  user_email?: string;
};

export default function AdminLeads() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [datePreset, setDatePreset] = useState<string>("");

  // Fetch profiles for the filter
  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles-for-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*, lojas(nome, user_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as LeadRow[];
    },
  });

  // Build a map of user_id -> profile info
  const profileMap = new Map<string, { name: string; email: string }>();
  profiles?.forEach((p) => {
    profileMap.set(p.id, { name: p.full_name || "", email: p.email || "" });
  });

  // Enrich leads with user info
  const leads = (data ?? []).map((l) => {
    const userId = l.lojas?.user_id;
    const profile = userId ? profileMap.get(userId) : null;
    return {
      ...l,
      user_name: profile?.name || "",
      user_email: profile?.email || "",
      _user_id: userId || null,
    };
  });

  // Get unique users that have leads
  const usersWithLeads = new Map<string, string>();
  leads.forEach((l) => {
    if (l._user_id && !usersWithLeads.has(l._user_id)) {
      const label = l.user_name || l.user_email || l._user_id;
      usersWithLeads.set(l._user_id, label);
    }
  });

  const filtered = leads.filter((l) => {
    // User filter
    if (selectedUsers.length > 0 && (!l._user_id || !selectedUsers.includes(l._user_id))) {
      return false;
    }
    // Date filter
    if (dateFrom && l.created_at) {
      if (new Date(l.created_at) < startOfDay(dateFrom)) return false;
    }
    if (dateTo && l.created_at) {
      if (new Date(l.created_at) > endOfDay(dateTo)) return false;
    }
    if ((dateFrom || dateTo) && !l.created_at) return false;
    // Text search
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.nome?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.cpf?.includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const formatEndereco = (l: LeadRow) => {
    const parts = [l.endereco, l.numero ? `nº ${l.numero}` : null].filter(Boolean).join(", ");
    const bairro = l.bairro ? ` - ${l.bairro}` : "";
    const cidadeUf = [l.cidade, l.estado].filter(Boolean).join("/");
    const cep = l.cep ? ` - ${l.cep}` : "";
    return [parts, bairro, cidadeUf ? `, ${cidadeUf}` : "", cep].join("") || "—";
  };

  const downloadCSV = () => {
    const header = ["Nome", "CPF", "Telefone", "Email", "Produto", "Valor", "Endereço", "Data"];
    const rows = filtered.map((l) => [
      l.nome,
      l.cpf || "",
      l.telefone || "",
      l.email,
      formatProduto(l.produto),
      Number(l.valor || 0).toFixed(2).replace(".", ","),
      formatEndereco(l),
      l.created_at ? format(new Date(l.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUserFilter = (value: string) => {
    if (value === "all") {
      setSelectedUsers([]);
    } else {
      setSelectedUsers((prev) =>
        prev.includes(value) ? prev.filter((u) => u !== value) : [...prev, value]
      );
    }
    setPage(0);
  };

  const applyDatePreset = (preset: string) => {
    const now = new Date();
    setDatePreset(preset);
    switch (preset) {
      case "today":
        setDateFrom(startOfDay(now));
        setDateTo(endOfDay(now));
        break;
      case "yesterday":
        setDateFrom(startOfDay(subDays(now, 1)));
        setDateTo(endOfDay(subDays(now, 1)));
        break;
      case "7d":
        setDateFrom(startOfDay(subDays(now, 6)));
        setDateTo(endOfDay(now));
        break;
      case "30d":
        setDateFrom(startOfDay(subDays(now, 29)));
        setDateTo(endOfDay(now));
        break;
      case "this_month":
        setDateFrom(startOfMonth(now));
        setDateTo(endOfMonth(now));
        break;
      case "this_week":
        setDateFrom(startOfWeek(now, { locale: ptBR }));
        setDateTo(endOfWeek(now, { locale: ptBR }));
        break;
      default:
        setDateFrom(undefined);
        setDateTo(undefined);
        setDatePreset("");
    }
    setPage(0);
  };

  const clearDateFilter = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setDatePreset("");
    setPage(0);
  };

  const dateLabel = () => {
    if (dateFrom && dateTo) {
      if (datePreset === "today") return "Hoje";
      if (datePreset === "yesterday") return "Ontem";
      if (datePreset === "7d") return "Últimos 7 dias";
      if (datePreset === "30d") return "Últimos 30 dias";
      if (datePreset === "this_month") return "Este mês";
      if (datePreset === "this_week") return "Esta semana";
      return `${format(dateFrom, "dd/MM/yy")} - ${format(dateTo, "dd/MM/yy")}`;
    }
    if (dateFrom) return `A partir de ${format(dateFrom, "dd/MM/yy")}`;
    if (dateTo) return `Até ${format(dateTo, "dd/MM/yy")}`;
    return "Filtrar por data";
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Contact className="h-6 w-6 text-primary" />
            Leads
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
            </span>
            <Button variant="outline" size="sm" onClick={downloadCSV} disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-1" /> Baixar CSV
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative max-w-sm flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email ou CPF..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                />
              </div>
              <Select
                value={selectedUsers.length === 1 ? selectedUsers[0] : selectedUsers.length > 1 ? "multi" : "all"}
                onValueChange={handleUserFilter}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue>
                    {selectedUsers.length === 0
                      ? "Todos os usuários"
                      : selectedUsers.length === 1
                        ? usersWithLeads.get(selectedUsers[0]) || "Usuário"
                        : `${selectedUsers.length} usuários`}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os usuários</SelectItem>
                  {Array.from(usersWithLeads.entries()).map(([id, label]) => (
                    <SelectItem key={id} value={id}>
                      {selectedUsers.includes(id) ? "✓ " : ""}{label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={`gap-1.5 ${(dateFrom || dateTo) ? "border-primary text-primary" : ""}`}>
                    <CalendarIcon className="h-4 w-4" />
                    <span className="text-xs">{dateLabel()}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="start">
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {[
                      { key: "today", label: "Hoje" },
                      { key: "yesterday", label: "Ontem" },
                      { key: "7d", label: "7 dias" },
                      { key: "30d", label: "30 dias" },
                      { key: "this_week", label: "Semana" },
                      { key: "this_month", label: "Mês" },
                    ].map((p) => (
                      <Button
                        key={p.key}
                        variant={datePreset === p.key ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => applyDatePreset(p.key)}
                      >
                        {p.label}
                      </Button>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">De</p>
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={(d) => { setDateFrom(d); setDatePreset(""); setPage(0); }}
                        locale={ptBR}
                        className="rounded-md border"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Até</p>
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={(d) => { setDateTo(d); setDatePreset(""); setPage(0); }}
                        locale={ptBR}
                        className="rounded-md border"
                      />
                    </div>
                  </div>
                  {(dateFrom || dateTo) && (
                    <Button variant="ghost" size="sm" className="w-full mt-2 text-xs" onClick={clearDateFilter}>
                      Limpar datas
                    </Button>
                  )}
                </PopoverContent>
              </Popover>
              {(selectedUsers.length > 0 || dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" onClick={() => { setSelectedUsers([]); clearDateFilter(); }}>
                  Limpar filtros
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : paginated.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">Nenhum lead encontrado.</p>
            ) : (
              <>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Endereço</TableHead>
                        <TableHead>Loja</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium whitespace-nowrap">{lead.nome}</TableCell>
                          <TableCell className="whitespace-nowrap">{lead.cpf || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{lead.telefone || "—"}</TableCell>
                          <TableCell>{lead.email}</TableCell>
                          <TableCell className="max-w-xs truncate">{formatProduto(lead.produto)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            {Number(lead.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{formatEndereco(lead)}</TableCell>
                          <TableCell className="whitespace-nowrap">{lead.lojas?.nome || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                            {lead.user_name || lead.user_email || "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                            {lead.created_at ? format(new Date(lead.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <span className="text-sm text-muted-foreground">
                      Página {page + 1} de {totalPages}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
