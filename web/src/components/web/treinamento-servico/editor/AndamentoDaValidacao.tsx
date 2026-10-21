import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { dataHora } from "@/lib/formatar";
import { textoDoAndamento, type ValidacaoDoTreinamento } from "@/lib/treinamento-validacao";

/**
 * Onde está a validação pelos supervisores: quantas assinaturas já há e quantas faltam e, por equipe escolhida, quem decidiu
 * (aprovou ou recusou, com o motivo) e quem ainda não. É só leitura; as ações ficam nas telas que a usam.
 */
export function AndamentoDaValidacao({ validacao }: { validacao: Pick<ValidacaoDoTreinamento, "aprovacoes" | "necessarias" | "validadores" | "rodada" | "autor" | "enviada_em"> }) {
  const { aprovacoes, necessarias, validadores } = validacao;
  const percentual = necessarias > 0 ? Math.min(100, Math.round((aprovacoes / necessarias) * 100)) : 0;

  return (
    <div className="ts-validacao">
      <div className="row between wrap g8">
        <strong>{textoDoAndamento(validacao)}</strong>
        <span className="small muted">
          Rodada {validacao.rodada}
          {validacao.autor ? ` · enviado por ${validacao.autor.nome}` : ""}
          {validacao.enviada_em ? ` em ${dataHora(validacao.enviada_em)}` : ""}
        </span>
      </div>
      <div className="progress ts-validacao-barra" role="meter" aria-label="Assinaturas para publicar" aria-valuemin={0} aria-valuemax={necessarias} aria-valuenow={aprovacoes}>
        <i style={{ width: `${percentual}%` }} />
      </div>
      <ul className="ts-validadores">
        {validadores.map((v, i) => (
          <li key={v.equipe_id} data-decisao={v.decisao ?? "aguardando"} style={{ "--i": i } as CSSProperties}>
            <span className="ts-validador-marca" aria-hidden="true">
              <Icon name={v.decisao === "aprovou" ? "check" : v.decisao === "recusou" ? "x" : "clock"} size={13} />
            </span>
            <span className="stack g4">
              <span className="row g8 wrap">
                <strong>{v.equipe_nome}</strong>
                {v.decisao === "aprovou" && <Badge tone="enc">Aprovou</Badge>}
                {v.decisao === "recusou" && <Badge tone="blq">Recusou</Badge>}
                {!v.decisao && <Badge tone="neu">Aguardando</Badge>}
              </span>
              <span className="small">
                {v.decisao
                  ? `${v.decidida_por_nome ?? "—"}${v.decidida_em ? ` · ${dataHora(v.decidida_em)}` : ""}`
                  : v.supervisor_nome
                    ? `Supervisão: ${v.supervisor_nome}`
                    : "Quem responde pela equipe decide"}
              </span>
              {v.motivo && <span className="small ts-validador-motivo">“{v.motivo}”</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
