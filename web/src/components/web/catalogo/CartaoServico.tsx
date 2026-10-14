"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { ServicoDoCatalogo } from "@/lib/catalogo";
import { EditorDoServico } from "./EditorDoServico";
import { ListaDoServico } from "./ListaDoServico";

/** Um serviço do catálogo: o código e a descrição da atividade e a lista do que o serviço leva para o campo. O admin edita a lista aqui mesmo. */
export function CartaoServico({ servico, podeEditar }: { servico: ServicoDoCatalogo; podeEditar: boolean }) {
  const [editando, setEditando] = useState(false);
  const total = servico.materiais.length;

  return (
    <section className="panel" aria-label={`Serviço ${servico.codigo}`} style={{ gap: 10 }}>
      <div className="row between" style={{ alignItems: "flex-start", gap: 12 }}>
        <div className="stack g4" style={{ minWidth: 0 }}>
          <span className="mono small" style={{ color: "var(--ink3)", overflowWrap: "anywhere" }}>
            {servico.codigo}
            {servico.provisorio && (
              <>
                {" "}
                <Badge tone="al" style={{ padding: "0 7px", fontSize: 11 }}>
                  Provisório
                </Badge>
              </>
            )}
          </span>
          <h2 style={{ fontSize: 15.5, fontWeight: 600, overflowWrap: "anywhere" }}>{servico.descricao}</h2>
          <span className="small" style={{ color: "var(--ink4)" }}>
            {total === 0 ? "Nenhum item" : total === 1 ? "1 item" : `${total} itens`}
          </span>
        </div>
        {podeEditar && !editando && (
          <Button variant="line" sm style={{ height: 32, flex: "none" }} onClick={() => setEditando(true)}>
            <Icon name="list" size={13} />
            Editar lista
          </Button>
        )}
      </div>
      {editando ? (
        <EditorDoServico servico={servico} aoFechar={() => setEditando(false)} />
      ) : total === 0 ? (
        <p className="muted" style={{ fontSize: 13.5 }}>
          O catálogo ainda não lista materiais para este serviço.
        </p>
      ) : (
        <ListaDoServico materiais={servico.materiais} />
      )}
    </section>
  );
}
