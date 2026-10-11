import { Panel, TableWrap } from "@/components/web/Panel";
import type { IndicadoresDeTempo, MedidaDeTempo } from "@/data/indicadores";
import { duracao } from "@/lib/formatar";

/** `0.1234` → `12%`; sem medida, "—". */
const porcentagem = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

function Linhas({ itens }: { itens: (MedidaDeTempo & { chave: string; nome: string })[] }) {
  return (
    <>
      {itens.map((i) => (
        <tr key={i.chave}>
          <th scope="row" style={{ fontWeight: 500 }}>
            {i.nome}
          </th>
          <td className="r">{i.execucoes}</td>
          <td className="r" style={{ fontWeight: 600 }}>
            {duracao(i.tempo_liquido_medio_min)}
          </td>
          <td className="r">{duracao(i.pausa_media_min)}</td>
          <td className="r">{porcentagem(i.proporcao_pausa)}</td>
        </tr>
      ))}
    </>
  );
}

function Tabela({ titulo, primeira, itens }: { titulo: string; primeira: string; itens: (MedidaDeTempo & { chave: string; nome: string })[] }) {
  return (
    <TableWrap>
      <table className="tb">
        <caption className="sr">{titulo}</caption>
        <thead>
          <tr>
            <th>{primeira}</th>
            <th className="r">Encerradas</th>
            <th className="r">Tempo líquido médio</th>
            <th className="r">Pausa média</th>
            <th className="r">Pausa no total</th>
          </tr>
        </thead>
        <tbody>
          <Linhas itens={itens} />
        </tbody>
      </table>
    </TableWrap>
  );
}

/** Tempo médio de execução por equipe e por técnico (líquido, sem as pausas), das execuções encerradas no mês. */
export function TempoExecucao({ tempo, rotuloDoMes }: { tempo: IndicadoresDeTempo; rotuloDoMes: string }) {
  return (
    <Panel style={{ padding: 20 }}>
      <div className="stack" style={{ gap: 2 }}>
        <h2>Tempo de execução</h2>
        <span className="muted">
          Média por execução encerrada em {rotuloDoMes}. O tempo líquido não conta as pausas; “pausa no total” é a pausa sobre o tempo total.
        </span>
      </div>
      {tempo.execucoes === 0 ? (
        <p className="muted">Nenhuma execução encerrada neste mês e nesta seleção.</p>
      ) : (
        <>
          <Tabela titulo="Tempo médio de execução por equipe" primeira="Equipe" itens={tempo.por_equipe.map((e) => ({ ...e, chave: e.equipe_id, nome: e.equipe_nome }))} />
          <Tabela titulo="Tempo médio de execução por técnico" primeira="Técnico" itens={tempo.por_usuario.map((u) => ({ ...u, chave: u.usuario_id, nome: u.usuario_nome }))} />
        </>
      )}
    </Panel>
  );
}
