import type { Metadata } from "next";
import Link from "next/link";
import { AtualizacaoAutomatica } from "@/components/ui/AtualizacaoAutomatica";
import { Notice } from "@/components/ui/Notice";
import { SeletorTemporada } from "@/components/web/gamificacao/SeletorTemporada";
import { TabelaDeEquipes, TabelaDePessoas } from "@/components/web/gamificacao/TabelaRanking";
import { jogaNaGamificacao } from "@/components/web/gamificacao/secao";
import { lerRankingDeEquipes, lerRankingDePessoas, lerTemporadas } from "@/data/gamificacao";
import { usuarioAtual } from "@/lib/api";
import { dataDoDia } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";

export const metadata: Metadata = { title: "Ranking" };

const um = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);

/**
 * Ranking de pessoas ou de equipes, na temporada de hoje, numa temporada fechada (como ficou no fechamento) ou no geral
 * (`?tipo=` e `?temporada=`). Todos os perfis veem; quem está anônimo aparece como "Participante anônimo" (a própria pessoa e o
 * admin veem o nome), e a própria linha vem em destaque. O ranking mostra só os pontos e a patente, nunca os indicadores.
 */
export default async function RankingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { usuario } = await usuarioAtual();
  const tipo = um(params.tipo) === "equipes" ? "equipes" : "pessoas";
  const pedida = um(params.temporada);
  const temporada = pedida && (pedida === "geral" || /^\d{4}-T[1-4]$/.test(pedida)) ? pedida : undefined;

  const temporadas = await lerTemporadas();
  const ranking = tipo === "equipes" ? await lerRankingDeEquipes(temporada) : await lerRankingDePessoas(temporada);
  const geral = ranking.escopo === "geral";
  const t = ranking.temporada;

  const aba = (qual: "pessoas" | "equipes") => {
    const consulta = new URLSearchParams();
    if (qual === "equipes") consulta.set("tipo", "equipes");
    if (temporada) consulta.set("temporada", temporada);
    const texto = consulta.toString();
    return texto ? `${rotas.app.gamificacaoRanking}?${texto}` : rotas.app.gamificacaoRanking;
  };

  return (
    <div className="stack g16">
      <div className="rank-controles">
        <div className="stack g6">
          <nav className="rank-alternar" aria-label="Tipo de ranking">
            <Link href={aba("pessoas")} aria-current={tipo === "pessoas" ? "true" : undefined}>
              Pessoas
            </Link>
            <Link href={aba("equipes")} aria-current={tipo === "equipes" ? "true" : undefined}>
              Equipes
            </Link>
          </nav>
          <span className="muted small">
            {geral
              ? "Ranking geral: todos os pontos desde a criação das contas."
              : t
                ? `${t.nome} (${dataDoDia(t.inicio)} a ${dataDoDia(t.fim)})${t.fechada ? " · temporada fechada: o resultado como ficou no fechamento" : t.atual ? " · temporada atual" : " · aguardando o fechamento"}`
                : ""}
          </span>
        </div>
        <SeletorTemporada caminho={rotas.app.gamificacaoRanking} temporadas={temporadas} valor={ranking.escopo} preservar={{ tipo: tipo === "equipes" ? "equipes" : undefined }} />
      </div>

      {!jogaNaGamificacao(usuario) && (
        <Notice tone="info" icon="info">
          O administrador não joga: não pontua e não aparece no ranking. Você vê os nomes de quem escolheu ficar anônimo.
        </Notice>
      )}

      {ranking.tipo === "equipes" ? <TabelaDeEquipes linhas={ranking.linhas} geral={geral} /> : <TabelaDePessoas linhas={ranking.linhas} geral={geral} />}

      <span className="muted small" style={{ maxWidth: 820 }}>
        {tipo === "equipes"
          ? "As equipes são ordenadas pela média por membro (a soma dividida pelas pessoas da equipe), para a equipe maior não ganhar só por ser maior. Equipe sem ninguém fica fora."
          : "No empate, fica na frente quem chegou primeiro àquela pontuação. Entram os técnicos ativos e liberados, supervisores inclusos."}
      </span>
      <AtualizacaoAutomatica />
    </div>
  );
}
