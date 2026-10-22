import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Panel, TableWrap } from "@/components/web/Panel";
import { PaginacaoLista } from "@/components/web/PaginacaoLista";
import { dataHora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import { BotaoTratarPergunta } from "./BotaoTratarPergunta";

export interface PerguntaSemResposta {
  id: string;
  pergunta: string;
  tela: string;
  perfil: "tecnico" | "admin";
  criada_em: string;
  tratada_em: string | null;
  tratada_por: string | null;
}

interface ListaPerguntasSemRespostaProps {
  perguntas: PerguntaSemResposta[];
  /** `undefined` = todas; `false` = só pendentes; `true` = só tratadas. */
  tratada: boolean | undefined;
  pagina: number;
  tamanho: number;
  total: number;
}

/** Lista paginada das perguntas que a Vitória não soube responder (`docs/ia-e-vitoria.md`, seção 4.12), com o filtro tratada/pendente. */
export function ListaPerguntasSemResposta({ perguntas, tratada, pagina, tamanho, total }: ListaPerguntasSemRespostaProps) {
  return (
    <Panel>
      <div className="row between wrap">
        <h2>{`Perguntas · ${total}`}</h2>
        <nav className="row g8" aria-label="Filtro por situação">
          <LinkButton sm variant={tratada === undefined ? "p" : "line"} href={rotas.app.vitoriaSemResposta}>
            Todas
          </LinkButton>
          <LinkButton sm variant={tratada === false ? "p" : "line"} href={`${rotas.app.vitoriaSemResposta}?tratada=false`}>
            Pendentes
          </LinkButton>
          <LinkButton sm variant={tratada === true ? "p" : "line"} href={`${rotas.app.vitoriaSemResposta}?tratada=true`}>
            Tratadas
          </LinkButton>
        </nav>
      </div>
      <TableWrap>
        <table className="tb">
          <caption className="sr">Perguntas que a Vitória não soube responder</caption>
          <thead>
            <tr>
              <th style={{ width: 150 }}>Quando</th>
              <th style={{ width: 100 }}>Perfil</th>
              <th style={{ width: 170 }}>Tela</th>
              <th>Pergunta</th>
              <th style={{ width: 180 }}>Situação</th>
            </tr>
          </thead>
          <tbody>
            {perguntas.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  Nenhuma pergunta encontrada.
                </td>
              </tr>
            ) : (
              perguntas.map((p) => (
                <tr key={p.id}>
                  <td>{dataHora(p.criada_em)}</td>
                  <td>
                    <Badge tone="neu">{p.perfil === "admin" ? "Admin" : "Técnico"}</Badge>
                  </td>
                  <td>{p.tela}</td>
                  <td>{p.pergunta}</td>
                  <td>{p.tratada_em ? <Badge tone="enc">{`Tratada em ${dataHora(p.tratada_em)}`}</Badge> : <BotaoTratarPergunta id={p.id} />}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableWrap>
      <PaginacaoLista caminho={rotas.app.vitoriaSemResposta} consulta={{ tratada: tratada === undefined ? undefined : String(tratada) }} pagina={pagina} tamanho={tamanho} total={total} />
    </Panel>
  );
}
