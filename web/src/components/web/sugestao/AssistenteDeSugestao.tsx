"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { ErroDeEnvio, useFormulario, useValorDoForm } from "@/components/ui/useFormulario";
import type { MaterialDoServico } from "@/lib/catalogo";
import { chamar } from "@/lib/cliente-api";
import { rotas } from "@/lib/rotas";
import {
  diferencaDeListas,
  itemDoServico,
  itemParaComparar,
  itemParaEnvio,
  lerQuantidade,
  MAX_CARACTERES_DO_MOTIVO,
  MAX_ITENS_DA_SUGESTAO,
  MIN_CARACTERES_DO_MOTIVO,
  totalDeMudancas,
  type EquipeDoServico,
  type ItemEmEdicao,
  type Sugestao,
  type TipoDeSugestao,
} from "@/lib/sugestao-materiais";
import { useToast } from "@/state/toast";
import { DiferencaDeListas } from "./DiferencaDeListas";
import { EditorDaLista } from "./EditorDaLista";
import { destinoDaSugestao } from "./ListaDeEquipes";

const esquemaDoItem = z.object({
  chave: z.string(),
  material_id: z.string().nullable(),
  codigo: z.string().nullable(),
  descricao: z.string(),
  unidade: z.string(),
  categoria: z.enum(["material", "ferramenta", "epi"]),
  quantidade: z.string(),
  observacao: z.string().max(200, "A observação pode ter até 200 caracteres."),
  ativo: z.boolean(),
});

/** O formulário do assistente: a lista em edição, o motivo e, na contestação, se a pessoa quer sugerir a lista certa. */
function criarEsquema(tipo: TipoDeSugestao, atual: MaterialDoServico[]) {
  const base = atual.map((m) => ({ material_id: m.material_id, descricao: m.descricao, unidade: m.unidade, quantidade: m.quantidade, observacao: m.observacao }));
  return z
    .object({
      itens: z.array(esquemaDoItem).max(MAX_ITENS_DA_SUGESTAO, `A lista pode ter até ${MAX_ITENS_DA_SUGESTAO} itens.`),
      motivo: z.string().max(MAX_CARACTERES_DO_MOTIVO, `O motivo pode ter até ${MAX_CARACTERES_DO_MOTIVO} caracteres.`),
      comLista: z.boolean(),
    })
    .superRefine((v, ctx) => {
      if (tipo === "contestacao" && v.motivo.trim().length < MIN_CARACTERES_DO_MOTIVO) {
        ctx.addIssue({ code: "custom", path: ["motivo"], message: `Explique por que a lista está errada, em pelo menos ${MIN_CARACTERES_DO_MOTIVO} caracteres.` });
      }
      if (tipo === "sugestao" || v.comLista) {
        if (v.itens.length === 0) return ctx.addIssue({ code: "custom", path: ["itens"], message: "Inclua ao menos um item na lista." });
        let invalida = false;
        v.itens.forEach((i, k) => {
          if (Number.isNaN(lerQuantidade(i.quantidade))) {
            invalida = true;
            ctx.addIssue({ code: "custom", path: ["itens", k, "quantidade"], message: `${i.descricao}: a quantidade precisa ser um número maior que zero, ou ficar vazia.` });
          }
        });
        if (!invalida && totalDeMudancas(diferencaDeListas(base, v.itens.map(itemParaComparar))) === 0) {
          ctx.addIssue({ code: "custom", path: ["itens"], message: "A lista está igual à atual do serviço. Mude alguma coisa para sugerir." });
        }
      }
    });
}

interface Etapa {
  id: "lista" | "motivo" | "revisao";
  rotulo: string;
}

const ETAPAS_DA_SUGESTAO: Etapa[] = [
  { id: "lista", rotulo: "A lista" },
  { id: "motivo", rotulo: "O motivo" },
  { id: "revisao", rotulo: "Revisão" },
];
const ETAPAS_DA_CONTESTACAO: Etapa[] = [
  { id: "motivo", rotulo: "O motivo" },
  { id: "lista", rotulo: "A lista certa" },
  { id: "revisao", rotulo: "Revisão" },
];

/**
 * A sugestão de lista e a contestação da lista recomendada, em etapas. Sugestão: a lista (a partir da atual), o motivo (opcional) e a
 * revisão. Contestação: o motivo (obrigatório), a lista certa (opcional) e a revisão. A revisão mostra o que muda e para quem a
 * sugestão vai; só ali ela é enviada.
 */
export function AssistenteDeSugestao({
  tipo,
  codigo,
  descricao,
  atual,
  equipes,
}: {
  tipo: TipoDeSugestao;
  codigo: string;
  descricao: string;
  atual: MaterialDoServico[];
  equipes: EquipeDoServico[];
}) {
  const router = useRouter();
  const exibirAviso = useToast();
  const etapas = tipo === "sugestao" ? ETAPAS_DA_SUGESTAO : ETAPAS_DA_CONTESTACAO;
  const [etapa, setEtapa] = useState(0);
  const esquema = useMemo(() => criarEsquema(tipo, atual), [tipo, atual]);
  const { form, ref, enviar, enviando, erroEnvio, limparErroEnvio } = useFormulario(esquema, { itens: atual.map(itemDoServico), motivo: "", comLista: false });
  const { register, formState, watch } = form;
  const [itens, definirItens] = useValorDoForm(form, "itens");
  const comLista = watch("comLista");
  const motivo = watch("motivo");
  const erros = formState.errors;
  const erroDaLista = erros.itens?.message ?? erros.itens?.root?.message ?? (erros.itens as { message?: string }[] | undefined)?.find?.((e) => e?.message)?.message;
  const erroDeItem = Array.isArray(erros.itens) ? (erros.itens as { quantidade?: { message?: string } }[]).map((e) => e?.quantidade?.message).find(Boolean) : undefined;

  const atualEtapa = etapas[etapa]!;
  const ultima = etapa === etapas.length - 1;
  const temLista = tipo === "sugestao" || comLista;
  const mudancas = useMemo(
    () => diferencaDeListas(atual.map((m) => ({ material_id: m.material_id, descricao: m.descricao, unidade: m.unidade, quantidade: m.quantidade, observacao: m.observacao })), itens.map((i) => itemParaComparar(i as ItemEmEdicao))),
    [atual, itens],
  );

  async function avancar() {
    limparErroEnvio();
    const campos = atualEtapa.id === "lista" ? (["itens"] as const) : atualEtapa.id === "motivo" ? (["motivo"] as const) : [];
    // A lista só vale quando a pessoa a quer (a contestação sem lista passa direto).
    const valido = atualEtapa.id === "lista" && !temLista ? true : await form.trigger(campos as never);
    if (valido) setEtapa((e) => Math.min(e + 1, etapas.length - 1));
  }

  const enviarSugestao = enviar(async (v) => {
    const resposta = await chamar<Sugestao>("POST", "/sugestoes-materiais", {
      atividade: codigo,
      tipo,
      motivo: v.motivo.trim() || null,
      lista: temLista ? v.itens.map((i) => itemParaEnvio(i as ItemEmEdicao)) : null,
    });
    exibirAviso(tipo === "sugestao" ? "Sugestão enviada. Você ganha pontos se ela for aceita." : "Contestação enviada ao supervisor.");
    router.push(rotas.app.sugestaoDeMateriais(codigo, resposta.id));
    router.refresh();
  });

  return (
    <form
      ref={ref}
      noValidate
      className="sg-assistente"
      onSubmit={(e) => {
        if (!ultima) {
          e.preventDefault();
          void avancar();
          return;
        }
        void enviarSugestao(e);
      }}
    >
      <ol className="sg-etapas" aria-label="Etapas">
        {etapas.map((e, i) => (
          <li key={e.id} aria-current={i === etapa ? "step" : undefined} className={i < etapa ? "feita" : i === etapa ? "atual" : undefined}>
            <span className="sg-etapa-num" aria-hidden="true">
              {i < etapa ? <Icon name="check" size={13} /> : i + 1}
            </span>
            <span>{e.rotulo}</span>
          </li>
        ))}
      </ol>

      <div className="panel sg-etapa-corpo stack g16">
        {atualEtapa.id === "lista" && (
          <>
            <div className="stack g4">
              <h2 className="sg-etapa-titulo">{tipo === "sugestao" ? "Monte a lista que o serviço leva" : "Qual seria a lista certa?"}</h2>
              <p className="muted small">
                {tipo === "sugestao"
                  ? "Você começa pela lista atual do serviço: tire o que sobra, ajuste as quantidades e inclua o que falta."
                  : "Se você sabe como a lista deve ficar, monte-a abaixo. O supervisor decide com a sua lista na mão."}
              </p>
            </div>
            {tipo === "contestacao" && (
              <label className="row g8 sg-opcao">
                <input type="checkbox" {...register("comLista")} />
                <span>
                  <strong>Quero sugerir a lista certa</strong>
                  <span className="small muted" style={{ display: "block" }}>
                    Opcional. Sem ela, o supervisor informa a lista nova se concordar com a contestação.
                  </span>
                </span>
              </label>
            )}
            {temLista ? (
              <EditorDaLista idBase={`sg-${tipo}`} itens={itens as ItemEmEdicao[]} aoMudar={(novos) => definirItens(novos)} erro={erroDaLista ?? erroDeItem} />
            ) : (
              <Notice tone="info" icon="info">
                Tudo certo: a contestação vai só com o motivo. Pode continuar.
              </Notice>
            )}
          </>
        )}

        {atualEtapa.id === "motivo" && (
          <>
            <div className="stack g4">
              <h2 className="sg-etapa-titulo">{tipo === "sugestao" ? "Por que mudar a lista?" : "Por que a lista está errada?"}</h2>
              <p className="muted small">
                {tipo === "sugestao"
                  ? "Opcional, mas ajuda o supervisor a decidir: o que aconteceu em campo, qual item faltou."
                  : "Obrigatório. Diga o que está errado na lista de materiais recomendada, para o supervisor poder avaliar."}
              </p>
            </div>
            <Field label={tipo === "sugestao" ? "Motivo (opcional)" : "Motivo da contestação"} htmlFor="sg-motivo" erro={erros.motivo?.message}>
              <textarea
                className="textarea"
                rows={5}
                maxLength={MAX_CARACTERES_DO_MOTIVO}
                placeholder={tipo === "sugestao" ? "Ex.: Sem o detector de gases não dá para liberar a área." : "Ex.: A luva de vaqueta não resiste ao produto usado neste serviço."}
                {...register("motivo")}
                {...ligarAoErro("sg-motivo", erros.motivo?.message)}
              />
            </Field>
            <span className="small muted">
              {motivo.trim().length} de {MAX_CARACTERES_DO_MOTIVO} caracteres{tipo === "contestacao" ? ` (mínimo ${MIN_CARACTERES_DO_MOTIVO})` : ""}
            </span>
          </>
        )}

        {atualEtapa.id === "revisao" && (
          <>
            <div className="stack g4">
              <h2 className="sg-etapa-titulo">Revise e envie</h2>
              <p className="muted small">Confira o que vai para o supervisor. Depois de enviar, você pode retirar a {tipo === "sugestao" ? "sugestão" : "contestação"} enquanto ninguém avaliou.</p>
            </div>
            <Notice tone="info" icon="users">
              {destinoDaSugestao(equipes)} Você é avisado quando houver resposta.
            </Notice>
            <dl className="dl d2">
              <div>
                <dt>Serviço</dt>
                <dd>
                  <span className="mono">{codigo}</span> · {descricao}
                </dd>
              </div>
              <div>
                <dt>Tipo</dt>
                <dd>{tipo === "sugestao" ? "Sugestão de lista" : "Contestação da lista recomendada"}</dd>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <dt>Motivo</dt>
                <dd>{motivo.trim() || <span className="muted">Não informado</span>}</dd>
              </div>
            </dl>
            {temLista ? (
              <div className="stack g8">
                <h3 className="sg-sub">O que muda na lista</h3>
                <DiferencaDeListas mudancas={mudancas} />
              </div>
            ) : (
              <Notice tone="al" icon="alert">
                Você não sugeriu uma lista. Se o supervisor concordar com a contestação, ele mesmo informa a lista nova.
              </Notice>
            )}
            <p className="small muted">Se for aceita, a {tipo === "sugestao" ? "sugestão" : "contestação"} rende pontos na regra Colaboração. Só a aceitação pontua, não o envio.</p>
          </>
        )}

        <ErroDeEnvio mensagem={erroEnvio} />
        <div className="row g8 wrap sg-botoes">
          {etapa > 0 && (
            <Button
              variant="line"
              onClick={() => {
                limparErroEnvio();
                setEtapa(etapa - 1);
              }}
              disabled={enviando}
            >
              <Icon name="left" size={16} />
              Voltar
            </Button>
          )}
          {ultima ? (
            <Button variant="p" type="submit" aria-busy={enviando} disabled={enviando}>
              {enviando ? "Enviando…" : tipo === "sugestao" ? "Enviar sugestão" : "Enviar contestação"}
            </Button>
          ) : (
            <Button variant="p" onClick={() => void avancar()}>
              Continuar
              <Icon name="right" size={16} />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
