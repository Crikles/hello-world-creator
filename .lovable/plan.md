

## Corrigir PDF da DANFE - Gerar a partir de iframe temporario

### Problema

O PDF esta sendo gerado capturando o iframe visivel na tela, que tem `transform: scale(0.85)` aplicado. O `html2canvas` nao lida bem com CSS transforms, resultando em linhas cortadas, texto distorcido e layout quebrado no PDF final. O preview na tela esta correto, mas o PDF sai bugado.

### Solucao

Mudar completamente a abordagem de geracao do PDF: em vez de capturar o iframe visivel (que esta escalado), criar um **iframe temporario oculto** com tamanho original, renderizar o HTML nele, capturar com `html2canvas`, gerar o PDF, e remover o iframe.

---

### Mudancas no arquivo `src/pages/Empresa.tsx`

Reescrever a funcao `handleDownloadPdf`:

1. Criar um iframe temporario com `position: absolute; left: -9999px; top: 0` e largura de 700px
2. Inserir o `danfeHtml` (nao o debounced) nesse iframe via `doc.write()`
3. Aguardar o iframe carregar
4. Forcar `.empresa-value` para cor preta
5. Capturar com `html2canvas` usando `scale: 2` para alta qualidade
6. Gerar o PDF com jsPDF, ajustando proporcao para caber em A4
7. Remover o iframe temporario do DOM

Isso elimina qualquer dependencia do CSS transform do preview e garante que o PDF sempre sai com o layout original de 700px.

### Mudancas no arquivo `src/components/danfe/DanfePreview.tsx`

Aplicar a mesma abordagem na funcao `handleDownload` do dialog de tela cheia:

1. Criar iframe temporario oculto
2. Renderizar o HTML, capturar e gerar PDF
3. Remover iframe

### Detalhes Tecnicos

```typescript
const handleDownloadPdf = async () => {
  // Criar iframe oculto
  const tempIframe = document.createElement('iframe');
  tempIframe.style.cssText = 'position:absolute;left:-9999px;top:0;width:700px;height:2000px;border:none;';
  document.body.appendChild(tempIframe);
  
  const doc = tempIframe.contentWindow!.document;
  doc.open();
  doc.write(danfeHtml); // HTML original, sem scale
  doc.close();
  
  // Aguardar renderizacao
  await new Promise(r => setTimeout(r, 500));
  
  // Forcar preto nos valores da empresa
  const spans = doc.querySelectorAll('.empresa-value');
  spans.forEach((el: any) => { el.style.color = '#000'; });
  
  // Capturar
  const body = doc.body;
  const canvas = await html2canvas(body, { 
    scale: 2, useCORS: true, backgroundColor: '#fff',
    scrollY: 0, scrollX: 0,
    windowWidth: 700, windowHeight: body.scrollHeight 
  });
  
  // Gerar PDF
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();
  const ratio = canvas.width / canvas.height;
  let w = pdfW, h = pdfW / ratio;
  if (h > pdfH) { h = pdfH; w = pdfH * ratio; }
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);
  pdf.save(`DANFE_${form.razao_social || 'empresa'}.pdf`);
  
  // Limpar
  document.body.removeChild(tempIframe);
};
```

### Resultado Esperado

- Preview na tela continua funcionando com scale 0.85 (bonito no painel)
- PDF gerado sempre com layout correto de 700px, sem distorcao
- Texto sempre preto no PDF
- Nenhuma dependencia do transform CSS na geracao do documento

