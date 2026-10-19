import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { BotaoTreinar } from "@/components/web/treinamento-servico/jogo/BotaoTreinar";
import type { TreinamentoResumo } from "@/lib/treinamento-servico";

/**
 * Bloco "Treinamentos de serviço" da tela de espera (seção 3.4 do `vitoria.md`): quem aguarda liberação já pode treinar
 * e pontuar, como no Campo de treino, enquanto espera o admin liberar o acesso de verdade. O jogo abre numa janela.
 */
export function TreinamentosDeServicoAguardando({ treinamentos }: { treinamentos: TreinamentoResumo[] }) {
  if (treinamentos.length === 0) return null;
  const concluidos = treinamentos.filter((t) => t.concluido).length;
  return (
    <section className="ts-aguardando" aria-labelledby="titulo-treinamentos-aguardando">
      <div className="ts-secao-cab">
        <div>
          <h2 id="titulo-treinamentos-aguardando">Treinamentos de serviço</h2>
          <p className="muted">Enquanto espera, treine os serviços do catálogo com a Vitória: a explicação e um jogo curto, com pontos que já contam para você.</p>
        </div>
        <span className="ts-contagem">
          {concluidos} de {treinamentos.length} concluídos
        </span>
      </div>
      <ul className="ts-aguardando-grade">
        {treinamentos.map((t, i) => (
          <li key={t.atividade_codigo} className="panel ts-aguardando-cartao" style={{ "--i": i } as CSSProperties}>
            <span className="mono small">{t.atividade_codigo}</span>
            <strong>{t.descricao}</strong>
            <span className="row g6 wrap small">
              <Icon name="play" size={13} />
              {t.total_fases} {t.total_fases === 1 ? "fase" : "fases"}
              {t.concluido && <Badge tone="enc">Concluído</Badge>}
            </span>
            <BotaoTreinar codigo={t.atividade_codigo} jaConcluiu={t.concluido} variant={t.concluido ? "line" : "p"} sm block />
          </li>
        ))}
      </ul>
    </section>
  );
}
