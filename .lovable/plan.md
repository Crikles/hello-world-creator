

## Gerar Nome da Instancia com Email do Usuario

### Problema
Atualmente o nome da instancia e gerado como `magnus-{loja_id_8chars}-{timestamp}`, o que nao permite identificar o dono no painel UAZAPI.

### Plano

**Arquivo: `supabase/functions/send-whatsapp/index.ts`**

Na secao de criacao da instancia (action "create"), antes de gerar o `instanceName`:

1. Buscar o email do dono da loja no banco:
   ```typescript
   const { data: ownerProfile } = await supabaseAdmin
     .from("profiles")
     .select("email")
     .eq("id", billingUserId)
     .maybeSingle();
   ```

2. Gerar o nome da instancia usando o email (sanitizado):
   ```
   // Pega a parte antes do @ e remove caracteres especiais
   // Ex: "joao.silva@gmail.com" -> "joaosilva"
   const emailPrefix = (ownerProfile?.email || "")
     .split("@")[0]
     .replace(/[^a-zA-Z0-9]/g, "")
     .slice(0, 20)
     .toLowerCase();
   
   const instanceName = body.instance_name 
     || `magnus-${emailPrefix || loja_id.slice(0, 8)}-${Date.now().toString(36)}`;
   ```

   Resultado: `magnus-joaosilva-mn4yttch`

### Notas
- Fallback para `loja_id` caso o email nao exista
- Caracteres especiais removidos para compatibilidade com UAZAPI
- Truncado em 20 chars do prefixo do email para evitar nomes muito longos
- Nenhuma mudanca no banco ou frontend necessaria

