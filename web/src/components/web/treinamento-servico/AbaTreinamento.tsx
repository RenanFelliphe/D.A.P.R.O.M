import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { TreinamentoResumo } from "@/lib/treinamento-servico";
import { rotas } from "@/lib/rotas";

interface AbaTreinamentoProps {
  codigo: string;
  /** Edita o catálogo (admin): vê o link do editor, mesmo sem versão publicada. */
  podeEditar: boolean;
  /** A versão publicada deste serviço, com a situação de quem pede (`GET /treinamentos`); `null` se não há nenhuma. */
  treinamento: TreinamentoResumo | null;
}

/** Aba "Treinamento" do cartão do serviço: "Treinar" para quem treina, a situação para o admin. */
export function AbaTreinamento({ codigo, podeEditar, treinamento }: AbaTreinamentoProps) {
  if (podeEditar) {
    return (
      <div className="row between wrap" style={{ gap: 10, alignItems: "center" }}>
        <span className="small" style={{ color: "var(--ink4)" }}>
          {treinamento ? (
            <>
              Publicado (v{treinamento.versao}), {treinamento.total_fases} {treinamento.total_fases === 1 ? "fase" : "fases"}.
            </>
          ) : (
            "Ainda não publicado."
          )}
        </span>
        <LinkButton href={rotas.app.treinamentoServico(codigo)} variant="line" sm>
          <Icon name="list" size={13} />
          {treinamento ? "Editar treinamento" : "Criar treinamento"}
        </LinkButton>
      </div>
    );
  }

  if (!treinamento) {
    return (
      <p className="muted" style={{ fontSize: 13.5 }}>
        Nenhum treinamento disponível ainda para este serviço.
      </p>
    );
  }

  return (
    <div className="row between wrap" style={{ gap: 10, alignItems: "center" }}>
      <div className="row g8" style={{ alignItems: "center" }}>
        {treinamento.concluido ? (
          <Badge tone="enc">
            Concluído · {treinamento.fases_certas}/{treinamento.total_fases} certas
          </Badge>
        ) : (
          <span className="small" style={{ color: "var(--ink4)" }}>
            {treinamento.total_fases} {treinamento.total_fases === 1 ? "fase" : "fases"}
          </span>
        )}
      </div>
      <Link className="btn btn-p btn-sm" href={rotas.app.treinarServico(codigo)}>
        <Icon name="play" size={13} />
        {treinamento.concluido ? "Jogar de novo" : "Treinar"}
      </Link>
    </div>
  );
}
