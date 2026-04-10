

## Ativar Recuperação para backupativado@gmail.com

### Problema
A funcionalidade de Recuperação de Vendas está restrita apenas ao email `vdklanca@gmail.com` em dois lugares do código.

### Alterações

**1. `src/components/layout/AppSidebar.tsx` (linha 68)**
Alterar a verificação para incluir ambos os emails:
```typescript
const isRecoveryAllowed = user?.email === "vdklanca@gmail.com" || user?.email === "backupativado@gmail.com";
```

**2. `src/pages/RecuperacaoVendas.tsx` (linha 1058)**
Alterar o guard de redirecionamento para permitir ambos:
```typescript
if (user && user.email !== "vdklanca@gmail.com" && user.email !== "backupativado@gmail.com") {
```

### Resultado
- `backupativado@gmail.com` verá o menu Recuperação habilitado e poderá acessar a página
- Todos os demais usuários continuam bloqueados com o badge "Em breve"

