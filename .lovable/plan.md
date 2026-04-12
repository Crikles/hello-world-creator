

## Plano: Criar páginas de Termos de Serviço e Política de Privacidade para Vetor e JL

### O que será feito

Criar 4 rotas novas no `LogisticsRoutes` e 2 páginas (uma para cada empresa), cada uma com conteúdo de Termos de Serviço e Política de Privacidade. Os links no footer de cada site serão atualizados para apontar para as novas rotas.

### Novas rotas

| Rota | Empresa |
|------|---------|
| `/termos` | Termos de Serviço (detecta automaticamente Vetor ou JL pelo domínio) |
| `/privacidade` | Política de Privacidade (detecta automaticamente Vetor ou JL pelo domínio) |

### Alterações técnicas

**1. Novo arquivo: `src/pages/TermosPrivacidade.tsx`**
- Componente que recebe prop `tipo` ("termos" ou "privacidade")
- Detecta `isVetor` pelo hostname (mesmo padrão do Rastreio.tsx)
- Renderiza o conteúdo com branding correto (cores, logo, nome da empresa)
- Layout simples: navbar no topo, conteúdo textual, footer
- Reutiliza os mesmos estilos de navbar/footer da respectiva empresa (Vetor verde ou JL indigo)
- Conteúdo genérico de termos/privacidade adaptado para uma empresa de transportes/logística

**2. `src/App.tsx`**
- Adicionar 2 rotas no `LogisticsRoutes`: `/termos` e `/privacidade`

**3. `src/pages/Rastreio.tsx`**
- Atualizar os 3 footers (Vetor, JL/Jadlog, JL default) para usar `<a href="/termos">` e `<a href="/privacidade">` em vez de `href="#"`

### Conteúdo das páginas
- **Termos de Serviço**: Uso do site, limitações, responsabilidades, propriedade intelectual
- **Política de Privacidade**: Dados coletados, uso dos dados, cookies, direitos do usuário (LGPD)
- Textos adaptados ao contexto de rastreamento de encomendas e logística

