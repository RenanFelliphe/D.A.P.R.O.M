import { Fragment } from "react";
import { Panel, TableWrap } from "@/components/web/Panel";
import { EditarRegra } from "@/components/web/gamificacao/EditarRegra";
import type { ComoPontuar, RegraDePontuacao } from "@/lib/gamificacao";

interface TabelaRegrasProps {
  regras: ComoPontuar["regras"];
  /** O admin muda o valor e liga ou desliga cada tarefa ali mesmo. */
  podeEditar: boolean;
}

/** As tarefas que pontuam, por grupo: o valor, quem ganha, quando conta e o limite de cada uma. */
export function TabelaRegras({ regras, podeEditar }: TabelaRegrasProps) {
  const grupos: { nome: string; itens: RegraDePontuacao[] }[] = [];
  for (const r of regras) {
    const grupo = grupos.find((g) => g.nome === r.grupo);
    if (grupo) grupo.itens.push(r);
    else grupos.push({ nome: r.grupo, itens: [r] });
  }
  return (
    <Panel style={{ gap: 12 }}>
      <TableWrap>
        <table className="tb">
          <caption className="sr">Tarefas que pontuam</caption>
          <thead>
            <tr>
              <th>Tarefa</th>
              <th style={{ width: podeEditar ? 220 : 110 }}>Pontos</th>
              <th>Quem ganha</th>
              <th>Quando conta</th>
              <th style={{ width: 150 }}>Limite</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <Fragment key={g.nome}>
                <tr className="regra-grupo">
                  <th colSpan={5}>{g.nome}</th>
                </tr>
                {g.itens.map((r) => (
                  <tr key={r.codigo} className={r.ativa ? undefined : "off"}>
                    <td className="regra-texto">
                      <strong>{r.nome}</strong>
                      <br />
                      <span className="muted">{r.descricao}</span>
                    </td>
                    <td className="regra-pontos">
                      <EditarRegra regra={r} podeEditar={podeEditar} />
                    </td>
                    <td className="regra-texto">{r.quem}</td>
                    <td className="regra-texto">{r.quando}</td>
                    <td className="regra-texto">{r.limite}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </Panel>
  );
}
