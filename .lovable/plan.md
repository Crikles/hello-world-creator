

## Plano: Restringir acesso à aba Recuperação

### O que será feito
- A aba "Recuperação" no menu lateral ficará visualmente desabilitada (cinza, sem clique) para todos os usuários, exceto `vdklanca@gmail.com`
- A rota `/recuperacao` também será protegida, redirecionando usuários não autorizados

### Alterações

**1. `src/components/layout/AppSidebar.tsx`**
- Adicionar flag `restricted` ao item "Recuperação" no menu
- No render do menu, verificar se o item é restrito e se o usuário atual NÃO é `vdklanca@gmail.com`
- Se restrito: renderizar como `<span>` com estilo desabilitado (opacity reduzida, cursor not-allowed, sem link) + badge "Em breve"
- Se não restrito (admin): renderizar normalmente como `<NavLink>`

**2. `src/pages/RecuperacaoVendas.tsx`**
- Adicionar guard no topo do componente: se `user?.email !== "vdklanca@gmail.com"`, redirecionar para o dashboard com `navigate`

### Resultado
- Usuários comuns veem "Recuperação" no menu mas não conseguem clicar — aparece como "Em breve"
- Apenas a conta admin (`vdklanca@gmail.com`) acessa normalmente

