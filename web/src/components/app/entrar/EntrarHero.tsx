import { Icon } from "@/components/ui/Icon";

const destaques = ["Web e Android", "Online primeiro", "Zero papel"];

/** Painel escuro de boas-vindas, ao lado do formulário de entrada. */
export function EntrarHero() {
  return (
    <section className="login-hero">
      <span className="logo">
        <Icon name="shield" size={24} style={{ fontSize: 30 }} />
      </span>
      <div className="stack g8">
        <h1>D.A.P.R.O.M</h1>
        <p className="tagline">APR e Ordens de Manutenção 100% digitais</p>
      </div>
      <div className="row wrap g8">
        {destaques.map((texto) => (
          <span key={texto} className="badge">
            {texto}
          </span>
        ))}
      </div>
    </section>
  );
}
