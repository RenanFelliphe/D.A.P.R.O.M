import { Icon } from "@/components/ui/Icon";
import type { ItemDoModelo, RiscoDoModelo } from "@/lib/apr";

interface RiscosAprProps {
  riscos: RiscoDoModelo[];
  itens: ItemDoModelo[];
  marcados: string[];
  aoAlternar: (id: string) => void;
}

/** Riscos do modelo agrupados por classificação: marque os que existem na atividade; só as medidas deles entram no checklist. */
export function RiscosApr({ riscos, itens, marcados, aoAlternar }: RiscosAprProps) {
  const grupos: { classificacao: string; riscos: RiscoDoModelo[] }[] = [];
  for (const risco of [...riscos].sort((a, b) => a.ordem - b.ordem)) {
    const grupo = grupos.find((g) => g.classificacao === risco.classificacao);
    if (grupo) grupo.riscos.push(risco);
    else grupos.push({ classificacao: risco.classificacao, riscos: [risco] });
  }
  const medidas = (riscoId: string) => itens.filter((i) => i.risco_id === riscoId).length;

  return (
    <div className="stack g8">
      <h2 style={{ fontSize: 16, fontWeight: 600 }}>Riscos da atividade</h2>
      <div className="row g8 small">
        <Icon name="alert" size={16} />
        Marque os riscos que existem nesta atividade. Só as medidas preventivas deles entram no checklist.
      </div>
      {grupos.length === 0 && <p className="muted">Este modelo não tem riscos: o checklist só tem os itens de verificação.</p>}
      {grupos.map((grupo) => (
        <div key={grupo.classificacao} className="stack g6">
          <span className="lbl">{grupo.classificacao}</span>
          <div className="list-box">
            {grupo.riscos.map((risco) => (
              <label key={risco.id} className="list-row" style={{ minHeight: 48 }}>
                <input type="checkbox" checked={marcados.includes(risco.id)} onChange={() => aoAlternar(risco.id)} />
                <span className="grow" style={{ fontSize: 14 }}>
                  {risco.nome}
                </span>
                <span className="small">{medidas(risco.id)} medida(s)</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
