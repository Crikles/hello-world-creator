

# Gestao de Email Resend no Painel Admin

## Resumo

Mover toda a gestao de email para o painel administrativo. O admin controla centralmente o Resend para todas as contas -- usuarios nao precisam configurar nada.

## O que muda

### 1. Nova pagina: Admin Email (`/admin/email`)

Pagina no painel admin com:

- **Status da API Key**: indicador visual se a RESEND_API_KEY esta configurada (testar com uma chamada a edge function)
- **Estatisticas de envio**: total de emails enviados, falhados, custo total (consultando `postagem_email_log`)
- **Log de emails recentes**: tabela com destinatario, assunto, status, data, loja (join com `lojas` para mostrar nome)
- **Dominio configurado**: campo informativo mostrando o dominio de envio atual (`onboarding@resend.dev` por padrao)

### 2. Sidebar Admin

Adicionar item "Email" no menu lateral do admin com icone `Mail`.

### 3. Rota no App.tsx

Nova rota `/admin/email` protegida com `AdminRoute`.

### 4. Remover referencia a email da pagina Configuracoes do usuario

A pagina `Configuracoes.tsx` atualmente mostra um card "Em breve" sobre email. Vamos remover esse card ja que o email sera gerido pelo admin.

### 5. RLS para admin ver todos os email logs

Adicionar policy para admin poder ler todos os registros de `postagem_email_log` (atualmente so o dono da loja consegue ver).

## Detalhes Tecnicos

### Arquivos modificados
- `src/pages/admin/AdminEmail.tsx` -- nova pagina
- `src/components/admin/AdminSidebar.tsx` -- adicionar item "Email"
- `src/App.tsx` -- nova rota `/admin/email`
- `src/pages/Configuracoes.tsx` -- remover card de email (ou remover a pagina inteira se ficar vazia)

### Migracao SQL
```sql
CREATE POLICY "Admins can view all email logs"
ON public.postagem_email_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
```

### Pagina AdminEmail
- Query `postagem_email_log` com join em `lojas` para nome da loja
- Cards de metricas: total enviados, total falhados, custo acumulado
- Tabela com colunas: Data, Loja, Destinatario, Assunto, Status, Custo
- Badge verde/vermelho para status sent/failed
- Edge function `send-email` ja esta pronta e usa a RESEND_API_KEY do backend -- nenhuma alteracao necessaria nela

