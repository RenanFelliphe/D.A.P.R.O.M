import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { ExcluirModelo } from "@/components/web/apr/ExcluirModelo";
import { RestaurarModelo } from "@/components/web/apr/RestaurarModelo";
import { editaModelos, veTodasAsEquipes } from "@/components/web/apr/secao";
import { UsoDoModelo } from "@/components/web/apr/UsoDoModelo";
import { EditorModelo } from "@/components/web/modelos/EditorModelo";
import { VersoesModelo } from "@/components/web/modelos/VersoesModelo";
import { VisaoModelo } from "@/components/web/modelos/VisaoModelo";
import { agruparModelos, type DetalheModelo, type ModeloCompleto, type ResumoModelo, type UsoDoModelo as Uso } from "@/data/modelos";
import { api, apiOuNulo, usuarioAtual } from "@/lib/api";
import { data } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";

export const metadata: Metadata = { title: "Modelo de APR" };

/** O código vem codificado na URL (`APR%2003`); decodifica uma vez, sem quebrar se o Next já tiver decodificado. */
function decodificar(valor: string) {
  try {
    return decodeURIComponent(valor);
  } catch {
    return valor;
  }
}

/**
 * Um modelo de APR: as versões, o editor do rascunho (admin) ou a versão em leitura, onde o
 * modelo é usado, e as ações de excluir e restaurar. `?versao=` escolhe a versão; sem ela, abre o rascunho ou a em uso.
 */
export default async function ModeloPage({ params, searchParams }: PageProps<"/web/apr/modelos/[codigo]">) {
  const codigo = decodificar((await params).codigo);
  const pedida = (await searchParams).versao;
  const versaoPedida = Array.isArray(pedida) ? pedida[0] : pedida;
  const caminho = `/modelos-apr/${encodeURIComponent(codigo)}`;

  const [{ usuario }, detalhe] = await Promise.all([usuarioAtual(), apiOuNulo<DetalheModelo>(caminho)]);
  if (!detalhe) notFound();
  const podeEditar = editaModelos(usuario);
  const excluido = Boolean(detalhe.arquivado_em);
  const rascunho = detalhe.versoes.find((v) => v.rascunho);
  const emUso = detalhe.versoes.find((v) => !v.rascunho);
  const escolhida = detalhe.versoes.find((v) => String(v.versao) === versaoPedida) ?? rascunho ?? emUso ?? detalhe.versoes[0]!;

  const [modelo, uso, publicados] = await Promise.all([
    apiOuNulo<ModeloCompleto>(`${caminho}/versoes/${escolhida.versao}`),
    veTodasAsEquipes(usuario) ? apiOuNulo<Uso>(`${caminho}/uso`) : Promise.resolve(null),
    podeEditar && !excluido ? api<{ modelos: ResumoModelo[] }>("/modelos-apr", { consulta: { publicados: true, tamanho: 200 } }) : Promise.resolve(null),
  ]);
  const substitutos = agruparModelos(publicados?.modelos ?? [])
    .filter((g) => g.codigo !== codigo)
    .map((g) => ({ codigo: g.codigo, titulo: g.titulo }));
  const aprs = detalhe.versoes.reduce((soma, v) => soma + v.aprs_total, 0);
  const atividades = emUso?.atividades_total ?? rascunho?.atividades_total ?? 0;

  return (
    <Screen>
      <div className="crumb">
        <Link href={rotas.web.modelos} style={{ fontWeight: 500 }}>
          APR
        </Link>{" "}
        / <span className="mono">{codigo}</span>
      </div>
      <div className="row between wrap" style={{ alignItems: "flex-end" }}>
        <div className="stack g6">
          <div className="row wrap g8">
            <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
              {codigo}
            </span>
            {excluido ? (
              <Badge tone="neu">Excluído</Badge>
            ) : emUso ? (
              <Badge tone="enc">{`v${emUso.versao} em uso`}</Badge>
            ) : (
              <Badge tone="neu">Não publicado</Badge>
            )}
            {rascunho && <Badge tone="al">{`Rascunho v${rascunho.versao}`}</Badge>}
          </div>
          <h1>{detalhe.titulo}</h1>
          <span className="muted" style={{ fontSize: 14 }}>
            {excluido
              ? `Excluído em ${data(detalhe.arquivado_em)} · ${aprs} ${aprs === 1 ? "APR respondida" : "APRs respondidas"}`
              : `${atividades} ${atividades === 1 ? "atividade ligada" : "atividades ligadas"} · ${aprs} ${aprs === 1 ? "APR respondida" : "APRs respondidas"}`}
          </span>
        </div>
        {podeEditar &&
          (excluido ? (
            <RestaurarModelo codigo={codigo} />
          ) : (
            <ExcluirModelo
              codigo={codigo}
              publicado={Boolean(emUso)}
              rascunho={rascunho?.versao}
              aprs={aprs}
              atividades={uso ? uso.atividades.length : atividades}
              osAbertas={uso?.os_abertas.total ?? null}
              substitutos={substitutos}
            />
          ))}
      </div>

      {excluido && (
        <Notice tone="al" icon="lock">
          Este modelo foi excluído: não aparece para o técnico nem recebe atividades. As versões ficam guardadas porque APRs e PDFs apontam para elas.
          {podeEditar ? " Restaure para voltar a usá-lo." : ""}
        </Notice>
      )}

      <div className="two lateral-270">
        <div className="stack g16">
          <VersoesModelo codigo={codigo} versoes={detalhe.versoes} atual={escolhida.versao} />
          {uso && <UsoDoModelo uso={uso} />}
        </div>
        <div className="stack g16">
          {podeEditar && !excluido && (
            <Notice tone="al" icon="info">
              O critério de bloqueio da carga inicial (quais itens são eliminatórios e qual resposta bloqueia) é provisório até a Segurança do Trabalho validar.
              Ajuste criando uma nova versão e publicando.
            </Notice>
          )}
          {!modelo ? (
            <Notice tone="blq" icon="alert">
              Versão não encontrada.
            </Notice>
          ) : podeEditar && modelo.rascunho ? (
            <EditorModelo key={modelo.id} modelo={modelo} temPublicada={Boolean(emUso)} />
          ) : (
            <VisaoModelo modelo={modelo} podeEditar={podeEditar} rascunho={rascunho?.versao} emUso={emUso?.versao === modelo.versao} />
          )}
        </div>
      </div>
    </Screen>
  );
}
