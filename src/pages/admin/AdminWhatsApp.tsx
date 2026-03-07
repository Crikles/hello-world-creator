import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Trash2, Smartphone, Wifi, WifiOff, RefreshCw, CreditCard, CalendarX } from "lucide-react";
import { format } from "date-fns";

interface InstanceWithLoja {
  id: string;
  instance_name: string;
  phone: string | null;
  status: string;
  created_at: string;
  expires_at: string | null;
  loja_id: string;
  lojas: {
    nome: string;
    user_id: string;
    profiles?: { full_name: string | null; email: string | null } | null;
  } | null;
}

interface SubscriptionWithLoja {
  id: string;
  created_at: string;
  expires_at: string;
  price_paid: number;
  user_id: string;
  loja_id: string;
  lojas: { nome: string } | null;
  profiles?: { full_name: string | null; email: string | null } | null;
}

export default function AdminWhatsApp() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [subSearch, setSubSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<InstanceWithLoja | null>(null);
  const [deleteSubTarget, setDeleteSubTarget] = useState<SubscriptionWithLoja | null>(null);

  // --- Instances ---
  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["admin-whatsapp-instances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("id, instance_name, phone, status, created_at, expires_at, loja_id, lojas(nome, user_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = [...new Set((data || []).map((i: any) => i.lojas?.user_id).filter(Boolean))];
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
        if (profiles) profiles.forEach((p) => { profilesMap[p.id] = p; });
      }

      return (data || []).map((i: any) => ({
        ...i,
        lojas: i.lojas ? { ...i.lojas, profiles: profilesMap[i.lojas.user_id] || null } : null,
      })) as InstanceWithLoja[];
    },
  });

  // --- Subscriptions ---
  const { data: subscriptions = [], isLoading: subsLoading } = useQuery({
    queryKey: ["admin-whatsapp-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_subscriptions")
        .select("id, created_at, expires_at, price_paid, user_id, loja_id, lojas(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = [...new Set((data || []).map((s: any) => s.user_id).filter(Boolean))];
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
        if (profiles) profiles.forEach((p) => { profilesMap[p.id] = p; });
      }

      return (data || []).map((s: any) => ({
        ...s,
        profiles: profilesMap[s.user_id] || null,
      })) as SubscriptionWithLoja[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (instance: InstanceWithLoja) => {
      // Delete from UAZAPI first, then from DB (same as user flow)
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: { action: "delete", loja_id: instance.loja_id, instance_id: instance.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("Instância removida com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["admin-whatsapp-instances"] });
      setDeleteTarget(null);
    },
    onError: (err: any) => toast.error("Erro ao remover instância: " + err.message),
  });

  const deleteSubMutation = useMutation({
    mutationFn: async (subId: string) => {
      // Also unlink instances tied to this subscription
      await supabase.from("whatsapp_instances").update({ subscription_id: null, expires_at: null }).eq("subscription_id", subId);
      const { error } = await supabase.from("whatsapp_subscriptions").delete().eq("id", subId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assinatura removida com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["admin-whatsapp-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-whatsapp-instances"] });
      setDeleteSubTarget(null);
    },
    onError: (err: any) => toast.error("Erro ao remover assinatura: " + err.message),
  });

  const filteredInstances = instances.filter((i) => {
    const q = search.toLowerCase();
    return (
      i.instance_name.toLowerCase().includes(q) ||
      (i.phone || "").toLowerCase().includes(q) ||
      (i.lojas?.nome || "").toLowerCase().includes(q) ||
      (i.lojas?.profiles?.full_name || "").toLowerCase().includes(q) ||
      (i.lojas?.profiles?.email || "").toLowerCase().includes(q)
    );
  });

  const filteredSubs = subscriptions.filter((s) => {
    const q = subSearch.toLowerCase();
    return (
      (s.lojas?.nome || "").toLowerCase().includes(q) ||
      (s.profiles?.full_name || "").toLowerCase().includes(q) ||
      (s.profiles?.email || "").toLowerCase().includes(q)
    );
  });

  const statusBadge = (status: string) => {
    if (status === "connected") return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30"><Wifi className="h-3 w-3 mr-1" />Conectado</Badge>;
    if (status === "connecting") return <Badge variant="outline" className="bg-accent/50 text-accent-foreground border-accent"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Conectando</Badge>;
    return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30"><WifiOff className="h-3 w-3 mr-1" />Desconectado</Badge>;
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">WhatsApp</h1>
          <p className="text-muted-foreground text-sm">Gerencie instâncias e assinaturas de WhatsApp dos usuários</p>
        </div>

        <Tabs defaultValue="instances">
          <TabsList>
            <TabsTrigger value="instances" className="gap-2"><Smartphone className="h-4 w-4" />Instâncias ({instances.length})</TabsTrigger>
            <TabsTrigger value="subscriptions" className="gap-2"><CreditCard className="h-4 w-4" />Assinaturas ({subscriptions.length})</TabsTrigger>
          </TabsList>

          {/* === INSTANCES TAB === */}
          <TabsContent value="instances">
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-primary" />
                    {filteredInstances.length} instância{filteredInstances.length !== 1 ? "s" : ""}
                  </CardTitle>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-center text-muted-foreground py-8">Carregando...</p>
                ) : filteredInstances.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhuma instância encontrada.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Usuário</TableHead>
                          <TableHead>Loja</TableHead>
                          <TableHead>Instância</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Criada em</TableHead>
                          <TableHead>Expira em</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInstances.map((inst) => (
                          <TableRow key={inst.id}>
                            <TableCell>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{inst.lojas?.profiles?.full_name || "—"}</p>
                                <p className="text-xs text-muted-foreground truncate">{inst.lojas?.profiles?.email || "—"}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{inst.lojas?.nome || "—"}</TableCell>
                            <TableCell className="text-xs font-mono">{inst.instance_name}</TableCell>
                            <TableCell className="text-sm">{inst.phone || "—"}</TableCell>
                            <TableCell>{statusBadge(inst.status)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{format(new Date(inst.created_at), "dd/MM/yyyy")}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{inst.expires_at ? format(new Date(inst.expires_at), "dd/MM/yyyy") : "—"}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(inst)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === SUBSCRIPTIONS TAB === */}
          <TabsContent value="subscriptions">
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    {filteredSubs.length} assinatura{filteredSubs.length !== 1 ? "s" : ""}
                  </CardTitle>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar..." value={subSearch} onChange={(e) => setSubSearch(e.target.value)} className="pl-9" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {subsLoading ? (
                  <p className="text-center text-muted-foreground py-8">Carregando...</p>
                ) : filteredSubs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhuma assinatura encontrada.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Usuário</TableHead>
                          <TableHead>Loja</TableHead>
                          <TableHead>Valor Pago</TableHead>
                          <TableHead>Criada em</TableHead>
                          <TableHead>Expira em</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSubs.map((sub) => (
                          <TableRow key={sub.id}>
                            <TableCell>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{sub.profiles?.full_name || "—"}</p>
                                <p className="text-xs text-muted-foreground truncate">{sub.profiles?.email || "—"}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{sub.lojas?.nome || "—"}</TableCell>
                            <TableCell className="text-sm font-medium">{sub.price_paid} moedas</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{format(new Date(sub.created_at), "dd/MM/yyyy")}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{format(new Date(sub.expires_at), "dd/MM/yyyy")}</TableCell>
                            <TableCell>
                              {isExpired(sub.expires_at) ? (
                                <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                                  <CalendarX className="h-3 w-3 mr-1" />Expirada
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">Ativa</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteSubTarget(sub)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Instance Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover instância</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover a instância <strong>{deleteTarget?.instance_name}</strong> do usuário <strong>{deleteTarget?.lojas?.profiles?.full_name || deleteTarget?.lojas?.profiles?.email}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              {deleteMutation.isPending ? "Removendo..." : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Subscription Dialog */}
      <Dialog open={!!deleteSubTarget} onOpenChange={() => setDeleteSubTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover assinatura</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover a assinatura do usuário <strong>{deleteSubTarget?.profiles?.full_name || deleteSubTarget?.profiles?.email}</strong>? As instâncias vinculadas perderão a validade e o acesso será revogado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSubTarget(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={deleteSubMutation.isPending} onClick={() => deleteSubTarget && deleteSubMutation.mutate(deleteSubTarget.id)}>
              {deleteSubMutation.isPending ? "Removendo..." : "Remover Assinatura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
