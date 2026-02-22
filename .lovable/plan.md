

## Corrigir PDF da DANFE - Substituir iframe temporario por div oculta

### Problema Real

O `html2canvas` nao funciona bem ao capturar conteudo de um iframe separado. Quando ele tenta renderizar o `body` de outro documento (iframe), ele perde informacoes de estilo, calcula alturas de celulas incorretamente e gera o PDF com labels deslocados e layout quebrado. O preview no painel esta correto porque o navegador renderiza o HTML nativamente, mas o `html2canvas` nao consegue replicar isso fielmente entre documentos diferentes.

### Solucao

Abandonar a abordagem de iframe temporario. Em vez disso, inserir o conteudo HTML da DANFE como uma **div oculta no proprio documento principal**, capturar com `html2canvas` (que agora opera no mesmo contexto de documento), gerar o PDF, e remover a div.

---

### Mudancas

**Arquivo: `src/pages/Empresa.tsx` - funcao `handleDownloadPdf`**

Reescrever para:

1. Criar uma `div` temporaria com `position: fixed; left: -9999px; top: 0; width: 700px` no documento principal
2. Injetar o HTML da DANFE usando `innerHTML` (apenas o conteudo do body, sem tags html/head)
3. Adicionar os estilos CSS como um `<style>` tag dentro da div
4. Forcar `.empresa-value` para cor preta
5. Capturar com `html2canvas` - agora funcionando no mesmo documento
6. Gerar PDF com jsPDF
7. Remover a div do DOM

**Arquivo: `src/components/danfe/DanfePreview.tsx` - funcao `handleDownload`**

Aplicar a mesma mudanca: trocar iframe temporario por div oculta no documento principal.

**Arquivo: `src/components/danfe/DanfePreview.tsx` - funcao `buildDanfeHtml`**

Criar uma funcao auxiliar `buildDanfeBodyAndStyles` que retorna separadamente:
- O CSS como string (para inserir em tag `<style>`)
- O HTML do body (a tabela e seu conteudo)

Isso permite reusar o mesmo conteudo tanto para o iframe de preview (HTML completo) quanto para a div de captura (apenas body + styles injetados).

### Detalhes Tecnicos

```typescript
// Nova funcao auxiliar exportada
export function getDanfeCssAndBody(empresa, envio) {
  // retorna { css: string, body: string }
}

// handleDownloadPdf reescrita
const handleDownloadPdf = async () => {
  const { css, body } = getDanfeCssAndBody(form, envioData);
  
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:700px;';
  container.innerHTML = `<style>${css}</style>${body}`;
  document.body.appendChild(container);

  // Forcar preto
  container.querySelectorAll('.empresa-value').forEach((el: any) => {
    el.style.color = '#000';
  });

  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(container, {
    scale: 2, useCORS: true, backgroundColor: '#fff',
    width: 700, windowWidth: 700
  });

  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();
  const ratio = canvas.width / canvas.height;
  let w = pdfW, h = pdfW / ratio;
  if (h > pdfH) { h = pdfH; w = pdfH * ratio; }
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
  pdf.save(`DANFE_${form.razao_social || 'empresa'}.pdf`);

  document.body.removeChild(container);
};
```

### Por que isso resolve

- `html2canvas` funciona perfeitamente quando captura elementos **do mesmo documento**
- Elimina problemas de cross-document rendering que causavam os labels deslocados
- A div recebe os mesmos estilos CSS da DANFE, garantindo layout identico ao preview
- O `buildDanfeHtml` continua existindo para o preview no iframe (que funciona bem)

### Resultado Esperado

- PDF identico ao preview na tela, sem linhas cortadas ou textos deslocados
- Preview continua funcionando normalmente com debounce
- Sem dependencia de iframe temporario para geracao do PDF

