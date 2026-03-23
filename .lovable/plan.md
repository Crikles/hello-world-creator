

## Plano: Redesign da Documentação com Layout Split + Fix JSON

### Problemas identificados

1. **JSON inválido**: Quando o usuário digita aspas curvas (`"` `"` — smart quotes) no textarea, o `JSON.parse()` falha. Precisa sanitizar automaticamente para aspas retas (`"`)
2. **Layout**: Atualmente tudo em coluna única. Usuário quer docs à esquerda, sandbox de teste à direita
3. **Sandbox incompleto**: Mostra apenas o payload JSON, deveria mostrar o request completo (URL, método, headers, body)

### Correções

**Arquivo: `src/pages/DocumentacaoPublica.tsx`** — rewrite completo do layout

**1. Layout split (duas colunas)**
- Hero + Token input no topo (full width)
- Abaixo: grid `lg:grid-cols-[1fr,420px]`
  - **Esquerda**: Endpoint, Exemplos de código, Campos do Payload, Respostas de sucesso/erro, FAQ
  - **Direita**: Sandbox de teste (sticky, acompanha scroll) com request completo e resultado

**2. Sanitização de caracteres especiais no textarea**
- Antes do `JSON.parse()`, substituir automaticamente:
  - `"` `"` → `"` (smart quotes)
  - `–` → `-` (em dash) — opcional, não quebra JSON
  - `'` `'` → `'` (smart single quotes)
- Aplicar sanitização no `onChange` do textarea e no `handleTestRequest`

**3. Sandbox completo mostrando request inteiro**
- Mostrar acima do textarea editável:
  - Método + URL: `POST https://...?token=XXX`
  - Header: `Content-Type: application/json`
- Textarea com o body JSON editável
- Botão de enviar + resultado abaixo

**4. API backend — sem alteração necessária**
- A edge function recebe JSON já parseado pelo runtime, então aspas curvas não chegam lá — o problema é 100% client-side no `JSON.parse()`
- Caracteres especiais como acentos, traços e aspas dentro de strings JSON são totalmente válidos quando as aspas de delimitação são retas

### Arquivos alterados
- `src/pages/DocumentacaoPublica.tsx` — layout split + sanitização + sandbox completo

