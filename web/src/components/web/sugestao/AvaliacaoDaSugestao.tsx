"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, ligarAoErro, MensagemDeErro } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { ErroDeEnvio, useFormulario, useValorDoForm } from "@/components/ui/useFormulario";
import { useAvisoDePontos } from "@/components/web/gamificacao/PontosGanhos";
import { rotuloDaCategoria, type Material } from "@/lib/catalogo";
import { chamar } from "@/lib/cliente-api";
import { dataHora } from "@/lib/formatar";
import type { RespostaComPontos } from "@/lib/gamificacao";
import { rotas } from "@/lib/rotas";
import {
  diferencaDeListas,
  itemDaSugestao,
  itemDoServico,
  itemParaComparar,
  itemParaEnvio,
  lerQuantidade,
  MAX_CARACTERES_DO_MOTIVO,
  MIN_CARACTERES_DO_MOTIVO,
  rotuloDoEstadoDeSugestao,
  rotuloDoTipoDeSugestao,
  textoDaQuantidade,
  totalDeMudancas,
  type ItemDaSugestao,
  type ItemEmEdicao,
  type Sugestao,
} from "@/lib/sugestao-materiais";
import { useToast } from "@/state/toast";
import { DiferencaDeListas } from "./DiferencaDeListas";
import { EditorDaLista } from "./EditorDaLista";
import { useBuscaDeMateriais } from "./useBuscaDeMateriais";

type Resposta = Sugestao & RespostaComPontos & { lista_mudou?: boolean };

const TOM_DO_ESTADO = { pendente: "al", aceita: "enc", recusada: "blq", cancelada: "neu" } as const;

/** A resposta (opcional) de quem aceita, ou o motivo (obrigatório) de quem recusa: o mesmo campo, com regras diferentes. */
const respostaOpcional = z.string().max(MAX_CARACTERES_DO_MOTIVO, `A resposta pode ter até ${MAX_CARACTERES_DO_MOTIVO} caracteres.`);

// ---- O que fazer com cada item digitado -----------------------------------------------------------------------------

const esquemaDoAceite = z
  .object({
    resposta: respostaOpcional,
    resolucoes: z.array(z.object({ ordem: z.number(), modo: z.enum(["criar", "ligar"]), material_id: z.string().nullable(), escolhido: z.string().nullable(), rotulo: z.string() })),
  })
  .superRefine((v, ctx) => {
    v.resolucoes.forEach((r, k) => {
      if (r.modo === "ligar" && !r.material_id) ctx.addIssue({ code: "custom", path: ["resolucoes", k, "material_id"], message: `Escolha o material do catálogo para "${r.rotulo}", ou cadastre-o como novo.` });
    });
  });

/** Liga um item digitado a um material que já existe: busca no catálogo e escolhe. */
function LigarAMaterial({ id, escolhido, aoEscolher, erro }: { id: string; escolhido: string | null; aoEscolher: (m: Material | null) => void; erro?: string }) {
  const [busca, setBusca] = useState("");
  const resultados = useBuscaDeMateriais(busca);
  return (
    <div className="stack g8 sg-ligar">
      <Field label="Material do catálogo" htmlFor={id} erro={erro}>
        <input id={id} className="input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Busque pela descrição ou pelo código do SAP" autoComplete="off" onKeyDown={(e) => e.key === "Enter" && e.preventDefault()} />
      </Field>
      {escolhido && (
        <span className="small">
          <Icon name="check" size={13} /> Ligado a <strong>{escolhido}</strong>
        </span>
      )}
      {resultados !== null &&
        (resultados.length === 0 ? (
          <span className="small muted">Nenhum material ativo encontrado.</span>
        ) : (
          <ul className="busca-material">
            {resultados.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    aoEscolher(m);
                    setBusca("");
                  }}
                >
                  <span>
                    {m.descricao}
                    {m.codigo && <span className="small mono"> · {m.codigo}</span>}
                  </span>
                  <span className="small">{m.unidade}</span>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

function FormularioDeAceite({ sugestao, aoCancelar, aoConcluir }: { sugestao: Sugestao; aoCancelar: () => void; aoConcluir: (r: Resposta) => void }) {
  const livres = sugestao.itens.filter((i) => i.material_id === null);
  const { form, ref, enviar, enviando, erroEnvio } = useFormulario(esquemaDoAceite, {
    resposta: "",
    resolucoes: livres.map((i) => ({ ordem: i.ordem, modo: "criar" as const, material_id: null, escolhido: null, rotulo: i.descricao })),
  });
  const { register, formState } = form;
  const [resolucoes, definirResolucoes] = useValorDoForm(form, "resolucoes");
  const erros = formState.errors;
  const mudar = (k: number, campos: Partial<(typeof resolucoes)[number]>) => definirResolucoes(resolucoes.map((r, i) => (i === k ? { ...r, ...campos } : r)));

  return (
    <form
      ref={ref}
      noValidate
      className="stack g12 sg-acao"
      onSubmit={enviar(async (v) => {
        const r = await chamar<Resposta>("POST", `/sugestoes-materiais/${sugestao.id}/aceitar`, {
          resolucoes: v.resolucoes.map((x) => (x.modo === "ligar" ? { ordem: x.ordem, material_id: x.material_id } : { ordem: x.ordem, criar_material: true })),
          resposta: v.resposta.trim() || null,
        });
        aoConcluir(r);
      })}
    >
      <h3 className="sg-sub">Aceitar {sugestao.tipo === "sugestao" ? "a sugestão" : "a contestação"}</h3>
      <p className="small muted">A lista proposta passa a ser a do serviço e todas as equipes que o fazem são avisadas.</p>
      {livres.length > 0 && (
        <div className="stack g12">
          <Notice tone="info" icon="info">
            {livres.length === 1 ? "Um item foi digitado e ainda não está no catálogo." : `${livres.length} itens foram digitados e ainda não estão no catálogo.`} Escolha o que fazer com cada um.
          </Notice>
          {resolucoes.map((r, k) => {
            const item = livres[k]!;
            const idBase = `sg-resolucao-${item.ordem}`;
            return (
              <fieldset key={item.ordem} className="sg-digitado">
                <legend>
                  {item.descricao} <span className="small muted">({item.unidade} · {rotuloDaCategoria[item.categoria]})</span>
                </legend>
                <label className="row g8 sg-opcao">
                  <input type="radio" name={`${idBase}-modo`} checked={r.modo === "criar"} onChange={() => mudar(k, { modo: "criar", material_id: null, escolhido: null })} />
                  <span>Cadastrar como novo material no catálogo</span>
                </label>
                <label className="row g8 sg-opcao">
                  <input type="radio" name={`${idBase}-modo`} checked={r.modo === "ligar"} onChange={() => mudar(k, { modo: "ligar" })} />
                  <span>Usar um material que já existe</span>
                </label>
                {r.modo === "ligar" && (
                  <LigarAMaterial
                    id={`${idBase}-busca`}
                    escolhido={r.escolhido}
                    aoEscolher={(m) => mudar(k, { material_id: m?.id ?? null, escolhido: m?.descricao ?? null })}
                    erro={erros.resolucoes?.[k]?.material_id?.message}
                  />
                )}
              </fieldset>
            );
          })}
        </div>
      )}
      <Field label="Resposta ao autor (opcional)" htmlFor="sg-aceite-resposta" erro={erros.resposta?.message}>
        <textarea className="textarea" rows={3} maxLength={MAX_CARACTERES_DO_MOTIVO} placeholder="Ex.: Boa, faltava mesmo." {...register("resposta")} {...ligarAoErro("sg-aceite-resposta", erros.resposta?.message)} />
      </Field>
      <ErroDeEnvio mensagem={erroEnvio} />
      <div className="row g8 wrap">
        <Button variant="p" type="submit" aria-busy={enviando} disabled={enviando}>
          {enviando ? "Aceitando…" : "Aceitar e atualizar a lista"}
        </Button>
        <Button variant="line" onClick={aoCancelar} disabled={enviando}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

// ---- Ajustar a lista antes de aceitar --------------------------------------------------------------------------------

const esquemaDoAjuste = z
  .object({
    resposta: respostaOpcional,
    itens: z.array(
      z.object({
        chave: z.string(),
        material_id: z.string().nullable(),
        codigo: z.string().nullable(),
        descricao: z.string(),
        unidade: z.string(),
        categoria: z.enum(["material", "ferramenta", "epi"]),
        quantidade: z.string(),
        observacao: z.string().max(200, "A observação pode ter até 200 caracteres."),
        ativo: z.boolean(),
      }),
    ),
  })
  .superRefine((v, ctx) => {
    v.itens.forEach((i, k) => {
      if (Number.isNaN(lerQuantidade(i.quantidade))) ctx.addIssue({ code: "custom", path: ["itens", k, "quantidade"], message: `${i.descricao}: a quantidade precisa ser um número maior que zero, ou ficar vazia.` });
    });
  });

function FormularioDeAjuste({ sugestao, aoCancelar, aoConcluir }: { sugestao: Sugestao; aoCancelar: () => void; aoConcluir: (r: Resposta) => void }) {
  // A contestação sem lista parte da lista de agora; a sugestão, da proposta do autor.
  const inicio = sugestao.tem_lista ? sugestao.itens.map(itemDaSugestao) : sugestao.lista_atual.map(itemDoServico);
  const { form, ref, enviar, enviando, erroEnvio } = useFormulario(esquemaDoAjuste, { resposta: "", itens: inicio });
  const { register, formState } = form;
  const [itens, definirItens] = useValorDoForm(form, "itens");
  const erros = formState.errors;
  const erroDeItem = Array.isArray(erros.itens) ? (erros.itens as { quantidade?: { message?: string } }[]).map((e) => e?.quantidade?.message).find(Boolean) : undefined;
  const mudancas = useMemo(
    () => diferencaDeListas(sugestao.lista_atual, itens.map((i) => itemParaComparar(i as ItemEmEdicao))),
    [sugestao.lista_atual, itens],
  );

  return (
    <form
      ref={ref}
      noValidate
      className="stack g12 sg-acao"
      onSubmit={enviar(async (v) => {
        const r = await chamar<Resposta>("POST", `/sugestoes-materiais/${sugestao.id}/aceitar`, { lista: v.itens.map((i) => itemParaEnvio(i as ItemEmEdicao, true)), resposta: v.resposta.trim() || null });
        aoConcluir(r);
      })}
    >
      <h3 className="sg-sub">{sugestao.tem_lista ? "Ajustar a lista e aceitar" : "Informar a lista e aceitar"}</h3>
      <p className="small muted">
        {sugestao.tem_lista ? "Mude o que for preciso. A lista abaixo é a que passa a valer no serviço; a sugestão fica marcada como aceita com ajustes." : "A contestação veio sem lista: informe a lista que passa a valer no serviço."}
      </p>
      <EditorDaLista idBase="sg-ajuste" itens={itens as ItemEmEdicao[]} aoMudar={(novos) => definirItens(novos)} erro={erroDeItem} avaliando />
      <div className="stack g8">
        <h4 className="sg-sub">O que muda no serviço</h4>
        <DiferencaDeListas mudancas={mudancas} />
      </div>
      <Field label="Resposta ao autor (opcional)" htmlFor="sg-ajuste-resposta" erro={erros.resposta?.message}>
        <textarea className="textarea" rows={3} maxLength={MAX_CARACTERES_DO_MOTIVO} placeholder="Ex.: Aceitei, mas troquei a quantidade." {...register("resposta")} {...ligarAoErro("sg-ajuste-resposta", erros.resposta?.message)} />
      </Field>
      <ErroDeEnvio mensagem={erroEnvio} />
      <div className="row g8 wrap">
        <Button variant="p" type="submit" aria-busy={enviando} disabled={enviando}>
          {enviando ? "Aceitando…" : "Aceitar com esta lista"}
        </Button>
        <Button variant="line" onClick={aoCancelar} disabled={enviando}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

// ---- Recusar ---------------------------------------------------------------------------------------------------------

const esquemaDaRecusa = z.object({
  resposta: z
    .string()
    .trim()
    .min(MIN_CARACTERES_DO_MOTIVO, `Explique a recusa em pelo menos ${MIN_CARACTERES_DO_MOTIVO} caracteres: o autor lê este motivo.`)
    .max(MAX_CARACTERES_DO_MOTIVO, `O motivo pode ter até ${MAX_CARACTERES_DO_MOTIVO} caracteres.`),
});

function FormularioDeRecusa({ sugestao, aoCancelar, aoConcluir }: { sugestao: Sugestao; aoCancelar: () => void; aoConcluir: (r: Resposta) => void }) {
  const { form, ref, enviar, enviando, erroEnvio } = useFormulario(esquemaDaRecusa, { resposta: "" });
  const erro = form.formState.errors.resposta?.message;
  return (
    <form ref={ref} noValidate className="stack g12 sg-acao" onSubmit={enviar(async (v) => aoConcluir(await chamar<Resposta>("POST", `/sugestoes-materiais/${sugestao.id}/recusar`, { resposta: v.resposta })))}>
      <h3 className="sg-sub">Recusar {sugestao.tipo === "sugestao" ? "a sugestão" : "a contestação"}</h3>
      <Field label="Motivo da recusa" htmlFor="sg-recusa-resposta" erro={erro}>
        <textarea className="textarea" rows={4} maxLength={MAX_CARACTERES_DO_MOTIVO} placeholder="Ex.: A luva atual já cobre este serviço." {...form.register("resposta")} {...ligarAoErro("sg-recusa-resposta", erro)} />
      </Field>
      <ErroDeEnvio mensagem={erroEnvio} />
      <div className="row g8 wrap">
        <Button variant="d" type="submit" aria-busy={enviando} disabled={enviando}>
          {enviando ? "Recusando…" : "Recusar e avisar o autor"}
        </Button>
        <Button variant="line" onClick={aoCancelar} disabled={enviando}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

// ---- A tela --------------------------------------------------------------------------------------------------------

function ItensDaLista({ itens }: { itens: Pick<ItemDaSugestao, "descricao" | "unidade" | "quantidade" | "observacao" | "material_id">[] }) {
  if (itens.length === 0) return <p className="muted small">Lista vazia.</p>;
  return (
    <ul className="sg-lista">
      {itens.map((i, k) => (
        <li key={`${i.descricao}-${k}`} className="sg-linha sg-igual">
          <span className="sg-marca" aria-hidden="true" />
          <span className="sg-texto">
            <strong>{i.descricao}</strong>
            <span className="small sg-detalhe">
              {textoDaQuantidade(i.quantidade, i.unidade)}
              {i.observacao ? ` · ${i.observacao}` : ""}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * A sugestão ou a contestação aberta: quem enviou, o motivo, o que muda na lista de agora e, para quem avalia, "Aceitar", "Ajustar
 * e aceitar" e "Recusar". O autor vê o andamento e retira a pendente. Depois de cada ação a página se atualiza.
 */
export function AvaliacaoDaSugestao({ sugestao }: { sugestao: Sugestao }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const avisarPontos = useAvisoDePontos();
  const [modo, setModo] = useState<"aceitar" | "ajustar" | "recusar" | null>(null);
  const [retirando, setRetirando] = useState(false);
  const [erroAoRetirar, setErroAoRetirar] = useState<string | null>(null);
  const mudancas = useMemo(() => diferencaDeListas(sugestao.lista_atual, sugestao.itens), [sugestao.lista_atual, sugestao.itens]);
  const semMudancas = sugestao.tem_lista && totalDeMudancas(mudancas) === 0;

  function concluir(r: Resposta, mensagem: string) {
    setModo(null);
    exibirAviso(mensagem);
    avisarPontos(r);
    router.refresh();
  }

  async function retirar() {
    setRetirando(true);
    setErroAoRetirar(null);
    try {
      await chamar("POST", `/sugestoes-materiais/${sugestao.id}/retirar`);
      exibirAviso("Sugestão retirada.");
      router.refresh();
    } catch (e) {
      setErroAoRetirar(e instanceof Error ? e.message : "Não foi possível retirar agora.");
    } finally {
      setRetirando(false);
    }
  }

  return (
    <div className="stack g16">
      <div className="panel stack g12 sg-cabecalho">
        <div className="row wrap g8">
          <Badge tone={sugestao.tipo === "contestacao" ? "al" : "brand"}>{rotuloDoTipoDeSugestao[sugestao.tipo]}</Badge>
          <Badge tone={TOM_DO_ESTADO[sugestao.estado]}>{rotuloDoEstadoDeSugestao[sugestao.estado]}</Badge>
          {sugestao.ajustada && <Badge tone="neu">Aceita com ajustes</Badge>}
          {sugestao.estado === "pendente" && sugestao.desatualizada && <Badge tone="al">Lista mudou desde o envio</Badge>}
        </div>
        <dl className="dl d2">
          <div>
            <dt>Serviço</dt>
            <dd>
              <Link href={`${rotas.app.catalogo}?busca=${encodeURIComponent(sugestao.atividade_codigo)}`}>
                <span className="mono">{sugestao.atividade_codigo}</span> · {sugestao.atividade_descricao}
              </Link>
            </dd>
          </div>
          <div>
            <dt>Enviada por</dt>
            <dd>
              {sugestao.autor_nome} · {dataHora(sugestao.criada_em)}
            </dd>
          </div>
          <div>
            <dt>Quem avalia</dt>
            <dd>{sugestao.equipe_responsavel_nome ? `Supervisor da equipe ${sugestao.equipe_responsavel_nome}` : "Administração (nenhuma equipe faz este serviço)"}</dd>
          </div>
          {sugestao.avaliada_em && (
            <div>
              <dt>{sugestao.estado === "aceita" ? "Aceita por" : "Avaliada por"}</dt>
              <dd>
                {sugestao.avaliada_por_nome ?? "—"} · {dataHora(sugestao.avaliada_em)}
              </dd>
            </div>
          )}
        </dl>
        {sugestao.motivo && (
          <div className="stack g4">
            <h3 className="sg-sub">{sugestao.tipo === "contestacao" ? "Motivo da contestação" : "Motivo"}</h3>
            <p className="sg-citacao">{sugestao.motivo}</p>
          </div>
        )}
        {sugestao.resposta && (
          <div className="stack g4">
            <h3 className="sg-sub">{sugestao.estado === "recusada" ? "Motivo da recusa" : "Resposta"}</h3>
            <p className="sg-citacao">{sugestao.resposta}</p>
          </div>
        )}
      </div>

      <div className="panel stack g12">
        <h2 className="sg-etapa-titulo">{sugestao.estado === "aceita" ? "O que foi sugerido" : "O que muda na lista"}</h2>
        {sugestao.tem_lista ? (
          sugestao.estado === "pendente" ? (
            <>
              <p className="small muted">Comparado com a lista que o serviço tem agora.</p>
              {semMudancas ? <Notice tone="info" icon="info">A lista do serviço já está igual à proposta (alguém a atualizou depois do envio).</Notice> : null}
              <DiferencaDeListas mudancas={mudancas} />
            </>
          ) : (
            <ItensDaLista itens={sugestao.itens} />
          )
        ) : (
          <Notice tone="info" icon="info">
            A contestação não trouxe uma lista nova. Para aceitá-la, quem avalia informa a lista que passa a valer.
          </Notice>
        )}
        {sugestao.estado === "pendente" && sugestao.desatualizada && (
          <details className="sg-detalhes">
            <summary>A lista do serviço mudou desde o envio: ver a lista de quando foi enviada</summary>
            <ItensDaLista itens={sugestao.lista_base} />
          </details>
        )}
      </div>

      {sugestao.posso_avaliar && (
        <div className="panel stack g12">
          {modo === null && (
            <>
              <h2 className="sg-etapa-titulo">Sua avaliação</h2>
              <p className="small muted">Você avalia porque {sugestao.equipe_responsavel_nome ? "sua equipe é a que mais faz este serviço" : "é da administração"}. Aceitar ou recusar rende pontos de Colaboração.</p>
              <div className="row g8 wrap">
                {sugestao.tem_lista && (
                  <Button variant="p" onClick={() => setModo("aceitar")}>
                    <Icon name="check" size={16} />
                    Aceitar
                  </Button>
                )}
                <Button variant={sugestao.tem_lista ? "line" : "p"} onClick={() => setModo("ajustar")}>
                  <Icon name="pencil" size={16} />
                  {sugestao.tem_lista ? "Ajustar e aceitar" : "Informar a lista e aceitar"}
                </Button>
                <Button variant="od" onClick={() => setModo("recusar")}>
                  <Icon name="x" size={16} />
                  Recusar
                </Button>
              </div>
            </>
          )}
          {modo === "aceitar" && <FormularioDeAceite sugestao={sugestao} aoCancelar={() => setModo(null)} aoConcluir={(r) => concluir(r, "Sugestão aceita: a lista do serviço foi atualizada.")} />}
          {modo === "ajustar" && <FormularioDeAjuste sugestao={sugestao} aoCancelar={() => setModo(null)} aoConcluir={(r) => concluir(r, "Aceita com ajustes: a lista do serviço foi atualizada.")} />}
          {modo === "recusar" && <FormularioDeRecusa sugestao={sugestao} aoCancelar={() => setModo(null)} aoConcluir={(r) => concluir(r, "Sugestão recusada. O autor foi avisado.")} />}
        </div>
      )}

      {sugestao.posso_retirar && (
        <div className="panel stack g8">
          <h2 className="sg-etapa-titulo">Sua {sugestao.tipo === "sugestao" ? "sugestão" : "contestação"}</h2>
          <p className="small muted">Aguarda a avaliação do supervisor. Você pode retirá-la e enviar outra, se mudar de ideia.</p>
          {erroAoRetirar && <MensagemDeErro>{erroAoRetirar}</MensagemDeErro>}
          <div>
            <Button variant="line" onClick={() => void retirar()} aria-busy={retirando} disabled={retirando}>
              {retirando ? "Retirando…" : "Retirar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
