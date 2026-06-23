import {
  Gauge,
  SendHorizonal,
  Activity,
  Megaphone,
  Sparkles,
  ShoppingCart,
  ShieldAlert,
  PackageX,
  BadgeCheck,
  CircleDollarSign,
  Users,
  Landmark,
  Cable,
  MessageCircle,
  SlidersHorizontal,
  LifeBuoy,
  Rocket,
  Building2,
  PhoneCall,
  type LucideIcon,
} from "lucide-react";

export type TutorialCategory =
  | "Primeiros Passos"
  | "Operações"
  | "Financeiro"
  | "Negócio"
  | "Sistema";

export interface Tutorial {
  id: string;
  category: TutorialCategory;
  title: string;
  summary: string;
  icon: LucideIcon;
  /** Caminho relativo dentro de /loja/:lojaId (sem barra inicial). Vazio = dashboard. */
  route?: string;
  purpose: string;
  steps: string[];
  tips?: string[];
  warnings?: string[];
}

export const TUTORIALS: Tutorial[] = [
  // ============== PRIMEIROS PASSOS ==============
  {
    id: "boas-vindas",
    category: "Primeiros Passos",
    title: "Bem-vindo ao Painel",
    summary:
      "Entenda a tela inicial, o saldo de moedas e como trocar de loja a qualquer momento.",
    icon: Rocket,
    purpose:
      "Esta é a sua central de operações. Aqui você gerencia envios, comunicações com clientes, integrações e pagamentos de uma ou várias lojas.",
    steps: [
      "Ao entrar, você verá o menu lateral com todas as funcionalidades organizadas por categoria.",
      "No topo do menu lateral aparece o nome da sua loja atual e o seu saldo em moedas.",
      "Para trocar de loja, clique em 'Trocar de Loja' no rodapé do menu lateral.",
      "Para sair da conta, clique em 'Sair' logo abaixo.",
    ],
    tips: [
      "Quanto mais escuro o cartão da funcionalidade, mais avançada ela é. Comece pelos itens de Operações.",
      "Você pode ter várias lojas no mesmo cadastro — o saldo de moedas é compartilhado.",
    ],
  },
  {
    id: "cadastro-empresa",
    category: "Primeiros Passos",
    title: "Complete o Cadastro da Empresa",
    summary:
      "Antes de enviar qualquer pedido, preencha os dados fiscais para que as DANFEs saiam corretas.",
    icon: Building2,
    route: "empresa",
    purpose:
      "Os dados da empresa aparecem em DANFEs, e-mails e páginas públicas. Sem eles, alguns recursos ficam bloqueados.",
    steps: [
      "Abra o menu lateral e clique em 'Empresa'.",
      "Preencha CNPJ, razão social, endereço completo e contatos.",
      "Adicione o logotipo da loja — ele aparecerá nos e-mails e nas páginas de rastreio.",
      "Salve. Pronto: agora suas comunicações terão a identidade da sua empresa.",
    ],
    warnings: [
      "Os dados fiscais aparecem na DANFE como remetente. Confira tudo antes de salvar.",
    ],
  },
  {
    id: "verificacao-whatsapp",
    category: "Primeiros Passos",
    title: "Verificação Obrigatória de WhatsApp",
    summary:
      "Confirme seu número de WhatsApp para destravar disparos automáticos para seus clientes.",
    icon: PhoneCall,
    purpose:
      "A verificação garante que somente donos reais de números possam enviar mensagens, evitando bloqueios e mantendo a reputação da plataforma.",
    steps: [
      "Ao acessar o painel pela primeira vez, um popup pedirá seu número de WhatsApp.",
      "Digite com DDD (sem o '+' e sem o 55, o sistema acrescenta automaticamente).",
      "Você receberá um código de 6 dígitos no WhatsApp.",
      "Insira o código no painel e confirme.",
    ],
    warnings: [
      "Sem essa verificação, alguns recursos de envio ficam indisponíveis.",
      "Se trocar de número, refaça o processo nas Configurações.",
    ],
  },

  // ============== OPERAÇÕES ==============
  {
    id: "dashboard",
    category: "Operações",
    title: "Dashboard",
    summary:
      "Acompanhe métricas em tempo real: envios, gastos, integrações e gráficos de desempenho.",
    icon: Gauge,
    route: "",
    purpose:
      "Visão executiva da loja. Aqui você vê o que está acontecendo agora e como foi a performance dos últimos dias.",
    steps: [
      "Os cartões superiores mostram totais (envios, mensagens, gastos).",
      "O gráfico de desempenho compara dois períodos — use os filtros para ajustar.",
      "A área 'Integrações' mostra o status de cada checkout conectado (verde = ativo).",
    ],
    tips: [
      "Se um número parecer estranho, atualize a página — o sistema busca dados em lotes para evitar limites.",
    ],
  },
  {
    id: "envios",
    category: "Operações",
    title: "Envios",
    summary:
      "Crie envios manualmente, importe planilhas, gere DANFEs e acompanhe o avanço automático do rastreamento.",
    icon: SendHorizonal,
    route: "envios",
    purpose:
      "É o coração operacional. Cada envio gera um código de rastreio público e pode acionar e-mail, SMS, WhatsApp e DANFE automaticamente.",
    steps: [
      "Clique em 'Novo Envio' para criar manualmente seguindo o passo a passo (destinatário, produto, valores).",
      "Para vários pedidos de uma vez, use 'Importar Planilha' (CSV ou Excel).",
      "Após criado, o envio recebe um código de rastreio ATLAS automaticamente.",
      "O sistema avança o rastreamento automaticamente a cada 5 minutos seguindo o template configurado.",
      "Você pode baixar a DANFE em PDF a qualquer momento na lista de envios.",
    ],
    tips: [
      "Na importação, use as colunas-modelo. O sistema reconhece endereços com regex inteligente.",
      "Envios marcados como Taxação ou Falha pausam a automação até você resolver.",
    ],
    warnings: [
      "Após criar o envio, o template de etapas é congelado. Mudanças no template só valem para envios futuros.",
    ],
  },
  {
    id: "live-view",
    category: "Operações",
    title: "Live View",
    summary:
      "Veja em tempo real os clientes navegando nas suas páginas de rastreio, com globo 3D e som de alerta.",
    icon: Activity,
    route: "live-view",
    purpose:
      "Monitore quem está acompanhando o pedido agora. Útil para sentir a 'pulsação' do dia e validar campanhas.",
    steps: [
      "Abra 'Live View' no menu.",
      "O cartão 'Visitantes Online' mostra quantos estão ativos agora.",
      "Logo abaixo está o painel 'Controles': clique em 'Som' para ouvir um beep a cada novo visitante e 'Pausar' para congelar a tela.",
      "O globo gira mostrando a localização aproximada de cada visitante.",
      "A tabela abaixo lista as últimas atividades.",
    ],
    tips: [
      "O som só funciona depois de você clicar em 'Som' — exigência dos navegadores.",
      "Pausar é útil para apresentar a tela a alguém sem que ela fique mudando.",
    ],
  },
  {
    id: "postagens",
    category: "Operações",
    title: "Postagens",
    summary:
      "Configure os e-mails, SMS e WhatsApp que seus clientes recebem em cada etapa do envio.",
    icon: Megaphone,
    route: "postagens",
    purpose:
      "Personalize totalmente a comunicação com o cliente: assunto, corpo do e-mail, mensagens curtas e até banners visuais.",
    steps: [
      "Abra 'Postagens' e escolha a etapa que deseja editar (ex: 'Postado', 'Em trânsito', 'Entregue').",
      "Use o editor visual para mudar texto, imagens e botões.",
      "Para inserir variáveis ou ajustes visuais, use o formato [conf_tag:valor] no corpo do texto.",
      "Pré-visualize antes de salvar.",
    ],
    tips: [
      "A NF-e (DANFE) é enviada apenas por e-mail. SMS e WhatsApp não anexam o documento.",
      "Domínio e remetente do e-mail mudam automaticamente conforme a transportadora configurada.",
    ],
    warnings: [
      "Use [conf_tag:valor] em vez de chaves duplas {{}} — esse é o padrão suportado pelo editor visual.",
    ],
  },
  {
    id: "upsell",
    category: "Operações",
    title: "Upsell",
    summary:
      "Insira ofertas extras dentro dos e-mails de rastreio para aumentar o ticket médio.",
    icon: Sparkles,
    route: "upsell",
    purpose:
      "Aproveita um momento de alta atenção (cliente acompanhando pedido) para oferecer produtos complementares.",
    steps: [
      "Abra 'Upsell' e cadastre cada oferta (imagem, título, descrição e link).",
      "Escolha em quais etapas a oferta aparece.",
      "Salve. As próximas mensagens já sairão com o bloco de upsell.",
    ],
    tips: [
      "Se deixar o link da oferta vazio, o botão CTA fica oculto automaticamente.",
    ],
  },
  {
    id: "recuperacao",
    category: "Operações",
    title: "Recuperação de Vendas",
    summary:
      "Recupere checkouts abandonados via SMS e e-mail integrando Vega, Zedy, Luna, Corvex, Adoorei, Shopify e Nuvorafy.",
    icon: ShoppingCart,
    route: "recuperacao",
    purpose:
      "Transforma carrinhos abandonados em vendas reais com mensagens automáticas e link de pagamento PIX.",
    steps: [
      "Conecte seu checkout em 'Integrações' antes de configurar a recuperação.",
      "Em 'Recuperação', escolha os canais (SMS e/ou E-mail) e os tempos de envio.",
      "Personalize a mensagem e o link de pagamento (com QR Code PIX dinâmico).",
      "Acompanhe a taxa de recuperação no painel.",
    ],
    warnings: [
      "Funcionalidade liberada apenas para contas autorizadas. Se aparecer 'Em breve' no menu, fale com o suporte.",
      "Cada SMS e cada e-mail de recuperação consome moedas — confira a tabela na aba 'Moedas'.",
    ],
  },
  {
    id: "confirmacao-pgto",
    category: "Operações",
    title: "Confirmação de Pagamento",
    summary:
      "Envie um e-mail bonito e claro assim que o pagamento do pedido for confirmado.",
    icon: BadgeCheck,
    route: "confirmacao-pagamento",
    purpose:
      "Aumenta confiança do cliente logo após a compra e reduz dúvidas de 'meu pagamento foi aprovado?'.",
    steps: [
      "Em 'Confirmação Pgto', use o editor visual para personalizar o e-mail.",
      "Inclua dados do pedido, prazos e CTA para o rastreio.",
      "Salve. Os próximos pagamentos confirmados disparam o e-mail automaticamente.",
    ],
  },

  // ============== FINANCEIRO ==============
  {
    id: "moedas",
    category: "Financeiro",
    title: "Moedas (Saldo)",
    summary:
      "Recarregue via PIX e acompanhe quanto cada SMS, e-mail e WhatsApp consome.",
    icon: CircleDollarSign,
    route: "moedas",
    purpose:
      "Toda comunicação enviada (SMS, e-mail, WhatsApp, recuperação) é debitada do saldo. Mantenha-o positivo.",
    steps: [
      "Abra 'Moedas' e clique em 'Recarregar'.",
      "Escolha o valor e gere o PIX (QR Code aparece na tela).",
      "Pague pelo seu banco — o saldo cai na conta em segundos após confirmação.",
      "Veja o histórico de débitos e créditos na mesma tela.",
    ],
    tips: [
      "Cashback automático pode ser creditado em casos de falhas seguidas no envio (verificado pelo monitor interno).",
    ],
  },
  {
    id: "indicacao",
    category: "Financeiro",
    title: "Indicação (Afiliados)",
    summary:
      "Compartilhe seu link e ganhe 10% de comissão sobre as recargas dos indicados.",
    icon: Users,
    route: "indicacao",
    purpose:
      "Programa de afiliados nativo da plataforma — sem ferramenta externa.",
    steps: [
      "Abra 'Indicação' e copie seu link único (domínio magnusfrete.com).",
      "Compartilhe nas suas redes ou envie para colegas.",
      "Ao se cadastrar pelo seu link, o usuário fica vinculado a você.",
      "Você ganha 10% de cada recarga dele, creditado direto no seu saldo.",
    ],
  },

  // ============== NEGÓCIO ==============
  {
    id: "empresa",
    category: "Negócio",
    title: "Empresa",
    summary:
      "Dados fiscais, razão social e branding (logo, cores) que aparecem em todas as comunicações.",
    icon: Landmark,
    route: "empresa",
    purpose:
      "Centraliza a identidade da sua loja. Tudo o que sai da plataforma usa essas informações.",
    steps: [
      "Acesse 'Empresa' e preencha CNPJ, razão social, endereço e contatos.",
      "Suba o logotipo (formato PNG ou SVG, fundo transparente de preferência).",
      "Salve.",
    ],
    warnings: [
      "Na DANFE aparece a razão social oficial 'HOLDING Transportes de Cargas LTDA'. Os dados da sua loja entram como remetente comercial.",
    ],
  },
  {
    id: "integracoes",
    category: "Negócio",
    title: "Integrações",
    summary:
      "Conecte seus checkouts (Shopify, Vega, Zedy, Luna, Corvex, Adoorei, Nuvorafy) para criação automática de envios.",
    icon: Cable,
    route: "integracoes",
    purpose:
      "Quando uma venda acontece no checkout, o pedido vira envio automaticamente — sem digitação manual.",
    steps: [
      "Acesse 'Integrações' e escolha a plataforma.",
      "Cole o webhook gerado pelo painel no checkout correspondente.",
      "Faça uma venda de teste — ela deve aparecer em 'Envios' em segundos.",
      "O Dashboard mostra um indicador verde para cada integração ativa.",
    ],
    tips: [
      "Se a integração ficar amarela/vermelha no Dashboard, refaça o webhook.",
    ],
  },
  {
    id: "whatsapp",
    category: "Negócio",
    title: "WhatsApp",
    summary:
      "Conecte instâncias UAZAPI para disparar mensagens com sua marca, com fila e fallback automático.",
    icon: MessageCircle,
    route: "whatsapp",
    purpose:
      "Permite enviar atualizações de rastreio, taxações e recuperação direto pelo WhatsApp.",
    steps: [
      "Em 'WhatsApp', clique em 'Conectar instância'.",
      "Escaneie o QR Code com o WhatsApp do número que vai disparar.",
      "Pronto: a partir de agora, mensagens entram em uma fila com pequeno delay para evitar bloqueios.",
      "Se a instância cair, o sistema usa outra disponível automaticamente.",
    ],
    warnings: [
      "Use sempre números BR no formato 11 dígitos com DDD — o sistema adiciona o 55.",
      "Mensagens de NF-e não saem por WhatsApp (só por e-mail).",
    ],
  },

  // ============== SISTEMA ==============
  {
    id: "configuracoes",
    category: "Sistema",
    title: "Configurações",
    summary:
      "Confira a transportadora padrão ATLAS e ajuste preferências da conta.",
    icon: SlidersHorizontal,
    route: "configuracoes",
    purpose:
      "Define o comportamento global da loja: qual transportadora exibir, qual domínio aparecer nos links de rastreio, etc.",
    steps: [
      "Abra 'Configurações' → aba 'Postagens'.",
      "A transportadora ativa é ATLAS.",
      "Salve. Próximos envios já sairão com o sufixo AT e o domínio app.atlas-cargo.org nos links.",
    ],
    tips: [
      "A transportadora afeta domínio, branding dos e-mails e código de rastreio.",
    ],
  },
  {
    id: "suporte",
    category: "Sistema",
    title: "Suporte",
    summary:
      "Abra um chamado, fale com a equipe e use códigos de verificação quando necessário.",
    icon: LifeBuoy,
    route: "suporte",
    purpose:
      "Canal direto para tirar dúvidas, reportar bugs e solicitar ajustes na sua conta.",
    steps: [
      "Acesse 'Suporte' e descreva sua dúvida com o máximo de detalhes.",
      "Se for um pedido administrativo (ex: liberar recurso, mudar e-mail), você pode receber um código de verificação no WhatsApp.",
      "Informe o código ao atendente para autorizar a alteração.",
    ],
  },
];

export const TUTORIAL_CATEGORIES: TutorialCategory[] = [
  "Primeiros Passos",
  "Operações",
  "Financeiro",
  "Negócio",
  "Sistema",
];
