import type { Metadata } from "next";
import { Panel, TableWrap } from "@/components/web/Panel";
import { TabelaRegras } from "@/components/web/gamificacao/TabelaRegras";
import { editaGamificacao } from "@/components/web/gamificacao/secao";
import { lerRegras } from "@/data/gamificacao";
import { usuarioAtual } from "@/lib/api";

export const metadata: Metadata = { title: "Como pontuar" };

/**
 * Como pontuar: as tarefas que pontuam, com o valor e as regras de cada uma, em linguagem simples, as regras do jogo e o que
 * não pontua. O admin muda o valor e liga ou desliga cada tarefa ali mesmo (vale dali em diante).
 */
export default async function ComoPontuarPage() {
  const [{ usuario }, { regras, regras_do_jogo, nao_pontuam }] = await Promise.all([usuarioAtual(), lerRegras()]);
  const podeEditar = editaGamificacao(usuario);

  return (
    <div className="stack g16">
      <span className="muted" style={{ fontSize: 14, maxWidth: 820 }}>
        Para cada pessoa que trabalhou numa OS, a APR e a execução valem pontos, mais os bônus de cada situação. Quantas tentativas a OS levou não muda o total: a segurança nunca custa pontos.
        {podeEditar ? " Você muda o valor e liga ou desliga cada tarefa aqui mesmo; a mudança vale dali em diante e o extrato antigo não muda." : ""}
      </span>

      <section className="stack g8">
        <h2>Tarefas que pontuam</h2>
        <TabelaRegras regras={regras} podeEditar={podeEditar} />
      </section>

      <Panel>
        <h2>As regras do jogo</h2>
        <ul className="regras-jogo">
          {regras_do_jogo.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </Panel>

      <section className="stack g8">
        <h2>O que não pontua</h2>
        <Panel style={{ gap: 12 }}>
          <TableWrap>
            <table className="tb">
              <caption className="sr">O que não pontua</caption>
              <thead>
                <tr>
                  <th>O quê</th>
                  <th>Por quê</th>
                </tr>
              </thead>
              <tbody>
                {nao_pontuam.map((n) => (
                  <tr key={n.o_que}>
                    <td className="regra-texto">
                      <strong>{n.o_que}</strong>
                    </td>
                    <td className="regra-texto">{n.por_que}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Panel>
      </section>
    </div>
  );
}
