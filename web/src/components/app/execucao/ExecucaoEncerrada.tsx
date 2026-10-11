"use client";

import { useEffect, useState } from "react";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { chamar } from "@/lib/cliente-api";
import { rotas, urlDoPdf } from "@/lib/rotas";

const TENTATIVAS = 10;

/**
 * Tela de sucesso. A `api` gera o PDF em segundo plano: aqui a OS é consultada algumas vezes até o PDF ficar pronto e, enquanto
 * isso, o link já funciona (`GET /os/{id}/pdf` gera na hora se a OS está encerrada).
 */
export function ExecucaoEncerrada({ osId, jaEncerrada }: { osId: string; jaEncerrada?: boolean }) {
  const [pronto, setPronto] = useState<boolean | null>(null);

  useEffect(() => {
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
    temporizador = setTimeout(consultar, jaEncerrada ? 0 : 1500);
    return () => {
      ativo = false;
      clearTimeout(temporizador);
    };
  }, [osId, jaEncerrada]);

  return (
    <div className="panel stack g12" style={{ maxWidth: 560 }}>
      <h2>{jaEncerrada ? "OS já encerrada" : "Encerrada"}</h2>
      <Notice tone="ok" icon="check">
        {jaEncerrada ? "Esta OS já foi encerrada." : "A OS foi encerrada e o supervisor dá ciência no painel."}{" "}
        {pronto === false ? "O PDF está sendo gerado; ao abrir, ele é preparado na hora." : pronto ? "O PDF da OS está pronto." : ""}
      </Notice>
      <div className="row g8 wrap">
        <a className="btn btn-p" href={urlDoPdf(osId)} target="_blank" rel="noreferrer">
          <Icon name="file" size={18} />
          {pronto === false ? "Abrir PDF (gerando)" : "Abrir PDF"}
        </a>
        <LinkButton variant="line" href={rotas.app.lista}>
          Voltar à lista
        </LinkButton>
      </div>
    </div>
  );
}
