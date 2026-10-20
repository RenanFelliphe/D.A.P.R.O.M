"use client";

import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { VitoriaNaCena } from "../vitoria/VitoriaNaCena";
import { explicarFalhaDaIA, type FalhaDaIA } from "./falhaDaIA";

/**
 * A falha do rascunho pela IA com título e origem (cota, servidor da IA, configuração, rede ou SYNQ OS), para o admin saber
 * de quem é o problema antes de tentar de novo. `compacto` é a versão do chat de ajustes, sem a Vitória.
 */
export function AvisoDeFalhaDaIA({ falha, compacto }: { falha: FalhaDaIA; compacto?: boolean }) {
  const { titulo, origem } = explicarFalhaDaIA(falha);
  const origemDaFalha = origem && <Badge tone="neu">Origem: {origem}</Badge>;

  if (compacto) {
    return (
      <Notice tone="blq" icon="alert" role="alert">
        <span className="stack g4">
          <strong>{titulo}</strong>
          {origemDaFalha && <span>{origemDaFalha}</span>}
          <span>{falha.mensagem}</span>
        </span>
      </Notice>
    );
  }
  return (
    <div role="alert">
      <VitoriaNaCena chave={`erro-${falha.codigo}-${falha.mensagem}`} reacao="errada" tamanho={72} tom="erro">
        <strong className="ts-balao-titulo">{titulo}</strong>
        {origemDaFalha && <p>{origemDaFalha}</p>}
        <p>{falha.mensagem}</p>
      </VitoriaNaCena>
    </div>
  );
}
