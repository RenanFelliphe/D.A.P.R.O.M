"use client";

import { useEffect } from "react";
import { Colunas } from "@/components/app/AppChrome";
import { AtalhosChecklist } from "@/components/app/checklist/AtalhosChecklist";
import { ChecklistCabecalho } from "@/components/app/checklist/ChecklistCabecalho";
import { EvidenciaCard } from "@/components/app/checklist/EvidenciaCard";
import { GradePerguntas } from "@/components/app/checklist/GradePerguntas";
import { NavegacaoChecklist } from "@/components/app/checklist/NavegacaoChecklist";
import { PerguntaCard } from "@/components/app/checklist/PerguntaCard";
import { ProgressoChecklist } from "@/components/app/checklist/ProgressoChecklist";
import { RevisaoApr } from "@/components/app/checklist/RevisaoApr";
import { Screen } from "@/components/ui/Screen";
import { perguntasApr03 } from "@/data/checklist";
import { estaReprovada, podeAvancar, totalPerguntas, totalRespondidas } from "@/lib/checklist";
import { useChecklist } from "@/state/checklist";

/**
 * Checklist da APR: responde-se tudo e só se valida no fim. Mostra uma pergunta por vez
 * (com evidência quando a resposta reprova) e, depois da última, a revisão final.
 */
export function ChecklistScreen() {
  const checklist = useChecklist();
  const { estado } = checklist;

  // Ao entrar na revisão (ou voltar dela), a página volta ao topo.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [estado.modo]);

  const respondidas = totalRespondidas(estado);
  const revisando = estado.modo === "revisao";
  const pergunta = perguntasApr03[estado.indice];

  return (
    <Screen>
      <ChecklistCabecalho />
      <ProgressoChecklist
        titulo={revisando ? `Revisão · ${respondidas} de ${totalPerguntas}` : `Pergunta ${estado.indice + 1} de ${totalPerguntas}`}
        secao={revisando ? "Antes de validar" : pergunta.secao}
        respondidas={respondidas}
        total={totalPerguntas}
      />
      <Colunas
        principal={
          revisando ? (
            <RevisaoApr
              estado={estado}
              aoAbrir={checklist.irPara}
              aoVoltar={checklist.voltarDaRevisao}
              aoValidar={checklist.validar}
            />
          ) : (
            <>
              <PerguntaCard
                numero={estado.indice + 1}
                pergunta={pergunta}
                resposta={estado.respostas[estado.indice]}
                aoResponder={checklist.responder}
              />
              {estaReprovada(estado, estado.indice) && (
                <EvidenciaCard
                  pergunta={pergunta}
                  observacao={estado.observacoes[estado.indice] ?? ""}
                  comFoto={Boolean(estado.fotos[estado.indice])}
                  aoObservar={checklist.observar}
                  aoAnexarFoto={checklist.anexarFoto}
                />
              )}
              <NavegacaoChecklist
                indice={estado.indice}
                total={totalPerguntas}
                podeAvancar={podeAvancar(estado)}
                aoVoltar={checklist.anterior}
                aoAvancar={checklist.proxima}
              />
            </>
          )
        }
        lateral={
          <>
            {!revisando && (
              <GradePerguntas
                total={totalPerguntas}
                atual={estado.indice}
                respondida={(i) => estado.respostas[i] !== undefined}
                aoSelecionar={checklist.irPara}
              />
            )}
            <AtalhosChecklist
              aoIrParaPergunta9={checklist.atalhoPergunta9}
              aoResponderResto={checklist.atalhoResponderResto}
            />
          </>
        }
      />
    </Screen>
  );
}
