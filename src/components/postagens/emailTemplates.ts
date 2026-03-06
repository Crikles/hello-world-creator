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
  transportadora: "JL Transportadora e Logística LTDA",
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

export const emojiMap: Record<string, string> = {
  Postado: "📄",
  "Nota Fiscal Emitida": "📄",
  "Pedido Confirmado": "📄",
  Coletado: "📦",
  "Em Trânsito": "🚛",
  "Em Rota": "🏍️",
  "Centro Local": "📍",
  "Saiu para Entrega": "🚚",
  Entregue: "✅",
  "Taxação": "⚠️",
  Pago: "💳",
  "Falha Entrega": "⚠️",
};

export const emojiSugeridos: Record<string, string[]> = {
  Postado: ["📄", "📦", "✨", "🎉"],
  Coletado: ["📦", "🏪", "✅"],
  "Em Trânsito": ["🚛", "📍", "🛣️", "🔄"],
  "Centro Local": ["📍", "🏢", "📬"],
  "Em Rota": ["🏍️", "🚛", "📍"],
  "Saiu para Entrega": ["🚚", "🏠", "📬", "🎯"],
  Entregue: ["✅", "🎁", "💚", "🥳"],
  "Taxação": ["⚠️", "📋", "💰", "🏛️"],
  Pago: ["💳", "✅", "🎉"],
  "Falha Entrega": ["⚠️", "📦", "🛑", "🔔"],
};

export const defaultSectionsByEvent: Record<string, EmailSections> = {
  Postado: {
    saudacao: "Olá {{cliente_nome}},",
    mensagem: "Sua nota fiscal foi emitida e está em anexo neste e-mail. Seu pedido **{{produto}}** será enviado em breve!",
    mostrar_info_pedido: true,
    mostrar_botao_cta: true,
    texto_botao_cta: "Rastrear Pedido",
    url_botao_cta: "https://rastreio.logisticajltransportes.com/r/{{codigo_rastreio}}",
    rodape: "Atenciosamente,\n{{empresa_nome}}",
  },
  Coletado: {
    saudacao: "Olá {{cliente_nome}},",
    mensagem: "Seu pedido **{{produto}}** foi coletado pela transportadora **{{transportadora}}** e já está a caminho! Acompanhe pelo código: **{{codigo_rastreio}}**",
    mostrar_info_pedido: true,
    mostrar_botao_cta: true,
    texto_botao_cta: "Rastrear Pedido",
    url_botao_cta: "https://rastreio.logisticajltransportes.com/r/{{codigo_rastreio}}",
    rodape: "Atenciosamente,\n{{empresa_nome}}",
  },
  "Em Trânsito": {
    saudacao: "Olá {{cliente_nome}},",
    mensagem: "Seu pedido **{{produto}}** está viajando até você!\n\nAcompanhe a entrega pelo código de rastreio: **{{codigo_rastreio}}**",
    mostrar_info_pedido: true,
    mostrar_botao_cta: true,
    texto_botao_cta: "Acompanhar Entrega",
    url_botao_cta: "https://rastreio.logisticajltransportes.com/r/{{codigo_rastreio}}",
    rodape: "Atenciosamente,\n{{empresa_nome}}",
  },
  "Centro Local": {
    saudacao: "Olá {{cliente_nome}},",
    mensagem: "Seu pedido **{{produto}}** chegou ao centro de distribuição mais próximo de você! Falta muito pouco agora.",
    mostrar_info_pedido: true,
    mostrar_botao_cta: true,
    texto_botao_cta: "Rastrear Pedido",
    url_botao_cta: "https://rastreio.logisticajltransportes.com/r/{{codigo_rastreio}}",
    rodape: "Atenciosamente,\n{{empresa_nome}}",
  },
  "Em Rota": {
    saudacao: "Olá {{cliente_nome}},",
    mensagem: "Seu pedido **{{produto}}** está em rota de entrega! O entregador já saiu com o seu pacote.",
    mostrar_info_pedido: true,
    mostrar_botao_cta: true,
    texto_botao_cta: "Acompanhar Entrega",
    url_botao_cta: "https://rastreio.logisticajltransportes.com/r/{{codigo_rastreio}}",
    rodape: "Atenciosamente,\n{{empresa_nome}}",
  },
  "Saiu para Entrega": {
    saudacao: "Olá {{cliente_nome}},",
    mensagem: "Boas notícias! Seu pedido **{{produto}}** saiu para entrega hoje. Fique atento, ele pode chegar a qualquer momento!",
    mostrar_info_pedido: true,
    mostrar_botao_cta: true,
    texto_botao_cta: "Acompanhar em Tempo Real",
    url_botao_cta: "https://rastreio.logisticajltransportes.com/r/{{codigo_rastreio}}",
    rodape: "Atenciosamente,\n{{empresa_nome}}",
  },
  Entregue: {
    saudacao: "Olá {{cliente_nome}},",
    mensagem: "Seu pedido **{{produto}}** foi entregue com sucesso!\n\nEsperamos que você aproveite! Se tiver alguma dúvida, não hesite em nos contatar.",
    mostrar_info_pedido: true,
    mostrar_botao_cta: false,
    texto_botao_cta: "",
    url_botao_cta: "",
    rodape: "Obrigado pela preferência!\n{{empresa_nome}}",
  },
  "Taxação": {
    saudacao: "Olá {{cliente_nome}},",
    mensagem: "Seu pedido **{{produto}}** foi taxado pela alfândega.\n\nPara que a entrega continue, é necessário realizar o pagamento da taxa. Clique no botão abaixo para mais detalhes.",
    mostrar_info_pedido: true,
    mostrar_botao_cta: true,
    texto_botao_cta: "Ver Detalhes da Taxa",
    url_botao_cta: "",
    rodape: "Atenciosamente,\n{{empresa_nome}}",
  },
  Pago: {
    saudacao: "Olá {{cliente_nome}},",
    mensagem: "O pagamento da taxa do seu pedido **{{produto}}** foi confirmado!\n\nA entrega será retomada em breve. Acompanhe pelo código: **{{codigo_rastreio}}**",
    mostrar_info_pedido: true,
    mostrar_botao_cta: true,
    texto_botao_cta: "Rastrear Pedido",
    url_botao_cta: "https://rastreio.logisticajltransportes.com/r/{{codigo_rastreio}}",
    rodape: "Atenciosamente,\n{{empresa_nome}}",
  },
  "Falha Entrega": {
    saudacao: "Olá {{cliente_nome}},",
    mensagem: "Houve uma falha na tentativa de entrega do seu pedido **{{produto}}**.\n\nPara reenviarmos, precisamos que você pague a taxa de retentativa acessando o checkout através do botão abaixo.",
    mostrar_info_pedido: true,
    mostrar_botao_cta: true,
    texto_botao_cta: "PAGAR REENVIO",
    url_botao_cta: "{{falha_checkout_url}}",
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

export function buildEmailHtml(sections: EmailSections, primaryColor = "#6366f1", eventName?: string, whatsappVendedor?: string): string {
  const saudacaoHtml = markdownToHtml(sections.saudacao);
  const mensagemHtml = markdownToHtml(sections.mensagem);
  const rodapeHtml = markdownToHtml(sections.rodape);

  const emoji = eventName ? (emojiMap[eventName] || "📬") : "📬";
  const titleMap: Record<string, string> = {
    "Postado": "Pedido Postado",
    "Nota Fiscal Emitida": "Nota Fiscal Emitida",
    "Pedido Confirmado": "Pedido Confirmado",
    "Coletado": "Pedido Coletado",
    "Em Trânsito": "Pedido em Trânsito",
    "Em Rota": "Em Rota de Entrega",
    "Centro Local": "Centro de Distribuição",
    "Saiu para Entrega": "Saiu para Entrega!",
    "Entregue": "Pedido Entregue!",
    "Taxação": "Aviso de Taxação",
    "Pago": "Pagamento Confirmado",
    "Falha Entrega": "Falha na Entrega",
  };
  const headerTitle = eventName ? `${emoji} ${titleMap[eventName] || eventName}` : "📬 Atualização do Pedido";

  const infoBlock = sections.mostrar_info_pedido
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <tr style="background-color:#fafafa;">
          <td style="padding:14px 18px;font-size:13px;color:#888;border-bottom:1px solid #f0f0f0;width:140px;">📦 Produto</td>
          <td style="padding:14px 18px;font-size:14px;font-weight:600;color:#1a1a1a;border-bottom:1px solid #f0f0f0;">{{produto}}</td>
        </tr>
        <tr>
          <td style="padding:14px 18px;font-size:13px;color:#888;border-bottom:1px solid #f0f0f0;">🔍 Rastreio</td>
          <td style="padding:14px 18px;font-size:14px;font-weight:700;color:${primaryColor};border-bottom:1px solid #f0f0f0;letter-spacing:0.5px;">{{codigo_rastreio}}</td>
        </tr>
        <tr style="background-color:#fafafa;">
          <td style="padding:14px 18px;font-size:13px;color:#888;border-bottom:1px solid #f0f0f0;">🚛 Transportadora</td>
          <td style="padding:14px 18px;font-size:14px;font-weight:600;color:#1a1a1a;border-bottom:1px solid #f0f0f0;">{{transportadora}}</td>
        </tr>
        <tr>
          <td style="padding:14px 18px;font-size:13px;color:#888;">💰 Valor</td>
          <td style="padding:14px 18px;font-size:14px;font-weight:700;color:#1a1a1a;">R$ {{valor}}</td>
        </tr>
      </table>`
    : "";

  const ctaBlock = sections.mostrar_botao_cta && sections.texto_botao_cta
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0 8px;"><tr><td align="center" style="text-align:center;">
        <a href="${sections.url_botao_cta || "#"}" style="display:inline-block;background-color:#1a1a1a;color:#ffffff;text-decoration:none;padding:16px 40px;border-radius:50px;font-size:15px;font-weight:700;letter-spacing:0.5px;box-shadow:0 4px 14px rgba(0,0,0,0.2);text-align:center;">${sections.texto_botao_cta}</a>
      </td></tr></table>`
    : "";

  const whatsappBlock = whatsappVendedor
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 0;"><tr><td align="center" style="text-align:center;">
        <a href="https://wa.me/${whatsappVendedor.replace(/\D/g, "")}" style="display:inline-block;background-color:#25D366;color:#ffffff;text-decoration:none;padding:12px 36px;border-radius:50px;font-size:13px;font-weight:700;letter-spacing:0.3px;box-shadow:0 4px 14px rgba(37,211,102,0.3);text-align:center;">💬 Fale Com o Vendedor</a>
      </td></tr></table>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f0f0;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          
          <!-- Logo Section -->
          <tr>
            <td style="background-color:#f5f5f5;padding:36px 40px 20px;text-align:center;">
              {{#empresa_logo_url}}<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 16px;"><tr><td style="width:90px;height:90px;border-radius:50%;background:#ffffff;text-align:center;vertical-align:middle;box-shadow:0 4px 12px rgba(0,0,0,0.15);"><img src="{{empresa_logo_url}}" alt="{{empresa_nome}}" style="max-height:60px;max-width:60px;vertical-align:middle;" /></td></tr></table>{{/empresa_logo_url}}
              <p style="margin:0;color:#666;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">{{empresa_nome}}</p>
            </td>
          </tr>

          <!-- Dark Header -->
          <tr>
            <td style="background-color:#1a1a1a;padding:28px 40px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.3px;">${headerTitle}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#333;">${saudacaoHtml}</p>
              <div style="margin:0 0 8px;font-size:15px;line-height:1.8;color:#555;">${mensagemHtml}</div>
              ${infoBlock}
              ${ctaBlock}
              ${whatsappBlock}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;background-color:#fafafa;border-top:1px solid #eee;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#aaa;text-align:center;">${rodapeHtml}</p>
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
  return defaultSectionsByEvent[eventName] || defaultSectionsByEvent["Postado"];
}
