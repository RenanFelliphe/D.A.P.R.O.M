"use client";

import { useEffect, useState } from "react";

/** As etapas que a Vitória "conta" enquanto a IA não manda o primeiro pedaço da resposta; trocam a cada poucos segundos. */
const ETAPAS = ["Lendo sua pergunta", "Procurando no manual", "Juntando as informações", "Montando a resposta"];
const INTERVALO_MS = 2200;
/** Depois disso, avisa que está demorando: a pessoa sabe que não travou. */
const DEMORANDO_MS = 10_000;
const MUITO_DEMORADO_MS = 25_000;

function textoDaEspera(decorrido: number): string {
  if (decorrido >= MUITO_DEMORADO_MS) return "Ainda trabalhando nisso, obrigado pela paciência";
  if (decorrido >= DEMORANDO_MS) return "Está levando um pouco mais que o normal, já estou quase lá";
  return ETAPAS[Math.min(Math.floor(decorrido / INTERVALO_MS), ETAPAS.length - 1)]!;
}

/**
 * O balão de "pensando" da Vitória: três pontinhos saltando e uma frase que vai mudando com brilho passando por cima,
 * para a espera da IA nunca parecer travada. Some quando chega o primeiro texto (aí entra o cursor piscando).
 */
export function IndicadorPensando() {
  const [decorrido, setDecorrido] = useState(0);

  useEffect(() => {
    const inicio = Date.now();
    const id = window.setInterval(() => setDecorrido(Date.now() - inicio), 500);
    return () => window.clearInterval(id);
  }, []);

  const texto = textoDaEspera(decorrido);

  return (
    <div className="vt-pensando" role="status" aria-live="polite">
      <span className="vt-pontos" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span key={texto} className="vt-etapa">
        {texto}
        <span className="vt-reticencias" aria-hidden="true">
          <i>.</i>
          <i>.</i>
          <i>.</i>
        </span>
      </span>
    </div>
  );
}
