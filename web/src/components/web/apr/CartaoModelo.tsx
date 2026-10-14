import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { GrupoModelo } from "@/data/modelos";
import { data } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Cartão de um modelo na aba Modelos: código, título, versão em uso, rascunho e quanto já foi usado. */
export function CartaoModelo({ grupo }: { grupo: GrupoModelo }) {
  const { emUso, rascunho } = grupo;
  const itens = (emUso ?? rascunho ?? grupo.versoes[0]!).itens_total;
  return (
    <Link className="cartao-modelo" href={rotas.web.modelo(grupo.codigo)}>
      <span className="cm-topo">
        <b className="mono">{grupo.codigo}</b>
        <span className="row g6 wrap">
          {emUso ? <Badge tone="enc">{`v${emUso.versao} em uso`}</Badge> : <Badge tone="neu">Não publicado</Badge>}
          {rascunho && <Badge tone="al">{`Rascunho v${rascunho.versao}`}</Badge>}
        </span>
      </span>
      <span className="cm-titulo">{grupo.titulo}</span>
      <span className="cm-dados">
        <span>{plural(itens, "item", "itens")}</span>
        <span>{plural(grupo.aprsTotal, "APR respondida", "APRs respondidas")}</span>
      </span>
      <span className="small">
        {emUso ? `Publicada em ${data(emUso.publicado_em)}` : "As APRs só usam o modelo depois da primeira publicação"}
      </span>
    </Link>
  );
}
