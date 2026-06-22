## Diagnóstico

### Onde estão os templates Globais hoje
Os templates do Fluxo Global (10 passos × EN/ES, e-mail + SMS) **não estão no Painel Admin**. Eles vivem **hardcoded** em `supabase/functions/send-global-flow/templates.ts` (arquivo Deno na edge function). Nenhum admin pode editá-los pela UI — só editando o código.

O único editor "global" no app é o `GlobalPaymentEmailEditor` (página /:lojaId/global → aba Confirmação de Pagamento), que cobre **apenas o e-mail de confirmação de pagamento internacional** e é por loja, não global do sistema.

### Por que o idioma "não vai" conforme escolhido
Fluxo do idioma:
1. Usuário escolhe EN ou ES em `/:lojaId/global` → grava `global_flow_config.idioma`.
2. Quando um envio é criado, o trigger `apply_global_flow_on_envio` lê `config.idioma` e **trava** em `envios.global_flow_lang`.
3. `send-global-flow` usa `envio.global_flow_lang` (com fallback para `config.idioma`, depois `"en"`).

Causas possíveis do "idioma errado":
- **Envios antigos** foram criados quando `config.idioma` ainda era `"en"` (padrão). Mudar o idioma na UI depois **não atualiza envios já existentes** — o campo é travado na criação.
- Loja sem `global_flow_config` cadastrada → fallback `"en"`.
- Em alguns webhooks/inserts o trigger pode estar sendo bypassado (insert via service_role em campos parciais).

## Mudanças

### 1) Banco — nova tabela de templates de sistema (EN/ES)

```sql
CREATE TABLE public.global_flow_system_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step_order int NOT NULL CHECK (step_order BETWEEN 1 AND 10),
  lang text NOT NULL CHECK (lang IN ('en','es')),
  step_key text NOT NULL,
  status_label text NOT NULL,           -- ex: "Order Received" / "Pedido Recibido"
  assunto_email text NOT NULL,
  corpo_email text NOT NULL,            -- HTML/markdown com {{nome}} {{produto}} {{link}} {{empresa}} {{origem}}
  sms_texto text NOT NULL,              -- SMS com {{nome}} {{link}}
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(step_order, lang)
);

GRANT SELECT ON public.global_flow_system_templates TO anon, authenticated;
GRANT ALL    ON public.global_flow_system_templates TO service_role;

ALTER TABLE public.global_flow_system_templates ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer um autenticado vê (templates do sistema, não dados sensíveis)
CREATE POLICY "read system global templates" ON public.global_flow_system_templates
  FOR SELECT TO authenticated, anon USING (true);

-- Escrita: só admin
CREATE POLICY "admin manage system global templates" ON public.global_flow_system_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

Seed: 20 linhas (10 passos × 2 idiomas) extraídas do conteúdo atual de `templates.ts`.

### 2) Admin — nova aba em /admin/templates

Editar `src/pages/admin/AdminTemplates.tsx` para adicionar **um terceiro card** "Templates Globais (Internacional)" abaixo dos templates nacionais, contendo:

- Toggle de idioma no topo: `[ English ] [ Español ]`
- Lista dos 10 passos do idioma selecionado (Order Received → Delivered)
- Cada passo abre o `EmailEditor` existente com campos: `assunto_email`, `corpo_email`, e um novo campo `sms_texto`
- Botão "Restaurar padrão" por passo (re-aplica seed)

Reutilizar `EmailEditor` (estender com prop opcional `smsTexto`/`onSmsChange`).

### 3) Edge function `send-global-flow`

Substituir o uso de `EMAIL_TEMPLATES[lang][step]` / `SMS_TEMPLATES[lang][step]` por leitura de `global_flow_system_templates` (cached por invocação). Interpolar `{{nome}}`, `{{produto}}`, `{{empresa}}`, `{{origem}}`, `{{link}}`, `{{rastreio}}`. Fallback para o hardcoded atual se a linha não existir (defesa em profundidade).

### 4) Correção do idioma

- **Backfill (migration única):** atualizar `envios` internacionais ativos para alinhar com o `idioma` atual da loja, **apenas para envios que ainda não passaram do passo 1** (não quebra histórico):
  ```sql
  UPDATE envios e SET global_flow_lang = c.idioma
  FROM global_flow_config c
  WHERE e.loja_id = c.loja_id
    AND e.is_international = true
    AND coalesce(e.ultimo_evento_ordem, 0) <= 1
    AND coalesce(e.global_flow_lang,'') <> c.idioma;
  ```

- **Override por envio na UI** (página /envios, drawer do envio internacional): pequeno seletor "Idioma do fluxo: EN / ES" que faz `UPDATE envios SET global_flow_lang = ?` — útil para corrigir envios já em andamento.

- **Garantir trigger em todos os inserts:** auditar webhooks que fazem `insert` em `envios` para confirmar que `apply_global_flow_on_envio` está ativo (é `BEFORE INSERT`, então sempre roda; mas validar que nenhum insert seta `global_flow_lang` cru com valor errado).

### 5) Documentação

Adicionar em `/admin/templates` um aviso no topo do card Global:
> "Estes templates são compartilhados por todas as lojas. O idioma de cada envio é definido pela loja em **Global → Idioma**, e travado quando o envio é criado."

## Validação

1. `/admin/templates` mostra 3 cards: Atlas Nacional, Jetline Nacional, **Global Internacional (EN/ES)**.
2. Editar o assunto do passo 5 em ES e disparar um envio com `global_flow_lang='es'` → e-mail chega com o novo assunto.
3. Envio internacional novo criado em loja com `idioma='es'` chega com templates ES.
4. Envio antigo travado em EN: após usar o seletor de idioma no /envios, próximo passo sai em ES.
5. Backfill: envios pendentes (ordem ≤ 1) de uma loja que mudou para ES passam a sair em ES.

## Deploy

- Migration SQL (tabela + seed + backfill).
- Deploy de `send-global-flow`.
- Sem mudança em outras edge functions.
