import { PainelAcoes } from "@/components/app/AppChrome";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { quemEncerrou } from "@/lib/execucao-pedidos";
import { dataHora, hora } from "@/lib/formatar";
import { reservadaParaOutro, situacaoDaApr, type AprDaOs, type ExecucaoDaOs, type OsDetalhada } from "@/lib/os-app";
import { rotas, urlDoPdf } from "@/lib/rotas";
import type { ConferenciaDaOs } from "@/lib/conferencia";
import { BotaoApr } from "./BotaoApr";
import { ConferenciaDaOsCard } from "./ConferenciaDaOsCard";

interface AcoesDaOsProps {
  os: OsDetalhada;
  usuarioId: string;
  execucaoAberta: ExecucaoDaOs | null;
  /** O técnico participa da APR da execução em andamento (de outra pessoa): ele a acompanha. */
  acompanhaExecucao?: boolean;
  /** A execução cujo tempo parou ("Encerrar OS") e que espera o preenchimento e a assinatura do responsável (a OS está `encerrando`). */
  execucaoEncerrando?: ExecucaoDaOs | null;
  /** APR aprovada de hoje, de que o técnico participa, que ainda serve e não amparou uma execução (assinada ou não por todos). */
  aprDisponivel: AprDaOs | null;
  /** A mesma APR disponível, de quem quer que seja: se o técnico não participa dela, ele não assina nem inicia a execução. */
  aprDeOutros: AprDaOs | null;
  /** A APR de hoje de que o técnico participa que deixou de servir (o responsável recusou, ou restaram menos de 2 participantes). */
  aprInviavel?: AprDaOs | null;
  /** O ausente só visualiza: o selo "Ausente até DD/MM/AAAA" quando quem olha está ausente, e as ações de campo somem. */
  ausencia?: string | null;
  /** As conferências da execução da OS (`GET /os/{id}`): quando há, o painel traz o aviso com o estado e o botão da tela. */
  conferencias?: ConferenciaDaOs[];
}

/**
 * Painel lateral do detalhe: o que o técnico pode fazer agora, conforme o estado da OS e, abaixo, o aviso da conferência da execução
 * (quando a equipe registrou parte do serviço sem sinal, em aparelhos diferentes) com o botão para abri-la.
 */
export function AcoesDaOs(props: AcoesDaOsProps) {
  return (
    <>
      <AcoesPorEstado {...props} />
      <ConferenciaDaOsCard osId={props.os.id} conferencias={props.conferencias} />
    </>
  );
}

function AcoesPorEstado({ os, usuarioId, execucaoAberta, acompanhaExecucao = false, execucaoEncerrando = null, aprDisponivel, aprDeOutros, aprInviavel = null, ausencia = null }: AcoesDaOsProps) {
  const aberta = os.status !== "encerrada" && os.status !== "cancelada" && os.status !== "devolvida" && os.status !== "encerrando" && os.status !== "aguardando_supervisor";
  // O ausente não aplica APR nem executa: só consulta (a OS dele em execução foi suspensa quando a ausência começou).
  if (ausencia && aberta) {
    return (
      <PainelAcoes>
        <Notice tone="al" icon="lock">
          <strong>{ausencia}.</strong> Você só visualiza o sistema: não dá para aplicar APR nem iniciar a execução desta OS.
        </Notice>
      </PainelAcoes>
    );
  }
  if (os.status === "em_execucao" || execucaoAberta) {
    const minha = execucaoAberta?.executor.id === usuarioId;
    return (
      <PainelAcoes>
        {minha ? (
          <>
            <div className="row g8 small">
              <Icon name="clock" size={16} />
              Execução iniciada em {dataHora(execucaoAberta!.inicio)}.
            </div>
            <LinkButton variant="p" block href={rotas.app.execucao(os.id)}>
              <Icon name="play" size={18} fill />
              Continuar execução
            </LinkButton>
          </>
        ) : (
          <Notice tone="info" icon="user">
            <strong>Esta OS já está em execução</strong>
            {execucaoAberta ? ` por ${execucaoAberta.executor.nome}, desde ${dataHora(execucaoAberta.inicio)}` : ""}. Não dá para iniciar outra APR
            ou execução enquanto ela não for encerrada, suspensa ou interrompida.
          </Notice>
        )}
        {!minha && acompanhaExecucao && (
          <LinkButton variant="p" block href={rotas.app.execucao(os.id)}>
            <Icon name="eye" size={18} />
            Acompanhar execução
          </LinkButton>
        )}
      </PainelAcoes>
    );
  }

  // O tempo parou ("Encerrar OS"), mas o responsável ainda não preencheu e assinou o encerramento.
  if (os.status === "encerrando") {
    const minha = execucaoEncerrando ? quemEncerrou(execucaoEncerrando).id === usuarioId : false;
    return (
      <PainelAcoes>
        {minha ? (
          <>
            <Notice tone="al" icon="clock">
              <strong>Você encerrou a OS: falta preencher e assinar o encerramento.</strong> O tempo já parou; o preenchimento não conta nele.
            </Notice>
            <LinkButton variant="p" block href={rotas.app.execucao(os.id)}>
              <Icon name="check" size={18} />
              Preencher e assinar o encerramento
            </LinkButton>
          </>
        ) : (
          <Notice tone="info" icon="user">
            <strong>{execucaoEncerrando ? `${quemEncerrou(execucaoEncerrando).nome} encerrou a OS` : "A OS foi encerrada"} e está preenchendo e assinando o encerramento.</strong> Só
            quem encerrou a OS assina o encerramento. Depois, a OS segue para o supervisor.
          </Notice>
        )}
      </PainelAcoes>
    );
  }

  if (os.status === "aguardando_supervisor") {
    return (
      <PainelAcoes>
        <Notice tone="info" icon="clock">
          <strong>O responsável já assinou o encerramento.</strong> Agora falta o supervisor ler o relatório da execução e assinar por último; só então a OS está concluída e o
          PDF fica pronto.
        </Notice>
      </PainelAcoes>
    );
  }

  if (os.status === "encerrada" || os.status === "cancelada" || os.status === "devolvida") {
    return (
      <PainelAcoes>
        <div className="row g8 small">
          <Icon name="lock" size={16} />
          {os.status === "encerrada" ? "OS concluída: só consulta." : os.status === "cancelada" ? "OS cancelada: só consulta." : "OS devolvida ao SAP: só consulta."}
        </div>
        {os.status === "cancelada" && os.justificativa_cancelamento && <p className="muted">{os.justificativa_cancelamento}</p>}
        {os.status === "devolvida" && os.devolucao?.justificativa && <p className="muted">{os.devolucao.justificativa}</p>}
        {os.status === "encerrada" &&
          (os.pdf_pronto ? (
            <a className="btn btn-p btn-block" href={urlDoPdf(os.id)} target="_blank" rel="noreferrer">
              <Icon name="file" size={18} />
              Abrir o PDF da OS
            </a>
          ) : (
            <p className="muted">O PDF desta OS ainda está sendo gerado.</p>
          ))}
      </PainelAcoes>
    );
  }

  // liberada ou pendente
  if (reservadaParaOutro(os, usuarioId)) {
    return (
      <PainelAcoes>
        <Notice tone="info" icon="lock">
          <strong>OS reservada para {os.responsavel!.nome}.</strong> Só quem o supervisor designou inicia a APR e a execução desta OS. Siga com as outras da equipe.
        </Notice>
      </PainelAcoes>
    );
  }

  const situacao = aprDisponivel ? situacaoDaApr(aprDisponivel) : null;
  const euAssinei = Boolean(aprDisponivel?.participantes.find((p) => p.usuario_id === usuarioId)?.assinada_em);
  const euRecusei = Boolean(aprDeOutros?.participantes.find((p) => p.usuario_id === usuarioId)?.recusou_em);

  return (
    <PainelAcoes>
      {aprDisponivel && situacao?.pronta ? (
        <>
          <Notice tone="ok" icon="check">
            <strong>APR aprovada hoje às {hora(aprDisponivel.concluida_em)} e assinada por todos.</strong> Ela ampara uma execução nesta OS.
          </Notice>
          <LinkButton variant="p" block href={rotas.app.execucao(os.id)} data-treino="os-iniciar-execucao">
            <Icon name="play" size={18} fill />
            Iniciar execução
          </LinkButton>
        </>
      ) : aprDisponivel && situacao ? (
        <>
          <Notice tone="al" icon="clip">
            <strong>
              APR aprovada hoje às {hora(aprDisponivel.concluida_em)}, {euAssinei ? "mas ainda faltam assinaturas" : "aguardando a sua assinatura"}.
            </strong>{" "}
            {euAssinei ? `Falta assinar: ${situacao.faltam.map((p) => p.nome).join(", ")}. ` : ""}A execução só começa quando todos os participantes assinam, cada um na própria conta.
          </Notice>
          <LinkButton variant="p" block href={rotas.app.aprovada(os.id)}>
            <Icon name="clip" size={18} />
            {euAssinei ? "Acompanhar as assinaturas" : "Assinar a APR"}
          </LinkButton>
        </>
      ) : aprDeOutros ? (
        <Notice tone="info" icon="user">
          {euRecusei ? (
            <>
              <strong>Você recusou a APR de {aprDeOutros.preenchida_por.nome} e saiu dela.</strong> Para executar esta OS, faça a sua APR.
            </>
          ) : (
            <>
              <strong>
                APR aprovada hoje às {hora(aprDeOutros.concluida_em)} por {aprDeOutros.preenchida_por.nome}.
              </strong>{" "}
              Só os participantes dela ({situacaoDaApr(aprDeOutros).ativos.map((p) => p.nome).join(", ")}) assinam e iniciam a execução. Para executar, faça a sua APR.
            </>
          )}
        </Notice>
      ) : aprInviavel ? (
        <Notice tone="blq" icon="octagon">
          <strong>A APR de hoje não serve mais.</strong> {situacaoDaApr(aprInviavel).motivoInviavel} Faça uma APR nova para executar a OS.
        </Notice>
      ) : (
        <div className="row g8 small">
          <Icon name="lock" size={16} />
          A execução só é liberada depois da APR aprovada e assinada por todos.
        </div>
      )}
      <BotaoApr osId={os.id} usuarioId={usuarioId} pendente={os.status === "pendente"} jaAprovada={Boolean(aprDisponivel)} />
    </PainelAcoes>
  );
}
