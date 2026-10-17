import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { rotas } from "@/lib/rotas";
import type { TreinamentoResumo } from "@/lib/treinamento-servico";

/**
 * Bloco "Treinamentos de serviço" da tela de espera (seção 3.4 do `vitoria.md`): quem aguarda liberação já pode treinar
 * e pontuar, como no Campo de treino, enquanto espera o admin liberar o acesso de verdade.
 */
export function TreinamentosDeServicoAguardando({ treinamentos }: { treinamentos: TreinamentoResumo[] }) {
  if (treinamentos.length === 0) return null;
  return (
    <div className="stack g10" style={{ marginTop: 8 }}>
      <h2 style={{ fontSize: 15 }}>Treinamentos de serviço</h2>
      <p className="muted" style={{ fontSize: 13.5 }}>
        Enquanto espera, treine os serviços do catálogo: a explicação e um jogo curto, com pontos para quando seu acesso for liberado.
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {treinamentos.map((t) => (
          <li key={t.atividade_codigo} className="row between" style={{ alignItems: "center", border: "1px solid var(--linha)", borderRadius: 8, padding: "8px 10px" }}>
            <span className="stack g2">
              <strong style={{ fontSize: 13.5 }}>{t.descricao}</strong>
              <span className="small muted">
                {t.total_fases} {t.total_fases === 1 ? "fase" : "fases"}
                {t.concluido && (
                  <>
                    {" · "}
                    <Badge tone="enc">Concluído</Badge>
                  </>
                )}
              </span>
            </span>
            <Link className="btn btn-line btn-sm" href={rotas.app.treinarServico(t.atividade_codigo)}>
              <Icon name="play" size={13} />
              {t.concluido ? "Jogar de novo" : "Treinar"}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
