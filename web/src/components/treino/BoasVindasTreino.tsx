"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { rotas } from "@/lib/rotas";
import { EscolhaDeModalidade } from "./EscolhaDeModalidade";
import { adiarBoasVindas, gravarTreinamento } from "./estado";
import { useDialogo } from "./useDialogo";

interface BoasVindasTreinoProps {
  /** `primeiro-acesso`: no sistema real, técnico com treinamento não iniciado. `treino`: já no campo de treino, falta escolher a modalidade. */
  contexto: "primeiro-acesso" | "treino";
  /** Fecha o diálogo sem escolher (no primeiro acesso é o mesmo que "Fazer depois"). */
  aoFechar: () => void;
}

/** Boas-vindas ao Campo de treino: texto curto, escolha entre Direcionado e Livre e, no primeiro acesso, "Fazer depois" e "Pular treinamento". */
export function BoasVindasTreino({ contexto, aoFechar }: BoasVindasTreinoProps) {
  const idTitulo = useId();
  const idTexto = useId();
  const [erro, setErro] = useState<string | null>(null);
  const [pulando, setPulando] = useState(false);
  const primeiroAcesso = contexto === "primeiro-acesso";

  function fazerDepois() {
    adiarBoasVindas();
    aoFechar();
  }

  async function pular() {
    setErro(null);
    setPulando(true);
    try {
      await gravarTreinamento("pulado");
      aoFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar agora.");
      setPulando(false);
    }
  }

  const raiz = useDialogo<HTMLDivElement>(primeiroAcesso ? fazerDepois : aoFechar);

  return (
    <div className="tr-fundo">
      <div ref={raiz} className="tr-dialogo" role="dialog" aria-modal="true" aria-labelledby={idTitulo} aria-describedby={idTexto} tabIndex={-1}>
        <div className="tr-dialogo-topo">
          <span className="tr-selo tr-selo-grande">
            <Icon name="shield" size={16} />
            Campo de treino
          </span>
        </div>
        <h2 id={idTitulo}>Bem-vindo ao Campo de Treino!</h2>
        <p id={idTexto} className="tr-dialogo-texto">
          Aqui tudo é de mentira: ordens, equipes e APRs são fictícias, e nada do que você fizer afeta o trabalho real. Pode clicar, errar e refazer à vontade.
        </p>
        <h3>Como você prefere aprender?</h3>
        <EscolhaDeModalidade />
        {erro && (
          <p className="tr-erro" role="alert">
            {erro}
          </p>
        )}
        <div className="tr-dialogo-rodape">
          {primeiroAcesso ? (
            <>
              <button type="button" className="tr-link" onClick={fazerDepois} disabled={pulando}>
                Fazer depois
              </button>
              <button type="button" className="tr-link" onClick={pular} disabled={pulando} aria-busy={pulando}>
                {pulando ? "Salvando…" : "Pular treinamento"}
              </button>
            </>
          ) : (
            <>
              <a className="tr-link" href={rotas.app.treinoSair}>
                Voltar ao sistema real
              </a>
              <button type="button" className="tr-link" onClick={aoFechar}>
                Explorar sem roteiro
              </button>
            </>
          )}
        </div>
        {primeiroAcesso && <p className="tr-dica">“Fazer depois” volta a aparecer no próximo acesso. Você pode abrir o Campo de treino a qualquer hora pelo menu.</p>}
      </div>
    </div>
  );
}
