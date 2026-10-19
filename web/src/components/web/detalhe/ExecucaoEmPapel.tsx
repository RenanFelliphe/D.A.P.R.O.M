import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/web/Panel";
import type { AprEmPapel, ExecucaoEmPapel as Dados } from "@/data/detalhe";
import { dataHora, duracao } from "@/lib/formatar";
import { Medida } from "./ExecucoesDaOs";

const FONTE: Record<Dados["fonte"], string> = {
  ia: "Lido pela IA e conferido por uma pessoa",
  manual: "Digitado ou corrigido por uma pessoa na conferência",
  nenhuma: "Não preenchido: a folha não foi lida",
};

const RESPOSTA: Record<AprEmPapel["respostas"][number]["resposta"], string> = { sim: "Sim", nao: "Não", na: "N/A" };
const FUNCAO: Record<AprEmPapel["participantes"][number]["funcao"], string> = { responsavel: "Supervisor da Atividade", executor: "Executante" };
const FONTE_DA_APR: Record<AprEmPapel["fonte"], string> = {
  ia: "Lida pela IA e conferida",
  manual: "Digitada ou corrigida por uma pessoa",
  nenhuma: "Não preenchida",
};

/**
 * A APR em papel que veio junto com a folha da OS digitalizada, conferida na Digitalização. Não é uma APR do sistema: não vale como
 * APR do dia nem pontua. Mostra só a marca de cada item, como está no papel (o que é eliminatório só o admin sabe).
 */
function AprDoPapel({ apr }: { apr: AprEmPapel }) {
  return (
    <div className="stack g12" style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack" style={{ gap: 2 }}>
          <h3 style={{ fontSize: 16 }}>
            APR em papel · {apr.modelo.codigo} <span className="muted">(versão {apr.modelo.versao})</span>
          </h3>
          <span className="muted">
            {apr.modelo.titulo}
            {apr.data_hora && ` · feita em ${dataHora(apr.data_hora)}`} · {apr.folhas === 1 ? "1 folha" : `${apr.folhas} folhas`}
          </span>
        </div>
        <Badge tone="neu">{FONTE_DA_APR[apr.fonte]}</Badge>
      </div>
      {apr.servico && <Medida rotulo="Serviço" valor={apr.servico} />}
      {apr.participantes.length > 0 && (
        <div>
          <div className="small" style={{ color: "var(--ink4)" }}>
            Quem participou
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14.5 }}>
            {apr.participantes.map((p, i) => (
              <li key={i}>
                {p.nome}
                {p.matricula && <span className="mono"> · {p.matricula}</span>} · {FUNCAO[p.funcao]}
                {p.usuario_id === null && <span className="muted"> · sem conta no sistema</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {apr.respostas.length > 0 && (
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Respostas marcadas na folha ({apr.respostas.length})</summary>
          <ol style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
            {apr.respostas.map((r) => (
              <li key={r.ordem} className="row between g12" style={{ fontSize: 14, alignItems: "baseline" }}>
                <span>
                  <span className="mono small">{r.ordem}.</span> {r.risco && <span className="small">{r.risco}: </span>}
                  {r.texto}
                </span>
                <strong>{RESPOSTA[r.resposta]}</strong>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

/**
 * A execução das OS digitalizadas (OS antigas, executadas no papel): o que a folha diz, conferido na Digitalização. Não há APR
 * nem execução no sistema, então a OS não pontua e não entra nos indicadores de tempo; as assinaturas ficam só nas imagens do
 * PDF da OS.
 */
export function ExecucaoEmPapel({ papel }: { papel: Dados }) {
  const minutos = papel.inicio_real && papel.fim_real ? (new Date(papel.fim_real).getTime() - new Date(papel.inicio_real).getTime()) / 60_000 : null;
  return (
    <Panel>
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack" style={{ gap: 2 }}>
          <h2>Execução em papel</h2>
          <span className="muted">
            Digitalizada por {papel.registrada_por_nome} em {dataHora(papel.registrada_em)} · {papel.folhas === 1 ? "1 folha" : `${papel.folhas} folhas`}
          </span>
        </div>
        <Badge tone="neu">De histórico</Badge>
      </div>
      <div className="medidas">
        <Medida rotulo="Início real" valor={papel.inicio_real ? dataHora(papel.inicio_real) : "não informado"} />
        <Medida rotulo="Fim real" valor={papel.fim_real ? dataHora(papel.fim_real) : "não informado"} />
        <Medida rotulo="Tempo total" valor={duracao(minutos)} />
        <Medida rotulo="Pessoas" valor={papel.numero_pessoas ? String(papel.numero_pessoas) : "não informado"} />
      </div>
      {papel.texto_manuscrito && (
        <div>
          <div className="small" style={{ color: "var(--ink4)" }}>
            Descrição escrita à mão
          </div>
          <p style={{ fontSize: 14.5, whiteSpace: "pre-line" }}>{papel.texto_manuscrito}</p>
        </div>
      )}
      {papel.apr && <AprDoPapel apr={papel.apr} />}
      <Notice tone="info" icon="info">
        {FONTE[papel.fonte]}. Esta OS não tem {papel.apr ? "APR do sistema" : "APR"} nem execução no sistema: não pontua e não entra nos indicadores de tempo. As assinaturas estão nas imagens do PDF da OS.
      </Notice>
    </Panel>
  );
}
