import { ferramentasOs } from "@/data/detalhe-app";

/** Card com as instruções da OS e as ferramentas necessárias. */
export function InstrucoesCard() {
  return (
    <div className="card stack g8">
      <h2 style={{ fontSize: 15, fontWeight: 600 }}>Instruções</h2>
      <p style={{ fontSize: 14, color: "var(--ink2)" }}>
        Inspecionar visualmente as válvulas V-101 a V-112. Registrar com foto cada ponto de corrosão e aplicar inibidor
        onde a corrosão for superficial.
      </p>
      <div className="row wrap g6">
        {ferramentasOs.map((ferramenta) => (
          <span key={ferramenta} className="tag">
            {ferramenta}
          </span>
        ))}
      </div>
    </div>
  );
}
