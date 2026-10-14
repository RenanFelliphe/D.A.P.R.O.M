import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { AtualizacaoAutomatica } from "@/components/ui/AtualizacaoAutomatica";
import { Kpi, Panel } from "@/components/web/Panel";
import { CartaoPatente } from "@/components/web/gamificacao/CartaoPatente";
import { ExtratoPontos } from "@/components/web/gamificacao/ExtratoPontos";
import { SeloPatente } from "@/components/web/gamificacao/SeloPatente";
import { jogaNaGamificacao } from "@/components/web/gamificacao/secao";
import { lerExtrato, lerMinhaPontuacao, lerTemporadas } from "@/data/gamificacao";
import { usuarioAtual } from "@/lib/api";
import { data } from "@/lib/formatar";
import { numero, ordinal } from "@/lib/gamificacao";
import { rotas } from "@/lib/rotas";

export const metadata: Metadata = { title: "Minha pontuação" };

const um = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);
const TAMANHO_DO_EXTRATO = 15;
const ULTIMAS_CONQUISTAS = 6;

/**
 * Minha pontuação (técnico, supervisor incluso): a patente da temporada com a barra até a próxima, os pontos da temporada e
 * os gerais, a maior patente, a posição na temporada e no geral, as últimas conquistas e o extrato (com filtro por temporada).
 * O admin não joga: vai para o Ranking.
 */
export default async function MinhaPontuacaoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { usuario } = await usuarioAtual();
  if (!jogaNaGamificacao(usuario)) redirect(rotas.app.gamificacaoRanking);

  const pedida = um(params.temporada);
  const temporadaDoExtrato = pedida && (pedida === "geral" || /^\d{4}-T[1-4]$/.test(pedida)) ? pedida : undefined;
  const pagina = Math.max(1, Number.parseInt(um(params.pagina) ?? "1", 10) || 1);
  const [eu, temporadas, extrato] = await Promise.all([lerMinhaPontuacao(), lerTemporadas(), lerExtrato(temporadaDoExtrato, pagina, TAMANHO_DO_EXTRATO)]);

  const ultimas = eu.conquistas
    .filter((c) => c.obtida_em)
    .sort((a, b) => new Date(b.obtida_em!).getTime() - new Date(a.obtida_em!).getTime())
    .slice(0, ULTIMAS_CONQUISTAS);

  return (
    <div className="stack g16">
      <div className="gam-topo">
        <CartaoPatente temporada={eu.temporada} pontosDaTemporada={eu.pontos_temporada} patente={eu.patente} barra={eu.barra} proxima={eu.proxima_patente} />
        <div className="gam-kpis">
          <Kpi label="Pontos na temporada" value={numero(eu.pontos_temporada)} sub={eu.temporada.nome} />
          <Kpi label="Pontos gerais" value={numero(eu.pontos_gerais)} sub="desde a criação da conta" />
          <Kpi
            label="Maior patente"
            value={eu.maior_patente ? <SeloPatente patente={eu.maior_patente} tamanho="m" /> : "—"}
            sub="a mais alta já alcançada"
          />
          <Kpi
            label="Posição"
            value={eu.posicao_temporada ? ordinal(eu.posicao_temporada) : "—"}
            sub={eu.posicao_temporada ? `de ${eu.participantes_temporada} na temporada · ${eu.posicao_geral ? `${ordinal(eu.posicao_geral)} no geral` : "sem posição no geral"}` : "fora do ranking"}
          />
        </div>
      </div>

      <Panel style={{ gap: 12 }}>
        <div className="row between wrap">
          <h2>Últimas conquistas</h2>
          <Link href={rotas.app.gamificacaoConquistas} className="small">
            Ver todas as conquistas
          </Link>
        </div>
        {ultimas.length === 0 ? (
          <span className="muted">Nenhuma conquista ainda. A primeira vem com a primeira APR completa.</span>
        ) : (
          <div className="gam-ultimas">
            {ultimas.map((c) => (
              <div key={c.id} className="gam-ultima">
                {c.imagem_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imagem_url} alt="" loading="lazy" />
                ) : (
                  <Icon name="trophy" size={24} />
                )}
                <strong>{c.titulo}</strong>
                <small>{data(c.obtida_em)}</small>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <ExtratoPontos extrato={extrato} temporadas={temporadas} caminho={rotas.app.gamificacaoMinha} />
      <AtualizacaoAutomatica />
    </div>
  );
}
