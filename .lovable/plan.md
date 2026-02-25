
# Isolamento Completo de Rotas entre Dominios

## Problema

Ao acessar `logisticajltransportes.com/r/`, o usuario e redirecionado para `app.magnusfrete.site/r/`. Isso provavelmente acontece porque o DNS do dominio de logistica esta configurado como **redirecionamento** (redirect 301/302) em vez de **apontamento A record** para o IP do Lovable. Alem disso, as rotas `/r` e `/p` estao disponiveis em ambos os dominios no codigo atual.

## O que precisa ser feito

### 1. DNS (acao do usuario na Hostinger)

O dominio `logisticajltransportes.com` precisa ter um **A record** apontando para `185.158.133.1` (IP do Lovable), e NAO um redirecionamento para outro dominio. Se houver um redirect configurado na Hostinger, ele precisa ser removido.

### 2. Remover rotas `/r` e `/p` do PanelRoutes (codigo)

Atualmente, `PanelRoutes` (dominio `app.magnusfrete.site`) inclui as rotas de rastreio e pagamento. Essas rotas devem ser removidas para que o painel nao sirva paginas de logistica.

### 3. Confirmar que LogisticsRoutes so tem rastreio/pagamento

Ja esta correto no codigo atual - apenas `/`, `/r`, `/r/:codigoParam` e `/p/:envioId`.

---

## Detalhes Tecnicos

### Arquivo: `src/App.tsx`

Remover estas rotas de `PanelRoutes`:

```tsx
// REMOVER estas linhas:
<Route path="/p/:envioId" element={<Pagamento />} />
<Route path="/r" element={<Rastreio />} />
<Route path="/r/:codigoParam" element={<Rastreio />} />
```

Resultado final do `PanelRoutes`:

```tsx
function PanelRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/lojas" element={<ProtectedRoute><Lojas /></ProtectedRoute>} />
        <Route path="/loja/:lojaId/*" element={<ProtectedRoute><LojaRoutes /></ProtectedRoute>} />
        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/usuarios" element={<AdminRoute><AdminUsuarios /></AdminRoute>} />
        <Route path="/admin/email" element={<AdminRoute><AdminEmail /></AdminRoute>} />
        <Route path="/admin/creditos" element={<AdminRoute><AdminCreditos /></AdminRoute>} />
        <Route path="/admin/templates" element={<AdminRoute><AdminTemplates /></AdminRoute>} />
        <Route path="/" element={<Navigate to="/lojas" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
```

`LogisticsRoutes` permanece como esta (sem alteracao).

### Arquivo: `src/lib/domain-config.ts`

Adicionar `www.logisticajltransportes.com` para cobrir acesso com www (ja esta la, confirmar).

---

## Resumo das mudancas

| Arquivo | Mudanca |
|---|---|
| `src/App.tsx` | Remover rotas `/r`, `/r/:codigoParam` e `/p/:envioId` do PanelRoutes |

## Acao necessaria do usuario

Verificar na Hostinger se `logisticajltransportes.com` tem um **redirecionamento** configurado para `app.magnusfrete.site`. Se sim, remover esse redirecionamento e configurar apenas o **A record** apontando para `185.158.133.1`.
