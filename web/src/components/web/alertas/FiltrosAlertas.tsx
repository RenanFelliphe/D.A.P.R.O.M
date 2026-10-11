"use client";

import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/Field";
import { rotas } from "@/lib/rotas";
import type { Equipe } from "@/lib/tipos";
import { TIPOS_DE_ALERTA, rotuloDoTipo } from "./tipos";

export interface ValoresDosFiltros {
  /** "nao" mostra só os não lidos; vazio, todos. */
  lido: string;
  tipo: string;
  equipe_id: string;
}

/** Filtros da lista: não lidos ou todos, tipo e equipe. Cada mudança refaz a consulta no servidor pela URL. */
export function FiltrosAlertas({ valores, equipes }: { valores: ValoresDosFiltros; equipes: Equipe[] | null }) {
  const roteador = useRouter();

  function mudar(campo: keyof ValoresDosFiltros, valor: string) {
    const proximos = { ...valores, [campo]: valor };
    const consulta = new URLSearchParams();
    for (const [k, v] of Object.entries(proximos)) if (v) consulta.set(k, v);
    const texto = consulta.toString();
    roteador.push(texto ? `${rotas.web.alertas}?${texto}` : rotas.web.alertas);
  }

  return (
    <div className="filters">
      <Field label="Mostrar" htmlFor="fa-lido">
        <select className="select" id="fa-lido" value={valores.lido} onChange={(e) => mudar("lido", e.target.value)}>
          <option value="">Todos</option>
          <option value="nao">Não lidos</option>
        </select>
      </Field>
      <Field label="Tipo" htmlFor="fa-tipo">
        <select className="select" id="fa-tipo" value={valores.tipo} onChange={(e) => mudar("tipo", e.target.value)}>
          <option value="">Todos os tipos</option>
          {TIPOS_DE_ALERTA.map((t) => (
            <option key={t} value={t}>
              {rotuloDoTipo[t]}
            </option>
          ))}
        </select>
      </Field>
      {equipes && (
        <Field label="Equipe" htmlFor="fa-equipe">
          <select className="select" id="fa-equipe" value={valores.equipe_id} onChange={(e) => mudar("equipe_id", e.target.value)}>
            <option value="">Todas as equipes</option>
            {equipes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </Field>
      )}
    </div>
  );
}
