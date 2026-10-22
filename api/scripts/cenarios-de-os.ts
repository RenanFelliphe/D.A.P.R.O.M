/**
 * Leva as OS recém-importadas aos status da demonstração (`criar-os-apresentacao.ts`): APR, execução, encerramento e ciência entram pelo
 * mesmo canal de eventos da api (`processarEventos`), com a hora de cada evento no passado e as contas reais de quem apresenta. A
 * devolução e a reserva usam as mesmas funções das rotas; o cancelamento vem do SAP (o script grava no simulador e lê de novo).
 * Dados fictícios; nunca rode com dados reais.
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import type { Config } from "../src/config";
import type { Db } from "../src/db/conexao";
import type { Deps } from "../src/deps";
import { equipe, itemModeloApr, localInstalacao, modeloApr, os, riscoModeloApr, usuario } from "../src/db/schema";
import { documentoDemo } from "../src/db/seed/documento-demo";
import { fotoDemo } from "../src/db/seed/imagens-demo";
import { posicaoDaDemo } from "../src/db/seed/posicoes-demo";
import { noMesmoDia } from "../src/db/seed/demo";
import { devolverOs, reservarOs } from "../src/dominio/atribuicao-os";
import { processarEventos } from "../src/dominio/eventos";
import { recalcularStatusOs } from "../src/dominio/status-os";
import type { UsuarioAutenticado } from "../src/http/autenticacao";
import { enfileirarTarefa } from "../src/servicos/fila";
import { ArmazenamentoSupabase } from "../src/servicos/armazenamento";
import { AuthSupabase } from "../src/servicos/auth";
import { ProvedorDeAssinaturaDesligado } from "../src/servicos/assinatura-juridica";
import { ClimaIndisponivel } from "../src/servicos/clima";
import { EmailEmMemoria } from "../src/servicos/email";
import { ProvedorIAIndisponivel } from "../src/servicos/ia/provedor-indisponivel";
import { OcrEmMemoria } from "../src/servicos/ocr-memoria";
import { PushEmMemoria } from "../src/servicos/push";
import { ClienteRhHttp } from "../src/servicos/rh-http";
import { ClienteSapHttp } from "../src/servicos/sap-http";

export const CENARIOS = ["liberada", "reservada", "devolvida", "cancelada", "em_execucao", "em_pausa", "encerrando", "aguardando", "encerrada", "bloqueada", "suspensa", "interrompida"] as const;
export type Cenario = (typeof CENARIOS)[number];

type Item = typeof itemModeloApr.$inferSelect;
type Risco = typeof riscoModeloApr.$inferSelect;
interface Modelo {
  id: string;
  itens: Item[];
  riscos: Risco[];
}

/** As duplas de cada equipe (matrícula; a primeira é a responsável) e quem supervisiona. As matrículas são as das contas reais. */
const EQUIPES = {
  SERV_ESP: { supervisor: "2007", modelo: "APR 03", duplas: [["2005", "2008"], ["2008", "2009"], ["2010", "2009"], ["2005", "2010"], ["2007", "2005"]] },
  INSTRUM: { supervisor: "2001", modelo: "APR 02", duplas: [["2003", "1212"], ["1212", "100002"], ["2003", "100002"], ["100002", "2001"], ["1212", "2001"], ["2006", "2003"], ["2006", "1212"]] },
  LAB_QUI: { supervisor: "2002", modelo: "APR 01", duplas: [["2004", "2002"]] },
} as const;

const BR = 3 * 3600_000;

export interface PedidoDeCenario {
  numeroOrdem: string;
  centro: keyof typeof EQUIPES;
  cenario: Cenario;
  /** Dias antes de hoje em que a OS foi feita (0 = hoje); vem da data programada. */
  diasAtras: number;
  /** Quem faz (a primeira é a responsável); sem isto, as duplas da equipe se revezam. Obrigatória em quem está em campo agora. */
  dupla?: readonly string[];
  /** Por que a execução foi interrompida. */
  motivo?: string;
}

interface Plano extends PedidoDeCenario {
  matriculas: readonly string[];
  hora: number;
}

const NO_PASSADO: readonly Cenario[] = ["encerrando", "aguardando", "encerrada", "bloqueada", "suspensa", "interrompida"];

/**
 * Quem faz cada OS e a que horas, sempre igual para os mesmos pedidos. As de quem está em campo agora trazem a dupla; as do passado
 * ficam com a primeira dupla da equipe e o primeiro horário do dia (7h, 10h, 13h ou 16h, a partir do que o número da ordem sugere)
 * em que ninguém dela estaria em outra OS. Falha se não houver lugar.
 */
export function planejar(pedidos: PedidoDeCenario[]): Plano[] {
  const ocupado = new Set<string>();
  const livre = (m: readonly string[], dia: number, hora: number) => m.every((x) => [0, 1, 2].every((d) => !ocupado.has(`${x}|${dia}|${hora + d}`)));
  const ocupar = (m: readonly string[], dia: number, hora: number) => m.forEach((x) => [0, 1, 2].forEach((d) => ocupado.add(`${x}|${dia}|${hora + d}`)));

  const planos = new Map<string, Plano>();
  for (const p of pedidos) {
    if (p.cenario === "em_execucao" || p.cenario === "em_pausa") {
      if (!p.dupla) throw new Error(`A OS ${p.numeroOrdem} (${p.cenario}) precisa de uma dupla explícita`);
      planos.set(p.numeroOrdem, { ...p, matriculas: p.dupla, hora: 0 });
    }
  }
  for (const p of pedidos) {
    if (!NO_PASSADO.includes(p.cenario)) {
      if (!planos.has(p.numeroOrdem)) planos.set(p.numeroOrdem, { ...p, matriculas: p.dupla ?? EQUIPES[p.centro].duplas[0]!, hora: 0 });
      continue;
    }
    const inicio = Number(p.numeroOrdem) % 4;
    let escolhido: Plano | null = null;
    for (const dupla of p.dupla ? [p.dupla] : EQUIPES[p.centro].duplas) {
      for (let s = 0; s < 4 && !escolhido; s++) {
        const hora = 7 + ((inicio + s) % 4) * 3;
        if (livre(dupla, p.diasAtras, hora)) escolhido = { ...p, matriculas: dupla, hora };
      }
      if (escolhido) break;
    }
    if (!escolhido) throw new Error(`Sem dupla livre para a OS ${p.numeroOrdem} no dia -${p.diasAtras}`);
    ocupar(escolhido.matriculas, escolhido.diasAtras, escolhido.hora);
    planos.set(p.numeroOrdem, escolhido);
  }
  return pedidos.map((p) => planos.get(p.numeroOrdem)!);
}

/** Leva ao cenário as OS de `executar` (as outras só entram no plano, para as duplas e as horas não mudarem entre os lotes). */
export async function conduzirCenarios(base: { db: Db; config: Config }, todos: PedidoDeCenario[], executar: Set<string>): Promise<Record<string, string>> {
  // As OS de quem está em campo agora vêm por último: quem tem execução aberta não pode começar outra num dia anterior.
  const planos = planejar(todos)
    .filter((p) => executar.has(p.numeroOrdem))
    .sort((a, b) => Number(a.cenario === "em_execucao" || a.cenario === "em_pausa") - Number(b.cenario === "em_execucao" || b.cenario === "em_pausa"));
  const { db, config } = base;
  const real = new Date();
  const relogio = { t: real };
  const deps: Deps = {
    db,
    // A demonstração não assina nada com o provedor: o ato vale só com a assinatura desenhada, como com a ZapSign desligada.
    config: { ...config, assinaturaJuridica: { ...config.assinaturaJuridica, provedor: "desligado", ligada: false } },
    auth: new AuthSupabase(config.supabaseUrl, config.supabaseServiceRoleKey),
    armazenamento: new ArmazenamentoSupabase(config.supabaseUrl, config.supabaseServiceRoleKey),
    email: new EmailEmMemoria(),
    push: new PushEmMemoria(),
    sap: new ClienteSapHttp(config.sapApiUrl, config.sapApiToken),
    rh: new ClienteRhHttp(config.rhApiUrl, config.rhApiToken),
    ia: new ProvedorIAIndisponivel(),
    ocr: new OcrEmMemoria(),
    clima: new ClimaIndisponivel(),
    provedorDeAssinatura: new ProvedorDeAssinaturaDesligado(),
    agora: () => relogio.t,
  };

  const hojeBR = new Date(real.getTime() - BR);
  const em = (diasAtras: number, h: number, m = 0) => new Date(Date.UTC(hojeBR.getUTCFullYear(), hojeBR.getUTCMonth(), hojeBR.getUTCDate() - diasAtras, h + 3, m));

  const cache = new Map<string, UsuarioAutenticado>();
  const pessoa = async (matricula: string): Promise<UsuarioAutenticado> => {
    const guardado = cache.get(matricula);
    if (guardado) return guardado;
    const [u] = await db.select().from(usuario).where(eq(sql`lower(${usuario.matricula})`, matricula.toLowerCase()));
    if (!u) throw new Error(`Nenhuma conta com a matrícula ${matricula}`);
    if (!u.assinaturaPath) throw new Error(`${u.nome} (${matricula}) não tem assinatura cadastrada`);
    const autenticado: UsuarioAutenticado = {
      id: u.id,
      nome: u.nome,
      matricula: u.matricula,
      email: u.email,
      perfil: u.perfil,
      equipeId: u.equipeId,
      equipesSupervisionadas: (await db.select({ id: equipe.id }).from(equipe).where(eq(equipe.supervisorId, u.id))).map((e) => e.id),
      equipesRepresentadas: [],
      ativo: u.ativo,
      senhaProvisoria: u.senhaProvisoria,
      assinaturaPath: u.assinaturaPath,
      ausencia: null,
    };
    cache.set(matricula, autenticado);
    return autenticado;
  };

  const modelos = new Map<string, Modelo>();
  const modelo = async (codigo: string): Promise<Modelo> => {
    const guardado = modelos.get(codigo);
    if (guardado) return guardado;
    const [m] = await db.select().from(modeloApr).where(and(eq(modeloApr.codigo, codigo), isNotNull(modeloApr.publicadoEm))).orderBy(desc(modeloApr.versao)).limit(1);
    if (!m) throw new Error(`Modelo ${codigo} não está publicado`);
    const carregado = { id: m.id, itens: await db.select().from(itemModeloApr).where(eq(itemModeloApr.modeloAprId, m.id)), riscos: await db.select().from(riscoModeloApr).where(eq(riscoModeloApr.modeloAprId, m.id)) };
    modelos.set(codigo, carregado);
    return carregado;
  };

  let fotos = 100;
  const foto = async () => {
    const id = randomUUID();
    await deps.armazenamento.gravar("fotos", id, fotoDemo(fotos++), "image/png");
    return id;
  };

  const enviar = async (u: UsuarioAutenticado, tipo: string, osId: string | null, payload: Record<string, unknown>, quando: Date) => {
    relogio.t = quando;
    const r = await processarEventos(deps, u, [{ id: randomUUID(), tipo: tipo as never, os_id: osId, payload, ocorrido_em: quando }]);
    const recusa = r.rejeitados[0] ?? r.pendentes[0];
    if (recusa) throw new Error(`Evento ${tipo} recusado (${recusa.codigo}): ${recusa.mensagem}`);
  };

  const respostas = (m: Modelo, marcados: Risco[], falhar: Item[]) => {
    const ids = new Set(marcados.map((r) => r.id));
    const falha = new Map(falhar.map((i) => [i.id, i]));
    const saida: { item_id: string; resposta: string; observacao?: string }[] = [];
    for (const i of m.itens) {
      if (i.secao === "medida_preventiva") {
        if (ids.has(i.riscoId!)) saida.push({ item_id: i.id, resposta: "sim" });
      } else if (falha.has(i.id)) {
        saida.push({ item_id: i.id, resposta: i.respostaBloqueante!, observacao: /gás|gas|vazamento|explos/i.test(i.texto) ? "Odor de gás no local; detector indicou concentração acima do limite." : "Condição encontrada fora do padrão; a atividade não pode começar até a correção." });
      } else {
        saida.push({ item_id: i.id, resposta: i.respostaBloqueante === "sim" ? "nao" : "sim" });
      }
    }
    return saida;
  };

  /** Registra a APR e, se ela passou, cada participante a assina (um minuto depois do outro). */
  const aprovar = async (responsavel: UsuarioAutenticado, osId: string, m: Modelo, equipeTec: UsuarioAutenticado[], quando: Date, opcoes: { riscos?: number; falhar?: Item[] } = {}) => {
    const marcados = m.riscos.slice(0, opcoes.riscos ?? 0);
    const falhar = opcoes.falhar ?? [];
    const evidencias: Record<string, unknown>[] = [];
    for (const item of falhar.filter((i) => i.evidencia === "foto")) {
      for (let k = 0; k < 2; k++) evidencias.push({ id: await foto(), item_id: item.id, capturada_em: quando.toISOString(), latitude: -20.31 + k * 0.0003, longitude: -40.29 });
    }
    const id = randomUUID();
    await enviar(responsavel, "apr_concluida", osId, {
      id,
      modelo_apr_id: m.id,
      participantes: equipeTec.map((u, i) => ({ usuario_id: u.id, funcao: i === 0 ? "responsavel" : "executor" })),
      riscos: marcados.map((r) => r.id),
      respostas: respostas(m, marcados, falhar),
      evidencias,
      observacao_geral: null,
      concluida_em: quando.toISOString(),
    }, quando);
    if (falhar.length === 0) {
      for (const [i, p] of equipeTec.entries()) {
        const assinou = new Date(quando.getTime() + (i + 1) * 60_000);
        await enviar(p, "apr_assinada", osId, { apr_id: id, assinada_em: assinou.toISOString() }, assinou);
      }
    }
    return id;
  };
  const eliminatorios = (m: Modelo, n: number) => m.itens.filter((i) => i.secao === "verificacao" && i.tipo === "eliminatorio" && i.evidencia === "foto").slice(0, n);

  interface OpcoesExecucao {
    inicio: Date;
    duracaoMin?: number;
    pausa?: [number, number];
    resultado: "encerrada" | "suspensa" | "interrompida" | "aberta" | "pausada";
    semAssinarEncerramento?: boolean;
    descricao?: string;
    motivo?: string;
    documento?: { nome: string; titulo: string; linhas: string[] };
  }
  const executarOs = async (u: UsuarioAutenticado, osId: string, aprId: string, participantes: UsuarioAutenticado[], o: OpcoesExecucao) => {
    const exId = randomUUID();
    const t = (min: number) => new Date(o.inicio.getTime() + min * 60_000);
    const [ordem] = await db.select({ numero: os.numeroOrdem, local: localInstalacao.codigo }).from(os).leftJoin(localInstalacao, eq(localInstalacao.id, os.localInstalacaoId)).where(eq(os.id, osId));
    const gps = (d = 0) => posicaoDaDemo(ordem?.local ?? null, ordem?.numero ?? osId, d);
    await enviar(u, "execucao_iniciada", osId, { id: exId, apr_id: aprId, numero_pessoas: participantes.length, inicio: o.inicio.toISOString(), ...gps() }, o.inicio);
    const dur = o.duracaoMin ?? 120;
    if (o.pausa) {
      const pausaId = randomUUID();
      await enviar(u, "pausa_iniciada", null, { id: pausaId, execucao_id: exId, inicio: t(o.pausa[0]).toISOString(), motivo: "almoco", ...gps(1) }, t(o.pausa[0]));
      if (o.resultado !== "pausada") await enviar(u, "pausa_encerrada", null, { pausa_id: pausaId, fim: t(o.pausa[1]).toISOString() }, t(o.pausa[1]));
    }
    const fim = t(dur);
    if (o.resultado === "encerrada") {
      const evidencias: Record<string, unknown>[] = [];
      for (let k = 0; k < 2; k++) evidencias.push({ id: await foto(), capturada_em: t(dur - 20 + k).toISOString(), ...gps(2 + k) });
      if (o.documento) {
        const id = randomUUID();
        await deps.armazenamento.gravar("documentos", id, documentoDemo(o.documento.titulo, o.documento.linhas), "application/pdf");
        evidencias.push({ id, tipo: "pdf", nome: o.documento.nome, capturada_em: t(dur - 5).toISOString() });
      }
      await enviar(u, "execucao_encerrada", osId, { execucao_id: exId, fim: fim.toISOString(), ...gps(1) }, fim);
      if (!o.semAssinarEncerramento) {
        const assinou = new Date(fim.getTime() + 4 * 60_000);
        await enviar(u, "encerramento_assinado", osId, { execucao_id: exId, assinada_em: assinou.toISOString(), descricao_atividade: o.descricao ?? "Atividade executada conforme o procedimento; equipamento testado e liberado para operação.", dados_inspecao: null, evidencias }, assinou);
      }
    } else if (o.resultado === "suspensa") {
      await enviar(u, "execucao_suspensa", osId, { execucao_id: exId, fim: fim.toISOString(), motivo: "fim_expediente", ...gps(1) }, fim);
    } else if (o.resultado === "interrompida") {
      await enviar(u, "execucao_interrompida", osId, { execucao_id: exId, fim: fim.toISOString(), motivo: o.motivo ?? "Risco identificado durante a atividade.", evidencias: [{ id: await foto(), capturada_em: fim.toISOString(), ...gps(2) }], ...gps(1) }, fim);
    }
  };

  const darCiencia = async (osId: string, supervisor: UsuarioAutenticado, quando: Date) => {
    await db.update(os).set({ cienciaPor: supervisor.id, cienciaEm: quando, cienciaAssinaturaPath: supervisor.assinaturaPath }).where(eq(os.id, osId));
    await recalcularStatusOs(db, osId);
    await enfileirarTarefa(db, "pdf_os", osId);
  };

  const resultado: Record<string, string> = {};
  for (const p of planos) {
    const [ordem] = await db.select({ id: os.id, status: os.status }).from(os).where(eq(os.numeroOrdem, p.numeroOrdem));
    if (!ordem) throw new Error(`A OS ${p.numeroOrdem} não foi importada`);
    const osId = ordem.id;
    // Já levada a outro status numa rodada anterior (ou cancelada pelo SAP): não repete.
    if (ordem.status !== "liberada") {
      resultado[p.numeroOrdem] = ordem.status;
      continue;
    }
    const eq_ = EQUIPES[p.centro];
    const sup = await pessoa(eq_.supervisor);
    const m = await modelo(eq_.modelo);
    const k = Number(p.numeroOrdem);
    const dupla = await Promise.all(p.matriculas.map(pessoa));
    const resp = dupla[0]!;
    const hora = p.hora;
    const dia = p.diasAtras;

    switch (p.cenario) {
      case "liberada":
        break;
      case "reservada":
        await reservarOs(db, sup, osId, resp.id, real);
        break;
      case "devolvida":
        await devolverOs(db, sup, osId, "Equipamento fora de operação até o fim do mês; a ordem precisa ser reprogramada no SAP.", new Date(real.getTime() - 3 * 3600_000));
        break;
      case "cancelada":
        break; // vem do SAP: feito pelo script principal
      case "em_execucao":
      case "em_pausa": {
        const [quandoApr, inicio] = noMesmoDia(real, p.cenario === "em_pausa" ? [130, 115, 55] : [95, 80]).slice(0, 2) as [Date, Date];
        const apr = await aprovar(resp, osId, m, dupla, quandoApr, { riscos: 2 });
        await executarOs(resp, osId, apr, dupla, p.cenario === "em_pausa" ? { inicio, resultado: "pausada", pausa: [60, 90], duracaoMin: 0 } : { inicio, resultado: "aberta", duracaoMin: 0 });
        break;
      }
      case "encerrando":
      case "aguardando":
      case "encerrada": {
        const apr = await aprovar(resp, osId, m, dupla, em(dia, hora, 0), { riscos: 2 });
        await executarOs(resp, osId, apr, dupla, { inicio: em(dia, hora, 15), duracaoMin: 100 + (k % 3) * 25, pausa: k % 2 === 0 ? [50, 62] : undefined, resultado: "encerrada", semAssinarEncerramento: p.cenario === "encerrando" });
        if (p.cenario === "encerrada") await darCiencia(osId, sup, em(Math.max(dia - 1, 0), 10, 30));
        break;
      }
      case "bloqueada":
        await aprovar(resp, osId, m, dupla, em(dia, hora, 0), { falhar: eliminatorios(m, 1) });
        break;
      case "suspensa": {
        const apr = await aprovar(resp, osId, m, dupla, em(dia, 8, 0), { riscos: 1 });
        await executarOs(resp, osId, apr, dupla, { inicio: em(dia, 8, 15), duracaoMin: 270, pausa: [110, 140], resultado: "suspensa" });
        break;
      }
      case "interrompida": {
        const apr = await aprovar(resp, osId, m, dupla, em(dia, hora, 0));
        await executarOs(resp, osId, apr, dupla, { inicio: em(dia, hora, 15), duracaoMin: 35, resultado: "interrompida", motivo: p.motivo });
        break;
      }
    }
    const [depois] = await db.select({ status: os.status }).from(os).where(eq(os.id, osId));
    resultado[p.numeroOrdem] = depois!.status;
  }
  return resultado;
}
