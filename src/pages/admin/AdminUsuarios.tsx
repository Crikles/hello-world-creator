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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Coins, Plus, Minus } from "lucide-react";
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
  const [operacao, setOperacao] = useState<"adicionar" | "remover">("adicionar");

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

  const manageCreditsMutation = useMutation({
    mutationFn: async ({ userId, qty, desc, action }: { userId: string; qty: number; desc: string; action: "adicionar" | "remover" }) => {
      // Fetch current saldo
      const { data: current } = await supabase
        .from("creditos")
        .select("saldo")
        .eq("user_id", userId)
        .single();

      const currentSaldo = current?.saldo || 0;
      let newSaldo = currentSaldo;

      if (action === "adicionar") {
        newSaldo += qty;
      } else {
        newSaldo -= qty;
        if (newSaldo < 0) {
          throw new Error("O usuário não possui saldo suficiente para esta remoção.");
        }
      }

      // Update saldo
      const { error: updateErr } = await supabase
        .from("creditos")
        .update({ saldo: newSaldo, updated_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (updateErr) throw updateErr;

      // Insert transaction
      const defaultDesc = action === "adicionar" ? "Adicionado pelo admin" : "Removido pelo admin";
      const { error: insertErr } = await supabase.from("creditos_transacoes").insert({
        user_id: userId,
        tipo: action === "adicionar" ? "adicao" : "remocao",
        quantidade: qty,
        descricao: desc || defaultDesc,
        admin_id: user!.id,
      });
      if (insertErr) throw insertErr;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-usuarios"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      setSelectedUser(null);
      setQuantidade("");
      setDescricao("");
      toast.success(variables.action === "adicionar" ? "Créditos adicionados com sucesso!" : "Créditos removidos com sucesso!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao gerenciar créditos.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !quantidade) return;
    const qty = parseInt(quantidade);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Quantidade inválida.");
      return;
    }
    manageCreditsMutation.mutate({ userId: selectedUser.id, qty, desc: descricao, action: operacao });
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
                      <Button size="sm" variant="outline" onClick={() => {
                        setSelectedUser(u);
                        setOperacao("adicionar");
                      }}>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Gerenciar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedUser} onOpenChange={(open) => {
        if (!open) {
          setSelectedUser(null);
          setQuantidade("");
          setDescricao("");
          setOperacao("adicionar");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Créditos</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-6 mt-2">
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg border border-border/50">
                Usuário: <strong className="text-foreground">{selectedUser.full_name || selectedUser.email}</strong>
                <br />
                Saldo atual: <strong className="text-primary">{selectedUser.saldo} moedas</strong>
              </p>

              <Tabs defaultValue="adicionar" value={operacao} onValueChange={(v) => setOperacao(v as "adicionar" | "remover")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="adicionar" className="data-[state=active]:bg-green-500/10 data-[state=active]:text-green-600">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar
                  </TabsTrigger>
                  <TabsTrigger value="remover" className="data-[state=active]:bg-red-500/10 data-[state=active]:text-red-500">
                    <Minus className="h-4 w-4 mr-2" />
                    Remover
                  </TabsTrigger>
                </TabsList>

                <form onSubmit={handleSubmit} className="space-y-4 mt-6">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Quantidade</Label>
                    <Input
                      type="number"
                      min="1"
                      max={operacao === "remover" ? selectedUser.saldo : undefined}
                      value={quantidade}
                      onChange={(e) => setQuantidade(e.target.value)}
                      placeholder={operacao === "adicionar" ? "Ex: 100" : "Ex: 50"}
                      required
                      className="bg-muted/30 focus:bg-background"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Descrição (opcional)</Label>
                    <Input
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder={operacao === "adicionar" ? "Ex: Bônus de boas-vindas" : "Ex: Ajuste de erro sistêmico"}
                      className="bg-muted/30 focus:bg-background"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    variant={operacao === "remover" ? "destructive" : "default"}
                    disabled={manageCreditsMutation.isPending}
                  >
                    {manageCreditsMutation.isPending
                      ? "Processando..."
                      : operacao === "adicionar" ? "Adicionar Créditos" : "Remover Créditos"}
                  </Button>
                </form>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
