export interface EmailSections {
  saudacao: string;
  mensagem: string;
  mostrar_info_pedido: boolean;
  mostrar_botao_cta: boolean;
  texto_botao_cta: string;
  url_botao_cta: string;
  rodape: string;
}

export const dadosExemplo: Record<string, string> = {
  cliente_nome: "Tiago Elias Manoel Bernardes",
  cliente_email: "tiago@email.com",
  produto: "Camiseta Polo Premium",
  codigo_rastreio: "BR547454312HF",
  transportadora: "Correios",
  valor: "89,90",
  quantidade: "1",
  empresa_nome: "Minha Loja",
};

export const variaveisDisponiveis = [
  { key: "{{cliente_nome}}", label: "Nome do cliente" },
  { key: "{{cliente_email}}", label: "Email do cliente" },
  { key: "{{produto}}", label: "Produto" },
  { key: "{{codigo_rastreio}}", label: "Código de rastreio" },
  { key: "{{transportadora}}", label: "Transportadora" },
  { key: "{{valor}}", label: "Valor do pedido" },
  { key: "{{quantidade}}", label: "Quantidade" },
  { key: "{{empresa_nome}}", label: "Nome da empresa" },
  { key: "{{empresa_logo_url}}", label: "Logo da empresa" },
];

export const emojiSugeridos: Record<string, string[]> = {
  Postado: ["📦", "✨", "🎉", "🚀"],
  Coletado: ["📦", "🏪", "✅"],
  "Em Trânsito": ["🚛", "📍", "🛣️", "🔄"],
  "Centro Local": ["📍", "🏢", "📬"],
  "Saiu para Entrega": ["🚚", "🏠", "📬", "🎯"],
  Entregue: ["✅", "🎁", "💚", "🥳"],
  "Taxação": ["⚠️", "📋", "💰", "🏛️"],
  Pago: ["💳", "✅", "🎉"],
  "Em Rota": ["🚛", "📍", "🛣️"],
};

export const defaultSectionsByEvent: Record<string, EmailSections> = {
  Postado: {
    saudacao: "Olá {{cliente_nome}},",
    mensagem: "Sua nota fiscal foi emitida e está em anexo neste e-mail. Seu pedido **{{produto}}** será enviado em breve!",
    mostrar_info_pedido: true,
    mostrar_botao_cta: true,
    texto_botao_cta: "Rastrear Pedido",
    url_botao_cta: "https://rastreamento.correios.com.br/app/index.php",
    rodape: "Atenciosamente,\n{{empresa_nome}}",
  },
  Coletado: {
    saudacao: "Olá {{cliente_nome}},",
    mensagem: "Seu pedido **{{produto}}** foi coletado pela transportadora **{{transportadora}}** e já está a caminho! Acompanhe pelo código: **{{codigo_rastreio}}**",
    mostrar_info_pedido: true,
    mostrar_botao_cta: true,
    texto_botao_cta: "Rastrear Pedido",
    url_botao_cta: "https://rastreamento.correios.com.br/app/index.php",
    rodape: "Atenciosamente,\n{{empresa_nome}}",
  },
  "Em Trânsito": {
    saudacao: "Olá {{cliente_nome}},",
    mensagem: "Seu pedido **{{produto}}** está viajando até você! 🚛\n\nAcompanhe a entrega pelo código de rastreio: **{{codigo_rastreio}}**",
    mostrar_info_pedido: true,
    mostrar_botao_cta: true,
    texto_botao_cta: "Acompanhar Entrega",
    url_botao_cta: "https://rastreamento.correios.com.br/app/index.php",
    rodape: "Atenciosamente,\n{{empresa_nome}}",
  },
  "Centro Local": {
    saudacao: "Olá {{cliente_nome}},",
    mensagem: "Seu pedido **{{produto}}** chegou ao centro de distribuição mais próximo de você! 📍 Falta muito pouco agora.",
    mostrar_info_pedido: true,
    mostrar_botao_cta: true,
    texto_botao_cta: "Rastrear Pedido",
    url_botao_cta: "https://rastreamento.correios.com.br/app/index.php",
    rodape: "Atenciosamente,\n{{empresa_nome}}",
  },
  "Saiu para Entrega": {
    saudacao: "Olá {{cliente_nome}},",
    mensagem: "Boas notícias! 🚚 Seu pedido **{{produto}}** saiu para entrega hoje. Fique atento, ele pode chegar a qualquer momento!",
    mostrar_info_pedido: true,
    mostrar_botao_cta: true,
    texto_botao_cta: "Acompanhar em Tempo Real",
    url_botao_cta: "https://rastreamento.correios.com.br/app/index.php",
    rodape: "Atenciosamente,\n{{empresa_nome}}",
  },
  Entregue: {
    saudacao: "Olá {{cliente_nome}},",
    mensagem: "Seu pedido **{{produto}}** foi entregue com sucesso! ✅🎉\n\nEsperamos que você aproveite! Se tiver alguma dúvida, não hesite em nos contatar.",
    mostrar_info_pedido: true,
    mostrar_botao_cta: false,
    texto_botao_cta: "",
    url_botao_cta: "",
    rodape: "Obrigado pela preferência!\n{{empresa_nome}}",
  },
  "Taxação": {
    saudacao: "Olá {{cliente_nome}},",
    mensagem: "Seu pedido **{{produto}}** foi taxado pela alfândega. ⚠️\n\nPara que a entrega continue, é necessário realizar o pagamento da taxa. Clique no botão abaixo para mais detalhes.",
    mostrar_info_pedido: true,
    mostrar_botao_cta: true,
    texto_botao_cta: "Ver Detalhes da Taxa",
    url_botao_cta: "",
    rodape: "Atenciosamente,\n{{empresa_nome}}",
  },
  Pago: {
    saudacao: "Olá {{cliente_nome}},",
    mensagem: "O pagamento da taxa do seu pedido **{{produto}}** foi confirmado! 💳✅\n\nA entrega será retomada em breve. Acompanhe pelo código: **{{codigo_rastreio}}**",
    mostrar_info_pedido: true,
    mostrar_botao_cta: true,
    texto_botao_cta: "Rastrear Pedido",
    url_botao_cta: "https://rastreamento.correios.com.br/app/index.php",
    rodape: "Atenciosamente,\n{{empresa_nome}}",
  },
};

export function replaceVariables(text: string, data: Record<string, string> = dadosExemplo): string {
  let result = text;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

function markdownToHtml(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");
}

export function buildEmailHtml(sections: EmailSections, primaryColor = "#6366f1"): string {
  const saudacaoHtml = markdownToHtml(sections.saudacao);
  const mensagemHtml = markdownToHtml(sections.mensagem);
  const rodapeHtml = markdownToHtml(sections.rodape);

  const infoBlock = sections.mostrar_info_pedido
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <tr style="background-color:#f9fafb;">
          <td style="padding:12px 16px;font-size:13px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Produto</td>
          <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#111827;border-bottom:1px solid #e5e7eb;">{{produto}}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;font-size:13px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Código de Rastreio</td>
          <td style="padding:12px 16px;font-size:13px;font-weight:600;color:${primaryColor};border-bottom:1px solid #e5e7eb;">{{codigo_rastreio}}</td>
        </tr>
        <tr style="background-color:#f9fafb;">
          <td style="padding:12px 16px;font-size:13px;color:#6b7280;border-bottom:1px solid #e5e7eb;">Transportadora</td>
          <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#111827;border-bottom:1px solid #e5e7eb;">{{transportadora}}</td>
        </tr>
        <tr>
          <td style="padding:12px 16px;font-size:13px;color:#6b7280;">Valor</td>
          <td style="padding:12px 16px;font-size:13px;font-weight:600;color:#111827;">R$ {{valor}}</td>
        </tr>
      </table>`
    : "";

  const ctaBlock = sections.mostrar_botao_cta && sections.texto_botao_cta
    ? `<div style="text-align:center;margin:28px 0;">
        <a href="${sections.url_botao_cta || "#"}" style="display:inline-block;background-color:${primaryColor};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.3px;">${sections.texto_botao_cta}</a>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,${primaryColor},${primaryColor}dd);padding:32px 40px;text-align:center;">
              <!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
              {{#empresa_logo_url}}<img src="{{empresa_logo_url}}" alt="{{empresa_nome}}" style="max-height:120px;max-width:200px;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;" />{{/empresa_logo_url}}
              <!--[if mso]></td></tr></table><![endif]-->
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">{{empresa_nome}}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#374151;">${saudacaoHtml}</p>
              <div style="margin:0 0 8px;font-size:15px;line-height:1.7;color:#4b5563;">${mensagemHtml}</div>
              ${infoBlock}
              ${ctaBlock}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:13px;line-height:1.5;color:#9ca3af;text-align:center;">${rodapeHtml}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function parseSectionsFromHtml(html: string | null, eventName: string): EmailSections {
  // If no HTML exists, return defaults for this event
  return defaultSectionsByEvent[eventName] || defaultSectionsByEvent["Postado"];
}
