import { Link } from "react-router-dom";
import { useEffect } from "react";

const SECTIONS = [
  {
    n: 1,
    t: "OBJETO",
    body: (
      <p>
        A plataforma Magnus Frete tem como finalidade permitir a criação,
        gerenciamento e consulta de códigos de rastreio, bem como a geração de
        notas fiscais simplificadas, destinadas a fins informativos e operacionais.
      </p>
    ),
  },
  {
    n: 2,
    t: "NATUREZA DO SERVIÇO",
    body: (
      <>
        <p>A Magnus Frete não é uma transportadora real e não executa entregas físicas.</p>
        <p className="mt-3">
          Trata-se de uma plataforma de simulação e gestão de rastreamento, utilizada por
          lojistas, afiliados e empresas para acompanhamento logístico visual e informativo,
          com suporte a operações nacionais e internacionais.
        </p>
      </>
    ),
  },
  {
    n: 3,
    t: "RESPONSABILIDADE DO USUÁRIO",
    body: (
      <>
        <p>O usuário é inteiramente responsável por:</p>
        <ul>
          <li>Veracidade dos dados inseridos</li>
          <li>Informações de destinatário</li>
          <li>Produtos cadastrados</li>
          <li>Valores declarados</li>
          <li>Uso legal da plataforma</li>
        </ul>
        <p className="mt-3">A Magnus Frete não se responsabiliza por:</p>
        <ul>
          <li>Perdas financeiras</li>
          <li>Atrasos reais</li>
          <li>Entregas não realizadas</li>
          <li>Uso indevido da ferramenta</li>
        </ul>
      </>
    ),
  },
  {
    n: 4,
    t: "NOTA FISCAL SIMPLIFICADA",
    body: (
      <p>
        A nota fiscal gerada pela plataforma possui caráter meramente ilustrativo, não
        substituindo documentos fiscais oficiais exigidos por lei.
      </p>
    ),
  },
  {
    n: 5,
    t: "CRÉDITOS E PAGAMENTOS",
    body: (
      <>
        <ul>
          <li>Cada rastreio consome 1 crédito</li>
          <li>Créditos não são reembolsáveis</li>
        </ul>
        <p className="mt-3">
          O valor unitário do crédito é definido pela plataforma. A Magnus Frete pode
          alterar valores mediante aviso prévio.
        </p>
      </>
    ),
  },
  {
    n: 6,
    t: "BLOQUEIO E SUSPENSÃO",
    body: (
      <p>
        A plataforma se reserva o direito de suspender contas, cancelar acessos e
        bloquear usuários em caso de uso abusivo, fraudulento ou ilegal.
      </p>
    ),
  },
  {
    n: 7,
    t: "ALTERAÇÕES DOS TERMOS",
    body: (
      <p>
        Os termos podem ser alterados a qualquer momento, sendo responsabilidade do
        usuário consultá-los periodicamente.
      </p>
    ),
  },
  {
    n: 8,
    t: "ACEITAÇÃO",
    body: (
      <p>
        Ao utilizar a plataforma, o usuário declara que leu, compreendeu e concorda com
        todos os termos acima.
      </p>
    ),
  },
  {
    n: 9,
    t: "COOPERAÇÃO, COMPLIANCE E CANAL DE DENÚNCIAS",
    body: (
      <>
        <p>
          A plataforma Magnus Frete atua de boa-fé e mantém política ativa de prevenção a
          usos abusivos, fraudulentos ou ilegais de seus serviços.
        </p>
        <p className="mt-3">
          Sempre que houver indícios de utilização da plataforma em desconformidade com a
          legislação vigente ou com estes Termos de Uso, a Magnus Frete poderá adotar
          medidas preventivas, incluindo, mas não se limitando a:
        </p>
        <ul>
          <li>Suspensão ou cancelamento de contas</li>
          <li>Bloqueio de funcionalidades</li>
          <li>Análise interna de registros e atividades</li>
        </ul>
        <p className="mt-4 font-medium text-gold-soft">Canal de Denúncias</p>
        <p className="mt-2">
          Com o objetivo de reforçar a transparência e a prevenção de abusos, a Magnus
          Frete disponibiliza um canal exclusivo para o recebimento de denúncias
          relacionadas a uso indevido da plataforma:
        </p>
        <p className="mt-3">
          <a href="mailto:denuncias@magnusfrete.net" className="text-gold underline-offset-4 hover:underline">
            denuncias@magnusfrete.net
          </a>
        </p>
        <p className="mt-3">
          As denúncias recebidas serão analisadas internamente, de acordo com critérios
          técnicos e legais, podendo resultar na adoção das medidas cabíveis, conforme
          previsto nestes Termos.
        </p>
        <p className="mt-4">
          <strong className="text-foreground">Cooperação com Autoridades:</strong> A Magnus
          Frete declara estar à disposição para cooperar com autoridades competentes,
          mediante requisição formal ou ordem judicial, fornecendo informações e registros
          técnicos disponíveis, nos limites da legislação aplicável, especialmente no que
          se refere à proteção de dados pessoais e à privacidade dos usuários, nos termos
          da Lei Geral de Proteção de Dados (LGPD).
        </p>
      </>
    ),
  },
];

export default function TermosUso() {
  useEffect(() => {
    document.title = "Termos de Uso — Magnus Frete";
  }, []);
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-foreground font-sans">
      <header className="border-b border-gold/10">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="size-8 rounded-md border border-gold/30 grid place-items-center bg-noir-elevated">
              <span className="font-serif text-gold text-lg leading-none">M</span>
            </div>
            <span className="font-serif text-xl text-foreground">
              Magnus<span className="text-gold">·</span>Frete
            </span>
          </Link>
          <Link to="/" className="text-sm text-foreground/70 hover:text-gold transition">
            ← Voltar ao site
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-[11px] uppercase tracking-[0.22em] text-gold/80">Plataforma Magnus Frete</div>
        <h1 className="mt-4 font-serif text-5xl md:text-6xl text-foreground">Termos de Uso</h1>
        <p className="mt-6 text-foreground/60 max-w-2xl">
          Ao acessar, cadastrar-se ou utilizar a plataforma Magnus Frete, o usuário
          concorda integralmente com os termos e condições descritos abaixo.
        </p>

        <div className="mt-16 space-y-14">
          {SECTIONS.map((s) => (
            <section key={s.n} className="grid md:grid-cols-[80px_1fr] gap-6">
              <div className="font-serif text-5xl text-gold-soft leading-none">{s.n}</div>
              <div>
                <h2 className="font-serif text-2xl text-foreground tracking-wide">{s.t}</h2>
                <div className="mt-4 text-foreground/70 leading-relaxed text-[15px] [&_ul]:mt-2 [&_ul]:pl-5 [&_ul]:list-disc [&_li]:my-1">
                  {s.body}
                </div>
              </div>
            </section>
          ))}
        </div>

        <div className="mt-20 pt-8 border-t border-gold/10 flex items-center justify-between text-sm text-foreground/50 flex-wrap gap-4">
          <Link to="/" className="text-gold hover:text-gold-soft transition">← Voltar para a página inicial</Link>
          <span>© {new Date().getFullYear()} Magnus Frete. Todos os direitos reservados.</span>
        </div>
      </main>
    </div>
  );
}
