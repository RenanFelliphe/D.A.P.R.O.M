"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { MOTIVO_DO_AUSENTE, descreverPeriodo, somarDias, type Ausencia } from "@/lib/ausencia";
import { chamar } from "@/lib/cliente-api";
import { dataDoDia, hoje } from "@/lib/formatar";
import { CamposDePeriodo, periodoParaApi, retornoDoPeriodo, type PeriodoDigitado } from "./CamposDePeriodo";
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
  const [motivo, setMotivo] = useState("");
  return (
    <JanelaDeAssinatura
      titulo={titulo}
      resumo={resumo}
      rotuloConfirmar={rotuloConfirmar}
      tom={tom}
      assinaturaPath={assinaturaPath}
      incompleto={obrigatorio && motivo.trim() === ""}
      aoConfirmar={() => enviar(motivo.trim()).then(() => undefined)}
      aoFechar={aoFechar}
    >
      <Field label={rotulo} htmlFor={`${id}-motivo`}>
        <textarea id={`${id}-motivo`} className="textarea" rows={3} maxLength={LIMITE_DO_MOTIVO} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Field>
    </JanelaDeAssinatura>
  );
}

/** O supervisor aprova o pedido, com ou sem ajuste das datas. */
function JanelaAprovar({ a, periodo, post, assinaturaPath, aoFechar }: ComumDaJanela & { a: Ausencia; periodo: string; post: Postar }) {
  const [ajustar, setAjustar] = useState(false);
  const [datas, setDatas] = useState<PeriodoDigitado>({ inicio: a.inicio, modo: "retorno", dias: String(a.dias), retorno: a.retorno });
  const passou = a.inicio < hoje();
  const mostrar = ajustar || passou;
  const retorno = retornoDoPeriodo(datas);
  return (
    <JanelaDeAssinatura
      titulo="Aprovar o pedido"
      resumo={`${a.usuario_nome} pediu ${periodo}. Aprovado, ${a.usuario_nome} ainda confirma, assinando, para a ausência valer.`}
      rotuloConfirmar="Aprovar e assinar"
      assinaturaPath={assinaturaPath}
      incompleto={mostrar && (retorno === null || datas.inicio < hoje())}
      aoConfirmar={() => post("aprovar", mostrar ? periodoParaApi(datas) : {}).then(() => undefined)}
      aoFechar={aoFechar}
    >
      {passou ? (
        <Notice tone="al" icon="alert">
          O início pedido já passou: ajuste as datas para aprovar.
        </Notice>
      ) : (
        <label className="row g8 small">
          <input type="checkbox" checked={ajustar} onChange={(e) => setAjustar(e.target.checked)} />
          Ajustar as datas antes de aprovar
        </label>
      )}
      {mostrar && <CamposDePeriodo valor={datas} aoMudar={setDatas} />}
    </JanelaDeAssinatura>
  );
}

/** O ausente pede o fim antecipado: a data de retorno que ele quer. */
function JanelaPedirFim({ a, post, assinaturaPath, aoFechar }: ComumDaJanela & { a: Ausencia; post: Postar }) {
  const id = useId();
  const [data, setData] = useState("");
  const ultimo = somarDias(a.retorno, -1);
  return (
    <JanelaDeAssinatura
      titulo="Pedir o fim antecipado"
      resumo={`O retorno previsto é ${dataDoDia(a.retorno)}. Informe o dia em que você quer voltar ao trabalho; o supervisor aprova ou recusa.`}
      rotuloConfirmar="Pedir e assinar"
      assinaturaPath={assinaturaPath}
      incompleto={data === "" || data < hoje() || data > ultimo}
      aoConfirmar={() => post("pedir-fim", { data }).then(() => undefined)}
      aoFechar={aoFechar}
    >
      <Field label="Quero voltar em" htmlFor={`${id}-data`}>
        <input id={`${id}-data`} className="input" type="date" min={hoje()} max={ultimo} value={data} onChange={(e) => setData(e.target.value)} />
      </Field>
    </JanelaDeAssinatura>
  );
}

/** O supervisor muda a data de retorno (a ausência em curso, agendada ou vencida). */
function JanelaProrrogar({ a, post, assinaturaPath, aoFechar }: ComumDaJanela & { a: Ausencia; post: Postar }) {
  const id = useId();
  const [retorno, setRetorno] = useState("");
  const [motivo, setMotivo] = useState("");
  const minimo = somarDias(hoje() > a.inicio ? hoje() : a.inicio, 1);
  return (
    <JanelaDeAssinatura
      titulo="Alterar a data de retorno"
      resumo={`${a.usuario_nome}: ${descreverPeriodo(a)}. A pessoa recebe o aviso da mudança.`}
      rotuloConfirmar="Alterar e assinar"
      assinaturaPath={assinaturaPath}
      incompleto={retorno === "" || retorno < minimo || retorno === a.retorno}
      aoConfirmar={() => post("prorrogar", { retorno, motivo: motivo.trim() || undefined }).then(() => undefined)}
      aoFechar={aoFechar}
    >
      <Field label="Novo retorno (primeiro dia de volta)" htmlFor={`${id}-retorno`}>
        <input id={`${id}-retorno`} className="input" type="date" min={minimo} value={retorno} onChange={(e) => setRetorno(e.target.value)} />
      </Field>
      <Field label="Motivo (opcional)" htmlFor={`${id}-motivo`}>
        <textarea id={`${id}-motivo`} className="textarea" rows={2} maxLength={LIMITE_DO_MOTIVO} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Field>
    </JanelaDeAssinatura>
  );
}
