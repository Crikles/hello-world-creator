

## Plano: Bloquear acesso mobile ao painel Magnus

### O que será feito

Criar um componente `MobileBlocker` que detecta se o dispositivo é mobile (largura < 768px) e, caso seja, exibe uma tela cheia com a mensagem "Site Desativado" impedindo qualquer interação. O bloqueio será aplicado **apenas nas rotas do painel** (login, lojas, dashboard, admin), **não** nas páginas públicas de rastreio/pagamento/falha que os leads acessam pelo celular.

### Alterações

**1. Novo componente `src/components/MobileBlocker.tsx`**

- Usa `window.innerWidth` e `matchMedia` para detectar mobile (< 768px)
- Renderiza uma tela cheia com fundo escuro, ícone de computador e mensagem:
  - Título: "Acesso Indisponível"
  - Texto: "Esta plataforma está disponível apenas para computadores. Acesse pelo seu desktop para continuar."
- Se desktop, renderiza `{children}` normalmente

**2. `src/App.tsx` — Envolver `PanelRoutes` com `MobileBlocker`**

```text
{logistics ? <LogisticsRoutes /> : <MobileBlocker><PanelRoutes /></MobileBlocker>}
```

Isso garante que:
- Páginas públicas de rastreio (`/r/...`), pagamento (`/p/...`), falha (`/f/...`) via domínio de logística **continuam acessíveis no mobile**
- Apenas o painel administrativo Magnus é bloqueado no mobile

### Resultado esperado
- Usuários mobile veem "Acesso Indisponível" ao tentar acessar magnusfrete.com
- Leads continuam acessando rastreio e pagamento normalmente no celular
- Desktop funciona sem alteração

