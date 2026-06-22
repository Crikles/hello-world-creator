## Diagnóstico

A página de rastreio que mostra "From → To: Ceara / PE → São Paulo / SP" está hospedada em **`us.tracker-master.com`** / **`es.tracker-master.com`** — é um **projeto Lovable separado** (TrackMaster), com seu próprio frontend e edge function.

Aqui no projeto **Atlas/Magnus** já corrigi o `rastreio-info` para usar `global_flow_config.pais_origem_nome` quando `is_international = true`. Mas isso só afeta o domínio Atlas. O TrackMaster continua lendo `postagem_config.origem_cidade/estado` (Nacional) porque o código dele não foi atualizado.

## Ação necessária

Não há alteração a fazer neste projeto. Envie o prompt abaixo no chat do **projeto TrackMaster** para que ele aplique a mesma correção.

## Prompt para colar no projeto TrackMaster

```
Na edge function que retorna os dados de rastreio (rastreio-info ou equivalente),
a origem ("From") está sendo lida sempre de postagem_config.origem_cidade /
origem_estado. Para envios internacionais (Fluxo Global) isso está errado —
precisa puxar o País de Origem configurado no painel Global.

Ajuste:

1) Em supabase/functions/rastreio-info/index.ts (ou nome equivalente),
   logo após carregar `postagem_config`, adicione:

   let origemCidade = config?.origem_cidade ?? null;
   let origemEstado = config?.origem_estado ?? null;

   if (envio.is_international) {
     const { data: gfc } = await supabase
       .from("global_flow_config")
       .select("pais_origem_nome")
       .eq("loja_id", envio.loja_id)
       .maybeSingle();
     if (gfc?.pais_origem_nome) {
       origemCidade = gfc.pais_origem_nome;
       origemEstado = null;
     }
   }

   E retorne `origem: { cidade: origemCidade, estado: origemEstado }` no JSON
   (substituindo o uso direto de config.origem_cidade/estado).

2) Na página de rastreio (Rastreio.tsx ou equivalente), trate o caso de só ter
   cidade (sem estado):

   const origemLabel = origem.cidade
     ? (origem.estado ? `${origem.cidade} - ${origem.estado}` : origem.cidade)
     : null;

3) Faça deploy da edge function rastreio-info.

Resultado esperado: para envios com is_international = true, "From" exibe o
País de Origem configurado no Global (ex.: "China") em vez de "Ceara / PE".
```

## Observação

A tabela `global_flow_config` precisa estar acessível pelo service_role no projeto TrackMaster — como ambos os projetos compartilham o mesmo banco Supabase (mesma `loja_id`), a consulta funcionará desde que as credenciais Supabase do TrackMaster apontem para a mesma instância.
