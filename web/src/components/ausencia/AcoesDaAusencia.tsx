"use client";

import { useId, useMemo, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { useFormulario, useValorDoForm } from "@/components/ui/useFormulario";
import { MOTIVO_DO_AUSENTE, descreverPeriodo, somarDias, type Ausencia } from "@/lib/ausencia";
import { chamar } from "@/lib/cliente-api";
import { dataDoDia, hoje } from "@/lib/formatar";
import { diaExiste } from "@/lib/validacao";
import { CamposDePeriodo, conferirPeriodo, esquemaDoPeriodo, periodoParaApi, type PeriodoDigitado } from "./CamposDePeriodo";
import { LIMITE_DO_MOTIVO } from "./FormularioDeAusencia";
import { JanelaDeAssinatura } from "./JanelaDeAssinatura";

/** Quem está olhando a ausência. */
export interface QuemAge {
  id: string;
  /** A assinatura do perfil de quem age (`null` = ainda não cadastrou). */
  assinaturaPath: string | null;
  /** Quem age está ausente: só visualiza, e os botões ficam desabilitados com o motivo. */
  ausente: boolean;
}

type Acao = "aprovar" | "recusar" | "confirmar" | "recusar-ajuste" | "cancelar" | "pedir-fim" | "aprovar-fim" | "recusar-fim" | "prorrogar" | "encerrar" | "confirmar-retorno";

interface AcoesDaAusenciaProps {
  ausencia: Ausencia;
  eu: QuemAge;
  /** Quem age supervisiona a equipe da ausência (o admin só consulta). */
  supervisaEquipe: boolean;
}

/**
 * Os botões de uma ausência, por quem olha e por como ela está: o ausente pede o fim antecipado e confirma o retorno; o técnico
 * confirma o que o supervisor aprovou; o supervisor da equipe aprova, recusa, altera o retorno e encerra. Toda ação, menos o
 * pedido inicial, é assinada (`JanelaDeAssinatura`). A `api` confere tudo de novo; aqui só se mostra o que cabe a cada um.
 */
export function AcoesDaAusencia({ ausencia: a, eu, supervisaEquipe }: AcoesDaAusenciaProps) {
  const [aberta, setAberta] = useState<Acao | null>(null);
  const minha = a.usuario_id === eu.id;
  const propria = minha && a.origem === "propria";
  // O supervisor também age sobre a própria ausência (a que ele registrou); sobre a de outra pessoa, só como supervisor da equipe.
  const comoSupervisor = supervisaEquipe && (!minha || propria);
  // O supervisor ausente não age pela equipe: só cuida da própria ausência.
  const bloqueadoPeloAusente = eu.ausente && !minha;

  const botoes: { acao: Acao; rotulo: string; variante?: "p" | "line" | "ghost"; }[] = [];
  if (minha && !propria) {
    if (a.situacao === "pedida") botoes.push({ acao: "cancelar", rotulo: "Cancelar o pedido", variante: "line" });
    if (a.situacao === "aguardando_confirmacao") {
      botoes.push({ acao: "confirmar", rotulo: "Confirmar a ausência", variante: "p" });
      botoes.push({ acao: "recusar-ajuste", rotulo: "Recusar as datas", variante: "line" });
      botoes.push({ acao: "cancelar", rotulo: "Cancelar o pedido", variante: "ghost" });
    }
    if (a.situacao === "em_curso" && !a.fim_pedido_em) botoes.push({ acao: "pedir-fim", rotulo: "Pedir fim antecipado", variante: "line" });
    if (a.situacao === "vencida") botoes.push({ acao: "confirmar-retorno", rotulo: "Confirmar o retorno", variante: "p" });
  }
  if (comoSupervisor) {
    if (a.situacao === "pedida" && !minha) {
      botoes.push({ acao: "aprovar", rotulo: "Aprovar", variante: "p" });
      botoes.push({ acao: "recusar", rotulo: "Recusar", variante: "line" });
    }
    if (a.situacao === "em_curso" && a.fim_pedido_em && !minha) {
      botoes.push({ acao: "aprovar-fim", rotulo: "Aprovar o fim antecipado", variante: "p" });
      botoes.push({ acao: "recusar-fim", rotulo: "Recusar o fim", variante: "line" });
    }
    if (a.situacao === "agendada" || a.situacao === "em_curso" || a.situacao === "vencida") {
      botoes.push({ acao: "prorrogar", rotulo: "Alterar o retorno", variante: "line" });
      botoes.push({ acao: "encerrar", rotulo: propria && a.situacao !== "agendada" ? "Encerrar a minha ausência" : "Encerrar a ausência", variante: "line" });
    }
  }
  if (botoes.length === 0) return null;

  const fechar = () => setAberta(null);
  const comum = { assinaturaPath: eu.assinaturaPath, aoFechar: fechar } as const;
  const post = (acao: string, corpo: object = {}) => chamar("POST", `/ausencias/${a.id}/${acao}`, { assinar: true, ...corpo });
  const periodo = descreverPeriodo(a);

  return (
    <>
      <div className="row g8 wrap">
        {botoes.map((b) => (
          <Button
            key={b.acao}
            variant={b.variante}
            sm
            disabled={bloqueadoPeloAusente}
            title={bloqueadoPeloAusente ? MOTIVO_DO_AUSENTE : undefined}
            onClick={() => setAberta(b.acao)}
          >
            {b.rotulo}
          </Button>
        ))}
      </div>
      {bloqueadoPeloAusente && <span className="small muted">{MOTIVO_DO_AUSENTE}</span>}

      {aberta === "aprovar" && <JanelaAprovar a={a} periodo={periodo} post={post} {...comum} />}
      {aberta === "recusar" && (
        <JanelaComMotivo titulo="Recusar o pedido" resumo={`${a.usuario_nome}: ${periodo}.`} rotulo="Motivo da recusa" obrigatorio rotuloConfirmar="Recusar e assinar" tom="d" enviar={(motivo) => post("recusar", { motivo })} {...comum} />
      )}
      {aberta === "confirmar" && (
        <JanelaDeAssinatura titulo="Confirmar a ausência" resumo={`O supervisor aprovou: ${periodo}. Ao confirmar, a ausência passa a valer.`} rotuloConfirmar="Confirmar e assinar" aoConfirmar={() => post("confirmar").then(() => undefined)} {...comum} />
      )}
      {aberta === "recusar-ajuste" && (
        <JanelaComMotivo titulo="Recusar as datas" resumo={`O supervisor aprovou: ${periodo}. Recusando, o pedido termina e você pode pedir de novo.`} rotulo="Motivo (opcional)" rotuloConfirmar="Recusar e assinar" tom="d" enviar={(motivo) => post("recusar-ajuste", { motivo: motivo || undefined })} {...comum} />
      )}
      {aberta === "cancelar" && (
        <JanelaDeAssinatura titulo="Cancelar o pedido" resumo={`Cancelar o pedido de ausência ${periodo}?`} rotuloConfirmar="Cancelar o pedido e assinar" tom="d" aoConfirmar={() => post("cancelar").then(() => undefined)} {...comum} />
      )}
      {aberta === "pedir-fim" && <JanelaPedirFim a={a} post={post} {...comum} />}
      {aberta === "aprovar-fim" && (
        <JanelaDeAssinatura
          titulo="Aprovar o fim antecipado"
          resumo={`${a.usuario_nome} pediu para voltar em ${dataDoDia(a.fim_pedido_data)} (o retorno previsto era ${dataDoDia(a.retorno)}). ${a.fim_pedido_data && a.fim_pedido_data <= hoje() ? "Como a data é hoje, a ausência termina na hora." : "A data de retorno passa a ser essa."}`}
          rotuloConfirmar="Aprovar e assinar"
          aoConfirmar={() => post("responder-fim", { aprovar: true }).then(() => undefined)}
          {...comum}
        />
      )}
      {aberta === "recusar-fim" && (
        <JanelaComMotivo titulo="Recusar o fim antecipado" resumo={`${a.usuario_nome} pediu para voltar em ${dataDoDia(a.fim_pedido_data)}.`} rotulo="Motivo (opcional)" rotuloConfirmar="Recusar e assinar" tom="d" enviar={(motivo) => post("responder-fim", { aprovar: false, motivo: motivo || undefined })} {...comum} />
      )}
      {aberta === "prorrogar" && <JanelaProrrogar a={a} post={post} {...comum} />}
      {aberta === "encerrar" && (
        <JanelaComMotivo
          titulo={propria && a.situacao !== "agendada" ? "Encerrar a minha ausência" : "Encerrar a ausência"}
          resumo={propria && a.situacao !== "agendada" ? "Encerrar em emergência: você volta a agir pela equipe na hora." : `${a.usuario_nome} volta ao normal na hora e a ausência é encerrada.`}
          rotulo="Motivo (opcional)"
          rotuloConfirmar="Encerrar e assinar"
          tom="d"
          enviar={(motivo) => post("encerrar", { motivo: motivo || undefined })}
          {...comum}
        />
      )}
      {aberta === "confirmar-retorno" && (
        <JanelaDeAssinatura titulo="Confirmar o retorno" resumo={`A sua ausência terminou em ${dataDoDia(a.retorno)}. Ao confirmar, a sua conta volta ao normal.`} rotuloConfirmar="Confirmar e assinar" aoConfirmar={() => post("confirmar-retorno").then(() => undefined)} {...comum} />
      )}
    </>
  );
}

/** O motivo de uma ação da ausência: até ${LIMITE_DO_MOTIVO} caracteres; com `mensagemSeVazio`, é obrigatório. */
function motivoDaAusencia(mensagemSeVazio?: string) {
  const texto = z.string().trim().max(LIMITE_DO_MOTIVO, `O motivo pode ter até ${LIMITE_DO_MOTIVO} caracteres.`);
  return mensagemSeVazio ? texto.min(1, mensagemSeVazio) : texto;
}

interface ComumDaJanela {
  assinaturaPath: string | null;
  aoFechar: () => void;
}

type Postar = (acao: string, corpo?: object) => Promise<unknown>;

/** Uma ação assinada que leva só um texto (o motivo), obrigatório ou não. */
function JanelaComMotivo({ titulo, resumo, rotulo, obrigatorio = false, rotuloConfirmar, tom, enviar, assinaturaPath, aoFechar }: ComumDaJanela & {
  titulo: string;
  resumo: string;
  rotulo: string;
  obrigatorio?: boolean;
  rotuloConfirmar: string;
  tom: "p" | "d";
  enviar: (motivo: string) => Promise<unknown>;
}) {
  const id = useId();
  const esquema = useMemo(() => z.object({ motivo: obrigatorio ? motivoDaAusencia("Informe o motivo.") : motivoDaAusencia() }), [obrigatorio]);
  const { form, validar } = useFormulario(esquema, { motivo: "" });
  const erro = form.formState.errors.motivo?.message;
  return (
    <JanelaDeAssinatura
      titulo={titulo}
      resumo={resumo}
      rotuloConfirmar={rotuloConfirmar}
      tom={tom}
      assinaturaPath={assinaturaPath}
      validar={validar}
      aoConfirmar={() => enviar(form.getValues("motivo").trim()).then(() => undefined)}
      aoFechar={aoFechar}
    >
      <Field label={rotulo} htmlFor={`${id}-motivo`} erro={erro}>
        <textarea className="textarea" rows={3} maxLength={LIMITE_DO_MOTIVO} {...form.register("motivo")} {...ligarAoErro(`${id}-motivo`, erro)} />
      </Field>
    </JanelaDeAssinatura>
  );
}

/** O supervisor aprova o pedido, com ou sem ajuste das datas. */
function JanelaAprovar({ a, periodo, post, assinaturaPath, aoFechar }: ComumDaJanela & { a: Ausencia; periodo: string; post: Postar }) {
  const passou = a.inicio < hoje();
  // As datas só são conferidas quando aparecem: ao ajustar, ou porque o início pedido já passou.
  const esquema = useMemo(
    () =>
      z
        .object({ ajustar: z.boolean(), datas: esquemaDoPeriodo })
        .superRefine((v, ctx) => {
          if (v.ajustar || passou) conferirPeriodo(v.datas, ctx, ["datas"]);
        }),
    [passou],
  );
  const { form, validar } = useFormulario(esquema, { ajustar: false, datas: { inicio: a.inicio, modo: "retorno", dias: String(a.dias), retorno: a.retorno } satisfies PeriodoDigitado });
  const erros = form.formState.errors;
  const [ajustar] = useValorDoForm(form, "ajustar");
  const [datas, setDatas] = useValorDoForm(form, "datas");
  const mostrar = ajustar || passou;
  return (
    <JanelaDeAssinatura
      titulo="Aprovar o pedido"
      resumo={`${a.usuario_nome} pediu ${periodo}. Aprovado, ${a.usuario_nome} ainda confirma, assinando, para a ausência valer.`}
      rotuloConfirmar="Aprovar e assinar"
      assinaturaPath={assinaturaPath}
      validar={validar}
      aoConfirmar={() => post("aprovar", mostrar ? periodoParaApi(datas) : {}).then(() => undefined)}
      aoFechar={aoFechar}
    >
      {passou ? (
        <Notice tone="al" icon="alert">
          O início pedido já passou: ajuste as datas para aprovar.
        </Notice>
      ) : (
        <label className="row g8 small">
          <input type="checkbox" {...form.register("ajustar")} />
          Ajustar as datas antes de aprovar
        </label>
      )}
      {mostrar && <CamposDePeriodo valor={datas} aoMudar={setDatas} erros={{ inicio: erros.datas?.inicio?.message, dias: erros.datas?.dias?.message, retorno: erros.datas?.retorno?.message }} />}
    </JanelaDeAssinatura>
  );
}

/** O ausente pede o fim antecipado: a data de retorno que ele quer. */
function JanelaPedirFim({ a, post, assinaturaPath, aoFechar }: ComumDaJanela & { a: Ausencia; post: Postar }) {
  const id = useId();
  const ultimo = somarDias(a.retorno, -1);
  const esquema = useMemo(
    () =>
      z.object({
        data: z
          .string()
          .min(1, "Informe o dia em que você quer voltar.")
          .refine(diaExiste, "Informe uma data válida.")
          .refine((v) => !diaExiste(v) || v >= hoje(), "O dia não pode ser anterior a hoje.")
          .refine((v) => !diaExiste(v) || v <= ultimo, `O dia precisa ser até ${dataDoDia(ultimo)}, antes do retorno previsto.`),
      }),
    [ultimo],
  );
  const { form, validar } = useFormulario(esquema, { data: "" });
  const erro = form.formState.errors.data?.message;
  return (
    <JanelaDeAssinatura
      titulo="Pedir o fim antecipado"
      resumo={`O retorno previsto é ${dataDoDia(a.retorno)}. Informe o dia em que você quer voltar ao trabalho; o supervisor aprova ou recusa.`}
      rotuloConfirmar="Pedir e assinar"
      assinaturaPath={assinaturaPath}
      validar={validar}
      aoConfirmar={() => post("pedir-fim", { data: form.getValues("data") }).then(() => undefined)}
      aoFechar={aoFechar}
    >
      <Field label="Quero voltar em" htmlFor={`${id}-data`} erro={erro}>
        <input className="input" type="date" min={hoje()} max={ultimo} {...form.register("data")} {...ligarAoErro(`${id}-data`, erro)} />
      </Field>
    </JanelaDeAssinatura>
  );
}

/** O supervisor muda a data de retorno (a ausência em curso, agendada ou vencida). */
function JanelaProrrogar({ a, post, assinaturaPath, aoFechar }: ComumDaJanela & { a: Ausencia; post: Postar }) {
  const id = useId();
  const minimo = somarDias(hoje() > a.inicio ? hoje() : a.inicio, 1);
  const esquema = useMemo(
    () =>
      z.object({
        retorno: z
          .string()
          .min(1, "Informe o novo retorno.")
          .refine(diaExiste, "Informe uma data válida.")
          .refine((v) => !diaExiste(v) || v >= minimo, `O retorno não pode ser antes de ${dataDoDia(minimo)}.`)
          .refine((v) => v !== a.retorno, "Este já é o retorno da ausência. Escolha outra data."),
        motivo: motivoDaAusencia(),
      }),
    [minimo, a.retorno],
  );
  const { form, validar } = useFormulario(esquema, { retorno: "", motivo: "" });
  const erros = form.formState.errors;
  return (
    <JanelaDeAssinatura
      titulo="Alterar a data de retorno"
      resumo={`${a.usuario_nome}: ${descreverPeriodo(a)}. A pessoa recebe o aviso da mudança.`}
      rotuloConfirmar="Alterar e assinar"
      assinaturaPath={assinaturaPath}
      validar={validar}
      aoConfirmar={() => {
        const { retorno, motivo } = form.getValues();
        return post("prorrogar", { retorno, motivo: motivo.trim() || undefined }).then(() => undefined);
      }}
      aoFechar={aoFechar}
    >
      <Field label="Novo retorno (primeiro dia de volta)" htmlFor={`${id}-retorno`} erro={erros.retorno?.message}>
        <input className="input" type="date" min={minimo} {...form.register("retorno")} {...ligarAoErro(`${id}-retorno`, erros.retorno?.message)} />
      </Field>
      <Field label="Motivo (opcional)" htmlFor={`${id}-motivo`} erro={erros.motivo?.message}>
        <textarea className="textarea" rows={2} maxLength={LIMITE_DO_MOTIVO} {...form.register("motivo")} {...ligarAoErro(`${id}-motivo`, erros.motivo?.message)} />
      </Field>
    </JanelaDeAssinatura>
  );
}
