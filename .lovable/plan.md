

# Adicionar seção "Parceiros Oficiais" na Sidebar

## O que será feito

Adicionar uma nova seção na barra lateral chamada **"Parceiros Oficiais"** com a logo da IntegraX e uma breve descrição. Ao clicar na imagem, o usuário será redirecionado para o link de cadastro da IntegraX.

## Alterações

### 1. Copiar a imagem da IntegraX para o projeto
- Salvar a imagem enviada em `src/assets/logo-integrax.jpeg`

### 2. Atualizar `src/components/layout/AppSidebar.tsx`
- Importar a imagem da IntegraX
- Adicionar um novo `SidebarGroup` entre o menu e o footer com:
  - Label: "Parceiros Oficiais"
  - Logo da IntegraX clicável (abre `https://integrax.app/auth/register?a=0Zleb3` em nova aba)
  - Texto descritivo: "Parceira oficial de envios de SMS para todos os eventos de vendas"
- O bloco terá um visual discreto e elegante, seguindo o estilo glass/glow já existente na sidebar

### Detalhes tecnicos

O novo grupo ficará posicionado após o menu principal e antes do footer, usando os mesmos componentes `SidebarGroup`, `SidebarGroupLabel` e `SidebarGroupContent` já utilizados. A imagem será um link (`<a>`) com `target="_blank"` e `rel="noopener noreferrer"`.

