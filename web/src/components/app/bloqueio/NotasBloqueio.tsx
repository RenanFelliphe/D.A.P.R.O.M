import { Icon } from "@/components/ui/Icon";

/** Avisos finais: quem é notificado e que o registro não pode ser alterado. */
export function NotasBloqueio() {
  return (
    <div className="stack g8 small" style={{ fontSize: 13, color: "var(--ink2)" }}>
      <div className="row g8" style={{ alignItems: "flex-start" }}>
        <Icon name="bell" size={16} style={{ color: "var(--brand)", marginTop: 2 }} />
        <span>
          Marcos Tavares, supervisor da equipe, recebe o aviso no painel e por e-mail assim que houver sinal, com o
          motivo e a evidência.
        </span>
      </div>
      <div className="row g8" style={{ alignItems: "flex-start" }}>
        <Icon name="lock" size={16} style={{ marginTop: 2 }} />
        <span>
          Depois de registrada, esta APR não pode ser alterada. A OS continua pendente: quem voltar ao local faz uma
          APR nova, sem esperar reprogramação.
        </span>
      </div>
    </div>
  );
}
