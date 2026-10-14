"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { JanelaModal } from "@/components/web/JanelaModal";
import { chamar } from "@/lib/cliente-api";
import { rotas } from "@/lib/rotas";
import { useToast } from "@/state/toast";

interface ExcluirModeloProps {
  codigo: string;
  /** Já teve versão publicada: a exclusão arquiva em vez de apagar. */
  publicado: boolean;
  /** Versão do rascunho, que é descartado junto. */
  rascunho?: number;
  aprs: number;
}

interface Resposta {
  codigo: string;
  resultado: "excluido" | "arquivado";
}

/**
 * "Excluir modelo" (`DELETE /modelos-apr/{codigo}`). Modelo publicado não some: é arquivado, com a orientação, porque APRs,
 * PDFs e a APR offline que ainda vai chegar apontam para as versões dele. O que nunca foi publicado sai de vez.
 */
export function ExcluirModelo({ codigo, publicado, rascunho, aprs }: ExcluirModeloProps) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [aberta, setAberta] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function fechar() {
    setAberta(false);
    setErro(null);
  }

  async function excluir() {
    setOcupado(true);
    setErro(null);
    try {
      const r = await chamar<Resposta>("DELETE", `/modelos-apr/${encodeURIComponent(codigo)}`);
      exibirAviso(r.resultado === "arquivado" ? `${codigo} excluído. As versões ficam guardadas para o histórico.` : `${codigo} excluído.`);
      router.push(rotas.web.modelos);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível excluir o modelo");
      setOcupado(false);
    }
  }

  return (
    <>
      <Button variant="od" sm onClick={() => setAberta(true)}>
        <Icon name="x" size={16} />
        Excluir modelo
      </Button>
      {aberta && (
        <JanelaModal titulo={`Excluir ${codigo}`} aoFechar={fechar}>
          <div className="stack g12">
            {publicado ? (
              <p style={{ fontSize: 14.5 }}>
                O {codigo} sai da lista de modelos e deixa de ser oferecido nas APRs novas, inclusive no modo offline.{" "}
                {aprs > 0
                  ? `As ${aprs} APRs respondidas nele continuam ligadas à versão que usaram, e o PDF delas não muda.`
                  : "As versões publicadas ficam guardadas para o histórico."}{" "}
                Dá para restaurá-lo depois, com a orientação.
              </p>
            ) : (
              <p style={{ fontSize: 14.5 }}>O {codigo} nunca foi publicado: o rascunho e a orientação são apagados e o código fica livre para um modelo novo.</p>
            )}
            {publicado && rascunho && <span className="small">{`O rascunho v${rascunho} é descartado.`}</span>}
            {erro && (
              <Notice tone="blq" icon="alert">
                {erro}
              </Notice>
            )}
            <div className="row g8" style={{ justifyContent: "flex-end" }}>
              <Button variant="line" sm onClick={fechar} disabled={ocupado}>
                Cancelar
              </Button>
              <Button variant="d" sm onClick={excluir} disabled={ocupado}>
                {ocupado ? "Excluindo…" : `Excluir ${codigo}`}
              </Button>
            </div>
          </div>
        </JanelaModal>
      )}
    </>
  );
}
