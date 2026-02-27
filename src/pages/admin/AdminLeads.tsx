import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Contact, Search, ChevronLeft, ChevronRight, Download } from "lucide-react";

const PAGE_SIZE = 25;

const formatProduto = (raw: string | null): string => {
  if (!raw) return "—";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((p: any) => `${p.nome || p.produto || "Produto"} (x${p.quantidade || p.qtd || 1})`)
        .join(", ");
    }
    return raw;
  } catch {
    return raw;
  }
};

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
  lojas: { nome: string } | null;
};

export default function AdminLeads() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*, lojas(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as LeadRow[];
    },
  });

  const leads = data ?? [];
  const filtered = leads.filter((l) => {
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
    const header = ["Nome", "CPF", "Telefone", "Email", "Produto", "Valor", "Endereço", "Loja"];
    const rows = filtered.map((l) => [
      l.nome,
      l.cpf || "",
      l.telefone || "",
      l.email,
      formatProduto(l.produto),
      Number(l.valor || 0).toFixed(2).replace(".", ","),
      formatEndereco(l),
      l.lojas?.nome || "",
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
            <div className="relative max-w-sm">
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
