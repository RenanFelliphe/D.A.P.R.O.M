import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import type { ItemDoModelo, RascunhoApr, ResumoDoRascunho } from "@/lib/apr";

interface RevisaoAprProps {
  rascunho: RascunhoApr;
  resumo: ResumoDoRascunho;
  /** Reabre a pergunta (base 0) para responder ou corrigir a resposta. */
  aoAbrir: (indice: number) => void;
  aoVoltar: () => void;
  aoObservarGeral: (texto: string) => void;
  aoValidar: () => void;
  validando: boolean;
  erro: string | null;
  /** O que falta de assinatura dos participantes (`AssinaturasFaltando`). */
  assinaturas: ReactNode;
  /** Quantos participantes ainda estão sem assinatura no perfil: a validação espera por eles. */
  semAssinatura: number;
  /** A conferência dos materiais do serviço (`ConferenciaDeMateriais`); nulo quando a OS não tem lista. */
  materiais?: ReactNode;
  /** Quantos itens da lista ainda pedem algo do técnico (sem resposta, ou obrigatório levado e sem a foto): a validação espera por eles. */
  materiaisPendentes?: number;
  /** Quantos itens obrigatórios o técnico disse que não levou: a APR vai ser bloqueada. */
  obrigatoriosNaoLevados?: number;
}

/**
 * Revisão final antes de validar: o que falta (respostas, observações, assinaturas) e as observações gerais. A revisão
 * não diz se a APR vai passar: isso só se sabe ao validar, e quem diz é a `api`. O técnico não vê quais itens são
 * eliminatórios.
 */
export function RevisaoApr({
  rascunho,
  resumo,
  aoAbrir,
  aoVoltar,
  aoObservarGeral,
  aoValidar,
  validando,
  erro,
  assinaturas,
  semAssinatura,
  materiais,
  materiaisPendentes = 0,
  obrigatoriosNaoLevados = 0,
}: RevisaoAprProps) {
  const { perguntas, naSemObservacao, semResposta } = resumo;
  const indiceDe = (item: ItemDoModelo) => perguntas.indexOf(item);

  return (
    <>
      <div className="card stack g6" data-treino="ck-revisao">
        <h2 style={{ fontSize: 17, fontWeight: 600 }}>Revisão da APR</h2>
        <p className="muted">
          {resumo.respondidas} de {perguntas.length} perguntas respondidas. Depois de validada, a APR não pode ser alterada; se reprovar,
          ela já fica registrada.
        </p>
      </div>

      {semResposta.length > 0 && (
        <>
          <Notice tone="al" icon="alert">
            <strong>
              {semResposta.length} {semResposta.length > 1 ? "perguntas sem resposta." : "pergunta sem resposta."}
            </strong>{" "}
            A APR é respondida por inteiro.
          </Notice>
          <div className="answered">
            {semResposta.map((item) => (
              <div key={item.id} className="ans-row">
                <span className="n">{indiceDe(item) + 1}</span>
                <span className="t">{item.texto}</span>
                <Button variant="line" sm style={{ height: 36, fontSize: 13 }} onClick={() => aoAbrir(indiceDe(item))}>
                  Responder
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      {naSemObservacao.length > 0 && (
        <>
          <Notice tone="al" icon="alert">
            <strong>NA exige observação.</strong> Explique o motivo em {naSemObservacao.length} {naSemObservacao.length > 1 ? "itens" : "item"}.
          </Notice>
          <div className="answered">
            {naSemObservacao.map((item) => (
              <div key={item.id} className="ans-row">
                <span className="n">{indiceDe(item) + 1}</span>
                <span className="t">{item.texto}</span>
                <Button variant="line" sm style={{ height: 36, fontSize: 13 }} onClick={() => aoAbrir(indiceDe(item))}>
                  Abrir
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      {materiais}

      {obrigatoriosNaoLevados > 0 && (
        <Notice tone="al" icon="alert">
          <strong>A APR será bloqueada.</strong> {obrigatoriosNaoLevados} {obrigatoriosNaoLevados > 1 ? "itens obrigatórios não foram levados" : "item obrigatório não foi levado"}. Se
          você estiver com {obrigatoriosNaoLevados > 1 ? "eles" : "ele"}, volte e envie a foto.
        </Notice>
      )}

      <div className="card stack g8">
        <Field label="Observações (opcional)" htmlFor="obs-geral">
          <textarea
            className="textarea"
            id="obs-geral"
            rows={3}
            placeholder="Algo mais que precise ficar registrado nesta APR"
            value={rascunho.observacaoGeral}
            onChange={(evento) => aoObservarGeral(evento.target.value)}
          />
        </Field>
      </div>

      {assinaturas}

      {erro && (
        <Notice tone="blq" icon="alert">
          {erro}
        </Notice>
      )}

      <div className="nav2" style={{ maxWidth: 560 }}>
        <Button variant="line" onClick={aoVoltar} disabled={validando}>
          Voltar
        </Button>
        <Button variant="p" disabled={!resumo.completo || semAssinatura > 0 || materiaisPendentes > 0 || validando} onClick={aoValidar} data-treino="ck-concluir">
          {validando ? "Validando…" : "Concluir e validar"}
        </Button>
      </div>
      {(!resumo.completo || semAssinatura > 0 || materiaisPendentes > 0) && (
        <p className="small">
          {semResposta.length > 0 && `Faltam respostas em ${semResposta.length} ${semResposta.length > 1 ? "itens" : "item"}. `}
          {naSemObservacao.length > 0 && `Falta observação em ${naSemObservacao.length} item(ns) com NA. `}
          {materiaisPendentes > 0 && `Falta conferir ${materiaisPendentes} ${materiaisPendentes > 1 ? "materiais" : "material"} do serviço. `}
          {semAssinatura > 0 && `Falta a assinatura de ${semAssinatura} ${semAssinatura > 1 ? "participantes" : "participante"}.`}
        </p>
      )}
    </>
  );
}
