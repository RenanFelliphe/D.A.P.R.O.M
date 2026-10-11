import type { Alerta } from "@/data/alertas";
import { ItemAlerta } from "./ItemAlerta";

interface ListaAlertasProps {
  alertas: Alerta[];
  selecionado: number;
  aoSelecionar: (indice: number) => void;
}

/** Lista de alertas à esquerda, com um item selecionado. */
export function ListaAlertas({ alertas, selecionado, aoSelecionar }: ListaAlertasProps) {
  return (
    <div className="alist" role="listbox" aria-label="Lista de alertas">
      {alertas.map((alerta, i) => (
        <ItemAlerta key={alerta.os} alerta={alerta} selecionado={i === selecionado} aoSelecionar={() => aoSelecionar(i)} />
      ))}
    </div>
  );
}
