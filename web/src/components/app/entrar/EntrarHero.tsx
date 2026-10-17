const destaques = ["Web e Android", "Online primeiro", "Zero papel"];

/** Painel escuro de boas-vindas, ao lado do formulário de entrada. */
export function EntrarHero() {
  return (
    <section className="login-hero">
      <div className="stack g8">
        <h1>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca/synq.png" alt="SYNQ OS" width={782} height={170} />
        </h1>
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
