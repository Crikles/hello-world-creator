
# Correção do Layout da Navbar - Flexbox horizontal

## Problema

O `.nav-inner` não tem `display: flex` e `justify-content: space-between`, fazendo com que os links e a tag "Transportes & Logística" apareçam empilhados abaixo da logo, em vez de ficarem distribuídos horizontalmente na mesma linha.

## Correção

Adicionar as propriedades flexbox faltantes no `.nav-inner`:

### Arquivo: `src/pages/Rastreio.tsx`

**CSS (linhas 430-434)** - Adicionar flex layout ao `.nav-inner`:

```css
.nav-inner {
  max-width: 1280px;
  width: 100%;
  margin: 0 auto;
  padding: 0 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
```

Isso vai distribuir os 3 blocos corretamente:
- Esquerda: Logo
- Centro: Links (Início, Rastrear, Contato)
- Direita: Transportes & Logística

Apenas 1 linha de mudança no CSS, nenhuma alteração no JSX.
