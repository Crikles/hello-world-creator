
# Correção da Exibição de Produtos na Tabela de Envios

## Problema
Quando um envio tem multiplos produtos, o campo `produto` armazena um JSON stringificado (ex: `[{"codigo":1,"nome":"Blusa P",...},{"codigo":2,"nome":"Blusa GG",...}]`). A tabela de envios exibe esse JSON bruto na coluna "Produto".

## Solucao

### Arquivo: `src/pages/Envios.tsx`

Criar uma funcao helper para formatar o campo `produto`:

```typescript
function formatProduto(raw: string): string {
  try {
    const items = JSON.parse(raw);
    if (Array.isArray(items)) {
      return items.map((i: any) => `${i.nome} (x${i.quantidade})`).join(", ");
    }
  } catch {
    // not JSON, return as-is (single product)
  }
  return raw;
}
```

Na coluna Produto da tabela, trocar `{envio.produto}` por `{formatProduto(envio.produto)}`.

Resultado: em vez de JSON bruto, mostrara algo como "Blusa P (x1), Blusa GG (x1)".

---

## Sobre o erro de DNS

O erro na imagem 2 ("The DNS records for logisticajltransportes.com are not properly configured") nao e um problema de codigo. Voce precisa:

1. Acessar o painel do seu registrador de dominio
2. Configurar um registro A apontando `@` para `185.158.133.1`
3. Configurar um registro A apontando `www` para `185.158.133.1`
4. Adicionar o registro TXT de verificacao `_lovable`
5. Aguardar a propagacao DNS (ate 72h)

Isso pode ser feito em **Settings > Domains** no projeto Lovable.
