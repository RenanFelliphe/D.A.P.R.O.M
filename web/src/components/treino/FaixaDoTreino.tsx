"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { rotas } from "@/lib/rotas";
import { useToast } from "@/state/toast";
import { estadoDoTreino } from "./estado";

/** Endereço que reinicia os dados fictícios (API fictícia, `src/treino/`). */
const REINICIAR = "/api/treino/reiniciar";

/** Faixa fina fixa no alto do campo de treino: avisa que os dados são fictícios e oferece "Recomeçar treino" e "Sair do treino". */
export function FaixaDoTreino() {
  const roteador = useRouter();
  const avisar = useToast();
  const [reiniciando, setReiniciando] = useState(false);

  async function recomecar() {
    if (!window.confirm("Recomeçar o treino? Os dados fictícios voltam ao início e o tutorial recomeça do primeiro passo.")) return;
    setReiniciando(true);
    try {
      const resposta = await fetch(REINICIAR, { method: "POST", cache: "no-store" });
      if (!resposta.ok) throw new Error();
      estadoDoTreino.definirPasso(0);
      roteador.push(rotas.app.lista);
      roteador.refresh();
      avisar("Treino recomeçado: tudo voltou ao início.");
    } catch {
      avisar("Não foi possível recomeçar agora. Tente de novo.");
    } finally {
      setReiniciando(false);
    }
  }

  return (
    <div className="tr-faixa" role="region" aria-label="Campo de treino">
      <span className="tr-faixa-texto">
        <Icon name="info" size={16} />
        <strong>Campo de treino</strong>
        <span className="tr-faixa-sep" aria-hidden="true">
          ·
        </span>
        <span className="tr-longo">dados fictícios</span>
        <span className="tr-curto">fictício</span>
      </span>
      <span className="tr-faixa-acoes">
        <button type="button" onClick={recomecar} disabled={reiniciando} aria-busy={reiniciando}>
          <Icon name="refresh" size={13} className={reiniciando ? "tr-gira" : undefined} />
          <span className="tr-longo">{reiniciando ? "Recomeçando…" : "Recomeçar treino"}</span>
          <span className="tr-curto">{reiniciando ? "…" : "Recomeçar"}</span>
        </button>
        {/* Navegação completa: a rota apaga o cookie do treino. O tutorial local é limpo antes de sair. */}
        <a href={rotas.app.treinoSair} onClick={() => estadoDoTreino.limpar()}>
          <Icon name="x" size={13} />
          <span className="tr-longo">Sair do treino</span>
          <span className="tr-curto">Sair</span>
        </a>
      </span>
    </div>
  );
}
