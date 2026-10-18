import { useMemo, type ReactNode } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Field, MensagemDeErro } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { ErroDeEnvio, useFormulario, useRevalidarQuando } from "@/components/ui/useFormulario";
import type { ItemDoModelo, RascunhoApr, ResumoDoRascunho } from "@/lib/apr";

interface RevisaoAprProps {
  rascunho: RascunhoApr;
  resumo: ResumoDoRascunho;
  /** Reabre a pergunta (base 0) para responder ou corrigir a resposta. */
  aoAbrir: (indice: number) => void;
  aoVoltar: () => void;
  aoObservarGeral: (texto: string) => void;
  /** Valida na `api` e registra a APR; uma falha é lançada e aparece acima do botão. */
  aoValidar: () => Promise<void>;
  /** O que falta de assinatura dos participantes (`AssinaturasFaltando`). */
  assinaturas: ReactNode;
  /** Quantos participantes ainda estão sem assinatura no perfil: a validação espera por eles. */
  semAssinatura: number;
  /** Os materiais recomendados do serviço (`MateriaisRecomendados`), só para consulta; nulo quando a OS não tem lista. */
  materiais?: ReactNode;
}

/**
 * Revisão final antes de validar: o que falta (respostas, observações, assinaturas) e as observações gerais. A revisão
 * não diz se a APR vai passar: isso só se sabe ao validar, e quem diz é a `api`. O técnico não vê quais itens são
 * eliminatórios. O botão de validar não fica desativado: faltando algo, a mensagem aparece acima dele e junto do que falta, e o
 * foco vai para lá.
 */
export function RevisaoApr({
  rascunho,
  resumo,
  aoAbrir,
  aoVoltar,
  aoObservarGeral,
  aoValidar,
  assinaturas,
  semAssinatura,
  materiais,
}: RevisaoAprProps) {
  const { perguntas, naSemObservacao, semResposta } = resumo;
  const indiceDe = (item: ItemDoModelo) => perguntas.indexOf(item);

  // O que impede de validar vira mensagem de erro (ao tentar), cada uma no bloco do que falta.
  const nSemResposta = semResposta.length;
  const nNaSemObservacao = naSemObservacao.length;
  const esquema = useMemo(
    () =>
      z
        .object({ observacaoGeral: z.string(), semResposta: z.string().optional(), naSemObservacao: z.string().optional(), assinaturas: z.string().optional() })
        .superRefine((_, ctx) => {
          if (nSemResposta > 0) {
            ctx.addIssue({ code: "custom", path: ["semResposta"], message: `Responda ${nSemResposta === 1 ? "a pergunta que falta" : `as ${nSemResposta} perguntas que faltam`}: a APR é respondida por inteiro.` });
          }
          if (nNaSemObservacao > 0) {
            ctx.addIssue({ code: "custom", path: ["naSemObservacao"], message: `Explique o motivo do NA em ${nNaSemObservacao === 1 ? "1 item" : `${nNaSemObservacao} itens`}.` });
          }
          if (semAssinatura > 0) {
            ctx.addIssue({
              code: "custom",
              path: ["assinaturas"],
              message: `Falta a assinatura no perfil de ${semAssinatura} ${semAssinatura > 1 ? "participantes" : "participante"}: cadastre-a ou retire a pessoa da APR.`,
            });
          }
        }),
    [nSemResposta, nNaSemObservacao, semAssinatura],
  );
  const { form, ref, enviar, enviando, erroEnvio } = useFormulario(esquema, { observacaoGeral: rascunho.observacaoGeral });
  useRevalidarQuando(form, esquema);
  const erros = form.formState.errors;
  const mensagens = [erros.semResposta?.message, erros.naSemObservacao?.message, erros.assinaturas?.message].filter(Boolean) as string[];

  return (
    <form ref={ref} noValidate onSubmit={enviar(() => aoValidar())} className="stack g12">
      <div className="card stack g6" data-treino="ck-revisao">
        <h2 style={{ fontSize: 17, fontWeight: 600 }}>Revisão da APR</h2>
        <p className="muted">
          {resumo.respondidas} de {perguntas.length} perguntas respondidas. Depois de validada, a APR não pode ser alterada; se reprovar,
          ela já fica registrada.
        </p>
      </div>

      {semResposta.length > 0 && (
        <div className="stack g8" data-erro={erros.semResposta ? "" : undefined}>
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
        </div>
      )}

      {naSemObservacao.length > 0 && (
        <div className="stack g8" data-erro={erros.naSemObservacao ? "" : undefined}>
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
        </div>
      )}

      {materiais}

      <div className="card stack g8">
        <Field label="Observações (opcional)" htmlFor="obs-geral">
          <textarea
            className="textarea"
            id="obs-geral"
            rows={3}
            placeholder="Algo mais que precise ficar registrado nesta APR"
            {...form.register("observacaoGeral", { onChange: (evento) => aoObservarGeral(evento.target.value) })}
          />
        </Field>
      </div>

      <div data-erro={erros.assinaturas ? "" : undefined}>{assinaturas}</div>

      {mensagens.length > 0 && (
        <div className="stack g6" role="alert">
          <strong style={{ color: "var(--blq)" }}>Ainda não dá para validar a APR:</strong>
          {mensagens.map((m) => (
            <MensagemDeErro key={m}>{m}</MensagemDeErro>
          ))}
        </div>
      )}
      <ErroDeEnvio mensagem={erroEnvio} />

      <div className="nav2" style={{ maxWidth: 560 }}>
        <Button variant="line" onClick={aoVoltar} disabled={enviando}>
          Voltar
        </Button>
        <Button type="submit" variant="p" disabled={enviando} aria-busy={enviando} data-treino="ck-concluir">
          {enviando ? "Validando…" : "Concluir e validar"}
        </Button>
      </div>
    </form>
  );
}
