import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { apiOuNulo } from "@/lib/api";
import { cx } from "@/lib/cx";
import { dataDoDia } from "@/lib/formatar";
import { aparenciaDaSituacao, contagemRegressiva, rotuloDaBase, rotuloDoPlano, type PlanoDaOs } from "@/lib/preventivas";
import { rotas } from "@/lib/rotas";

interface CicloDaOsProps {
  osId: string;
  /** Só a OS preventiva tem plano; as demais nem consultam. */
  preventiva: boolean;
  /** Quem planeja (admin e supervisor) ganha o atalho para as OS preventivas do quadro. */
  gestao: boolean;
  /** `panel` no painel de gestão, `card` na tela do técnico. */
  estilo: "panel" | "card";
}

/**
 * O ciclo da preventiva no detalhe da OS: o intervalo do plano, a contagem até o próximo ciclo e, se esta não é a última OS
 * do plano, qual é. Some quando a OS não é preventiva de plano (ou no Campo de treino, que não tem planos).
 */
export async function CicloDaOs({ osId, preventiva, gestao, estilo }: CicloDaOsProps) {
  if (!preventiva) return null;
  const plano = await apiOuNulo<PlanoDaOs>(`/os/${osId}/preventiva`);
  if (!plano) return null;
  const aparencia = aparenciaDaSituacao[plano.situacao];
  const ultima = plano.ultima_os;

  return (
    <div className={cx(estilo, "ciclo-os")}>
      <div className="row between wrap g8" style={{ alignItems: "center" }}>
        <h2 style={estilo === "card" ? { fontSize: 15, fontWeight: 600 } : undefined}>Ciclo da preventiva</h2>
        <Badge tone={aparencia.tom}>{aparencia.rotulo}</Badge>
      </div>
      <dl className="dl d2">
        <div>
          <dt>Plano</dt>
          <dd className="mono">{rotuloDoPlano(plano)}</dd>
        </div>
        <div>
          <dt>Intervalo entre ciclos</dt>
          <dd>{plano.intervalo_descricao ? `${plano.intervalo_descricao}, contado ${rotuloDaBase[plano.base_do_ciclo]}` : "Não definido"}</dd>
        </div>
        <div>
          <dt>Próximo ciclo</dt>
          <dd style={{ color: aparencia.cor, fontWeight: 600 }}>
            {contagemRegressiva(plano)}
            {plano.proximo_ciclo ? ` · ${dataDoDia(plano.proximo_ciclo)}` : ""}
          </dd>
        </div>
        <div>
          <dt>Ciclos registrados</dt>
          <dd>{plano.total_ciclos}</dd>
        </div>
      </dl>
      {!plano.eh_ultima_do_plano && ultima && (
        <span className="small">
          Esta OS é de um ciclo anterior. A última do plano é a{" "}
          <Link href={rotas.app.os(ultima.id)} className="mono">
            {ultima.numero_ordem ?? "OS"}
          </Link>
          , programada para {dataDoDia(ultima.data_inicio_prog)}.
        </span>
      )}
      {gestao && (
        <Link href={rotas.app.preventivas} className="row g6" style={{ fontSize: 14, fontWeight: 600, alignItems: "center" }}>
          <Icon name="clock" size={16} />
          {plano.pode_editar && !plano.intervalo ? "Definir o intervalo nas OS preventivas" : "Ver o histórico nas OS preventivas"}
        </Link>
      )}
    </div>
  );
}
