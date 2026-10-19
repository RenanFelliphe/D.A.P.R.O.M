import { randomUUID } from "node:crypto";
import { and, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/conexao";
import { APR_FUNCOES, APR_RESPOSTAS, digitalizacao, importacao, itemModeloApr, modeloApr, os, usuario } from "../db/schema";
import type { Deps } from "../deps";
import { conflito, invalido, naoEncontrado } from "../http/erros";
import { montarPdfDasFolhas } from "../servicos/pdf-folhas";
import { registrarAuditoria, type Ator } from "./auditoria";
import { BUCKET_DAS_FOLHAS, caminhoDaFolha, type LeituraDaDigitalizacao, type OsDigitalizada } from "./digitalizacao";
import { processarOrdens, type DadosDaAprEmPapel, type DadosDoHistorico } from "./importacao-ordens";

/**
 * Digitalização de OS antigas, o registro: a pessoa conferiu a leitura (`digitalizacao-leitura`) e manda cada OS com os campos
 * corrigidos e o que a folha diz da execução. O registro usa a leitura GUARDADA, nunca lê de novo: a IA custa e não responde
 * igual duas vezes. Cada OS entra encerrada, de histórico (`importacao-ordens.ts`), com o PDF das folhas dela.
 */

/** `AAAA-MM-DDTHH:MM`, no horário de São Paulo, de uma data e hora que existem. */
const instanteLocal = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "use AAAA-MM-DDTHH:MM")
  .refine((v) => {
    const [a, m, d, h, min] = v.split(/[-T:]/).map(Number) as [number, number, number, number, number];
    const data = new Date(Date.UTC(a, m - 1, d, h, min));
    return data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === d && h < 24 && min < 60;
  }, "data ou hora inexistente");
/** O horário de São Paulo é fixo em UTC-3 (sem horário de verão desde 2019), como em `inicioDoDia`. */
const emSaoPaulo = (v: string) => new Date(`${v}:00-03:00`);

/** A APR em papel como a pessoa a conferiu: o modelo escolhido, o que a folha diz e a resposta de cada item marcado. */
const esquemaApr = z.object({
  modelo_id: z.uuid(),
  data_hora: instanteLocal.nullable(),
  servico: z.string().trim().max(500).nullable(),
  participantes: z
    .array(
      z.object({
        nome: z.string().trim().min(1, "toda pessoa da APR precisa de nome").max(200),
        matricula: z.string().trim().max(30).nullable(),
        funcao: z.enum(APR_FUNCOES),
      }),
    )
    .max(20),
  respostas: z.array(z.object({ item_id: z.uuid(), resposta: z.enum(APR_RESPOSTAS) })).max(300),
});
export type AprConferida = z.infer<typeof esquemaApr>;

export const esquemaRegistro = z.object({
  ordens: z
    .array(
      z.object({
        /** O número da ordem como foi lido, para achar a OS na leitura guardada; o `numero_ordem` abaixo é o que a pessoa confirmou. */
        chave: z.string().trim().min(1),
        ordem: z.looseObject({ numero_ordem: z.string().trim().min(1, "toda OS precisa do número da ordem") }),
        execucao: z.object({
          inicio: instanteLocal.nullable(),
          fim: instanteLocal.nullable(),
          numero_pessoas: z.number().int().min(1).max(50).nullable(),
          texto: z.string().trim().max(4000).nullable(),
        }),
        /** A APR em papel desta OS; sem ela (ou `null`), só a OS é registrada e a folha da APR fica nas imagens do PDF. */
        apr: esquemaApr.nullish(),
      }),
    )
    .min(1, "escolha ao menos uma OS")
    .max(60, "no máximo 60 OS por PDF"),
});
export type CorpoDoRegistro = z.infer<typeof esquemaRegistro>;

/** Os pares `[nome, matrícula, função]`, as respostas por item e o resto da APR, numa forma que só muda se a pessoa mudar algo. */
function assinaturaDaApr(a: { modelo_id: string | null; data_hora: string | null; servico: string | null; participantes: { nome: string | null; matricula: string | null; funcao: string }[]; respostas: { item_id: string; resposta: string }[] }) {
  return JSON.stringify([
    a.modelo_id,
    a.data_hora || null,
    a.servico || null,
    a.participantes.map((p) => [p.nome || null, p.matricula || null, p.funcao]),
    [...a.respostas].sort((x, y) => x.item_id.localeCompare(y.item_id)).map((r) => [r.item_id, r.resposta]),
  ]);
}

/**
 * Confere a APR em papel que a pessoa mandou com a OS e a deixa pronta para gravar. Só vale se a leitura achou a folha da APR nesta
 * OS; o modelo tem de estar publicado e as respostas têm de ser de itens dele. Quem tem conta no sistema fica ligado a ela.
 */
async function prepararApr(deps: Deps, numero: string, lida: OsDigitalizada, apr: AprConferida | null | undefined): Promise<DadosDaAprEmPapel | null> {
  if (!apr) return null;
  const lidaApr = lida.apr ?? null;
  if (!lidaApr) throw invalido("apr_fora_da_leitura", `OS ${numero}: a leitura não achou folha de APR nesta OS`);
  const [modelo] = await deps.db.select({ id: modeloApr.id }).from(modeloApr).where(and(eq(modeloApr.id, apr.modelo_id), isNotNull(modeloApr.publicadoEm)));
  if (!modelo) throw invalido("modelo_apr_invalido", `OS ${numero}: o modelo da APR não existe ou não está publicado`);
  const itens = new Set((await deps.db.select({ id: itemModeloApr.id }).from(itemModeloApr).where(eq(itemModeloApr.modeloAprId, modelo.id))).map((i) => i.id));
  const vistos = new Set<string>();
  for (const r of apr.respostas) {
    if (!itens.has(r.item_id)) throw invalido("apr_resposta_invalida", `OS ${numero}: uma resposta da APR é de um item que não é do modelo escolhido`);
    if (vistos.has(r.item_id)) throw invalido("apr_resposta_invalida", `OS ${numero}: o mesmo item da APR veio respondido duas vezes`);
    vistos.add(r.item_id);
  }
  if (apr.participantes.filter((p) => p.funcao === "responsavel").length > 1) {
    throw invalido("apr_participantes_invalidos", `OS ${numero}: a APR só tem um Supervisor da Atividade`);
  }
  const participantes: DadosDaAprEmPapel["participantes"] = [];
  for (const p of apr.participantes) {
    const matricula = p.matricula || null;
    const [conta] = matricula ? await deps.db.select({ id: usuario.id }).from(usuario).where(eq(usuario.matricula, matricula)) : [];
    participantes.push({ nome: p.nome, matricula, funcao: p.funcao, usuario_id: conta?.id ?? null });
  }
  const vazia = !apr.data_hora && !apr.servico && participantes.length === 0 && apr.respostas.length === 0;
  const igualAoLido =
    lidaApr.lido_por === "ia" &&
    assinaturaDaApr({ ...apr, participantes: apr.participantes }) ===
      assinaturaDaApr({ modelo_id: lidaApr.modelo?.id ?? null, data_hora: lidaApr.data_hora, servico: lidaApr.servico, participantes: lidaApr.participantes, respostas: lidaApr.respostas });
  return {
    paginas: lidaApr.paginas,
    modeloAprId: modelo.id,
    dataHora: apr.data_hora ? emSaoPaulo(apr.data_hora) : null,
    servico: apr.servico || null,
    participantes,
    respostas: apr.respostas,
    fonte: vazia ? "nenhuma" : igualAoLido ? "ia" : "manual",
  };
}

export async function registrarDigitalizacao(deps: Deps, eu: Ator & { id: string }, id: string, corpo: CorpoDoRegistro) {
  const [lote] = await deps.db.select().from(digitalizacao).where(eq(digitalizacao.id, id));
  if (!lote) throw naoEncontrado("Digitalização não encontrada");
  if (lote.estado !== "lida" || !lote.leitura) throw conflito("digitalizacao_nao_lida", "Esta digitalização não está pronta para registrar");
  const leitura = lote.leitura as LeituraDaDigitalizacao;

  const lidas = new Map(leitura.ordens.map((o) => [o.chave, o]));
  const chaves = new Set<string>();
  const numeros = new Set<string>();
  for (const e of corpo.ordens) {
    if (!lidas.has(e.chave)) throw invalido("ordem_fora_do_pdf", `A ordem ${e.chave} não está nesta digitalização`);
    if (chaves.has(e.chave)) throw invalido("ordem_repetida", `A ordem ${e.chave} veio repetida`);
    chaves.add(e.chave);
    const numero = e.ordem.numero_ordem.trim();
    if (numeros.has(numero)) throw invalido("ordem_repetida", `Duas folhas ficaram com o número de ordem ${numero}`);
    numeros.add(numero);
    if (e.execucao.inicio && e.execucao.fim && e.execucao.fim < e.execucao.inicio) {
      throw invalido("execucao_invalida", `OS ${numero}: o fim real é anterior ao início real`);
    }
  }

  // O PDF das folhas de cada OS: o id da OS que existe, ou o da que vai nascer.
  const historico = new Map<string, DadosDoHistorico>();
  const guardados: string[] = [];
  const entradas: { ordem: unknown }[] = [];
  try {
    for (const e of corpo.ordens) {
      const lida = lidas.get(e.chave)!;
      const numero = e.ordem.numero_ordem.trim();
      const [existente] = await deps.db.select({ id: os.id, status: os.status }).from(os).where(eq(os.numeroOrdem, numero));
      const osId = existente?.id ?? randomUUID();
      // Só a OS nova, ou a que ainda está liberada, ganha o PDF das folhas: o de uma OS que o sistema já encerrou não se toca (a
      // transação recusa a folha dela).
      if (!existente || existente.status === "liberada") {
        const jpegs: Uint8Array[] = [];
        for (const n of lida.paginas) {
          const bytes = await deps.armazenamento.ler(BUCKET_DAS_FOLHAS, caminhoDaFolha(id, n));
          if (!bytes) throw conflito("folha_sumiu", `A folha ${n} deste PDF não está mais guardada: envie o PDF de novo.`);
          jpegs.push(bytes);
        }
        const pdf = await montarPdfDasFolhas(jpegs, `OS ${numero} (digitalizada)`);
        await deps.armazenamento.gravar("pdfs", osId, pdf, "application/pdf", { sobrescrever: true });
        guardados.push(osId);
      }

      const lido = lida.manuscrito;
      const igualAoLido =
        lido.lido_por === "ia" &&
        (lido.inicio ?? null) === e.execucao.inicio &&
        (lido.fim ?? null) === e.execucao.fim &&
        (lido.pessoas ?? null) === e.execucao.numero_pessoas &&
        (lido.texto ?? null) === (e.execucao.texto || null);
      const vazio = !e.execucao.inicio && !e.execucao.fim && !e.execucao.numero_pessoas && !e.execucao.texto;
      historico.set(numero, {
        osId,
        digitalizacaoId: id,
        usuarioId: eu.id,
        pdfPath: osId,
        paginas: lida.paginas,
        inicioReal: e.execucao.inicio ? emSaoPaulo(e.execucao.inicio) : null,
        fimReal: e.execucao.fim ? emSaoPaulo(e.execucao.fim) : null,
        numeroPessoas: e.execucao.numero_pessoas,
        textoManuscrito: e.execucao.texto || null,
        fonte: vazio ? "nenhuma" : igualAoLido ? "ia" : "manual",
        // A APR só acompanha a OS que a folha encerra (a que o sistema já encerrou não é tocada e nem guarda a APR).
        apr: !existente || existente.status === "liberada" ? await prepararApr(deps, numero, lida, e.apr) : null,
      });
      entradas.push({ ordem: { ...e.ordem, numero_ordem: numero } });
    }

    const agora = deps.agora();
    const importacaoId = randomUUID();
    const resultado = await deps.db.transaction(async (tx) => {
      const db = tx as unknown as Db;
      // Duas conferências registrando o mesmo PDF ao mesmo tempo: a segunda espera e encontra o lote já registrado.
      const [travado] = await db.select({ estado: digitalizacao.estado }).from(digitalizacao).where(eq(digitalizacao.id, id)).for("update");
      if (travado?.estado !== "lida") throw conflito("digitalizacao_nao_lida", "Esta digitalização já foi registrada ou descartada");
      const processado = await processarOrdens(db, entradas, { origem: "digitalizacao", agora, historico });
      await db.insert(importacao).values({
        id: importacaoId,
        origem: "digitalizacao",
        arquivo: lote.arquivo,
        usuarioId: eu.id,
        criadas: processado.criadas,
        atualizadas: processado.atualizadas,
        ignoradas: processado.ignoradas.length,
        detalheIgnoradas: processado.ignoradas,
        avisos: processado.avisos.length,
        detalheAvisos: processado.avisos.length ? processado.avisos : null,
      });
      // Se nenhuma OS entrou (todas recusadas), o lote segue `lida`: a pessoa corrige e tenta de novo.
      if (processado.registradas.length > 0) {
        await db.update(digitalizacao).set({ estado: "registrada", importacaoId, atualizadaEm: agora }).where(and(eq(digitalizacao.id, id), eq(digitalizacao.estado, "lida")));
      } else {
        await db.delete(importacao).where(eq(importacao.id, importacaoId));
      }
      return processado;
    });

    // O PDF de uma OS que a transação recusou não tem a quem pertencer.
    const registradas = new Set(resultado.registradas.map((r) => r.osId));
    await Promise.all(guardados.filter((g) => !registradas.has(g)).map((g) => deps.armazenamento.remover("pdfs", g).catch(() => undefined)));

    if (resultado.registradas.length > 0) {
      await registrarAuditoria(deps.db, eu, {
        entidade: "importacao",
        verbo: "digitalizacao",
        entidadeId: importacaoId,
        alvo: lote.nomeArquivo,
        resumo: `Digitalizou ${lote.nomeArquivo}: ${resultado.criadas} OS criadas e ${resultado.atualizadas} encerradas pela folha, ${resultado.ignoradas.length} ignoradas`,
        detalhes: { criadas: resultado.criadas, atualizadas: resultado.atualizadas, ignoradas: resultado.ignoradas.length, ordens: resultado.registradas.map((r) => r.numero_ordem) },
      });
    }
    return {
      importacaoId: resultado.registradas.length > 0 ? importacaoId : null,
      criadas: resultado.criadas,
      atualizadas: resultado.atualizadas,
      ignoradas: resultado.ignoradas,
      avisos: resultado.avisos,
      registradas: resultado.registradas,
    };
  } catch (erro) {
    await Promise.all(guardados.map((g) => deps.armazenamento.remover("pdfs", g).catch(() => undefined)));
    throw erro;
  }
}
