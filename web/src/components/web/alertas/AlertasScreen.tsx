"use client";

import { Screen } from "@/components/ui/Screen";
import { DetalheAlerta } from "@/components/web/alertas/DetalheAlerta";
import { ListaAlertas } from "@/components/web/alertas/ListaAlertas";
import { textoNaoLidos } from "@/data/alertas";
import { useAlertas } from "@/state/alertas";

/** Alertas do painel: lista à esquerda e, à direita, o detalhe do alerta aberto. */
export function AlertasScreen() {
  const { alertas, selecionado, selecionar } = useAlertas();

  return (
    <Screen>
      <div className="row between wrap" style={{ alignItems: "flex-end" }}>
        <div className="stack" style={{ gap: 2 }}>
          <h1>Alertas</h1>
          <span className="muted" style={{ fontSize: 14 }}>
            Serviços Especiais · <span id="al-count">{textoNaoLidos(alertas)}</span> · avisos também enviados por
            e-mail
          </span>
        </div>
      </div>
      <div className="two" style={{ gridTemplateColumns: "340px 1fr" }}>
        <ListaAlertas alertas={alertas} selecionado={selecionado} aoSelecionar={selecionar} />
        <DetalheAlerta key={alertas[selecionado].os} alerta={alertas[selecionado]} />
      </div>
    </Screen>
  );
}
