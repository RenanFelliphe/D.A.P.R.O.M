import { ItemAlerta } from "./ItemAlerta";
import type { Alerta } from "./tipos";

interface ListaAlertasProps {
  alertas: Alerta[];
  selecionadoId: string | null;
  /** Endereço da tela com o alerta aberto, mantendo os filtros. */
  hrefDoAlerta: (id: string) => string;
}

/** Lista de alertas à esquerda, com um item selecionado. */
export function ListaAlertas({ alertas, selecionadoId, hrefDoAlerta }: ListaAlertasProps) {
  return (
    <div className="alist" role="listbox" aria-label="Lista de alertas">
      {alertas.map((alerta) => (
        <ItemAlerta key={alerta.id} alerta={alerta} selecionado={alerta.id === selecionadoId} href={hrefDoAlerta(alerta.id)} />
      ))}
    </div>
  );
}
