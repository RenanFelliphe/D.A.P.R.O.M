import Link from "next/link";
import { Screen } from "@/components/ui/Screen";
import { Notice } from "@/components/ui/Notice";
import { DetalheAlerta } from "@/components/web/alertas/DetalheAlerta";
import { FiltrosAlertas, type ValoresDosFiltros } from "@/components/web/alertas/FiltrosAlertas";
import { ListaAlertas } from "@/components/web/alertas/ListaAlertas";
import { Panel } from "@/components/web/Panel";
import { rotas } from "@/lib/rotas";
import { ehAdmin, ehSupervisor as supervisa, nomesDasEquipesDoSupervisor, type Equipe, type Usuario } from "@/lib/tipos";
import type { Alerta } from "./tipos";

interface AlertasScreenProps {
  usuario: Usuario;
  alertas: Alerta[];
  /** Alerta aberto; `null` se a lista está vazia ou o pedido não existe. */
  selecionado: Alerta | null;
  /** O `?alerta=` pedido na URL não foi achado. */
  alertaNaoEncontrado: boolean;
  /** O alerta aberto foi escolhido pela pessoa (`?alerta=` na URL), e não o primeiro da lista aberto por padrão. */
  alertaPedido: boolean;
  filtros: ValoresDosFiltros;
  pagina: number;
  tamanho: number;
  /** Total da consulta (com o filtro de tipo aplicado, o total da página única). */
  total: number;
  naoLidos: number;
  equipes: Equipe[];
}

function endereco(filtros: ValoresDosFiltros, extra: { alerta?: string; pagina?: number }) {
  const consulta = new URLSearchParams();
  for (const [k, v] of Object.entries(filtros)) if (v) consulta.set(k, v);
  if (extra.alerta) consulta.set("alerta", extra.alerta);
  if (extra.pagina && extra.pagina > 1) consulta.set("pagina", String(extra.pagina));
  const texto = consulta.toString();
  return texto ? `${rotas.web.alertas}?${texto}` : rotas.web.alertas;
}

/** Alertas do painel: lista à esquerda e, à direita, o detalhe do alerta aberto. */
export function AlertasScreen({ usuario, alertas, selecionado, alertaNaoEncontrado, alertaPedido, filtros, pagina, tamanho, total, naoLidos, equipes }: AlertasScreenProps) {
  const ehSupervisor = supervisa(usuario);
  const nomeDaEquipe = ehSupervisor ? nomesDasEquipesDoSupervisor(usuario) : undefined;
  const leitura = ehAdmin(usuario);
  const ultimaPagina = Math.max(1, Math.ceil(total / tamanho));
  const hrefDoAlerta = (id: string) => endereco(filtros, { alerta: id, pagina });
  // Sem `?alerta=` a tela abre o primeiro da lista. Com o filtro de não lidos, marcá-lo o tiraria da lista e o próximo seria
  // aberto e marcado em seguida, até esvaziar: nesse caso só vale o alerta que a pessoa escolheu.
  const marcarAoAbrir = alertaPedido || filtros.lido !== "nao";

  return (
    <Screen>
      <div className="row between wrap" style={{ alignItems: "flex-end" }}>
        <div className="stack" style={{ gap: 2 }}>
          <h1>Alertas</h1>
          <span className="muted" style={{ fontSize: 14 }}>
            {nomeDaEquipe ? `${nomeDaEquipe} · ` : ""}
            <span id="al-count">
              {naoLidos} {naoLidos === 1 ? "não lido" : "não lidos"}
            </span>{" "}
            · avisos também enviados por e-mail
            {leitura ? " · você vê os alertas de todos os destinatários; abrir o de outra pessoa não o marca como lido" : ""}
          </span>
        </div>
        <FiltrosAlertas valores={filtros} equipes={ehSupervisor ? null : equipes} />
      </div>

      {alertaNaoEncontrado && (
        <Notice tone="al" icon="alert" style={{ fontSize: 14 }}>
          O alerta pedido não foi encontrado.
        </Notice>
      )}

      {alertas.length === 0 ? (
        <Panel style={{ padding: "32px 22px", alignItems: "center", textAlign: "center" }}>
          <strong style={{ fontSize: 16 }}>{filtros.lido === "nao" ? "Nenhum alerta não lido" : "Nenhum alerta por aqui"}</strong>
          <span className="muted">
            {filtros.lido || filtros.tipo || filtros.equipe_id
              ? "Nenhum alerta combina com os filtros escolhidos."
              : "Quando uma APR for bloqueada, uma execução for interrompida ou uma importação de OS falhar, o aviso aparece aqui."}
          </span>
        </Panel>
      ) : (
        <div className="two lateral-340">
          <div className="stack g8">
            <ListaAlertas alertas={alertas} selecionadoId={selecionado?.id ?? null} hrefDoAlerta={hrefDoAlerta} />
            {ultimaPagina > 1 && (
              <div className="row between small">
                {pagina > 1 ? <Link href={endereco(filtros, { pagina: pagina - 1 })}>Anteriores</Link> : <span />}
                <span>
                  Página {pagina} de {ultimaPagina}
                </span>
                {pagina < ultimaPagina ? <Link href={endereco(filtros, { pagina: pagina + 1 })}>Próximos</Link> : <span />}
              </div>
            )}
          </div>
          {selecionado && <DetalheAlerta key={selecionado.id} alerta={selecionado} usuario={usuario} equipes={equipes} marcarAoAbrir={marcarAoAbrir} />}
        </div>
      )}
    </Screen>
  );
}
