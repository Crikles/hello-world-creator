import { getDanfeCssAndBody, type EmpresaData, type EnvioData } from "@/components/danfe/DanfePreview";

/**
 * Generates a random NF-e filename like NF-e34339292201_49392.pdf
 */
export function generateNfeFilename(): string {
  const part1 = Math.floor(Math.random() * 99999999999).toString().padStart(11, '0');
  const part2 = Math.floor(Math.random() * 99999).toString().padStart(5, '0');
  return `NF-e${part1}_${part2}.pdf`;
}

/**
 * Generates a DANFE PDF as base64 string (without data: prefix).
 * Must be called in a browser context (uses html2canvas + jsPDF).
 */
export async function generateDanfePdfBase64(
  empresa: EmpresaData,
  envio: EnvioData
): Promise<string> {
  const { css, body } = getDanfeCssAndBody(empresa, envio);

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;width:700px;overflow:visible;';
  container.innerHTML = `<style>${css}</style>${body}`;
  document.body.appendChild(container);

  // Convert empresa-value colors to black for PDF
  container.querySelectorAll('.empresa-value').forEach((el: Element) => {
    (el as HTMLElement).style.color = '#000';
  });

  await new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 100);
      });
    });
  });

  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(container, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#fff',
    width: 700,
    windowWidth: 700,
    height: container.scrollHeight,
  });

  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();
  const ratio = canvas.width / canvas.height;
  let w = pdfW, h = pdfW / ratio;
  if (h > pdfH) { h = pdfH; w = pdfH * ratio; }
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h);

  document.body.removeChild(container);

  // Get base64 without "data:application/pdf;base64," prefix
  const pdfBase64 = pdf.output('datauristring');
  return pdfBase64.split(',')[1];
}
