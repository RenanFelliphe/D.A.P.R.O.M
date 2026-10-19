import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { dataHora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import type { VersaoAnterior } from "@/lib/treinamento-servico";

const ESTADOS = {
  rascunho: { tom: "al", texto: "Rascunho em edição" },
  publicada: { tom: "enc", texto: "No ar" },
  substituida: { tom: "neu", texto: "Substituída" },
} as const;

/** As versões do treinamento, da mais nova para a mais antiga, com quem assinou cada publicação (seção 3.7 do `vitoria.md`). */
export function ListaDeVersoes({ codigo, versoes }: { codigo: string; versoes: VersaoAnterior[] }) {
  if (versoes.length === 0) {
    return (
      <div className="ts-vazio ts-vazio-grande">
        <Icon name="layers" size={24} />
        <strong>Nenhuma versão ainda</strong>
        <span className="small">A primeira versão nasce quando você começa o conteúdo.</span>
      </div>
    );
  }

  return (
    <section className="ts-secao-lista" aria-labelledby="titulo-versoes">
      <div className="ts-secao-cab">
        <div>
          <h2 id="titulo-versoes">Versões</h2>
          <p className="muted">A versão publicada nunca muda: editar cria a seguinte, que precisa de nova assinatura.</p>
        </div>
      </div>
      <ol className="ts-linha-do-tempo">
        {versoes.map((v, i) => {
          const estado = ESTADOS[v.estado];
          return (
            <li key={v.versao_id} data-estado={v.estado} style={{ "--i": i } as CSSProperties}>
              <span className="ts-linha-marca" aria-hidden="true" />
              <div className="ts-linha-cartao">
                <div className="ts-item-cab">
                  <strong className="ts-item-titulo">Versão {v.versao}</strong>
                  <Badge tone={estado.tom}>{estado.texto}</Badge>
                </div>
                <span className="small">
                  {v.total_passos} {v.total_passos === 1 ? "passo" : "passos"} · {v.total_fases} {v.total_fases === 1 ? "fase" : "fases"}
                </span>
                {v.estado === "rascunho" ? (
                  <LinkButton variant="ghost" sm href={rotas.app.treinamentoServico(codigo)}>
                    Continuar a edição
                    <Icon name="right" size={13} />
                  </LinkButton>
                ) : (
                  <span className="ts-versao-assinatura">
                    <Icon name="shield" size={13} />
                    Assinada e publicada por {v.publicada_por_nome ?? "—"} em {dataHora(v.publicada_em)}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
