"use client";

import { useState } from "react";
import { CabecalhoPagina, Colunas, PainelAcoes } from "@/components/app/AppChrome";
import { AssinaturasExecutantes } from "@/components/app/execucao/AssinaturasExecutantes";
import { FotosExecucao } from "@/components/app/execucao/FotosExecucao";
import { ResumoTempo } from "@/components/app/execucao/ResumoTempo";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Field, Req } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { bloqueios } from "@/data/bloqueio";
import { rotas } from "@/lib/telas";
import { useChecklist } from "@/state/checklist";
import { useSincronizacao } from "@/state/sincronizacao";
import { useToast } from "@/state/toast";

/**
 * Execução da OS. Pausar é diferente de interromper: a pausa só para o relógio líquido,
 * e a interrupção por risco leva ao bloqueio da OS (nova APR para retomar).
 */
export function ExecucaoScreen() {
  const exibirAviso = useToast();
  const { definirBloqueio } = useChecklist();
  const { reiniciar: reiniciarSincronizacao } = useSincronizacao();
  const [emPausa, setEmPausa] = useState(false);

  function alternarPausa() {
    exibirAviso(
      emPausa
        ? "Execução retomada às 10:27. Pausa de 12 min registrada."
        : "Pausa registrada às 10:15. Conta à parte do tempo líquido.",
    );
    setEmPausa(!emPausa);
  }

  return (
    <Screen>
      <CabecalhoPagina
        trilha={[
          { rotulo: "OS da equipe", href: rotas.app.lista },
          { rotulo: <span className="mono">OS 4031187</span>, href: rotas.app.detalhe },
          { rotulo: "Execução" },
        ]}
      >
        <div className="row wrap g8">
          <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
            OS 4031187
          </span>
          <Badge tone={emPausa ? "al" : "exe"}>{emPausa ? "Em pausa" : "Em execução"}</Badge>
        </div>
        <h1>Execução da OS</h1>
        <span className="muted">ERP Serra · APR aprovada às 09:24</span>
      </CabecalhoPagina>
      <Colunas
        principal={
          <>
            <div className="panel">
              <Field
                label={
                  <>
                    Descrição da atividade <Req style={{ color: "var(--exe)" }}>· obrigatória</Req>
                  </>
                }
                htmlFor="descricao"
              >
                <textarea
                  className="textarea"
                  id="descricao"
                  rows={4}
                  defaultValue="Inspecionadas as 12 válvulas. Corrosão superficial em V-104 e V-109, tratada com inibidor. Demais válvulas sem anomalias."
                />
              </Field>
            </div>
            <div className="panel">
              <FotosExecucao />
            </div>
            <div className="panel">
              <AssinaturasExecutantes />
            </div>
          </>
        }
        lateral={
          <>
            <ResumoTempo emPausa={emPausa} />
            <PainelAcoes>
              <p className="small">
                Ao encerrar, a OS fica “Encerrada · aguardando envio” até a próxima sincronização. O supervisor dá ciência
                no painel.
              </p>
              <LinkButton
                variant="p"
                block
                href={rotas.app.sync}
                aviso="OS encerrada. Registro na fila do aparelho."
                onClick={reiniciarSincronizacao}
              >
                <Icon name="check" size={18} />
                Encerrar OS
              </LinkButton>
              <div className="nav2">
                <Button variant="line" onClick={alternarPausa}>
                  <Icon name={emPausa ? "play" : "pause"} size={18} />
                  <span>{emPausa ? "Continuar" : "Pausar"}</span>
                </Button>
                <LinkButton
                  variant="od"
                  href={rotas.app.bloqueio}
                  style={{ fontSize: 14 }}
                  onClick={() => definirBloqueio(bloqueios.interrupcao)}
                >
                  Interromper por risco
                </LinkButton>
              </div>
            </PainelAcoes>
          </>
        }
      />
    </Screen>
  );
}
