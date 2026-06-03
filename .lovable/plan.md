# Plano: corrigir travamento da página Empresa

## Diagnóstico

A página `src/pages/Empresa.tsx` recalcula e re-renderiza o preview DANFE a cada tecla digitada nos inputs. Três problemas se somam no main thread:

1. `buildDanfeHtml(form, {...envioFake})` (linha 218) é chamado no corpo do componente → roda a cada `setForm`, gerando a string completa de CSS+HTML (≈280 linhas) toda vez. O segundo argumento é um **objeto novo** a cada render, mas como `buildDanfeHtml` retorna string, o `useEffect` compara por valor — só que o trabalho de construção da string já aconteceu.
2. O `useEffect` (linha 242) usa `iframe.contentWindow.document.open()/write()/close()` a cada update do `debouncedHtml`. `document.write` é síncrono e dispara reparse completo + reaplicação de estilos no iframe — operação cara, especialmente em laptops mais fracos.
3. Debounce de apenas 300ms permite múltiplas reconstruções enquanto o usuário ainda está digitando.

A combinação trava o main thread e o Chrome mostra "Página sem resposta".

## Mudanças

### 1. Memoizar a construção do HTML

```tsx
const danfeHtml = useMemo(
  () => buildDanfeHtml(form, FAKE_ENVIO),
  [form]
);
```

Mover o objeto fake para uma constante fora do componente (evita realocação por render).

### 2. Aumentar debounce + usar `requestIdleCallback`

```tsx
const [debouncedHtml, setDebouncedHtml] = useState(danfeHtml);
useEffect(() => {
  const handle = setTimeout(() => {
    const cb = () => setDebouncedHtml(danfeHtml);
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(cb, { timeout: 1000 });
    } else {
      cb();
    }
  }, 500);
  return () => clearTimeout(handle);
}, [danfeHtml]);
```

### 3. Trocar `doc.write` por `iframe.srcdoc`

`srcdoc` é assíncrono e o navegador faz parse fora da janela de input — elimina o bloqueio principal:

```tsx
<iframe
  ref={previewIframeRef}
  srcDoc={debouncedHtml}
  title="DANFE Preview"
  className="..."
/>
```

Remove o `useEffect` que faz `doc.open/write/close` e o estado `iframeReady`.

### 4. Garantir que inputs não re-renderizem o iframe enquanto digita

Com as 3 mudanças acima isso já está resolvido: o iframe só é repintado quando `debouncedHtml` muda (após 500ms de inatividade + idle).

## Escopo

- Editar somente `src/pages/Empresa.tsx`.
- Sem alterações em backend, schema, ou no `DanfePreview` component.

## Validação

- Abrir `/empresa`, digitar continuamente em "Razão Social", "Endereço" e selecionar uma logo. Confirmar que a página não congela e que o preview atualiza após parar de digitar.
