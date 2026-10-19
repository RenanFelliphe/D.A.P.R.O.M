import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/web/Panel";
import type { ExecucaoEmPapel as Dados } from "@/data/detalhe";
import { dataHora, duracao } from "@/lib/formatar";
import { Medida } from "./ExecucoesDaOs";

const FONTE: Record<Dados["fonte"], string> = {
  ia: "Lido pela IA e conferido por uma pessoa",
  manual: "Digitado ou corrigido por uma pessoa na conferência",
  nenhuma: "Não preenchido: a folha não foi lida",
};

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
      <Notice tone="info" icon="info">
        {FONTE[papel.fonte]}. Esta OS não tem APR nem execução no sistema: não pontua e não entra nos indicadores de tempo. As assinaturas estão nas imagens do PDF da OS.
      </Notice>
    </Panel>
  );
}
