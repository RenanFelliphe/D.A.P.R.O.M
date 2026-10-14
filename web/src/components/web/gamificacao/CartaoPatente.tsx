import type { CSSProperties } from "react";
import { Panel } from "@/components/web/Panel";
import { numero, pontos, type DadosDaTemporada, type SeloDePatente } from "@/lib/gamificacao";

interface CartaoPatenteProps {
  temporada: Pick<DadosDaTemporada, "nome">;
  pontosDaTemporada: number;
  patente: SeloDePatente | null;
  /** Onde a barra começa (a pontuação da patente de agora) e termina (a da próxima; `null` no topo). */
  barra: { de: number; ate: number | null };
  proxima: (SeloDePatente & { faltam: number }) | null;
}

/** A patente da temporada, com a imagem e a barra de progresso até a próxima. */
export function CartaoPatente({ temporada, pontosDaTemporada, patente, barra, proxima }: CartaoPatenteProps) {
  const percentual = barra.ate === null ? 100 : Math.max(0, Math.min(100, ((pontosDaTemporada - barra.de) / Math.max(1, barra.ate - barra.de)) * 100));
  const estilo = { "--cor-patente": patente?.cor ?? "var(--brand)" } as CSSProperties;
  return (
    <Panel className="gam-cartao" style={estilo}>
      {patente?.imagem_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="gam-imagem" src={patente.imagem_url} alt={`Patente ${patente.nome}`} />
      ) : (
        <span className="selo-patente selo-xg" aria-hidden>
          <span className="selo-ph">{(patente?.nome ?? "?").slice(0, 1)}</span>
        </span>
      )}
      <div className="stack g8">
        <span className="lbl">Minha patente · {temporada.nome}</span>
        <span className="gam-nome">{patente?.nome ?? "Sem patente"}</span>
        <span className="gam-pontos">
          <strong>{numero(pontosDaTemporada)}</strong> {pontosDaTemporada === 1 ? "ponto" : "pontos"} na temporada
        </span>
        <div className="stack g4">
          <div className="gam-barra" role="progressbar" aria-valuemin={barra.de} aria-valuemax={barra.ate ?? pontosDaTemporada} aria-valuenow={pontosDaTemporada} aria-label="Progresso até a próxima patente">
            <i style={{ width: `${percentual}%` }} />
          </div>
          <div className="gam-rotulos">
            <span>{numero(barra.de)}</span>
            {proxima ? <span>Faltam {pontos(proxima.faltam)} para {proxima.nome}</span> : <span>Você está na maior patente</span>}
            {barra.ate !== null && <span>{numero(barra.ate)}</span>}
          </div>
        </div>
      </div>
    </Panel>
  );
}
