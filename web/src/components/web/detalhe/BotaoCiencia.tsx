"use client";

import { useState } from "react";
import { z } from "zod";
import { JanelaDeAssinatura } from "@/components/ausencia/JanelaDeAssinatura";
import { Button } from "@/components/ui/Button";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { ErroDeEnvio, useFormulario } from "@/components/ui/useFormulario";
import { JanelaModal } from "@/components/web/JanelaModal";
import { chamar } from "@/lib/cliente-api";
import { textoDosPontosGanhos, type RespostaComPontos } from "@/lib/gamificacao";
import { urlDoRelatorio } from "@/lib/rotas";
import { useMinhaAssinatura } from "@/state/minha-assinatura";
import { useToast } from "@/state/toast";

/** `POST /os/{id}/ciencia`: a OS passa a `encerrada` (concluída). */
interface RespostaDaAssinaturaFinal extends RespostaComPontos {
  status?: string;
}

const esquema = z.object({
  li: z.boolean().refine((v) => v, { message: "Marque que você leu o relatório da execução para seguir para a assinatura." }),
});

/** Primeira etapa: o relatório da execução (PDF) ao lado da caixa "Li o relatório", obrigatória para seguir. */
function JanelaDoRelatorio({ osId, aoSeguir, aoFechar }: { osId: string; aoSeguir: () => void; aoFechar: () => void }) {
  const { form, ref, enviar, erroEnvio } = useFormulario(esquema, { li: false });
  const erro = form.formState.errors.li?.message;
  return (
    <JanelaModal titulo="Relatório da execução" aoFechar={aoFechar} className="dlg-larga">
      <form ref={ref} noValidate className="stack g12" onSubmit={enviar(() => aoSeguir())}>
        <p>
          Leia o relatório da execução antes de assinar: o tempo, as pausas e os motivos, a localização, as fotos, o checklist e as assinaturas da APR.
        </p>
        <iframe
          title="Relatório da execução"
          src={urlDoRelatorio(osId)}
          style={{ width: "100%", height: "min(56vh, 520px)", minHeight: 280, border: "1px solid var(--line)", borderRadius: 10, background: "#fff" }}
        />
        <a href={urlDoRelatorio(osId)} target="_blank" rel="noreferrer" style={{ fontSize: 14, fontWeight: 600, alignSelf: "flex-start" }}>
          Abrir em outra aba
        </a>
        <Field label="Confirmação" erro={erro}>
          <label className="row g8" style={{ alignItems: "flex-start" }}>
            <input type="checkbox" style={{ marginTop: 3 }} {...form.register("li")} {...ligarAoErro("li", erro)} />
            <span>Li o relatório da execução</span>
          </label>
        </Field>
        <ErroDeEnvio mensagem={erroEnvio} />
        <div className="row g8 wrap">
          <Button type="submit" variant="p">
            Continuar para a assinatura
          </Button>
          <Button variant="ghost" onClick={aoFechar}>
            Voltar
          </Button>
        </div>
      </form>
    </JanelaModal>
  );
}

/**
 * A assinatura final do supervisor, na OS `aguardando_supervisor` (`POST /os/{id}/ciencia`). Dois passos: a janela do relatório da
 * execução, com a caixa "Li o relatório" (obrigatória), e a janela da assinatura do perfil. Assinada, a OS fica concluída
 * (`encerrada`), o PDF é gerado e a tela recarrega com quem assinou e quando.
 */
export function BotaoCiencia({ osId }: { osId: string }) {
  const exibirAviso = useToast();
  const assinaturaPath = useMinhaAssinatura();
  const [etapa, setEtapa] = useState<"fechada" | "relatorio" | "assinatura">("fechada");

  async function assinar() {
    const resposta = await chamar<RespostaDaAssinaturaFinal>("POST", `/os/${osId}/ciencia`);
    // Assinar até 72 h depois do encerramento pontua o supervisor.
    const pontos = textoDosPontosGanhos(resposta);
    exibirAviso(pontos ? `OS concluída · ${pontos}` : "OS concluída");
  }

  const fechar = () => setEtapa("fechada");

  return (
    <>
      <button className="btn btn-p btn-sm" type="button" onClick={() => setEtapa("relatorio")} style={{ alignSelf: "flex-start" }}>
        <Icon name="check" size={16} />
        Assinar e concluir a OS
      </button>
      {etapa === "relatorio" && <JanelaDoRelatorio osId={osId} aoSeguir={() => setEtapa("assinatura")} aoFechar={fechar} />}
      {etapa === "assinatura" && (
        <JanelaDeAssinatura
          titulo="Assinar e concluir a OS"
          resumo="Você leu o relatório da execução e assina a OS por último. A sua assinatura vai para o PDF da OS, que é gerado agora; a OS fica concluída e entra na planilha de baixa do SAP."
          rotuloConfirmar="Assinar e concluir a OS"
          assinaturaPath={assinaturaPath}
          aoConfirmar={assinar}
          aoFechar={fechar}
        />
      )}
    </>
  );
}
