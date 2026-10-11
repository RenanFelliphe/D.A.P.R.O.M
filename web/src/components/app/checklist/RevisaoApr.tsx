import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { perguntasApr03 } from "@/data/checklist";
import {
  faltaEvidencia,
  itensReprovados,
  totalAlertas,
  totalPerguntas,
  totalRespondidas,
  type EstadoChecklist,
} from "@/lib/checklist";

interface RevisaoAprProps {
  estado: EstadoChecklist;
  /** Reabre a pergunta (base 0) para corrigir a resposta ou a evidência. */
  aoAbrir: (indice: number) => void;
  aoVoltar: () => void;
  aoValidar: () => void;
}

/** Revisão final antes de validar: itens reprovados, alertas e o aviso do que acontece ao concluir. */
export function RevisaoApr({ estado, aoAbrir, aoVoltar, aoValidar }: RevisaoAprProps) {
  const reprovados = itensReprovados(estado);
  const semEvidencia = reprovados.filter((i) => faltaEvidencia(estado, i));
  const alertas = totalAlertas(estado);

  return (
    <>
      <div className="card stack g6">
        <h2 style={{ fontSize: 17, fontWeight: 600 }}>Revisão da APR</h2>
        <p className="muted">
          {totalRespondidas(estado)} de {totalPerguntas} perguntas respondidas. Depois de validada, a APR não pode ser
          alterada.
        </p>
      </div>
      {reprovados.length > 0 ? (
        <>
          <Notice tone="blq" icon="octagon">
            <strong>
              {reprovados.length} {reprovados.length > 1 ? "itens eliminatórios reprovados." : "item eliminatório reprovado."}
            </strong>{" "}
            Ao validar, a APR será bloqueada e a OS ficará pendente.
          </Notice>
          <div className="answered">
            {reprovados.map((i) => (
              <div key={i} className="ans-row">
                <span className="n">{i + 1}</span>
                <span className="t">
                  {perguntasApr03[i].texto}
                  <br />
                  <span className="small">
                    {faltaEvidencia(estado, i) ? "Falta a evidência" : `“${estado.observacoes[i]}”`}
                  </span>
                </span>
                <Button variant="line" sm style={{ height: 36, fontSize: 13 }} onClick={() => aoAbrir(i)}>
                  Abrir
                </Button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <Notice tone="ok" icon="check">
          <strong>Nenhum item eliminatório reprovado.</strong> Ao validar, a APR será aprovada e a execução liberada.
        </Notice>
      )}
      {alertas > 0 && (
        <Notice tone="al" icon="alert">
          <strong>
            {alertas} {alertas > 1 ? "alertas" : "alerta"}:
          </strong>{" "}
          fica registrado no PDF e no painel, mas não bloqueia.
        </Notice>
      )}
      <div className="nav2" style={{ maxWidth: 560 }}>
        <Button variant="line" onClick={aoVoltar}>
          Voltar
        </Button>
        <Button variant="p" disabled={semEvidencia.length > 0} onClick={aoValidar}>
          Concluir e validar
        </Button>
      </div>
      {semEvidencia.length > 0 && (
        <p className="small">
          Falta evidência em {semEvidencia.length} {semEvidencia.length > 1 ? "itens reprovados." : "item reprovado."}
        </p>
      )}
    </>
  );
}
