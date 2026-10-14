import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { data } from "@/lib/formatar";
import { mediaDeEquipe, numero, ordinal, raridadeEmTexto, type Conquista } from "@/lib/gamificacao";

/** O progresso de uma conquista que falta: "37 de 50" com a barra, ou o texto próprio dos critérios de posição. */
function Progresso({ c }: { c: Conquista }) {
  const p = c.progresso;
  if (!p) return null;
  if (c.criterio === "posicao" || c.criterio === "posicao_da_equipe") {
    return (
      <div className="c-prog">
        {p.atual === null ? <span>Ainda sem temporada fechada.</span> : <span>Melhor posição: {ordinal(p.atual)} (a meta é o {ordinal(p.meta)} ou melhor)</span>}
      </div>
    );
  }
  const pontosDaPatente = c.criterio === "patente" || c.criterio === "patente_da_equipe";
  const atual = p.atual ?? 0;
  const percentual = Math.max(0, Math.min(100, (atual / Math.max(1, p.meta)) * 100));
  const formatar = (n: number) => (c.criterio === "patente_da_equipe" ? mediaDeEquipe(n) : numero(n));
  return (
    <div className="c-prog">
      <span>
        {formatar(atual)} de {formatar(p.meta)}
        {pontosDaPatente ? (c.criterio === "patente_da_equipe" ? " de média por membro" : " pontos numa temporada") : ""}
      </span>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={p.meta} aria-valuenow={Math.min(atual, p.meta)} aria-label={`Progresso: ${c.titulo}`}>
        <i style={{ width: `${percentual}%` }} />
      </div>
    </div>
  );
}

interface CartaoConquistaProps {
  conquista: Conquista;
  /** Botões do admin (editar, desativar, excluir), no rodapé do cartão. */
  acoes?: ReactNode;
}

/** Um troféu: colorido, com a data, quando obtido; em cinza, com a meta e o progresso, quando falta. Mostra a raridade e os pontos. */
export function CartaoConquista({ conquista: c, acoes }: CartaoConquistaProps) {
  const obtida = c.obtida_em !== null;
  return (
    <article className={cx("conquista", obtida ? "obtida" : "falta", !c.ativa && "desativada")} aria-label={c.titulo}>
      {c.imagem_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.imagem_url} alt={obtida ? `Troféu ${c.titulo} (obtido)` : `Troféu ${c.titulo} (ainda não obtido)`} loading="lazy" />
      ) : (
        <span aria-hidden style={{ width: 72, height: 72, display: "grid", placeItems: "center" }}>
          <Icon name="trophy" size={24} />
        </span>
      )}
      <div className="c-corpo">
        <h3>{c.titulo}</h3>
        <span className="c-meta">{c.meta}</span>
        <span className="c-desc">{c.descricao}</span>
        {obtida ? (
          <div className="c-prog" style={{ color: "var(--enc)" }}>
            <strong>
              <Icon name="check" size={13} /> Obtida em {data(c.obtida_em)}
            </strong>
          </div>
        ) : (
          <Progresso c={c} />
        )}
        <div className="c-pe">
          <span title={`${numero(c.obtidas)} ${c.tipo === "equipe" ? "equipes" : "técnicos"}`}>
            {raridadeEmTexto(c.raridade)} {c.tipo === "equipe" ? "das equipes" : "dos técnicos"} {c.obtidas === 1 ? "tem" : "têm"}
          </span>
          {c.pontos > 0 && <Badge tone="al">+{numero(c.pontos)} pontos</Badge>}
          {!c.ativa && <Badge tone="neu">Desativada</Badge>}
        </div>
      </div>
      {acoes && <div className="c-acoes">{acoes}</div>}
    </article>
  );
}
