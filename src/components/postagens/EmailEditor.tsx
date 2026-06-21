import { useState, useRef, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { EmailPreview } from "./EmailPreview";
import {
  type EmailSections,
  variaveisDisponiveis,
  emojiSugeridos,
  defaultSectionsByEvent,
  defaultSubjectByEvent,
  buildEmailHtml,
} from "./emailTemplates";
import {
  Smile,
  Variable,
  Eye,
  Sparkles,
  RotateCcw,
  FileText,
  MousePointerClick,
} from "lucide-react";

interface EmailEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventoNome: string;
  statusLabel: string;
  initialAssunto: string;
  initialCorpo: string;
  enviarEmail: boolean;
  enviarNfePdf: boolean;
  onSave: (data: {
    assunto_email: string;
    corpo_email: string;
    enviar_email: boolean;
    enviar_nfe_pdf: boolean;
  }) => void;
  saving?: boolean;
}

export function EmailEditor({
  open,
  onOpenChange,
  eventoNome,
  statusLabel,
  initialAssunto,
  initialCorpo,
  enviarEmail,
  enviarNfePdf,
  onSave,
  saving,
}: EmailEditorProps) {
  const eventKey = statusLabel || eventoNome;
  const defaults = defaultSectionsByEvent[eventKey] || defaultSectionsByEvent["Postado"];

  const [assunto, setAssunto] = useState(initialAssunto || defaultSubjectByEvent[eventKey] || defaultSubjectByEvent[eventoNome] || eventoNome);
  const [sections, setSections] = useState<EmailSections>(defaults);
  const [emailActive, setEmailActive] = useState(enviarEmail);
  const [nfePdf, setNfePdf] = useState(enviarNfePdf);
  const [activeField, setActiveField] = useState<"assunto" | "saudacao" | "mensagem" | "rodape" | "cta_texto" | "cta_url">("assunto");

  const assuntoRef = useRef<HTMLInputElement>(null);
  const saudacaoRef = useRef<HTMLTextAreaElement>(null);
  const mensagemRef = useRef<HTMLTextAreaElement>(null);
  const rodapeRef = useRef<HTMLTextAreaElement>(null);

  const emojis = emojiSugeridos[eventKey] || emojiSugeridos["Postado"] || ["📦", "✨"];

  const insertVariable = useCallback((varKey: string) => {
    const insertAt = (
      ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
      value: string,
      setter: (val: string) => void
    ) => {
      const el = ref.current;
      if (!el) { setter(value + varKey); return; }
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const newVal = value.substring(0, start) + varKey + value.substring(end);
      setter(newVal);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + varKey.length, start + varKey.length);
      }, 0);
    };

    switch (activeField) {
      case "assunto":
        insertAt(assuntoRef, assunto, setAssunto);
        break;
      case "saudacao":
        insertAt(saudacaoRef, sections.saudacao, (v) => setSections((s) => ({ ...s, saudacao: v })));
        break;
      case "mensagem":
        insertAt(mensagemRef, sections.mensagem, (v) => setSections((s) => ({ ...s, mensagem: v })));
        break;
      case "rodape":
        insertAt(rodapeRef, sections.rodape, (v) => setSections((s) => ({ ...s, rodape: v })));
        break;
    }
  }, [activeField, assunto, sections]);

  const insertEmoji = useCallback((emoji: string) => {
    setAssunto((prev) => prev + " " + emoji);
    assuntoRef.current?.focus();
  }, []);

  const resetToDefault = useCallback(() => {
    const d = defaultSectionsByEvent[eventKey] || defaultSectionsByEvent["Postado"];
    setSections(d);
    setAssunto(defaultSubjectByEvent[eventKey] || defaultSubjectByEvent[eventoNome] || eventoNome);
  }, [eventKey, eventoNome]);

  const handleSave = useCallback(() => {
    const html = buildEmailHtml(sections);
    onSave({
      assunto_email: assunto,
      corpo_email: html,
      enviar_email: emailActive,
      enviar_nfe_pdf: nfePdf,
    });
  }, [assunto, sections, emailActive, nfePdf, onSave]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1200px] max-h-[92vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg">Editar Email: {eventoNome}</DialogTitle>
              <DialogDescription className="text-xs">
                Configure o email que será enviado neste evento de rastreamento
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden" style={{ height: "calc(92vh - 130px)" }}>
          {/* Left column - Editor */}
          <ScrollArea className="w-1/2 border-r">
            <div className="p-6 space-y-5">
              {/* Email toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Enviar email neste evento</Label>
                </div>
                <Switch checked={emailActive} onCheckedChange={setEmailActive} />
              </div>

              {emailActive && (
                <>
                  {/* Subject */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Assunto do Email</Label>
                      <div className="flex gap-1">
                        {emojis.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center text-base transition-colors"
                            onClick={() => insertEmoji(emoji)}
                            title={`Inserir ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center transition-colors"
                          title="Emojis"
                        >
                          <Smile className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                    <Input
                      ref={assuntoRef}
                      value={assunto}
                      onChange={(e) => setAssunto(e.target.value)}
                      onFocus={() => setActiveField("assunto")}
                      placeholder="Ex: Seu pedido foi postado! 📦"
                      className="text-sm"
                    />
                  </div>

                  {/* Variables */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Variable className="h-3.5 w-3.5 text-muted-foreground" />
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Variáveis disponíveis
                      </Label>
                      <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5">
                        <MousePointerClick className="h-3 w-3" /> clique para inserir
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {variaveisDisponiveis.map((v) => (
                        <Badge
                          key={v.key}
                          variant="outline"
                          className="cursor-pointer hover:bg-primary/10 hover:border-primary/30 text-xs transition-colors select-none"
                          onClick={() => insertVariable(v.key)}
                          title={v.label}
                        >
                          {v.key}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Greeting */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Saudação</Label>
                    <Textarea
                      ref={saudacaoRef}
                      rows={2}
                      value={sections.saudacao}
                      onChange={(e) => setSections((s) => ({ ...s, saudacao: e.target.value }))}
                      onFocus={() => setActiveField("saudacao")}
                      placeholder="Olá {{cliente_nome}},"
                      className="text-sm resize-none"
                    />
                  </div>

                  {/* Main message */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Mensagem Principal</Label>
                    <Textarea
                      ref={mensagemRef}
                      rows={6}
                      value={sections.mensagem}
                      onChange={(e) => setSections((s) => ({ ...s, mensagem: e.target.value }))}
                      onFocus={() => setActiveField("mensagem")}
                      placeholder="Escreva a mensagem principal do email..."
                      className="text-sm resize-none"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Use **texto** para negrito. Variáveis são substituídas automaticamente.
                    </p>
                  </div>

                  {/* Block toggles */}
                  <div className="space-y-3 p-4 rounded-lg border bg-card">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Blocos do Email</p>

                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Informações do Pedido</Label>
                      <Switch
                        checked={sections.mostrar_info_pedido}
                        onCheckedChange={(v) => setSections((s) => ({ ...s, mostrar_info_pedido: v }))}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Botão de Ação (CTA)</Label>
                      <Switch
                        checked={sections.mostrar_botao_cta}
                        onCheckedChange={(v) => setSections((s) => ({ ...s, mostrar_botao_cta: v }))}
                      />
                    </div>

                    {sections.mostrar_botao_cta && (
                      <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                        <div>
                          <Label className="text-xs text-muted-foreground">Texto do Botão</Label>
                          <Input
                            value={sections.texto_botao_cta}
                            onChange={(e) => setSections((s) => ({ ...s, texto_botao_cta: e.target.value }))}
                            onFocus={() => setActiveField("cta_texto")}
                            placeholder="Rastrear Pedido"
                            className="text-sm h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">URL do Botão</Label>
                          <Input
                            value={sections.url_botao_cta}
                            onChange={(e) => setSections((s) => ({ ...s, url_botao_cta: e.target.value }))}
                            onFocus={() => setActiveField("cta_url")}
                            placeholder="https://..."
                            className="text-sm h-8"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* NFe toggle */}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-sm">Anexar PDF da NFe</Label>
                    </div>
                    <Switch checked={nfePdf} onCheckedChange={setNfePdf} />
                  </div>

                  {/* Footer */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Rodapé</Label>
                    <Textarea
                      ref={rodapeRef}
                      rows={2}
                      value={sections.rodape}
                      onChange={(e) => setSections((s) => ({ ...s, rodape: e.target.value }))}
                      onFocus={() => setActiveField("rodape")}
                      placeholder="Atenciosamente, {{empresa_nome}}"
                      className="text-sm resize-none"
                    />
                  </div>

                  {/* Reset */}
                  <Button variant="ghost" size="sm" onClick={resetToDefault} className="text-xs text-muted-foreground">
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Restaurar template padrão
                  </Button>
                </>
              )}
            </div>
          </ScrollArea>

          {/* Right column - Preview */}
          <ScrollArea className="w-1/2 bg-muted/20">
            <div className="p-6">
              {emailActive ? (
                <EmailPreview assunto={assunto} sections={sections} eventName={statusLabel} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground">
                  <Eye className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm">Email desativado para este evento</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar Email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
