"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { dataDoDia } from "@/lib/formatar";
import { diasEntre, MOTIVO_DO_AUSENTE, type Ausencia, type MinhaAusencia } from "@/lib/ausencia";
import { chamar } from "@/lib/cliente-api";
import { AcoesDaAusencia } from "./AcoesDaAusencia";
import { JanelaDeAssinatura } from "./JanelaDeAssinatura";

interface FaixaDeAusenciaProps {
  ausencia: MinhaAusencia;
  eu: { id: string; nome: string; assinaturaPath: string | null };
  /** Quem está ausente supervisiona uma equipe: a ausência dele é a que registrou, e ele a encerra em emergência. */
  supervisor: boolean;
}

/** A `Ausencia` completa, no que os botões usam, a partir do que `GET /me` traz. */
function comoAusencia(m: MinhaAusencia, eu: FaixaDeAusenciaProps["eu"]): Ausencia {
  return {
    id: m.id,
    usuario_id: eu.id,
    usuario_nome: eu.nome,
    usuario_matricula: "",
    equipe_id: "",
    equipe_nome: "",
    supervisor_id: null,
    supervisor_nome: null,
    motivo: m.motivo,
    inicio: m.inicio,
    retorno: m.retorno,
    dias: diasEntre(m.inicio, m.retorno),
    dias_informados: null,
    estado: "confirmada",
    situacao: m.situacao,
    origem: m.origem,
    fim_pedido_data: m.fim_pedido_data,
    fim_pedido_em: m.fim_pedido_em,
    encerrada_em: null,
    forma_encerramento: null,
    criada_em: "",
  };
}

/**
 * A faixa de quem está ausente ("Você está ausente até DD/MM"), com o pedido de fim antecipado. Passada a data de retorno a
 * ausência fica vencida: aparece a tela "Sua ausência terminou em DD/MM", onde o ausente confirma o retorno, assinando, e a
 * conta volta ao normal na hora. O ausente só visualiza o sistema.
 */
export function FaixaDeAusencia({ ausencia: m, eu, supervisor }: FaixaDeAusenciaProps) {
  const a = comoAusencia(m, eu);
  const vencida = m.situacao === "vencida";
  const [retornoAberto, setRetornoAberto] = useState(vencida);

  return (
    <div className={vencida ? "aus-faixa vencida" : "aus-faixa"} role="status">
      <div className="aus-faixa-texto">
        <Icon name={vencida ? "clock" : "info"} size={18} />
        <span>
          {vencida ? (
            <>
              <strong>Sua ausência terminou em {dataDoDia(m.retorno)}.</strong> Confirme o retorno para voltar a usar o sistema; até lá você só visualiza.
            </>
          ) : (
            <>
              <strong>Você está ausente até {dataDoDia(m.retorno)}.</strong> {MOTIVO_DO_AUSENTE.replace("Você está ausente: ", "")}
              {m.fim_pedido_em && m.fim_pedido_data ? ` Fim antecipado pedido para ${dataDoDia(m.fim_pedido_data)}: aguardando o supervisor.` : ""}
            </>
          )}
        </span>
      </div>
      <AcoesDaAusencia ausencia={a} eu={{ id: eu.id, assinaturaPath: eu.assinaturaPath, ausente: true }} supervisaEquipe={supervisor} />
      {retornoAberto && (
        <JanelaDeAssinatura
          titulo="Sua ausência terminou"
          resumo={`Sua ausência terminou em ${dataDoDia(m.retorno)}. Confirme o retorno, assinando, e a sua conta volta ao normal na hora.`}
          rotuloConfirmar="Confirmar retorno e assinar"
          assinaturaPath={eu.assinaturaPath}
          aoConfirmar={() => chamar("POST", `/ausencias/${m.id}/confirmar-retorno`, { assinar: true }).then(() => undefined)}
          aoFechar={() => setRetornoAberto(false)}
        />
      )}
    </div>
  );
}
