import { PainelAcoes } from "@/components/app/AppChrome";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { dataHora, hora } from "@/lib/formatar";
import type { AprDaOs, ExecucaoDaOs, OsDetalhada } from "@/lib/os-app";
import { rotas, urlDoPdf } from "@/lib/rotas";
import { BotaoApr } from "./BotaoApr";

interface AcoesDaOsProps {
  os: OsDetalhada;
  usuarioId: string;
  execucaoAberta: ExecucaoDaOs | null;
  /** APR aprovada de hoje que ainda não amparou uma execução. */
  aprDisponivel: AprDaOs | null;
}

/** Painel lateral do detalhe: o que o técnico pode fazer agora, conforme o estado da OS. */
export function AcoesDaOs({ os, usuarioId, execucaoAberta, aprDisponivel }: AcoesDaOsProps) {
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
      </PainelAcoes>
    );
  }

  if (os.status === "encerrada" || os.status === "cancelada") {
    return (
      <PainelAcoes>
        <div className="row g8 small">
          <Icon name="lock" size={16} />
          {os.status === "encerrada" ? "OS encerrada: só consulta." : "OS cancelada: só consulta."}
        </div>
        {os.status === "cancelada" && os.justificativa_cancelamento && <p className="muted">{os.justificativa_cancelamento}</p>}
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
  return (
    <PainelAcoes>
      {aprDisponivel ? (
        <>
          <Notice tone="ok" icon="check">
            <strong>APR aprovada hoje às {hora(aprDisponivel.concluida_em)}.</strong> Ela ampara uma execução nesta OS.
          </Notice>
          <LinkButton variant="p" block href={rotas.app.execucao(os.id)} data-treino="os-iniciar-execucao">
            <Icon name="play" size={18} fill />
            Iniciar execução
          </LinkButton>
        </>
      ) : (
        <div className="row g8 small">
          <Icon name="lock" size={16} />
          A execução só é liberada depois da APR aprovada.
        </div>
      )}
      <BotaoApr osId={os.id} usuarioId={usuarioId} pendente={os.status === "pendente"} jaAprovada={Boolean(aprDisponivel)} />
    </PainelAcoes>
  );
}
