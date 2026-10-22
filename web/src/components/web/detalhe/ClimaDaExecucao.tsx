import { ClimaGuardado } from "@/components/clima/CartaoDaPrevisao";
import type { AprDaOs, ClimaGuardadoDaOs, ExecucaoDaOs } from "@/data/detalhe";
import { hora } from "@/lib/formatar";

const rotuloMedida = { color: "var(--ink4)" } as const;

/**
 * Uma previsão do tempo guardada: o cartão da previsão (o mesmo do quadro) com a hora em que a pessoa a consultou e, na APR, a
 * confirmação do aviso (a previsão apontava risco e a pessoa respondeu "favorável" e confirmou).
 */
export function BlocoDeClima({ titulo, clima }: { titulo: string; clima: ClimaGuardadoDaOs }) {
  return (
    <div className="clima-registro">
      <div className="small" style={rotuloMedida}>
        {titulo} · consultada às {hora(clima.consultada_em)}
      </div>
      <ClimaGuardado clima={clima} />
      {clima.confirmou_apesar_do_aviso && <span className="clima-confirmou">A pessoa respondeu que o clima estava favorável e confirmou o aviso.</span>}
    </div>
  );
}

/** "Condições climáticas" de uma execução: a previsão da APR que a amparou e a do encerramento; sem nenhuma, diz que não houve registro. */
export function CondicoesClimaticas({ apr, execucao }: { apr: AprDaOs | undefined; execucao: ExecucaoDaOs }) {
  const naApr = apr?.clima ?? null;
  const noEncerramento = execucao.clima ?? null;
  return (
    <div className="stack g8" data-treino="clima-registro">
      <div className="small" style={rotuloMedida}>
        Condições climáticas
      </div>
      {!naApr && !noEncerramento && <p className="muted">Sem registro do clima: a previsão estava indisponível ou o aparelho estava sem sinal.</p>}
      {naApr && <BlocoDeClima titulo="Na APR" clima={naApr} />}
      {noEncerramento && <BlocoDeClima titulo="No encerramento" clima={noEncerramento} />}
    </div>
  );
}
