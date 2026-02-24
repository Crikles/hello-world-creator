import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Coins, Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  role: string;
  saldo: number;
  lojas_count: number;
}

export default function AdminUsuarios() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [quantidade, setQuantidade] = useState("");
  const [descricao, setDescricao] = useState("");

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ["admin-usuarios"],
    queryFn: async () => {
      const [profilesRes, rolesRes, creditosRes, lojasRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("*"),
        supabase.from("creditos").select("*"),
        supabase.from("lojas").select("id, user_id"),
      ]);

      const profiles = profilesRes.data || [];
      const roles = rolesRes.data || [];
      const creditos = creditosRes.data || [];
      const lojas = lojasRes.data || [];

      return profiles.map((p): UserRow => {
        const userRole = roles.find((r) => r.user_id === p.id);
        const userCredito = creditos.find((c) => c.user_id === p.id);
        const userLojas = lojas.filter((l) => l.user_id === p.id);
        return {
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          created_at: p.created_at,
          role: userRole?.role || "user",
          saldo: userCredito?.saldo || 0,
          lojas_count: userLojas.length,
        };
      });
    },
  });

  const addCreditsMutation = useMutation({
    mutationFn: async ({ userId, qty, desc }: { userId: string; qty: number; desc: string }) => {
      // Update saldo
      const { data: current } = await supabase
        .from("creditos")
        .select("saldo")
        .eq("user_id", userId)
        .single();

      const newSaldo = (current?.saldo || 0) + qty;

      const { error: updateErr } = await supabase
        .from("creditos")
        .update({ saldo: newSaldo, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (updateErr) throw updateErr;

      // Insert transaction
      const { error: insertErr } = await supabase.from("creditos_transacoes").insert({
        user_id: userId,
        tipo: "adicao",
        quantidade: qty,
        descricao: desc || "Adicionado pelo admin",
        admin_id: user!.id,
      });
      if (insertErr) throw insertErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-usuarios"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      setSelectedUser(null);
      setQuantidade("");
      setDescricao("");
      toast.success("Créditos adicionados com sucesso!");
    },
    onError: () => toast.error("Erro ao adicionar créditos."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !quantidade) return;
    const qty = parseInt(quantidade);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Quantidade inválida.");
      return;
    }
    addCreditsMutation.mutate({ userId: selectedUser.id, qty, desc: descricao });
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-foreground mb-6">Gestão de Usuários</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Todos os Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Créditos</TableHead>
                  <TableHead>Lojas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuarios.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell>{u.email || "—"}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-primary/20 text-primary" : "bg-secondary text-secondary-foreground"}`}>
                        {u.role}
                      </span>
                    </TableCell>
                    <TableCell>{format(new Date(u.created_at), "dd/MM/yyyy")}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        <Coins className="h-3.5 w-3.5 text-primary" />
                        {u.saldo}
                      </span>
                    </TableCell>
                    <TableCell>{u.lojas_count}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelectedUser(u)}>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Créditos
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Créditos</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Usuário: <strong className="text-foreground">{selectedUser.full_name || selectedUser.email}</strong>
                <br />
                Saldo atual: <strong className="text-primary">{selectedUser.saldo} moedas</strong>
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Quantidade</Label>
                <Input
                  type="number"
                  min="1"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  placeholder="Ex: 100"
                  required
                  className="bg-muted/30 focus:bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Descrição (opcional)</Label>
                <Input
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Bônus de boas-vindas"
                  className="bg-muted/30 focus:bg-background"
                />
              </div>
              <Button type="submit" className="w-full" disabled={addCreditsMutation.isPending}>
                {addCreditsMutation.isPending ? "Adicionando..." : "Adicionar Créditos"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
