import { filtrosOs, type FiltroOsId } from "@/data/os-app";

interface FiltrosOsProps {
  ativo: FiltroOsId;
  aoFiltrar: (filtro: FiltroOsId) => void;
}

/** Filtros de status da lista; só um fica pressionado por vez. */
export function FiltrosOs({ ativo, aoFiltrar }: FiltrosOsProps) {
  return (
    <div className="chips" role="group" aria-label="Filtrar por status">
      {filtrosOs.map((filtro) => (
        <button key={filtro.id} type="button" aria-pressed={filtro.id === ativo} onClick={() => aoFiltrar(filtro.id)}>
          {filtro.rotulo}
        </button>
      ))}
    </div>
  );
}
