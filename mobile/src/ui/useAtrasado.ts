import { useEffect, useState } from "react";

/** O valor de `valor` só depois de `ms` sem mudar: a busca digitada chama a `api` quando a pessoa para de digitar. */
export function useAtrasado<T>(valor: T, ms = 400): T {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return atrasado;
}
