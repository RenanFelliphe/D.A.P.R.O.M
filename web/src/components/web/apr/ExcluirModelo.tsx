"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
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
  /** `null` quando o perfil não vê o uso (a `api` conta mesmo assim). */
  atividades: number | null;
  osAbertas: number | null;
  /** Outros modelos publicados, para onde as atividades podem ir. */
  substitutos: { codigo: string; titulo: string }[];
}

interface Resposta {
  resultado: "excluido" | "arquivado";
  atividades: number;
  substituto: string | null;
}

/**
 * "Excluir modelo" (`DELETE /modelos-apr/{codigo}`). Modelo publicado não some: é arquivado, porque APRs, PDFs e a APR
 * offline que ainda vai chegar apontam para as versões dele. As atividades ligadas vão para o substituto escolhido ou
 * ficam sem modelo (o técnico escolhe ao abrir a APR dessas OS).
 */
export function ExcluirModelo({ codigo, publicado, rascunho, aprs, atividades, osAbertas, substitutos }: ExcluirModeloProps) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [aberta, setAberta] = useState(false);
  const [substituto, setSubstituto] = useState("");
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
      const consulta = substituto ? `?substituto=${encodeURIComponent(substituto)}` : "";
      const r = await chamar<Resposta>("DELETE", `/modelos-apr/${encodeURIComponent(codigo)}${consulta}`);
      const destino = r.atividades === 0 ? "" : r.substituto ? ` ${r.atividades} atividade(s) passaram para o ${r.substituto}.` : ` ${r.atividades} atividade(s) ficaram sem modelo.`;
      exibirAviso(`${codigo} excluído.${destino}`);
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
                Dá para restaurá-lo depois.
              </p>
            ) : (
              <p style={{ fontSize: 14.5 }}>O {codigo} nunca foi publicado: o rascunho é apagado e o código fica livre para um modelo novo.</p>
            )}
            {publicado && rascunho && <span className="small">{`O rascunho v${rascunho} é descartado.`}</span>}
            {osAbertas !== null && osAbertas > 0 && (
              <Notice tone="al" icon="alert">
                {osAbertas === 1 ? "1 OS aberta usa" : `${osAbertas} OS abertas usam`} este modelo hoje. A APR que já estiver em andamento termina no modelo
                atual; as próximas seguem o destino das atividades abaixo.
              </Notice>
            )}
            {atividades !== 0 && (
              <Field label={atividades === null ? "As atividades ligadas a ele passam para" : `As ${atividades} atividades ligadas a ele passam para`} htmlFor="substituto">
                <select id="substituto" className="select" value={substituto} onChange={(e) => setSubstituto(e.target.value)}>
                  <option value="">Nenhum modelo (o técnico escolhe ao abrir a APR)</option>
                  {substitutos.map((m) => (
                    <option key={m.codigo} value={m.codigo}>
                      {`${m.codigo} — ${m.titulo}`}
                    </option>
                  ))}
                </select>
              </Field>
            )}
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
