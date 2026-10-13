"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { chamar, ErroCliente } from "@/lib/cliente-api";
import { dataDoDia } from "@/lib/formatar";
import type { DetalheDoPlano } from "@/lib/preventivas";
import { rotas } from "@/lib/rotas";
import { rotuloDoStatus } from "@/lib/tipos";

const dias = (n: number) => (n === 1 ? "1 dia" : `${n} dias`);

/**
 * Histórico de um plano: o cumprimento (ciclos no prazo e com atraso, intervalo real contra o definido), as próximas datas
 * projetadas e cada ciclo (OS) com a data programada, o encerramento e o vencimento que o ciclo anterior marcou.
 * `versao` muda quando o plano é salvo, para recarregar.
 */
export function HistoricoDoPlano({ planoId, versao }: { planoId: string; versao: string }) {
  const [detalhe, setDetalhe] = useState<DetalheDoPlano | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    chamar<DetalheDoPlano>("GET", `/preventivas/${planoId}`)
      .then((d) => vivo && (setDetalhe(d), setErro(null)))
      .catch((e) => vivo && setErro(e instanceof ErroCliente ? e.message : "Não foi possível carregar o histórico."));
    return () => {
      vivo = false;
    };
  }, [planoId, versao]);

  if (erro) return <span className="entrada-retorno erro">{erro}</span>;
  if (!detalhe) return <span className="small">Carregando o histórico…</span>;

  const { estatisticas: e, proximas_datas: proximas, ciclos } = detalhe;
  const real = e.intervalo_real_medio_dias;
  const definido = e.intervalo_definido_dias;

  return (
    <div className="prev-historico">
      <dl className="prev-numeros">
        <div>
          <dt>Ciclos executados</dt>
          <dd>{e.ciclos_encerrados}</dd>
        </div>
        <div>
          <dt>No prazo</dt>
          <dd>
            {e.no_prazo}
            {e.ciclos_encerrados > 0 && <span className="small"> · {Math.round((e.no_prazo / e.ciclos_encerrados) * 100)}%</span>}
          </dd>
        </div>
        <div>
          <dt>Com atraso</dt>
          <dd>{e.com_atraso}</dd>
        </div>
        <div>
          <dt>Intervalo real médio</dt>
          <dd>
            {real === null ? "—" : dias(real)}
            {real !== null && definido !== null && <span className="small"> · definido {dias(definido)}</span>}
          </dd>
        </div>
      </dl>

      {proximas.length > 0 && (
        <div className="stack g6">
          <span className="prev-subtitulo">Próximos ciclos previstos</span>
          <div className="row wrap g6">
            {proximas.map((d) => (
              <span key={d} className="tag mono">
                {dataDoDia(d)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="stack g6">
        <span className="prev-subtitulo">Ciclos (OS do plano)</span>
        {ciclos.length === 0 ? (
          <span className="small">Nenhuma OS ativa do plano.</span>
        ) : (
          <div className="prev-tabela">
            <table className="prev-ciclos">
              <thead>
                <tr>
                  <th scope="col">OS</th>
                  <th scope="col">Programada</th>
                  <th scope="col">Previsto pelo ciclo</th>
                  <th scope="col">Encerrada</th>
                  <th scope="col">Situação</th>
                </tr>
              </thead>
              <tbody>
                {ciclos.map((c) => (
                  <tr key={c.os_id}>
                    <td>
                      <Link href={rotas.app.os(c.os_id)} className="mono">
                        {c.numero_ordem ?? "—"}
                      </Link>
                    </td>
                    <td>{dataDoDia(c.data_inicio_prog)}</td>
                    <td>{c.previsto ? dataDoDia(c.previsto) : "—"}</td>
                    <td>{c.encerrada_em ? dataDoDia(c.encerrada_em) : "—"}</td>
                    <td>
                      {c.no_prazo === true ? (
                        <Badge tone="enc">No prazo</Badge>
                      ) : c.atraso_dias ? (
                        <Badge tone={c.encerrada_em ? "al" : "blq"}>
                          {c.encerrada_em ? `${dias(c.atraso_dias)} de atraso` : `Atrasada ${dias(c.atraso_dias)}`}
                        </Badge>
                      ) : (
                        <Badge tone="neu">{rotuloDoStatus[c.status]}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
