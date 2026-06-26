## Diagnóstico

Fiz fetch da página `https://usevulcano.store/pages/rastreio` e analisei o HTML real publicado. O que o cliente colou foi **só a metade do snippet**:

```html
<!-- WIDGET JETLINE -->
<div class="atlas-order-tracking" data-loja="77d02687-dae2-488a-a4c6-0baa6b106166">
</div>
```

A tag `<script src="https://app.atlas-cargo.org/widget/tracking.js" async></script>` **não existe em lugar nenhum da página**. Sem ela, o `tracking.js` nunca é carregado, então o `<div>` fica vazio e o usuário só vê o cabeçalho azul "Rastreie seu pedido" (que é design da própria página do Shopify do cliente, não é nosso widget).

Ou seja: **o widget em si não está bugado** — está funcionando normalmente (o `widget-preview.html` no nosso projeto confirma). O problema é instalação incompleta na loja.

## Ação

Não há mudança de código no nosso projeto. A resolução é orientar o cliente a colar o snippet **completo** na página de rastreio do Shopify dele:

```html
<div class="atlas-order-tracking" data-loja="77d02687-dae2-488a-a4c6-0baa6b106166"></div>
<script src="https://app.atlas-cargo.org/widget/tracking.js" async></script>
```

A tag `<script>` precisa aparecer **uma vez na página** (pode ser logo abaixo da div, ou no fim do template). Se ele já cola em vários lugares, basta uma.

## Opcional — melhoria preventiva no painel

Para evitar que outros usuários cometam o mesmo erro, posso (se você quiser, em outra rodada):

1. **Aba Integração → Widget de Rastreio**: deixar o bloco de código copiável dividido em "Passo 1: cole a div" + "Passo 2: cole o script" com aviso vermelho "ambos são obrigatórios".
2. **Tutoriais**: adicionar item "Widget aparece vazio? Verifique se a tag &lt;script&gt; foi colada" em `src/data/tutorials.ts`.

Me diga se quer que eu aplique essas melhorias preventivas no painel ou se basta orientar o cliente.