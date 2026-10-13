"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { dataDoDia } from "@/lib/formatar";
import { aparenciaDaSituacao, contagemRegressiva, rotuloDaBase, rotuloDoPlano, type DetalheDoPlano, type PlanoPreventiva } from "@/lib/preventivas";
import { rotas } from "@/lib/rotas";
import { rotuloDoStatus } from "@/lib/tipos";
import { EditorDoCiclo } from "./EditorDoCiclo";
import { HistoricoDoPlano } from "./HistoricoDoPlano";

interface LinhaPreventivaProps {
  plano: PlanoPreventiva;
  /** O plano foi salvo: a lista troca a linha pela versão nova. */
  aoAtualizar: (plano: PlanoPreventiva) => void;
  /** Abre já no editor (o plano sem intervalo, na importação). */
  editando?: boolean;
}

/**
 * Um plano de preventiva na lista: a contagem regressiva até o próximo ciclo, a barra do ciclo, o intervalo e a última OS.
 * "Histórico" abre os ciclos e as próximas datas; quem pode editar define o intervalo ali mesmo.
 */
export function LinhaPreventiva({ plano, aoAtualizar, editando = false }: LinhaPreventivaProps) {
  const [aberto, setAberto] = useState<"historico" | "editor" | null>(editando ? "editor" : null);
  const aparencia = aparenciaDaSituacao[plano.situacao];
  const progresso = plano.progresso === null ? null : Math.min(1, plano.progresso);
  const ultima = plano.ultima_os;

  function salvo(detalhe: DetalheDoPlano) {
    aoAtualizar(detalhe.plano);
    setAberto("historico");
  }

  return (
    <li className="prev-item" data-situacao={plano.situacao}>
      <div className="prev-cab">
        <div className="stack g4" style={{ minWidth: 0 }}>
          <div className="row wrap g6" style={{ alignItems: "center" }}>
            <Badge tone={aparencia.tom}>{aparencia.rotulo}</Badge>
            <span className="small mono">{rotuloDoPlano(plano)}</span>
          </div>
          <strong className="prev-titulo">{plano.titulo ?? `Plano ${plano.plano_manutencao}`}</strong>
          <span className="small">
            {[plano.equipe?.nome, plano.local?.codigo, plano.equipamento].filter(Boolean).join(" · ") || "Sem OS ativa"}
          </span>
        </div>
        <div className="prev-contagem" style={{ color: aparencia.cor }}>
          <strong>{contagemRegressiva(plano)}</strong>
          {plano.proximo_ciclo && <span className="small">próximo ciclo em {dataDoDia(plano.proximo_ciclo)}</span>}
        </div>
      </div>

      {progresso !== null && (
        <div
          className="prev-barra"
          role="progressbar"
          aria-label="Quanto do ciclo já passou"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progresso * 100)}
        >
          <i style={{ width: `${Math.round(progresso * 100)}%`, background: aparencia.cor }} />
        </div>
      )}

      <div className="prev-rodape">
        <span className="small">
          {plano.intervalo_descricao ? (
            <>
              <strong style={{ color: "var(--ink2)" }}>{plano.intervalo_descricao[0]!.toUpperCase() + plano.intervalo_descricao.slice(1)}</strong>, contada {rotuloDaBase[plano.base_do_ciclo]}
            </>
          ) : (
            "Sem intervalo entre ciclos"
          )}
          {ultima && (
            <>
              {" · "}Última OS{" "}
              <Link href={rotas.app.os(ultima.id)} className="mono">
                {ultima.numero_ordem ?? "de apoio"}
              </Link>{" "}
              ({rotuloDoStatus[ultima.status].toLowerCase()}
              {ultima.encerrada_em ? `, encerrada em ${dataDoDia(ultima.encerrada_em)}` : `, programada para ${dataDoDia(ultima.data_inicio_prog)}`})
            </>
          )}
          {plano.os_abertas > 1 && ` · ${plano.os_abertas} OS do plano em aberto`}
        </span>
        <div className="row g6">
          <Button variant="ghost" sm onClick={() => setAberto(aberto === "historico" ? null : "historico")} aria-expanded={aberto === "historico"}>
            <Icon name="list" size={16} />
            Histórico
          </Button>
          {plano.pode_editar && (
            <Button variant={plano.intervalo ? "line" : "p"} sm onClick={() => setAberto(aberto === "editor" ? null : "editor")} aria-expanded={aberto === "editor"}>
              <Icon name="clock" size={16} />
              {plano.intervalo ? "Editar ciclo" : "Definir intervalo"}
            </Button>
          )}
        </div>
      </div>

      {plano.observacao && <span className="small prev-obs">{plano.observacao}</span>}

      {aberto === "editor" && <EditorDoCiclo plano={plano} aoSalvar={salvo} aoCancelar={() => setAberto(null)} />}
      {aberto === "historico" && <HistoricoDoPlano planoId={plano.id} versao={plano.atualizado_em} />}
    </li>
  );
}
