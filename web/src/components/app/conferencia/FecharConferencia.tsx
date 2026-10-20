"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAcao } from "@/components/app/execucao/useAcao";
import { Button } from "@/components/ui/Button";
import { JanelaSobreposta } from "@/components/ui/JanelaSobreposta";
import { ErroDeEnvio } from "@/components/ui/useFormulario";
import { chamar } from "@/lib/cliente-api";
import { quemFalta, type ConferenciaDaApi } from "@/lib/conferencia";
import { dataHora } from "@/lib/formatar";
import { useToast } from "@/state/toast";

/** Junta nomes numa frase: "Ana, Bia e Caio". */
const lista = (nomes: string[]) => (nomes.length <= 1 ? (nomes[0] ?? "") : `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`);

/**
 * "Fechar com o que existe": a partir de 72 horas o responsável ou o supervisor segue sem quem faltou (sincronizar, escolher ou assinar).
 * A janela explica o que isso faz antes de confirmar: onde ninguém escolheu vale o padrão sugerido. `POST /conferencias/{id}/fechar`.
 */
export function FecharConferencia({ conferencia }: { conferencia: Pick<ConferenciaDaApi, "id" | "participantes" | "libera_fechar_em"> }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const { ocupado, erro, limparErro, executar } = useAcao();
  const [aberta, setAberta] = useState(false);
  const falta = quemFalta(conferencia);
  const quem = [...new Set([...falta.sincronizar, ...falta.assinar])];

  const fechar = () =>
    executar(async () => {
      await chamar("POST", `/conferencias/${conferencia.id}/fechar`, {});
      exibirAviso("Conferência fechada com o que existe");
      setAberta(false);
      router.refresh();
    });

  return (
    <>
      <Button
        variant="line"
        block
        onClick={() => {
          limparErro();
          setAberta(true);
        }}
      >
        Fechar com o que existe
      </Button>
      <span className="small muted">Liberado desde {dataHora(conferencia.libera_fechar_em)}: já passaram 72 horas desde a abertura da conferência.</span>
      {aberta && (
        <JanelaSobreposta titulo="Fechar com o que existe" aoFechar={ocupado ? () => undefined : () => setAberta(false)}>
          <div className="stack g12">
            <p>
              A conferência segue <strong>sem {quem.length > 0 ? lista(quem) : "quem faltou"}</strong>. Onde ninguém escolheu a versão certa, vale o padrão sugerido pelo sistema. Ela
              fica registrada como fechada com o que existia, com o nome de quem faltou.
            </p>
            <ErroDeEnvio mensagem={erro?.mensagem ?? null} />
            <div className="row g8 wrap">
              <Button variant="d" onClick={() => void fechar()} disabled={ocupado} aria-busy={ocupado}>
                {ocupado ? "Fechando…" : "Fechar com o que existe"}
              </Button>
              <Button variant="ghost" onClick={() => setAberta(false)} disabled={ocupado}>
                Voltar
              </Button>
            </div>
          </div>
        </JanelaSobreposta>
      )}
    </>
  );
}
