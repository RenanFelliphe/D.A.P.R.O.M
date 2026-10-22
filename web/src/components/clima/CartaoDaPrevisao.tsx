import { Icon, type IconName } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { classeDoNivel, horaDaPrevisao, horasParaMostrar, ROTULO_DO_NIVEL, rotuloDoLocal, type ClimaRegistrado, type HoraDoClima, type NivelDeRisco, type PrevisaoDoTempo } from "@/lib/clima-comum";
import { hora } from "@/lib/formatar";
import type { EstadoDaPrevisao } from "./usePrevisao";

/** O ícone de cada nível: o selo da previsão diz o nível sem depender só da cor. */
export const ICONE_DO_NIVEL: Record<NivelDeRisco, IconName> = { sem_risco: "check", atencao: "alert", extremo: "octagon" };

/** As horas da janela em chips: a hora, o ícone do tempo, a temperatura e a chance de chuva. A hora com risco ganha o contorno do nível dela. */
export function HorasDoClima({ horas, max = 6 }: { horas: HoraDoClima[]; max?: number }) {
  if (horas.length === 0) return null;
  return (
    <ul className="clima-horas" aria-label="Previsão hora a hora">
      {horasParaMostrar(horas, max).map((h) => (
        <li key={h.hora} className={cx("clima-hora", h.nivel !== "sem_risco" && classeDoNivel(h.nivel))} title={`${h.condicao} · sensação de ${h.sensacao}°C · rajadas de ${h.rajada_kmh} km/h`}>
          <span className="clima-hora-h">{horaDaPrevisao(h.hora)}</span>
          <Icon name={h.icone} size={22} />
          <strong>{h.temperatura}°</strong>
          <span className="clima-hora-chuva">{h.chance_chuva}%</span>
          <span className="sr">
            {` ${h.condicao}, ${h.temperatura} graus, chance de chuva de ${h.chance_chuva}%`}
          </span>
        </li>
      ))}
    </ul>
  );
}

interface CartaoProps {
  previsao: Pick<PrevisaoDoTempo, "nivel" | "titulo" | "orientacao" | "horas" | "local" | "consultada_em" | "fonte">;
  /** Menos respiro e menos horas: a previsão dentro da pergunta da APR. */
  compacto?: boolean;
  /** Título do cartão (padrão "Previsão do tempo"). */
  cabecalho?: string;
}

/** A previsão da janela: o selo do nível, o local, as horas, a frase da `api` e o que fazer. É o mesmo cartão do quadro e da APR. */
export function CartaoDaPrevisao({ previsao, compacto, cabecalho = "Previsão do tempo" }: CartaoProps) {
  const nivel = previsao.nivel ?? "sem_risco";
  return (
    <section className={cx("clima-cartao", classeDoNivel(nivel), compacto && "compacto")} aria-label={cabecalho} data-treino="clima-cartao">
      <header className="clima-cab">
        <span className="clima-selo">
          <Icon name={ICONE_DO_NIVEL[nivel]} size={13} />
          {ROTULO_DO_NIVEL[nivel]}
        </span>
        <span className="clima-local">
          <Icon name="pin" size={13} />
          {rotuloDoLocal(previsao)}
        </span>
      </header>
      <HorasDoClima horas={previsao.horas} max={compacto ? 4 : 6} />
      <div className="stack g4">
        <strong className="clima-titulo">{previsao.titulo}</strong>
        <span className="clima-orientacao">{previsao.orientacao}</span>
      </div>
      <small className="clima-rodape">
        Atualizado às {hora(previsao.consultada_em)} · {previsao.fonte}
      </small>
    </section>
  );
}

/** Enquanto a previsão não chegou: o esqueleto do cartão, no mesmo tamanho (a tela não pula quando ela chega). */
export function EsqueletoDaPrevisao({ compacto }: { compacto?: boolean }) {
  return (
    <section className={cx("clima-cartao clima-esqueleto", compacto && "compacto")} aria-busy="true" aria-label="Previsão do tempo, carregando">
      <span className="clima-bloco" style={{ width: "40%" }} />
      <span className="clima-bloco" style={{ height: 64 }} />
      <span className="clima-bloco" style={{ width: "75%" }} />
    </section>
  );
}

/** O provedor não respondeu: uma linha discreta, sem alarme (nada é bloqueado por falta de previsão). */
export function PrevisaoIndisponivel({ compacto }: { compacto?: boolean }) {
  return (
    <section className={cx("clima-cartao clima-indisponivel", compacto && "compacto")} aria-label="Previsão do tempo">
      <span className="clima-selo">
        <Icon name="nuvem" size={13} />
        Previsão do tempo
      </span>
      <span className="clima-orientacao">Previsão indisponível agora. Observe o tempo no local antes de começar.</span>
    </section>
  );
}

/** O que mostrar em cada fase da previsão; `null` quando a tela não tem previsão (treino). */
export function PrevisaoPorEstado({ estado, compacto, cabecalho }: { estado: EstadoDaPrevisao; compacto?: boolean; cabecalho?: string }) {
  if (estado.fase === "oculta") return null;
  if (estado.fase === "carregando") return <EsqueletoDaPrevisao compacto={compacto} />;
  if (estado.fase === "indisponivel" || !estado.previsao.disponivel) return <PrevisaoIndisponivel compacto={compacto} />;
  return <CartaoDaPrevisao previsao={estado.previsao} compacto={compacto} cabecalho={cabecalho} />;
}

/** O clima guardado (relatório e detalhe da OS): o mesmo cartão, sem a atualização automática. */
export function ClimaGuardado({ clima }: { clima: ClimaRegistrado }) {
  return <CartaoDaPrevisao previsao={{ ...clima, fonte: "Open-Meteo" }} cabecalho="Condições climáticas" />;
}

/** Uma linha discreta com as condições de agora (no formulário de encerramento): nada enquanto carrega, sem previsão ou no treino. */
export function LinhaDeCondicoes({ estado }: { estado: EstadoDaPrevisao }) {
  if (estado.fase !== "pronta" || !estado.previsao.disponivel) return null;
  const { previsao } = estado;
  const nivel = previsao.nivel ?? "sem_risco";
  const agora = previsao.horas[0];
  return (
    <div className={cx("clima-linha", classeDoNivel(nivel))} data-treino="clima-condicoes">
      {agora && <Icon name={agora.icone} size={18} />}
      <span>
        <strong>Condições agora:</strong> {agora ? `${agora.condicao}, ${agora.temperatura}°C. ` : ""}
        {previsao.titulo}. Fica registrado no relatório da execução.
      </span>
    </div>
  );
}
