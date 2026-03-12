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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Package, Plus, Store, LogOut, Shield, Coins, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Lojas() {
  const { user, signOut, isImpersonating, exitImpersonation } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [renameDialog, setRenameDialog] = useState<{ open: boolean; lojaId: string; nome: string }>({ open: false, lojaId: "", nome: "" });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; lojaId: string; nome: string }>({ open: false, lojaId: "", nome: "" });

  const { data: profile } = useQuery({
    queryKey: ["meu-perfil", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

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
        .eq("user_id", user!.id)
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

  const renameMutation = useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const { error } = await supabase.from("lojas").update({ nome }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lojas"] });
      setRenameDialog({ open: false, lojaId: "", nome: "" });
      toast.success("Loja renomeada!");
    },
    onError: () => toast.error("Erro ao renomear loja."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("postagem_email_log").delete().eq("loja_id", id);
      await supabase.from("postagem_config").delete().eq("loja_id", id);
      await supabase.from("envios").delete().eq("loja_id", id);
      await supabase.from("pedidos").delete().eq("loja_id", id);
      await supabase.from("empresas").delete().eq("loja_id", id);
      await supabase.from("webhook_logs").delete().eq("loja_id", id);
      await supabase.from("checkout_integrations").delete().eq("loja_id", id);
      await supabase.from("shopify_integrations").delete().eq("loja_id", id);
      await supabase.from("leads").delete().eq("loja_id", id);
      const { data: templates } = await supabase.from("postagem_templates").select("id").eq("loja_id", id);
      if (templates?.length) {
        const ids = templates.map(t => t.id);
        await supabase.from("postagem_eventos").delete().in("template_id", ids);
        await supabase.from("postagem_templates").delete().eq("loja_id", id);
      }
      const { error } = await supabase.from("lojas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lojas"] });
      setDeleteDialog({ open: false, lojaId: "", nome: "" });
      toast.success("Loja excluída com sucesso!");
    },
    onError: () => toast.error("Erro ao excluir loja."),
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
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Immersive Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsla(43,74%,49%,0.04)_0%,_transparent_70%)]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-40" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 glass-strong">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src="/logo-magnus.png" alt="Magnus Frete" className="h-10 w-auto" />
            <span className="text-lg font-bold text-foreground tracking-tight">Magnus</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass glow-border text-sm text-primary font-semibold">
              <Coins className="h-3.5 w-3.5 animate-glow-pulse" />
              {saldo ?? 0}
            </div>
            {isAdmin && (
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary transition-colors" onClick={() => navigate("/admin")}>
                <Shield className="h-4 w-4 mr-1.5" />
                Admin
              </Button>
            )}
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary transition-colors" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1.5" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="mb-12 text-center">
          <div className="inline-block relative mb-4">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
              Olá {profile?.full_name || user?.email?.split("@")[0] || ""}, seja bem-vindo à <span className="text-primary">Magnus</span>!
            </h1>
            <div className="absolute -inset-x-8 -inset-y-4 bg-[radial-gradient(ellipse_at_center,_hsla(43,74%,49%,0.08)_0%,_transparent_70%)] pointer-events-none" />
          </div>
          <p className="text-muted-foreground text-base max-w-md mx-auto mb-2">
            Selecione uma loja para acessar o painel, ou crie uma nova.
          </p>
          <p className="text-xs text-muted-foreground/60 mb-8">
            {lojas.length}/5 lojas ativas
          </p>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                disabled={lojas.length >= 5}
                className="shimmer-btn px-8 py-3 rounded-xl text-sm font-semibold glow-border transition-all hover:scale-[1.02]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nova Loja
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-strong border-primary/10">
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
                    className="bg-muted/30 focus:bg-background border-primary/10 focus:border-primary/30"
                  />
                </div>
                <Button type="submit" className="w-full shimmer-btn" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Criando..." : "Criar Loja"}
                </Button>
              </form>
              <p className="text-xs text-muted-foreground text-center">
                {lojas.length}/5 lojas utilizadas
              </p>
            </DialogContent>
          </Dialog>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-32 rounded-2xl skeleton-shimmer" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        ) : lojas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative mb-8">
              <div className="h-20 w-20 rounded-2xl glass glow-border flex items-center justify-center animate-float">
                <Store className="h-10 w-10 text-primary/40" />
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary/30 animate-orbit" style={{ animationDuration: '6s' }} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary/20 animate-orbit" style={{ animationDuration: '10s', animationDelay: '2s' }} />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Nenhuma loja ainda</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs text-center">
              Crie sua primeira loja para começar a gerenciar seus envios.
            </p>
            <Button className="shimmer-btn glow-border rounded-xl" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeira Loja
            </Button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {lojas.map((loja, index) => (
              <div
                key={loja.id}
                className="animate-stagger-in cursor-pointer group"
                style={{ animationDelay: `${index * 0.08}s` }}
                onClick={() => navigate(`/loja/${loja.id}`)}
              >
                <div className="relative rounded-2xl glass glow-border glow-border-hover p-5 transition-all duration-300 hover:scale-[1.02]">
                  <div className="flex items-start gap-4">
                    {/* Store icon with rotating ring */}
                    <div className="relative flex-shrink-0">
                      <div className="h-12 w-12 rounded-xl bg-primary/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <Store className="h-6 w-6 text-primary" />
                      </div>
                      {/* Active dot */}
                      <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary animate-pulse-dot" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate text-base">{loja.nome}</h3>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                        <span className="inline-block w-1 h-1 rounded-full bg-muted-foreground/40" />
                        {format(new Date(loja.created_at), "dd/MM/yyyy")}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="glass-strong border-primary/10" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => setRenameDialog({ open: true, lojaId: loja.id, nome: loja.nome })}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Renomear
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setDeleteDialog({ open: true, lojaId: loja.id, nome: loja.nome })}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Rename Dialog */}
      <Dialog open={renameDialog.open} onOpenChange={(open) => !open && setRenameDialog({ open: false, lojaId: "", nome: "" })}>
        <DialogContent className="glass-strong border-primary/10">
          <DialogHeader>
            <DialogTitle>Renomear Loja</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!renameDialog.nome.trim()) return;
              renameMutation.mutate({ id: renameDialog.lojaId, nome: renameDialog.nome.trim() });
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome da Loja</Label>
              <Input
                value={renameDialog.nome}
                onChange={(e) => setRenameDialog((prev) => ({ ...prev, nome: e.target.value }))}
                required
                className="bg-muted/30 focus:bg-background border-primary/10 focus:border-primary/30"
              />
            </div>
            <Button type="submit" className="w-full" disabled={renameMutation.isPending}>
              {renameMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete AlertDialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, lojaId: "", nome: "" })}>
        <AlertDialogContent className="glass-strong border-primary/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{deleteDialog.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Todos os dados da loja serão perdidos (envios, pedidos, empresa, etc). Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate(deleteDialog.lojaId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
