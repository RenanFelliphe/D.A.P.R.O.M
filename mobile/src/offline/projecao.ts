import type { OsStatus } from "@shared/api/tipos";
import type { AprDaCopia, EventoDaFila, ExecucaoDaCopia, OsDaCopia, PausaDaCopia } from "./tipos";

/**
 * A projeção: o que o técnico fez e ainda não chegou à `api` (a fila), aplicado sobre a cópia da OS, só para as telas mostrarem a
 * situação certa enquanto o servidor não responde. **O servidor é quem decide** (resultado da APR, status da OS, pontos): a projeção
 * não grava nada e some quando o evento é confirmado e a cópia nova chega. Cada passo é idempotente: se a cópia já traz o efeito do
 * evento (o servidor o aplicou antes de a fila ser limpa), aplicar de novo não muda nada.
 */

export interface EstadoDaOs {
  os: OsDaCopia;
  aprs: AprDaCopia[];
  execucoes: ExecucaoDaCopia[];
}

const copiar = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const texto = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const numero = (v: unknown): number | null => (typeof v === "number" ? v : null);

/** O status que a `api` derivaria (`recalcularStatusOs`): a mesma regra, sobre o que há na cópia. */
export function statusDerivado(os: Pick<OsDaCopia, "status" | "ciencia_em">, aprs: Pick<AprDaCopia, "resultado">[], execucoes: Pick<ExecucaoDaCopia, "resultado" | "encerramento_assinado_em">[]): OsStatus {
  if (os.status === "cancelada" || os.status === "devolvida") return os.status;
  const validas = execucoes.filter((e) => e.resultado !== "cancelada");
  const encerradas = validas.filter((e) => e.resultado === "encerrada");
  if (encerradas.length > 0) {
    if (!encerradas.some((e) => e.encerramento_assinado_em)) return "encerrando";
    return os.ciencia_em ? "encerrada" : "aguardando_supervisor";
  }
  if (validas.some((e) => e.resultado === null)) return "em_execucao";
  if (validas.some((e) => e.resultado === "interrompida" || e.resultado === "suspensa")) return "pendente";
  return aprs.some((a) => a.resultado === "bloqueada") ? "pendente" : "liberada";
}

const fecharPausaAberta = (e: ExecucaoDaCopia, fim: string) => {
  for (const p of e.pausas) if (!p.fim) p.fim = fim;
};

function aplicar(estado: EstadoDaOs, ev: EventoDaFila): void {
  const p = ev.payload;
  const osId = estado.os.id;
  const execucaoDe = (id: unknown) => estado.execucoes.find((e) => e.id === id);

  switch (ev.tipo) {
    case "apr_concluida": {
      const id = texto(p.id);
      if (!id || estado.aprs.some((a) => a.id === id)) return;
      // Sem sinal o aparelho não validou a APR: ela vale como aprovada até o servidor dizer o contrário. Com `resultado` (validada
      // antes de ir para a fila), vale o que o servidor disse.
      const presencial = p.assinatura_presencial === true;
      const resultado = p.resultado === "bloqueada" ? "bloqueada" : "aprovada";
      const concluidaEm = texto(p.concluida_em) ?? ev.ocorridoEm;
      const participantes = Array.isArray(p.participantes) ? (p.participantes as { usuario_id: string; funcao: "responsavel" | "executor"; assinada_em?: string }[]) : [];
      estado.aprs.push({
        id,
        os_id: osId,
        modelo_apr_id: texto(p.modelo_apr_id) ?? "",
        preenchida_por: ev.usuarioId,
        resultado,
        concluida_em: concluidaEm,
        participantes: participantes.map((x) => ({
          usuario_id: x.usuario_id,
          funcao: x.funcao,
          assinada_em: presencial && resultado === "aprovada" ? (x.assinada_em ?? concluidaEm) : null,
          assinatura_presencial: presencial && resultado === "aprovada",
          recusou_em: null,
        })),
        ...(presencial ? { aguardando_validacao: true } : {}),
        itens_respondidos: Array.isArray(p.respostas) ? p.respostas.length : 0,
      });
      return;
    }
    case "apr_assinada": {
      const participante = estado.aprs.find((a) => a.id === p.apr_id)?.participantes.find((x) => x.usuario_id === ev.usuarioId);
      if (participante && !participante.assinada_em && !participante.recusou_em) participante.assinada_em = texto(p.assinada_em) ?? ev.ocorridoEm;
      return;
    }
    case "apr_recusada": {
      const participante = estado.aprs.find((a) => a.id === p.apr_id)?.participantes.find((x) => x.usuario_id === ev.usuarioId);
      if (participante && !participante.recusou_em && !participante.assinada_em) {
        participante.recusou_em = texto(p.recusada_em) ?? ev.ocorridoEm;
        participante.recusa_motivo = texto(p.motivo);
      }
      return;
    }
    case "execucao_iniciada": {
      const id = texto(p.id);
      if (!id || execucaoDe(id)) return;
      const apr = estado.aprs.find((a) => a.id === p.apr_id);
      estado.execucoes.push({
        id,
        os_id: osId,
        apr_id: texto(p.apr_id) ?? "",
        executor_id: ev.usuarioId,
        numero_pessoas: numero(p.numero_pessoas) ?? apr?.participantes.filter((x) => !x.recusou_em).length ?? 1,
        inicio: texto(p.inicio) ?? ev.ocorridoEm,
        fim: null,
        resultado: null,
        motivo: null,
        suspensao_motivo: null,
        suspensao_complemento: null,
        encerramento_assinado_em: null,
        inicio_latitude: numero(p.latitude),
        inicio_longitude: numero(p.longitude),
        fim_latitude: null,
        fim_longitude: null,
        pausas: [],
      });
      return;
    }
    case "pausa_iniciada": {
      const e = execucaoDe(p.execucao_id);
      const id = texto(p.id);
      if (!e || !id || e.pausas.some((x) => x.id === id)) return;
      const pausa: PausaDaCopia = {
        id,
        execucao_id: e.id,
        inicio: texto(p.inicio) ?? ev.ocorridoEm,
        fim: null,
        motivo: texto(p.motivo),
        complemento: texto(p.complemento),
        latitude: numero(p.latitude),
        longitude: numero(p.longitude),
      };
      e.pausas.push(pausa);
      return;
    }
    case "pausa_encerrada": {
      for (const e of estado.execucoes) {
        const pausa = e.pausas.find((x) => x.id === p.pausa_id);
        if (pausa && !pausa.fim) pausa.fim = texto(p.fim) ?? ev.ocorridoEm;
      }
      return;
    }
    // O participante que pede ao responsável (`pedido_aberto`) e fica na fila vale na hora no aparelho: a `api` o aplica direto (sem sinal).
    case "pedido_aberto":
    case "execucao_encerrada":
    case "execucao_interrompida":
    case "execucao_suspensa": {
      const e = execucaoDe(p.execucao_id);
      if (!e || e.resultado !== null) return;
      const fim = texto(p.instante) ?? texto(p.fim) ?? ev.ocorridoEm;
      fecharPausaAberta(e, fim);
      e.fim = fim;
      e.fim_latitude = numero(p.latitude);
      e.fim_longitude = numero(p.longitude);
      e.finalizada_por = ev.usuarioId;
      if (ev.tipo === "execucao_encerrada" || (ev.tipo === "pedido_aberto" && p.tipo === "encerrar")) e.resultado = "encerrada";
      else if (ev.tipo === "execucao_interrompida") {
        e.resultado = "interrompida";
        e.motivo = texto(p.motivo);
      } else {
        e.resultado = "suspensa";
        e.suspensao_motivo = texto(p.motivo);
        e.suspensao_complemento = texto(p.complemento);
      }
      return;
    }
    case "encerramento_assinado": {
      const e = execucaoDe(p.execucao_id);
      if (e && e.resultado === "encerrada" && !e.encerramento_assinado_em) e.encerramento_assinado_em = ev.ocorridoEm;
      return;
    }
    case "execucao_cancelada": {
      const e = execucaoDe(p.execucao_id);
      if (!e || e.resultado !== null) return;
      e.resultado = "cancelada";
      e.fim = ev.ocorridoEm;
      fecharPausaAberta(e, ev.ocorridoEm);
      return;
    }
  }
}

/** A OS de um evento: a do envelope ou a do payload (o `execucao_iniciada` e o `apr_concluida` podem trazê-la lá). */
export const osDoEvento = (e: Pick<EventoDaFila, "osId" | "payload">): string | null => e.osId ?? (typeof e.payload.os_id === "string" ? e.payload.os_id : null);

/**
 * A OS como o aparelho a vê agora: a cópia mais os eventos pendentes dela, na ordem em que a `api` os aplicará. Sem evento pendente,
 * devolve a cópia como veio (e o status que o servidor deu).
 */
export function projetar(base: EstadoDaOs, pendentes: EventoDaFila[]): EstadoDaOs {
  const daOs = pendentes.filter((e) => osDoEvento(e) === base.os.id);
  if (daOs.length === 0) return base;
  const estado = copiar(base);
  for (const ev of daOs) aplicar(estado, ev);
  estado.os.status = statusDerivado(estado.os, estado.aprs, estado.execucoes);
  return estado;
}
