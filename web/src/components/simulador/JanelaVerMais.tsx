"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { JanelaModal } from "@/components/web/JanelaModal";

export interface SecaoVerMais {
  titulo?: string;
  itens: { rotulo: string; valor: ReactNode }[];
}

/** Janela "Ver mais" dos simuladores: todos os campos do registro, em seções de rótulo e valor. */
export function JanelaVerMais({ titulo, secoes, aoFechar }: { titulo: string; secoes: SecaoVerMais[]; aoFechar: () => void }) {
  return (
    <JanelaModal titulo={titulo} aoFechar={aoFechar} className="dlg-larga">
      {secoes.map((s, i) => (
        <section key={s.titulo ?? i} className="stack g8">
          {s.titulo && <h3 className="sim-secao-t">{s.titulo}</h3>}
          <dl className="sim-dl">
            {s.itens.map((item) => (
              <div key={item.rotulo}>
                <dt>{item.rotulo}</dt>
                <dd>{item.valor === null || item.valor === undefined || item.valor === "" ? "—" : item.valor}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <Button variant="p" sm onClick={aoFechar}>
          Fechar
        </Button>
      </div>
    </JanelaModal>
  );
}
