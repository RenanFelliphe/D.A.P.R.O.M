"use client";

import { useState } from "react";
import { FiltrosOs } from "@/components/app/lista/FiltrosOs";
import { GrupoOs } from "@/components/app/lista/GrupoOs";
import { Notice } from "@/components/ui/Notice";
import { gruposOs, type FiltroOsId } from "@/data/os-app";

/** Filtros e lista de OS por local; grupos sem nenhuma OS no filtro somem. */
export function ListaOsFiltravel() {
  const [filtro, setFiltro] = useState<FiltroOsId>("todas");

  const grupos = gruposOs
    .map((grupo) => ({ ...grupo, os: grupo.os.filter((os) => filtro === "todas" || os.status === filtro) }))
    .filter((grupo) => grupo.os.length > 0);

  return (
    <>
      <Notice tone="off" icon="wifioff">
        <strong>Sem sinal desde 08:12.</strong> Tudo o que você registrar fica salvo no aparelho. Última sincronização às
        07:58.
      </Notice>
      <FiltrosOs ativo={filtro} aoFiltrar={setFiltro} />
      <div className="os-groups">
        {grupos.map((grupo) => (
          <GrupoOs key={grupo.nome} grupo={grupo} />
        ))}
      </div>
    </>
  );
}
