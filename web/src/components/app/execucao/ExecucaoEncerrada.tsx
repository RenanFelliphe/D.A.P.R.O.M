"use client";

import { useEffect, useState } from "react";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { PontosGanhos } from "@/components/web/gamificacao/PontosGanhos";
import { chamar } from "@/lib/cliente-api";
import type { RespostaComPontos } from "@/lib/gamificacao";
import { rotas, urlDoPdf } from "@/lib/rotas";

const TENTATIVAS = 10;

interface ExecucaoEncerradaProps {
  osId: string;
  /**
   * Em que ponto a OS está: `aguardando_supervisor` (o responsável assinou; falta o supervisor ler o relatório e assinar) ou
   * `encerrada` (o supervisor assinou: concluída, com o PDF).
   */
  status: "aguardando_supervisor" | "encerrada";
  /** Os pontos que a assinatura do encerramento acabou de dar ("+N pontos"). */
  pontos?: RespostaComPontos | null;
}

/**
 * Tela final do técnico. Depois da assinatura do responsável a OS aguarda o supervisor: ele lê o relatório da execução e assina por
 * último, e só então a OS está concluída e o PDF existe. Com a OS já concluída, a `api` gera o PDF em segundo plano: a OS é
 * consultada algumas vezes até ele ficar pronto e, enquanto isso, o link já funciona (`GET /os/{id}/pdf` gera na hora).
 */
export function ExecucaoEncerrada({ osId, status, pontos }: ExecucaoEncerradaProps) {
  const [pronto, setPronto] = useState<boolean | null>(null);
  const concluida = status === "encerrada";

  useEffect(() => {
    if (!concluida) return;
    let ativo = true;
    let tentativa = 0;
    let temporizador: ReturnType<typeof setTimeout>;
    async function consultar() {
      try {
        const { os } = await chamar<{ os: { pdf_pronto: boolean } }>("GET", `/os/${osId}`);
        if (!ativo) return;
        setPronto(os.pdf_pronto);
        if (!os.pdf_pronto && ++tentativa < TENTATIVAS) temporizador = setTimeout(consultar, 3000);
      } catch {
        /* o link do PDF segue disponível */
      }
    }
    temporizador = setTimeout(consultar, 0);
    return () => {
      ativo = false;
      clearTimeout(temporizador);
    };
  }, [osId, concluida]);

  return (
    <div className="panel stack g12" style={{ maxWidth: 560 }} data-treino="exec-encerrada">
      <h2>{concluida ? "OS concluída" : "Encerramento assinado"}</h2>
      {concluida ? (
        <Notice tone="ok" icon="check">
          O supervisor leu o relatório e assinou: a OS está concluída.{" "}
          {pronto === false ? "O PDF está sendo gerado; ao abrir, ele é preparado na hora." : pronto ? "O PDF da OS está pronto." : ""}
        </Notice>
      ) : (
        <Notice tone="ok" icon="check">
          <strong>Agora a OS aguarda o supervisor.</strong> Ele lê o relatório da execução e assina por último; só então a OS está concluída e o PDF fica pronto. Você não precisa fazer mais nada.
        </Notice>
      )}
      <PontosGanhos resposta={pontos} />
      <div className="row g8 wrap">
        {concluida && (
          <a className="btn btn-p" href={urlDoPdf(osId)} target="_blank" rel="noreferrer">
            <Icon name="file" size={18} />
            {pronto === false ? "Abrir PDF (gerando)" : "Abrir PDF"}
          </a>
        )}
        <LinkButton variant={concluida ? "line" : "p"} href={rotas.app.lista}>
          Voltar à lista
        </LinkButton>
      </div>
    </div>
  );
}
