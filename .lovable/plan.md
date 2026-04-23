

## Trocar logo da JL para a nova logo Jet Line Transportes

### Escopo
Substituir apenas o **arquivo da logo** usada no domínio de logística JL (`rastreio.jltransportelogistica.com`) e em qualquer referência ao branding "Logística JL Transportes" dentro do app. Os textos permanecem como "JL Transportes" / "Logística JL Transportes" (já que JL agora significa Jet Line). Razão social fiscal **não muda**.

### O que será feito

1. **Subir a nova logo Jet Line** enviada pelo usuário para `public/logojltransportes.png` (sobrescreve o arquivo atual). Como todas as referências no código já apontam para esse caminho, o swap propaga automaticamente para:
   - Login / Signup / ResetPassword (`/logojltransportes.png`)
   - Sidebar do app (`AppSidebar.tsx`)
   - Página pública de Rastreio (`/rastreio/...`)
   - Página pública de Pagamento/Taxação (`/p/...`)
   - Página pública de Falha de Entrega (`/falha/...`)
   - Preview de configuração de Falha (`FailedDeliveryConfig.tsx`)
   - Qualquer template de e-mail que referencie a logo via URL pública

2. **Atualizar o favicon** do domínio de logística:
   - Substituir `public/favicon.png` (e remover `public/favicon.ico` para evitar fallback) por uma versão quadrada da nova logo Jet Line.

3. **PWA / manifest** (`public/manifest.json`): atualizar o ícone se ele apontar para a logo antiga, garantindo que o app instalado mostre a nova marca.

### O que NÃO muda
- Textos: "JL Transportes", "Logística JL Transportes", "JL Transportadora e Logística LTDA" permanecem
- Razão social fiscal na DANFE (HOLDING Transportes de Cargas LTDA)
- Cores e tema dark/indigo da página de rastreio JL
- Logos da Vetor, Jadlog e Magnus (intactas)
- Domínio `rastreio.jltransportelogistica.com` e e-mails de envio

### Arquivos afetados
- `public/logojltransportes.png` (substituir)
- `public/favicon.png` (substituir pela nova marca)
- `public/favicon.ico` (remover)
- `public/manifest.json` (verificar/atualizar referência de ícone)

### Observação
A nova logo é horizontal (proporção ~3:2). Em locais onde ela é renderizada como ícone quadrado pequeno (sidebar `h-12 w-12`, preview de e-mail `h-9 w-9 rounded-full`), a imagem horizontal pode ficar comprimida ou cortada. Posso entregar **duas versões** no upload: a horizontal completa para Login/Rastreio/Pagamento, e uma versão quadrada/icônica (só o emblema circular do JL com caminhão) para sidebar e favicon — me avise se quer que eu faça essa separação ou se posso usar a mesma imagem em todos os lugares com `object-contain`.

