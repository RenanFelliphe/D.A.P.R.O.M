import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui/Notice";
import { CartaoDeSugestao } from "@/components/web/sugestao/CartaoDeSugestao";
import { PaginacaoLista } from "@/components/web/PaginacaoLista";
import { usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import { emTreino } from "@/lib/treino-modo";
import { sugestoesDe, totalParaAvaliar } from "@/lib/sugestao-materiais-servidor";
import { ehAdmin, ehSupervisor } from "@/lib/tipos";

export const metadata: Metadata = { title: "Sugestões de materiais" };

const um = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);
const TAMANHO = 20;

/**
 * Aba Sugestões: as sugestões de lista e as contestações. "Minhas" (de quem não é admin) mostra o que a pessoa enviou e o
 * andamento; "Para avaliar" (supervisor e admin) é a fila das que esperam a resposta dela, com o número no selo.
 */
export default async function SugestoesDeMateriaisPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  if (await emTreino()) {
    return (
      <Notice tone="info" icon="info">
        As sugestões de materiais ficam fora do Campo de treino: o treino não grava nada no sistema de verdade.
      </Notice>
    );
  }
  const { usuario } = await usuarioAtual();
  const admin = ehAdmin(usuario);
  const avalia = admin || ehSupervisor(usuario);
  const paraAvaliar = avalia ? await totalParaAvaliar() : 0;
  // Quem avalia abre na fila quando há o que avaliar; o admin não envia, então só tem a fila.
  const pedida = um(params.aba);
  const aba: "minhas" | "avaliar" = admin ? "avaliar" : avalia && (pedida === "avaliar" || (pedida !== "minhas" && paraAvaliar > 0)) ? "avaliar" : "minhas";
  const pagina = Math.max(1, Number.parseInt(um(params.pagina) ?? "1", 10) || 1);
  const lista = await sugestoesDe({ escopo: aba, pagina, tamanho: TAMANHO });
  const caminho = (a: string) => `${rotas.app.sugestoesDeMateriais}?aba=${a}`;

  return (
    <div className="stack g16">
      <span className="muted" style={{ fontSize: 14, maxWidth: 820 }}>
        {admin
          ? "As sugestões e contestações da lista de materiais dos serviços. Quem avalia é o supervisor da equipe que mais faz o serviço; você também pode avaliar qualquer uma."
          : "Quem faz o serviço sabe o que ele pede. Sugira uma lista nova ou conteste a recomendada, no cartão do serviço ou no detalhe da OS. O supervisor da equipe que mais faz o serviço avalia, e você ganha pontos quando é aceita."}
      </span>
      {!admin && (
        <div className="row g8 wrap">
          <Link className="btn btn-line btn-sm" href={rotas.app.catalogo}>
            Escolher um serviço para sugerir
          </Link>
        </div>
      )}
      {avalia && !admin && (
        <nav className="sg-filtro" aria-label="Quais sugestões">
          <Link href={caminho("minhas")} aria-current={aba === "minhas" ? "page" : undefined}>
            Minhas
          </Link>
          <Link href={caminho("avaliar")} aria-current={aba === "avaliar" ? "page" : undefined}>
            Para avaliar
            {paraAvaliar > 0 && <span className="sg-selo">{paraAvaliar}</span>}
          </Link>
        </nav>
      )}
      {lista.sugestoes.length === 0 ? (
        <p className="muted">
          {aba === "avaliar" ? "Nenhuma sugestão espera a sua avaliação." : "Você ainda não enviou nenhuma sugestão. Abra um serviço no catálogo e escolha \"Sugerir lista\" ou \"Contestar lista\"."}
        </p>
      ) : (
        <div className="sg-cartoes">
          {lista.sugestoes.map((s) => (
            <CartaoDeSugestao key={s.id} sugestao={s} mostrarAutor={aba === "avaliar"} />
          ))}
        </div>
      )}
      <PaginacaoLista caminho={rotas.app.sugestoesDeMateriais} consulta={{ aba: avalia && !admin ? aba : undefined }} pagina={lista.pagina} tamanho={lista.tamanho} total={lista.total} />
    </div>
  );
}
