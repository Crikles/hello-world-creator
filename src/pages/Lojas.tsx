import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Package, Plus, Store, LogOut, Shield, Coins } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Lojas() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nome, setNome] = useState("");

  const { data: saldo } = useQuery({
    queryKey: ["meu-saldo", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("creditos")
        .select("saldo")
        .eq("user_id", user!.id)
        .single();
      return data?.saldo ?? 0;
    },
    enabled: !!user,
  });

  const { data: lojas = [], isLoading } = useQuery({
    queryKey: ["lojas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lojas")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (nome: string) => {
      const slug = nome
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        + "-" + Math.random().toString(36).substring(2, 6);

      const { error } = await supabase.from("lojas").insert({
        user_id: user!.id,
        nome,
        slug,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lojas"] });
      setDialogOpen(false);
      setNome("");
      toast.success("Loja criada com sucesso!");
    },
    onError: (err: any) => {
      if (err.message?.includes("5 lojas")) {
        toast.error("Você já atingiu o limite de 5 lojas.");
      } else {
        toast.error("Erro ao criar loja.");
      }
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    createMutation.mutate(nome.trim());
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold text-foreground">Minhas Lojas</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm text-primary font-medium">
              <Coins className="h-4 w-4" />
              {saldo ?? 0}
            </span>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
                <Shield className="h-4 w-4 mr-1.5" />
                Admin
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted-foreground">
            Selecione uma loja para acessar o painel, ou crie uma nova.
          </p>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={lojas.length >= 5}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Loja
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Loja</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Nome da Loja</Label>
                  <Input
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Minha Loja Online"
                    required
                    className="bg-muted/30 focus:bg-background"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Criando..." : "Criar Loja"}
                </Button>
              </form>
              <p className="text-xs text-muted-foreground text-center">
                {lojas.length}/5 lojas utilizadas
              </p>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : lojas.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Store className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-1">Nenhuma loja ainda</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crie sua primeira loja para começar a gerenciar envios.
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Loja
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lojas.map((loja) => (
              <Card
                key={loja.id}
                className="cursor-pointer hover:border-primary/50 hover:shadow-lg transition-all group"
                onClick={() => navigate(`/loja/${loja.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Store className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{loja.nome}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Criada em {format(new Date(loja.created_at), "dd/MM/yyyy")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
