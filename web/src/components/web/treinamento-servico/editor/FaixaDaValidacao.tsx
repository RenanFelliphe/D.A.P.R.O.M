import type { ReactNode } from "react";
import { LinkButton } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { dataHora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import { validacaoDoTreinamento } from "@/lib/treinamento-servico-servidor";
import { situacaoDaValidacao, textoDoAndamento } from "@/lib/treinamento-validacao";
import { BotaoRetirarValidacao } from "./BotaoRetirarValidacao";

/**
 * O que o editor diz da validação pelos supervisores: com o rascunho em validação, um aviso no topo e (com `travar`) as telas de edição
 * ficam desativadas (um `fieldset` desativado desliga todos os campos e botões de dentro, que a `api` também recusaria com `409
 * em_validacao`); com o rascunho devolvido por um validador, o motivo e quem recusou. "Retirar da validação" destrava para editar.
 */
export async function FaixaDaValidacao({ codigo, travar = false, children }: { codigo: string; travar?: boolean; children?: ReactNode }) {
  const v = await validacaoDoTreinamento(codigo);
  const situacao = situacaoDaValidacao(v);

  return (
    <>
      {v && situacao === "em_validacao" && (
        <Notice tone="al" icon="clock" role="status">
          <span className="stack g8">
            <strong>
              Enviado para validação{v.enviada_em ? ` em ${dataHora(v.enviada_em)}` : ""} · {textoDoAndamento(v)}
            </strong>
            <span>
              {travar ? "As telas de edição ficam travadas enquanto os supervisores validam" : "Enquanto os supervisores validam, o rascunho fica travado"}. Para mudar algo, retire o treinamento da
              validação: as assinaturas já dadas se perdem e o envio recomeça.
            </span>
            <span className="row g8 wrap">
              {v.pode_retirar && <BotaoRetirarValidacao codigo={codigo} />}
              <LinkButton variant="line" sm href={rotas.app.treinamentoServico(codigo, "publicar")}>
                Ver o andamento
              </LinkButton>
            </span>
          </span>
        </Notice>
      )}
      {v && situacao === "devolvido" && (
        <Notice tone="blq" icon="alert" role="status">
          <span className="stack g4">
            <strong>Devolvido pela validação{v.historico[0]?.por_nome ? ` por ${v.historico[0].por_nome}` : ""}</strong>
            <span>{v.historico[0]?.motivo ?? "Sem motivo registrado."}</span>
            <span className="small">Ajuste o treinamento e envie de novo: a nova rodada escolhe os validadores outra vez.</span>
          </span>
        </Notice>
      )}
      {v?.em_validacao && travar ? (
        <fieldset disabled className="ts-travado">
          {children}
        </fieldset>
      ) : (
        children
      )}
    </>
  );
}
