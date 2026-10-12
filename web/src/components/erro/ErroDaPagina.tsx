"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";

interface ErroDaPaginaProps {
  error: Error & { digest?: string };
  retry: () => void;
  /** Para onde "Voltar ao início" leva (o início da área em que a falha aconteceu). */
  inicio: string;
}

/**
 * Falha ao montar uma página (a `api` fora do ar, uma resposta de erro, um dado inesperado). O erro de componente de
 * servidor chega sem detalhe ao navegador (só o `digest`, que casa com o log do servidor); a tela diz o que fazer, em vez
 * da tela de erro padrão do Next.
 */
export function ErroDaPagina({ error, retry, inicio }: ErroDaPaginaProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Screen>
      <div className="stack g4">
        <h1>Não foi possível abrir esta página</h1>
        <span className="muted">Algo deu errado ao carregar as informações. Isso costuma passar ao tentar de novo.</span>
      </div>
      <Notice tone="blq" icon="alert">
        O servidor não respondeu como esperado.
        {error.digest ? <span className="small muted"> Código do erro: {error.digest}.</span> : null}
      </Notice>
      <div className="row g8">
        <button type="button" className="btn btn-p" onClick={() => retry()}>
          Tentar de novo
        </button>
        <Link href={inicio} className="btn">
          Voltar ao início
        </Link>
      </div>
    </Screen>
  );
}
