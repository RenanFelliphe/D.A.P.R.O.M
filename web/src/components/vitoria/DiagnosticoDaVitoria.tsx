import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Panel } from "@/components/web/Panel";
import { dataHora, hora } from "@/lib/formatar";

/** Resposta de `GET /vitoria/diagnostico` (só admin). */
export interface Diagnostico {
  estado: "ativa" | "sem_chave" | "desligada" | "limite_do_dia" | "fornecedor_com_problema";
  titulo: string;
  porque: string;
  volta: string | null;
  provedor: "anthropic" | "gemini";
  modelo: string;
  uso: {
    dia: string;
    usadas: number;
    limite: number;
    restantes: number;
    percentual: number;
    ritmo_por_hora: number | null;
    esgota_em_horas: number | null;
    esgota_por_volta: string | null;
  };
  limites: { por_conversa: number; por_conta_dia: number };
  ultima_chamada: { em: string; ok: boolean; erro: string | null } | null;
  hoje: { respondidas: number; nao_sei: number; com_ia: number; sem_ia: number };
}

const TOM: Record<Diagnostico["estado"], { selo: BadgeTone; rotulo: string }> = {
  ativa: { selo: "enc", rotulo: "Ativa" },
  sem_chave: { selo: "neu", rotulo: "Sem chave" },
  desligada: { selo: "neu", rotulo: "Desligada" },
  limite_do_dia: { selo: "blq", rotulo: "Limite do dia" },
  fornecedor_com_problema: { selo: "crit", rotulo: "Fornecedor com problema" },
};

/** "3,5 h" ou "40 min": o tempo que falta para acabar, em linguagem de gente. */
function tempoQueFalta(horas: number): string {
  if (horas < 1) return `${Math.max(Math.round(horas * 60), 1)} min`;
  return `${horas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
}

/**
 * O diagnóstico da IA da Vitória para o admin (a única parte de "Vitória do admin" além das perguntas sem resposta): se está
 * ativa, por quê, quando volta e quanto do limite de respostas com IA do dia o projeto já usou, num controle deslizante
 * só de leitura.
 */
export function DiagnosticoDaVitoria({ d }: { d: Diagnostico }) {
  const { uso } = d;
  const nivel = d.estado === "limite_do_dia" || uso.percentual >= 100 ? "esgotado" : uso.percentual >= 80 ? "perto" : "folga";
  const marcaDaCota = d.provedor === "gemini" ? "Gemini" : "Claude";

  return (
    <Panel className={`vd vd-${d.estado}`}>
      <div className="row between wrap g8">
        <h2>Diagnóstico</h2>
        <Badge tone={TOM[d.estado].selo}>{TOM[d.estado].rotulo}</Badge>
      </div>

      <div className="stack g4">
        <strong className="vd-titulo">{d.titulo}</strong>
        <span>{d.porque}</span>
        {d.volta ? (
          <span className="vd-volta">
            <strong>Quando volta: </strong>
            {d.volta}
          </span>
        ) : null}
      </div>

      <div className="vd-slider-bloco">
        <div className="row between wrap g8">
          <span>
            <strong>{uso.usadas.toLocaleString("pt-BR")}</strong> de {uso.limite.toLocaleString("pt-BR")} respostas com IA usadas hoje
          </span>
          <span className="muted">{uso.percentual}%</span>
        </div>
        <div
          className={`vd-slider vd-${nivel}`}
          role="meter"
          aria-label="Respostas com IA usadas hoje"
          aria-valuemin={0}
          aria-valuemax={uso.limite}
          aria-valuenow={Math.min(uso.usadas, uso.limite)}
          aria-valuetext={`${uso.usadas} de ${uso.limite} respostas usadas, ${uso.restantes} restantes`}
        >
          <div className="vd-trilho">
            <div className="vd-preenchido" style={{ width: `${uso.percentual}%` }} />
          </div>
          <div className="vd-botao" style={{ left: `${uso.percentual}%` }} aria-hidden="true" />
        </div>
        <div className="row between muted vd-pontas">
          <span>0</span>
          <span>{`${uso.restantes.toLocaleString("pt-BR")} ainda dá para usar`}</span>
          <span>{uso.limite.toLocaleString("pt-BR")}</span>
        </div>
      </div>

      <dl className="vd-fatos">
        <div>
          <dt>Para esgotar</dt>
          <dd>
            {uso.restantes === 0
              ? "Já esgotou"
              : uso.esgota_em_horas === null
                ? "Pouco uso hoje para estimar"
                : uso.esgota_por_volta
                  ? `${tempoQueFalta(uso.esgota_em_horas)} (por volta das ${hora(uso.esgota_por_volta)})`
                  : "Não esgota hoje, no ritmo atual"}
          </dd>
        </div>
        <div>
          <dt>Ritmo de hoje</dt>
          <dd>{uso.ritmo_por_hora === null ? "—" : `${uso.ritmo_por_hora.toLocaleString("pt-BR")} respostas por hora`}</dd>
        </div>
        <div>
          <dt>Respondidas hoje</dt>
          <dd>{`${d.hoje.com_ia} com IA · ${d.hoje.sem_ia} pelo manual · ${d.hoje.nao_sei} sem resposta`}</dd>
        </div>
        <div>
          <dt>Última chamada à IA</dt>
          <dd>
            {d.ultima_chamada
              ? `${d.ultima_chamada.ok ? "Deu certo" : "Falhou"} em ${dataHora(d.ultima_chamada.em)}`
              : "Nenhuma desde que a api subiu"}
          </dd>
        </div>
        <div>
          <dt>Quem responde</dt>
          <dd className="mono">{`${marcaDaCota} · ${d.modelo}`}</dd>
        </div>
        <div>
          <dt>Limites por pessoa</dt>
          <dd>{`${d.limites.por_conta_dia} respostas por dia · ${d.limites.por_conversa} por conversa`}</dd>
        </div>
      </dl>

      {d.ultima_chamada && !d.ultima_chamada.ok && d.ultima_chamada.erro ? <span className="muted vd-erro">{`Erro do fornecedor: ${d.ultima_chamada.erro}`}</span> : null}
      <span className="muted vd-nota">
        O limite do dia (VITORIA_LIMITE_GLOBAL_DIA) é o do projeto e zera à meia-noite de Brasília. A cota do fornecedor é outra e só aparece aqui quando uma
        pergunta é recusada; a última chamada fica na memória da api e zera ao reiniciar.
      </span>
    </Panel>
  );
}
