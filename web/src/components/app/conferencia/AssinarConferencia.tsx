"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAcao } from "@/components/app/execucao/useAcao";
import { JanelaDeAssinatura } from "@/components/ausencia/JanelaDeAssinatura";
import { Button } from "@/components/ui/Button";
import { MensagemDeErro } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { chamar } from "@/lib/cliente-api";
import type { ConferenciaDaApi } from "@/lib/conferencia";
import { useMinhaAssinatura } from "@/state/minha-assinatura";
import { useToast } from "@/state/toast";

const LIMITE_DA_RESSALVA = 1000;

/**
 * A ciência (resumo: um toque, sem assinatura) ou a assinatura (com divergência: a assinatura do perfil) de quem falta, com ressalva
 * opcional. A ressalva não trava nada: ela vai ao responsável, ao supervisor e ao relatório. `POST /conferencias/{id}/assinar`.
 */
export function AssinarConferencia({ conferencia }: { conferencia: Pick<ConferenciaDaApi, "id" | "tipo"> }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const assinaturaPath = useMinhaAssinatura();
  const { ocupado, erro, executar } = useAcao();
  const resumo = conferencia.tipo === "resumo";
  const [janela, setJanela] = useState<"simples" | "ressalva" | null>(null);
  const [ressalva, setRessalva] = useState("");
  const [faltaRessalva, setFaltaRessalva] = useState(false);

  const enviar = (texto: string) => chamar("POST", `/conferencias/${conferencia.id}/assinar`, texto ? { ressalva: texto } : {});

  const darCiencia = () =>
    executar(async () => {
      await enviar("");
      exibirAviso("Ciência registrada");
      router.refresh();
    });

  const fechar = () => {
    setJanela(null);
    setRessalva("");
    setFaltaRessalva(false);
  };

  // Com ressalva, o texto é obrigatório; sem ela, é opcional. A janela só valida o que é dela (a assinatura); o texto é conferido aqui.
  const validar = async () => {
    const vazia = janela === "ressalva" && ressalva.trim() === "";
    setFaltaRessalva(vazia);
    return !vazia;
  };

  const rotuloDaRessalva = resumo ? "Dar ciência com ressalva" : "Assinar com ressalva";

  return (
    <div className="stack g8">
      {erro && (
        <Notice tone="blq" icon="alert" role="alert">
          {erro.mensagem}
        </Notice>
      )}
      <Button variant="p" block disabled={ocupado} aria-busy={ocupado} onClick={resumo ? () => void darCiencia() : () => setJanela("simples")} data-treino="conferencia-assinar">
        <Icon name="check" size={18} />
        {resumo ? (ocupado ? "Registrando…" : "Dar ciência") : "Assinar"}
      </Button>
      <Button variant="line" block disabled={ocupado} onClick={() => setJanela("ressalva")}>
        {rotuloDaRessalva}
      </Button>
      <span className="small muted">Se discordar de algo, use a ressalva: ela vai ao supervisor e ao relatório, e não impede a conferência.</span>
      {janela && (
        <JanelaDeAssinatura
          titulo={janela === "ressalva" ? rotuloDaRessalva : "Assinar a conferência"}
          resumo={
            resumo
              ? "Os registros dos aparelhos batem. Você dá a sua ciência ao resumo da execução."
              : "O responsável escolheu as versões certas. Você confere o resultado e assina a conferência com a sua assinatura do perfil."
          }
          rotuloConfirmar={janela === "ressalva" ? rotuloDaRessalva : resumo ? "Dar ciência" : "Assinar"}
          assinaturaPath={assinaturaPath}
          semAssinatura={resumo}
          validar={validar}
          aoConfirmar={async () => {
            await enviar(ressalva.trim());
            exibirAviso(janela === "ressalva" ? "Ressalva registrada" : resumo ? "Ciência registrada" : "Conferência assinada");
          }}
          aoFechar={fechar}
        >
          <label className="stack g6" htmlFor="cf-ressalva">
            <span className="lbl">{janela === "ressalva" ? "Ressalva" : "Ressalva (opcional)"}</span>
            <textarea
              id="cf-ressalva"
              className="input"
              rows={4}
              maxLength={LIMITE_DA_RESSALVA}
              value={ressalva}
              onChange={(e) => {
                setRessalva(e.target.value);
                if (e.target.value.trim()) setFaltaRessalva(false);
              }}
              aria-invalid={faltaRessalva ? true : undefined}
              placeholder="Ex.: a pausa do almoço foi das 12:00 às 13:00, não das 11:30"
            />
            {faltaRessalva && <MensagemDeErro>Escreva a ressalva, ou volte e assine sem ela.</MensagemDeErro>}
          </label>
        </JanelaDeAssinatura>
      )}
    </div>
  );
}
