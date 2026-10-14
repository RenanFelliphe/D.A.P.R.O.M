import type { CSSProperties } from "react";
import { cx } from "@/lib/cx";
import type { SeloDePatente } from "@/lib/gamificacao";

interface SeloPatenteProps {
  /** A patente; `null` mostra "Sem patente" (com a carga inicial ninguém fica sem: Bronze começa em 0). */
  patente: Pick<SeloDePatente, "nome" | "cor" | "imagem_url"> | null;
  tamanho?: "p" | "m" | "g" | "xg";
  /** Só a imagem, com o nome para os leitores de tela. */
  semNome?: boolean;
  className?: string;
}

/** A imagem e o nome da patente, usados na barra, no ranking, no perfil e na equipe. A cor da patente destaca o nome. */
export function SeloPatente({ patente, tamanho = "m", semNome, className }: SeloPatenteProps) {
  const nome = patente?.nome ?? "Sem patente";
  const estilo = patente ? ({ "--cor-patente": patente.cor } as CSSProperties) : undefined;
  return (
    <span className={cx("selo-patente", `selo-${tamanho}`, semNome && "selo-sem-nome", className)} style={estilo} title={nome}>
      {patente?.imagem_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={patente.imagem_url} alt={semNome ? nome : ""} loading="lazy" />
      ) : (
        <span className="selo-ph" role={semNome ? "img" : undefined} aria-label={semNome ? nome : undefined} aria-hidden={semNome ? undefined : true}>
          {nome.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="selo-nome">{nome}</span>
    </span>
  );
}
