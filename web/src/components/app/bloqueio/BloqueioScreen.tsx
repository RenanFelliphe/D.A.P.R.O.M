"use client";

import { useEffect, useState } from "react";
import { CabecalhoPagina, Colunas, PainelAcoes } from "@/components/app/AppChrome";
import { FormInterrupcao } from "@/components/app/bloqueio/FormInterrupcao";
import { ItemReprovadoCard } from "@/components/app/bloqueio/ItemReprovadoCard";
import { NotasBloqueio } from "@/components/app/bloqueio/NotasBloqueio";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { bloqueios, type Bloqueio } from "@/data/bloqueio";
import { rotas } from "@/lib/telas";
import { useChecklist } from "@/state/checklist";

/**
 * Tela de impedimento: bloqueio por item eliminatório da APR ou interrupção por risco.
 * Mostra o bloqueio deixado pela tela anterior (uma só vez); sem ele, o exemplo da OS 4030877.
 */
export function BloqueioScreen() {
  const { bloqueioPendente, consumirBloqueio } = useChecklist();
  const [bloqueio] = useState<Bloqueio>(() => bloqueioPendente ?? bloqueios.apr);

  useEffect(() => {
    consumirBloqueio();
  }, [consumirBloqueio]);

  return (
    <Screen>
      <CabecalhoPagina trilha={[{ rotulo: "OS da equipe", href: rotas.app.lista }, { rotulo: "Impedimento" }]}>
        <h1>{bloqueio.cabecalho}</h1>
        <span className="muted mono">{bloqueio.subtitulo}</span>
      </CabecalhoPagina>
      <div className="res-banner rb-blq">
        <span className="ic">
          <Icon name="octagon" size={24} />
        </span>
        <div className="stack g4">
          <h2>{bloqueio.titulo}</h2>
          <p>{bloqueio.descricao}</p>
        </div>
      </div>
      <Colunas
        principal={
          <>
            {bloqueio.itens.length > 0 && (
              <div className="stack g8">
                {bloqueio.itens.map((item) => (
                  <ItemReprovadoCard key={item.label} item={item} />
                ))}
              </div>
            )}
            {bloqueio.variante === "interrupcao" && <FormInterrupcao />}
          </>
        }
        lateral={
          <PainelAcoes>
            <NotasBloqueio />
            <LinkButton
              variant="d"
              block
              href={rotas.app.lista}
              aviso="Impedimento registrado. Entra na fila e sobe na próxima sincronização."
            >
              Registrar impedimento
            </LinkButton>
          </PainelAcoes>
        }
      />
    </Screen>
  );
}
