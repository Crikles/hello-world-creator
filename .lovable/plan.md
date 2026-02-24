

# Bordas Coloridas nos Eventos e Botao de Salvar Manual

## Resumo

Duas mudancas principais:
1. Cada card de evento tera borda **verde** quando a funcionalidade correspondente esta ativa e borda **vermelha** quando desativada
2. Remover salvamento automatico e adicionar um botao **Salvar** manual no final da pagina

## Logica de ativacao por evento

Cada evento sera mapeado para o toggle correspondente no config:

| Evento | Campo do config |
|--------|----------------|
| Primeiro evento (NF/Postado) | `enviar_nfe_email` |
| Eventos de rastreio (Coletado, Em Transito, Centro Local, Saiu para Entrega, Entregue) | `enviar_emails` |
| Eventos de taxacao (Taxacao, Pago) | `ativar_taxacao` |

## O que muda

### 1. Bordas coloridas nos cards de eventos

Atualmente so o primeiro evento tem borda verde. A mudanca fara com que:
- **Ativo** (toggle ligado): `border-green-500/50 bg-green-50/20`
- **Inativo** (toggle desligado): `border-red-500/50 bg-red-50/20`

### 2. Salvamento manual (botao SAVE)

Atualmente os toggles e delays salvam automaticamente no banco. A mudanca:
- Criar estado local para as configuracoes (`localConfig`) e delays (`localDelays`)
- Os toggles e inputs de delay alterarao apenas o estado local
- Um botao "Salvar" aparecera no final da secao de eventos
- Ao clicar em Salvar, faz as chamadas ao banco (update config + update delays de cada evento alterado)
- Desabilitar o botao se nao houver mudancas pendentes

## Detalhes Tecnicos

### Arquivo modificado: `src/pages/Postagens.tsx`

**Estado local:**
```typescript
const [localConfig, setLocalConfig] = useState<PostagemConfig | null>(null);
const [localDelays, setLocalDelays] = useState<Record<string, number>>({});

// Sincronizar quando dados carregam
useEffect(() => {
  if (config) setLocalConfig(config);
}, [config]);

useEffect(() => {
  if (activeEventos) {
    const delays: Record<string, number> = {};
    activeEventos.forEach(e => { delays[e.id] = e.delay_horas; });
    setLocalDelays(delays);
  }
}, [activeEventos]);
```

**Funcao para determinar se evento esta ativo:**
```typescript
function isEventoAtivo(evento, localConfig) {
  if (evento.enviar_nfe_pdf) return localConfig.enviar_nfe_email;
  if (evento.status_label === "Taxação" || evento.status_label === "Pago") 
    return localConfig.ativar_taxacao;
  return localConfig.enviar_emails;
}
```

**Borda condicional no Card:**
```typescript
const ativo = isEventoAtivo(evento, localConfig);
<Card className={ativo ? "border-green-500/50 bg-green-50/10" : "border-red-500/50 bg-red-50/10"}>
```

**Toggles alteram estado local (nao salvam):**
```typescript
onCheckedChange={() => {
  setLocalConfig(prev => prev ? {...prev, enviar_emails: !prev.enviar_emails} : prev);
}}
```

**Delay altera estado local:**
```typescript
onChange={(delay_horas) => {
  setLocalDelays(prev => ({...prev, [evento.id]: delay_horas}));
}}
```

**Deteccao de mudancas pendentes:**
```typescript
const hasChanges = useMemo(() => {
  if (!config || !localConfig) return false;
  const configChanged = 
    config.enviar_emails !== localConfig.enviar_emails ||
    config.enviar_nfe_email !== localConfig.enviar_nfe_email ||
    config.ativar_site_rastreio !== localConfig.ativar_site_rastreio ||
    config.ativar_taxacao !== localConfig.ativar_taxacao;
  const delaysChanged = activeEventos?.some(
    e => localDelays[e.id] !== e.delay_horas
  );
  return configChanged || delaysChanged;
}, [config, localConfig, activeEventos, localDelays]);
```

**Mutation de salvar tudo:**
```typescript
const saveAll = useMutation({
  mutationFn: async () => {
    // 1. Update config
    await supabase.from("postagem_config")
      .update({
        enviar_emails: localConfig.enviar_emails,
        enviar_nfe_email: localConfig.enviar_nfe_email,
        ativar_site_rastreio: localConfig.ativar_site_rastreio,
        ativar_taxacao: localConfig.ativar_taxacao,
      })
      .eq("loja_id", loja.id);
    // 2. Update delays alterados
    for (const evento of activeEventos) {
      if (localDelays[evento.id] !== evento.delay_horas) {
        await supabase.from("postagem_eventos")
          .update({ delay_horas: localDelays[evento.id] })
          .eq("id", evento.id);
      }
    }
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["postagem-config"] });
    queryClient.invalidateQueries({ queryKey: ["postagem-eventos-active"] });
    toast({ title: "Configurações salvas!" });
  },
});
```

**Botao Salvar no final:**
```text
+------------------------------------------+
| [Salvar Alteracoes]  (desabilitado se     |
|  nao ha mudancas pendentes)               |
+------------------------------------------+
```

O botao ficara fixo abaixo dos eventos, com destaque visual quando houver mudancas pendentes.

### Custo estimado

O card de custo estimado passara a usar `localConfig` em vez de `config`, refletindo o custo antes de salvar.

