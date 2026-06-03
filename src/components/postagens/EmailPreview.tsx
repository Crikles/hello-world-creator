import { useMemo } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { replaceVariables, dadosExemplo, buildEmailHtml, type EmailSections } from "./emailTemplates";
import { Mail, Paperclip } from "lucide-react";

interface EmailPreviewProps {
  assunto: string;
  sections: EmailSections;
  empresaNome?: string;
  eventName?: string;
  whatsappVendedor?: string;
}

export function EmailPreview({ assunto, sections, empresaNome, eventName, whatsappVendedor }: EmailPreviewProps) {
  const data = useMemo(() => ({
    ...dadosExemplo,
    empresa_nome: empresaNome || dadosExemplo.empresa_nome,
  }), [empresaNome]);

  const previewSubject = useMemo(() => replaceVariables(assunto, data), [assunto, data]);
  const fullHtml = useMemo(() => {
    const raw = buildEmailHtml(sections, "#6366f1", eventName, whatsappVendedor);
    return replaceVariables(raw, data);
  }, [sections, data, eventName]);
  const debouncedHtml = useDebouncedValue(fullHtml, 300);

  // Extract a text snippet for inbox preview
  const previewText = useMemo(() => {
    const text = replaceVariables(sections.mensagem, data)
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\n/g, " ")
      .substring(0, 90);
    return text + (text.length >= 90 ? "..." : "");
  }, [sections.mensagem, data]);

  return (
    <div className="flex flex-col h-full">
      {/* Inbox simulation */}
      <div className="rounded-xl border bg-card p-4 mb-4 space-y-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Preview da Caixa de Entrada
        </p>
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Mail className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-foreground truncate">
                {empresaNome || data.empresa_nome}
              </span>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap ml-2">agora</span>
            </div>
            <p className="text-sm font-medium text-foreground truncate">{previewSubject || "Sem assunto"}</p>
            <p className="text-xs text-muted-foreground truncate">{previewText}</p>
          </div>
          <Paperclip className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 mt-1" />
        </div>
      </div>

      {/* Email body preview */}
      <div className="flex-1 rounded-xl border bg-muted/30 overflow-hidden min-h-[400px]">
        <iframe
          title="Email Preview"
          srcDoc={debouncedHtml}
          className="w-full h-full border-0"
          sandbox="allow-same-origin"
          style={{ minHeight: 400 }}
        />
      </div>
    </div>
  );
}
