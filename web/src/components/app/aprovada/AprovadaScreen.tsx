"use client";

import { useState, type MouseEvent } from "react";
import { AssinaturaCard } from "@/components/app/aprovada/AssinaturaCard";
import { CabecalhoPagina, Colunas, PainelAcoes } from "@/components/app/AppChrome";
import { LinkButton } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { assinantesApr } from "@/data/aprovada";
import { totalAlertas, totalPerguntas } from "@/lib/checklist";
import { rotas } from "@/lib/telas";
import { useChecklist } from "@/state/checklist";
import { useToast } from "@/state/toast";

/** Alerta registrado quando a APR foi validada no checklist (quantidade real de respostas de alerta). */
function AvisoAlertas({ quantidade }: { quantidade: number }) {
  const varios = quantidade > 1;
  return (
    <Notice tone="al" icon="alert">
      <strong>
        {quantidade} {varios ? "alertas registrados" : "alerta registrado"}:
      </strong>{" "}
      iluminação auxiliar necessária. Aparece no PDF e no painel, mas não bloqueia.
    </Notice>
  );
}

/**
 * APR aprovada. Quem chega direto pelo endereço vê o exemplo (18 itens às 09:24, 1 alerta);
 * quem chega do checklist vê o resultado real da validação.
 */
export function AprovadaScreen() {
  const { estado } = useChecklist();
  const exibirAviso = useToast();
  const [confirmadas, setConfirmadas] = useState([false, false]);

  const todasConfirmadas = confirmadas.every(Boolean);
  const alertas = estado.concluido ? totalAlertas(estado) : 1;

  function confirmar(indice: number) {
    setConfirmadas((atuais) => atuais.map((c, i) => c || i === indice));
  }

  function aoIniciar(evento: MouseEvent<HTMLAnchorElement>) {
    if (todasConfirmadas) return;
    evento.preventDefault();
    exibirAviso("Confirme as assinaturas dos dois participantes para iniciar.");
  }

  return (
    <Screen>
      <CabecalhoPagina
        trilha={[
          { rotulo: "OS da equipe", href: rotas.app.lista },
          { rotulo: <span className="mono">OS 4031187</span>, href: rotas.app.detalhe },
          { rotulo: "Nova APR", href: rotas.app.novaApr },
          { rotulo: "APR aprovada" },
        ]}
      >
        <h1>APR · ERP Serra</h1>
        <span className="muted">
          <span className="mono">OS 4031187 · APR 03 v4</span> · Etapa 3 de 3
        </span>
      </CabecalhoPagina>
      <div className="res-banner rb-ok">
        <span className="ic">
          <Icon name="check" size={24} />
        </span>
        <div className="stack g4">
          <h2>APR aprovada</h2>
          <p>
            {totalPerguntas} de {totalPerguntas} itens respondidos{estado.concluido ? "" : " às 09:24"}. Nenhum item
            eliminatório bloqueou.
          </p>
        </div>
      </div>
      {alertas > 0 && <AvisoAlertas quantidade={alertas} />}
      <Colunas
        principal={
          <section className="stack g8">
            <h2>Assinaturas</h2>
            <div className="nav2">
              {assinantesApr.map((assinante, i) => (
                <AssinaturaCard
                  key={assinante.pessoa}
                  assinante={assinante}
                  confirmada={confirmadas[i]}
                  aoConfirmar={() => confirmar(i)}
                />
              ))}
            </div>
          </section>
        }
        lateral={
          <PainelAcoes>
            <Field label="Número de pessoas na atividade" htmlFor="npessoas">
              <input className="input mono" id="npessoas" type="number" min={1} defaultValue={2} />
            </Field>
            <Notice tone="ok" icon="lock">
              <strong>OS 4031187 liberada para execução.</strong> A APR vale só para esta OS. Para outra OS, outra APR.
            </Notice>
            <LinkButton
              variant="p"
              block
              className={todasConfirmadas ? undefined : "is-off"}
              href={rotas.app.execucao}
              aria-disabled={!todasConfirmadas}
              tabIndex={todasConfirmadas ? undefined : -1}
              onClick={aoIniciar}
            >
              <Icon name="play" size={18} fill />
              Iniciar execução · OS 4031187
            </LinkButton>
          </PainelAcoes>
        }
      />
    </Screen>
  );
}
