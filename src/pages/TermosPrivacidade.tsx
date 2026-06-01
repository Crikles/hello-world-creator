import { getLogisticsProvider } from "@/lib/domain-config";

interface Props {
  tipo: "termos" | "privacidade";
}

export default function TermosPrivacidade({ tipo }: Props) {
  const provider = getLogisticsProvider();
  const isVetor = provider === "vetor";

  const empresa = isVetor ? "Vetor Transportes Ltda" : "JL Transporte e Logística";
  const empresaCurta = isVetor ? "Vetor Transportes" : "JL Transportes";
  const site = isVetor ? "vetortransportesltda.com" : "rastreio.jltransportelogistica.com";
  const email = isVetor ? "contato@vetortransportesltda.com" : "contato@jltransportelogistica.com";

  const accent = isVetor ? "#22c55e" : "#6366f1";
  const accentDark = isVetor ? "#16a34a" : "#4f46e5";
  const bgBody = isVetor ? "#f0fdf4" : "#eef2ff";

  const styles = `
    .tp-page { font-family: 'Inter', system-ui, sans-serif; background: ${bgBody}; min-height: 100vh; color: #1e293b; }
    .tp-nav { background: #111827; padding: 16px 0; }
    .tp-nav-inner { max-width: 900px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; gap: 12px; }
    .tp-nav-logo { height: 36px; }
    .tp-nav-brand { color: #fff; font-size: 18px; font-weight: 700; }
    .tp-container { max-width: 900px; margin: 0 auto; padding: 48px 24px 64px; }
    .tp-title { font-size: 32px; font-weight: 800; color: ${accentDark}; margin-bottom: 8px; }
    .tp-updated { font-size: 14px; color: #64748b; margin-bottom: 40px; }
    .tp-section { margin-bottom: 32px; }
    .tp-section h2 { font-size: 20px; font-weight: 700; color: ${accentDark}; margin-bottom: 12px; border-left: 4px solid ${accent}; padding-left: 12px; }
    .tp-section p, .tp-section li { font-size: 15px; line-height: 1.75; color: #334155; }
    .tp-section ul { padding-left: 20px; margin-top: 8px; }
    .tp-section li { margin-bottom: 6px; }
    .tp-footer { background: #111827; color: #94a3b8; text-align: center; padding: 24px; font-size: 13px; }
    .tp-footer a { color: ${accent}; text-decoration: none; }
    @media (max-width: 768px) {
      .tp-title { font-size: 24px; }
      .tp-container { padding: 32px 16px 48px; }
      .tp-section h2 { font-size: 17px; }
    }
  `;

  return (
    <>
      <style>{styles}</style>
      <div className="tp-page">
        <nav className="tp-nav">
          <div className="tp-nav-inner">
            <span className="tp-nav-brand">{empresaCurta}</span>
          </div>
        </nav>

        <div className="tp-container">
          {tipo === "termos" ? (
            <TermosContent empresa={empresa} empresaCurta={empresaCurta} site={site} email={email} />
          ) : (
            <PrivacidadeContent empresa={empresa} empresaCurta={empresaCurta} site={site} email={email} />
          )}
        </div>

        <footer className="tp-footer">
          © {new Date().getFullYear()} {empresa}. Todos os direitos reservados. |{" "}
          <a href="/termos">Termos</a> | <a href="/privacidade">Privacidade</a>
        </footer>
      </div>
    </>
  );
}

function TermosContent({ empresa, empresaCurta, site, email }: { empresa: string; empresaCurta: string; site: string; email: string }) {
  return (
    <>
      <h1 className="tp-title">Termos de Serviço</h1>
      <p className="tp-updated">Última atualização: 12 de abril de 2026</p>

      <div className="tp-section">
        <h2>1. Aceitação dos Termos</h2>
        <p>Ao acessar e utilizar o site {site} ("{empresaCurta}"), você concorda integralmente com estes Termos de Serviço. Caso não concorde com alguma cláusula, solicitamos que não utilize nossos serviços.</p>
      </div>

      <div className="tp-section">
        <h2>2. Descrição dos Serviços</h2>
        <p>O {empresaCurta} oferece uma plataforma de rastreamento de encomendas e informações logísticas. Nossos serviços incluem:</p>
        <ul>
          <li>Rastreamento em tempo real de envios e encomendas</li>
          <li>Notificações sobre atualizações de status de entrega</li>
          <li>Informações sobre prazos estimados de entrega</li>
          <li>Suporte ao cliente para questões relacionadas a entregas</li>
        </ul>
      </div>

      <div className="tp-section">
        <h2>3. Uso do Site</h2>
        <p>Você se compromete a utilizar o site apenas para fins lícitos e de acordo com estes Termos. É proibido:</p>
        <ul>
          <li>Utilizar o site de forma que possa danificar, desabilitar ou sobrecarregar nossos servidores</li>
          <li>Acessar informações de rastreamento de terceiros sem autorização</li>
          <li>Utilizar robôs, scrapers ou outros meios automatizados para acessar o site</li>
          <li>Tentar obter acesso não autorizado a qualquer parte do sistema</li>
        </ul>
      </div>

      <div className="tp-section">
        <h2>4. Propriedade Intelectual</h2>
        <p>Todo o conteúdo do site, incluindo textos, logotipos, design, código-fonte e demais materiais, é de propriedade exclusiva da {empresa} e está protegido pelas leis brasileiras de propriedade intelectual.</p>
      </div>

      <div className="tp-section">
        <h2>5. Limitação de Responsabilidade</h2>
        <p>O {empresaCurta} se esforça para manter as informações de rastreamento atualizadas e precisas. No entanto, não garantimos a exatidão, completude ou pontualidade das informações exibidas, uma vez que estas dependem de fontes externas (transportadoras parceiras). O {empresaCurta} não se responsabiliza por:</p>
        <ul>
          <li>Atrasos ou falhas nas informações de rastreamento fornecidas por terceiros</li>
          <li>Danos diretos ou indiretos decorrentes do uso ou da impossibilidade de uso do site</li>
          <li>Interrupções temporárias do serviço para manutenção ou atualizações</li>
        </ul>
      </div>

      <div className="tp-section">
        <h2>6. Modificações dos Termos</h2>
        <p>A {empresa} se reserva o direito de alterar estes Termos de Serviço a qualquer momento. As alterações entram em vigor imediatamente após sua publicação no site. O uso continuado do site após as alterações constitui aceitação dos novos termos.</p>
      </div>

      <div className="tp-section">
        <h2>7. Legislação Aplicável</h2>
        <p>Estes Termos são regidos pelas leis da República Federativa do Brasil. Eventuais disputas serão resolvidas no foro da Comarca da sede da empresa.</p>
      </div>

      <div className="tp-section">
        <h2>8. Contato</h2>
        <p>Em caso de dúvidas sobre estes Termos de Serviço, entre em contato pelo e-mail: <strong>{email}</strong></p>
      </div>
    </>
  );
}

function PrivacidadeContent({ empresa, empresaCurta, site, email }: { empresa: string; empresaCurta: string; site: string; email: string }) {
  return (
    <>
      <h1 className="tp-title">Política de Privacidade</h1>
      <p className="tp-updated">Última atualização: 12 de abril de 2026</p>

      <div className="tp-section">
        <h2>1. Introdução</h2>
        <p>A {empresa} ("{empresaCurta}") está comprometida com a proteção da privacidade dos seus usuários. Esta Política de Privacidade descreve como coletamos, utilizamos e protegemos seus dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).</p>
      </div>

      <div className="tp-section">
        <h2>2. Dados Coletados</h2>
        <p>Podemos coletar os seguintes tipos de dados:</p>
        <ul>
          <li><strong>Dados de rastreamento:</strong> código de rastreio, status do envio, endereço de entrega</li>
          <li><strong>Dados de navegação:</strong> endereço IP, tipo de navegador, páginas visitadas, horário de acesso</li>
          <li><strong>Dados de contato:</strong> nome, e-mail e telefone, quando fornecidos voluntariamente</li>
          <li><strong>Dados de notificação:</strong> informações de push notification, quando autorizado pelo usuário</li>
        </ul>
      </div>

      <div className="tp-section">
        <h2>3. Uso dos Dados</h2>
        <p>Os dados coletados são utilizados para:</p>
        <ul>
          <li>Fornecer informações de rastreamento de encomendas</li>
          <li>Enviar notificações sobre atualizações de entrega</li>
          <li>Melhorar a experiência do usuário e a qualidade dos nossos serviços</li>
          <li>Comunicar informações relevantes sobre o status de envios</li>
          <li>Cumprir obrigações legais e regulatórias</li>
        </ul>
      </div>

      <div className="tp-section">
        <h2>4. Compartilhamento de Dados</h2>
        <p>Seus dados pessoais não são vendidos a terceiros. Podemos compartilhar informações com:</p>
        <ul>
          <li><strong>Transportadoras parceiras:</strong> para fins de logística e rastreamento</li>
          <li><strong>Prestadores de serviço:</strong> que nos auxiliam na operação do site (hospedagem, e-mail)</li>
          <li><strong>Autoridades:</strong> quando exigido por lei ou ordem judicial</li>
        </ul>
      </div>

      <div className="tp-section">
        <h2>5. Cookies</h2>
        <p>Utilizamos cookies e tecnologias similares para melhorar a navegação, analisar o uso do site e personalizar conteúdo. Você pode configurar seu navegador para recusar cookies, mas isso pode afetar a funcionalidade do site.</p>
      </div>

      <div className="tp-section">
        <h2>6. Segurança dos Dados</h2>
        <p>Empregamos medidas técnicas e organizacionais adequadas para proteger seus dados pessoais contra acesso não autorizado, perda, alteração ou destruição. Utilizamos criptografia, firewalls e controles de acesso para garantir a segurança das informações.</p>
      </div>

      <div className="tp-section">
        <h2>7. Seus Direitos (LGPD)</h2>
        <p>De acordo com a LGPD, você tem direito a:</p>
        <ul>
          <li>Confirmar a existência de tratamento de seus dados pessoais</li>
          <li>Acessar seus dados pessoais</li>
          <li>Solicitar a correção de dados incompletos ou desatualizados</li>
          <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários</li>
          <li>Solicitar a portabilidade de seus dados</li>
          <li>Revogar o consentimento a qualquer momento</li>
        </ul>
      </div>

      <div className="tp-section">
        <h2>8. Retenção de Dados</h2>
        <p>Seus dados pessoais são mantidos apenas pelo tempo necessário para cumprir as finalidades descritas nesta política, ou conforme exigido por lei. Dados de rastreamento são mantidos por até 12 meses após a entrega.</p>
      </div>

      <div className="tp-section">
        <h2>9. Alterações nesta Política</h2>
        <p>Esta Política de Privacidade pode ser atualizada periodicamente. Recomendamos que você a consulte regularmente. As alterações entram em vigor imediatamente após a publicação no site.</p>
      </div>

      <div className="tp-section">
        <h2>10. Contato</h2>
        <p>Para exercer seus direitos ou esclarecer dúvidas sobre esta política, entre em contato pelo e-mail: <strong>{email}</strong></p>
      </div>
    </>
  );
}
