import Image from "next/image";
import Link from "next/link";
import { Trilha } from "@/components/app/AppChrome";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { SeloPatente } from "@/components/web/gamificacao/SeloPatente";
import { lerConquistas, lerOuNulo, lerPatentes } from "@/data/gamificacao";
import { apiOuNulo, usuarioAtual } from "@/lib/api";
import { numero } from "@/lib/gamificacao";
import { rotas } from "@/lib/rotas";
import { estaPendente } from "@/lib/tipos";
import { REACOES, type Reacao } from "@/lib/vitoria";
import type { FuncaoDeIA } from "../../../../shared/ia/funcoes";
import { Figurinha } from "./Figurinha";

/** Resposta de `GET /vitoria/sobre`: a única parte verdadeira do perfil (o provedor, os modelos, os limites e o uso de hoje). */
interface SobreAVitoria {
  provedor: "anthropic" | "gemini";
  ligada: boolean;
  modelos: Record<FuncaoDeIA, string>;
  /** Quais funções recebem dado real agora (o admin autorizou, assinando). */
  lendo_dados: Record<FuncaoDeIA, boolean>;
  limites: { por_conversa: number; por_conta_dia: number };
  mensagens_hoje: number;
  /** Os números de verdade dela (`vitoria_estatistica`), somados desde `desde`. */
  estatisticas: {
    desde: string | null;
    respondidas: number;
    nao_sei: number;
    com_acao: number;
    idas_na_tela: number;
    tempo_medio_ms: number | null;
    treinamentos_criados: number;
    treinamentos_publicados: number;
    digitalizadas: number;
  };
}

const NOME_DO_PROVEDOR: Record<SobreAVitoria["provedor"], string> = {
  anthropic: "Anthropic Claude",
  gemini: "Google Gemini (gratuito, só na demonstração)",
};

/** `AAAA-MM-DD` (um dia, sem hora) em `DD/MM/AAAA`, sem passar por `Date`, que leria como UTC e poderia voltar um dia. */
const diaPorExtenso = (dia: string) => dia.split("-").reverse().join("/");

/**
 * Os 4 contadores do topo, com os números de verdade dela (`GET /vitoria/sobre`, seção 2.8.7). A contagem começou em
 * 17/10/2026; antes disso nada era somado. Sem a consulta, os valores ficam em "—".
 */
function numerosDaVitoria(e: SobreAVitoria["estatisticas"] | null) {
  return [
    {
      rotulo: "Dúvidas respondidas",
      valor: e ? numero(e.respondidas) : "—",
      detalhe: e?.desde ? `desde ${diaPorExtenso(e.desde)}` : "contadas a partir da primeira",
      cor: "var(--enc)",
    },
    {
      rotulo: "Treinamentos criados",
      valor: e ? numero(e.treinamentos_criados) : "—",
      detalhe: e ? `pelo rascunho da IA · ${numero(e.treinamentos_publicados)} ${e.treinamentos_publicados === 1 ? "publicado" : "publicados"}` : "pelo rascunho da IA",
      cor: "var(--brand)",
    },
    {
      rotulo: "Tempo de resposta",
      valor: e?.tempo_medio_ms != null ? `${(e.tempo_medio_ms / 1000).toFixed(1).replace(".", ",")} s` : "—",
      detalhe: e?.tempo_medio_ms != null ? "em média, com a IA" : "ainda sem respostas com IA",
      cor: "var(--lib)",
    },
    {
      rotulo: "OS/APR digitalizadas",
      valor: e ? numero(e.digitalizadas) : "—",
      detalhe: e && e.digitalizadas > 0 ? "folhas antigas lidas pela IA" : "a digitalização ainda não começou",
      cor: "var(--exe)",
    },
  ];
}

const INFORMACOES: [string, string][] = [
  ["Matrícula", "VIT-0001"],
  ["Cargo", "Assistente de campo virtual"],
  ["Na empresa desde", "16/10/2026"],
  ["Turno", "24 horas, 7 dias por semana"],
  ["Férias", "nunca tirou (e não precisa)"],
  ["Assinatura", "não assina: quem assina são as pessoas"],
];

/** O que ela pode e o que não pode fazer: as regras de verdade da Vitória (`vitoria.md`, seções 2.5 e "O que ela não deve fazer"). */
const PODE = [
  "Consultar o manual do seu perfil (técnico ou administrador)",
  "Levar você à tela certa (\"Me leve lá\") e fazer piscar o botão (\"Mostrar na tela\")",
  "Abrir uma tela já filtrada pelo mês que você pediu",
  "Montar o rascunho de um treinamento, que o administrador revisa, corrige e assina",
  "Responder pelo manual, sem IA, quando a IA está fora do ar",
];
const NAO_PODE = [
  "Ver as suas OS, as respostas da APR ou os seus dados (a menos que o administrador libere a leitura, e então só o seu trabalho)",
  "Dizer o que reprova a APR ou orientar normas de segurança de campo",
  "Aprovar, reprovar ou assinar qualquer coisa",
  "Guardar a conversa: ela fica só no seu aparelho",
  "Publicar um treinamento: quem publica assina e responde por ele",
];

const HISTORICO = [
  { data: "14/10/2026", titulo: "Contratada", texto: "A Vitória é decidida, junto com os treinamentos de serviço." },
  { data: "16/10/2026", titulo: "Primeiro dia", texto: "Começa a responder pelo manual, levar à tela certa e destacar botões." },
  { data: "17/10/2026", titulo: "Promovida", texto: "Ganha o Gemini para a demonstração e passa a montar os rascunhos dos treinamentos." },
  { data: "17/10/2026", titulo: "Visual novo", texto: "Ganha a foto de perfil, as figurinhas e este perfil." },
];

const NOME_DA_FIGURINHA: Record<Reacao, string> = {
  ola: "Olá",
  certo: "Joinha",
  atencao: "Atenção",
  comemorando: "Comemorando",
  errada: "Ops",
  pensando: "Pensando",
  triste: "Triste",
  surpresa: "Surpresa",
  vergonha: "Vergonha",
  fofo: "Fofa",
};

/**
 * O perfil da Vitória (`/app/perfil/vitoria`, `vitoria.md`, seção 2.8.7), aberto pelo cabeçalho do chat. É fictício (a
 * equipe, a matrícula e o histórico são inventados), menos os 4 contadores do topo e o bloco "Modelo da IA", que vêm
 * de `GET /vitoria/sobre`, e a patente e as conquistas, que são as imagens reais da gamificação. Ela não é um usuário
 * do banco: não entra no ranking, nas equipes nem na auditoria.
 */
export async function PerfilDaVitoria() {
  // Quem aguarda liberação também abre o perfil, mas a gamificação recusa e a web levaria à tela de espera: para essa pessoa
  // a patente e as conquistas não são consultadas. Qualquer falha ao consultar o modelo só esconde o bloco dele.
  const { usuario: eu } = await usuarioAtual();
  const consultaGamificacao = !estaPendente(eu);
  const [sobre, patentes, conquistas] = await Promise.all([
    apiOuNulo<SobreAVitoria>("/vitoria/sobre").catch(() => null),
    consultaGamificacao ? lerOuNulo(lerPatentes) : null,
    consultaGamificacao ? lerOuNulo(lerConquistas) : null,
  ]);
  const maiorPatente = patentes?.patentes.filter((p) => p.ativa).sort((a, b) => b.pontos_necessarios - a.pontos_necessarios)[0] ?? null;
  const todasAsConquistas = conquistas?.conquistas.filter((c) => c.ativa) ?? [];

  return (
    <Screen className="perfil-pagina vp-pagina">
      <Trilha passos={[{ rotulo: "Meu perfil", href: rotas.app.perfil }, { rotulo: "Vitória" }]} />

      <header className="perfil-capa vp-capa">
        <span className="perfil-foto vp-foto">
          <Image src="/vitoria/icone.webp" alt="Foto da Vitória" width={104} height={104} unoptimized />
        </span>
        <div className="perfil-id">
          <div className="row g8 wrap">
            <h1>Vitória</h1>
            <Badge tone="brand">Assistente virtual</Badge>
          </div>
          <span className="muted">Assistente de campo virtual · Equipe Suporte Digital</span>
          <div className="row g8 wrap">
            <Badge tone="dark">
              <Icon name="star" size={13} /> Funcionária exemplar
            </Badge>
            <Badge tone="lib">Funcionária do mês · outubro de 2026</Badge>
            {sobre && <Badge tone={sobre.ligada ? "enc" : "al"}>{sobre.ligada ? "Online com IA" : "Respondendo sem IA"}</Badge>}
          </div>
        </div>
      </header>

      <div className="kpis k4">
        {numerosDaVitoria(sobre?.estatisticas ?? null).map((n) => (
          <div key={n.rotulo} className="kpi">
            <span className="l">
              <i style={{ background: n.cor }} />
              {n.rotulo}
            </span>
            <span className="v">{n.valor}</span>
            <span className="s">{n.detalhe}</span>
          </div>
        ))}
      </div>

      <div className="perfil-grade">
        <div className="col-main stack g16" style={{ minWidth: 0 }}>
          {eu.perfil === "admin" && (
            <section className="panel" aria-labelledby="vp-controle" data-treino="vp-controle-da-ia">
              <h2 id="vp-controle">Controle da IA</h2>
              <p className="muted">Ligar e desligar cada função da IA, autorizar a leitura de dados e ajustar os limites de uso ficam agora nas configurações do sistema.</p>
              <div>
                <Link href={`${rotas.app.configuracoesSistema}#controle-da-ia`} className="btn btn-line btn-sm">
                  <Icon name="engrenagem" size={16} />
                  Abrir o controle da IA
                </Link>
              </div>
            </section>
          )}

          <section className="panel" aria-labelledby="vp-sobre">
            <h2 id="vp-sobre">Sobre</h2>
            <div className="vp-texto">
              <p>
                Sou a Vitória, a colega que conhece o SYNQ OS de cor. Não vou a campo: quem faz a APR e executa a OS é você. O meu trabalho é você não perder
                tempo procurando onde fica cada coisa.
              </p>
              <p>Meu nome vem da capital do Espírito Santo e de cada OS encerrada sem acidente.</p>
            </div>
          </section>

          <section className="panel" aria-labelledby="vp-direitos">
            <h2 id="vp-direitos">Direitos no sistema</h2>
            <div className="vp-direitos">
              <div>
                <h3>O que ela pode fazer</h3>
                <ul className="vp-lista vp-pode">
                  {PODE.map((item) => (
                    <li key={item}>
                      <Icon name="check" size={16} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>O que ela não pode fazer</h3>
                <ul className="vp-lista vp-nao-pode">
                  {NAO_PODE.map((item) => (
                    <li key={item}>
                      <Icon name="x" size={16} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="panel" aria-labelledby="vp-historico">
            <h2 id="vp-historico">Histórico na empresa</h2>
            <ol className="vp-linha-do-tempo">
              {HISTORICO.map((h) => (
                <li key={h.titulo}>
                  <span className="small mono">{h.data}</span>
                  <strong>{h.titulo}</strong>
                  <span className="small">{h.texto}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="panel" aria-labelledby="vp-figurinhas">
            <h2 id="vp-figurinhas">Figurinhas</h2>
            <p className="small muted">Toque numa figurinha para ver a animação.</p>
            <ul className="vp-figurinhas">
              {REACOES.map((r) => (
                <li key={r}>
                  <Figurinha reacao={r} tocar={false} tamanho={84} />
                  <span className="small">{NOME_DA_FIGURINHA[r]}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="stack g16" style={{ minWidth: 0 }}>
          <section className="panel vp-ia" aria-labelledby="vp-modelo">
            <h2 id="vp-modelo">
              <Icon name="star" size={16} /> Modelo da IA
            </h2>
            {!sobre ? (
              <p className="muted">Não foi possível consultar o modelo agora.</p>
            ) : (
              <>
                <dl className="perfil-dados">
                  <div>
                    <dt>Provedor</dt>
                    <dd>{NOME_DO_PROVEDOR[sobre.provedor]}</dd>
                  </div>
                  <div>
                    <dt>Modelo da conversa</dt>
                    <dd className="mono">{sobre.modelos.chatbot}</dd>
                  </div>
                  <div>
                    <dt>Modelo dos rascunhos de treinamento</dt>
                    <dd className="mono">{sobre.modelos.minigames}</dd>
                  </div>
                  <div>
                    <dt>Situação</dt>
                    <dd>{sobre.ligada ? "Ligada" : "Sem IA: ela responde pelo manual, por palavras-chave"}</dd>
                  </div>
                  <div>
                    <dt>Limites</dt>
                    <dd>
                      {sobre.limites.por_conversa} mensagens por conversa · {sobre.limites.por_conta_dia} por pessoa por dia
                    </dd>
                  </div>
                  <div>
                    <dt>Você hoje</dt>
                    <dd>
                      {sobre.mensagens_hoje} de {sobre.limites.por_conta_dia} mensagens com IA
                    </dd>
                  </div>
                </dl>
                <p className="small muted">
                  {sobre.lendo_dados.chatbot
                    ? "A IA recebe a sua pergunta, a tela em que você está, o manual do seu perfil e um resumo do seu trabalho (as OS em aberto da sua equipe, as assinaturas que faltam e os seus pontos), porque o administrador autorizou essa leitura."
                    : "A IA recebe só a sua pergunta, a tela em que você está e o manual do seu perfil. Nunca as suas OS nem os seus dados."}
                </p>
              </>
            )}
          </section>

          <section className="panel" aria-labelledby="vp-dados">
            <h2 id="vp-dados">Informações</h2>
            <dl className="perfil-dados">
              {INFORMACOES.map(([rotulo, valor]) => (
                <div key={rotulo}>
                  <dt>{rotulo}</dt>
                  <dd>{valor}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="panel gam-bloco" aria-labelledby="vp-gamificacao">
            <h2 id="vp-gamificacao">Gamificação</h2>
            <div className="gam-resumo">
              <div className="r-item">
                <span className="lbl">Patente</span>
                <SeloPatente patente={maiorPatente ?? { nome: "Diamante", cor: "#4FB3D9", imagem_url: null }} tamanho="m" />
              </div>
              <div className="r-item">
                <span className="lbl">Conquistas</span>
                <strong>{todasAsConquistas.length > 0 ? `${numero(todasAsConquistas.length)} de ${numero(todasAsConquistas.length)}` : "todas"}</strong>
              </div>
            </div>
            {todasAsConquistas.length > 0 && (
              <div className="gal-pequena">
                {todasAsConquistas.map((c) => (
                  <span key={c.id} className="trofeu" title={c.descricao}>
                    {c.imagem_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imagem_url} alt="" loading="lazy" />
                    ) : (
                      <Icon name="trophy" size={16} />
                    )}
                    {c.titulo}
                  </span>
                ))}
              </div>
            )}
            <span className="small muted">Honorária: assistente virtual não pontua nem entra no ranking.</span>
          </section>
        </aside>
      </div>
    </Screen>
  );
}
