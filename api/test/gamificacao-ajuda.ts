/**
 * Ajuda dos testes da gamificação: monta o campo (equipe, técnicos, OS), faz a APR e a execução pelas rotas de evento (as
 * mesmas que a web usa) e lê o extrato direto do banco.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq, ne, sql } from "drizzle-orm";
import { itemModeloApr, lancamentoPontos, localInstalacao, modeloApr, os, type RegraCodigo } from "../src/db/schema";
import { criarAmbiente, type Ambiente, type OpcoesReq, type UsuarioDeTeste } from "./ajuda";

/** O relógio dos testes de gamificação: um dia útil de outubro de 2026, temporada Primavera 2026 (`2026-T4`). */
export const AGORA = new Date("2026-10-13T15:00:00Z");

export async function prepararCampo(opcoes: { relogio?: Date } = {}) {
  const amb = await criarAmbiente({ comCarga: true, relogio: opcoes.relogio ?? AGORA, duracaoDoTokenSeg: 90 * 86_400 });
  const equipe = await amb.criarEquipe({ nome: "Equipe A" });
  // A supervisora é da equipe A e a supervisiona (equipe.supervisor_id).
  const supervisor = await amb.criarUsuario({ perfil: "tecnico", nome: "Sandra Supervisora", equipeId: equipe.id, supervisor: true });
  const admin = await amb.criarUsuario({ perfil: "admin", nome: "Admin" });
  const [m] = await amb.db.select().from(modeloApr).where(eq(modeloApr.codigo, "APR 01"));
  const itens = await amb.db.select().from(itemModeloApr).where(eq(itemModeloApr.modeloAprId, m!.id));
  const [local] = await amb.db.insert(localInstalacao).values({ codigo: "VILA VELHA/REDE", critico: false }).returning();
  const [localCritico] = await amb.db.insert(localInstalacao).values({ codigo: "ERP SERRA", critico: true }).returning();
  let contadorOs = 4_200_000;

  const agora = () => amb.relogio.agora.toISOString();
  const enviar = (como: UsuarioDeTeste, ...eventos: unknown[]) => amb.esperar(200, "POST", "/eventos", { como, json: { eventos } });
  const evento = (tipo: string, payload: object, osId?: string) => ({ id: randomUUID(), tipo, os_id: osId ?? null, payload, ocorrido_em: agora() });
  const foto = async () => {
    const id = randomUUID();
    await amb.armazenamento.gravar("fotos", id, new Uint8Array([1]), "image/png");
    return id;
  };

  /** Técnico da equipe (com assinatura cadastrada). */
  const tecnico = (nome?: string, equipeId: string = equipe.id) => amb.criarUsuario({ perfil: "tecnico", equipeId, ...(nome ? { nome } : {}) });

  /** OS nova da equipe (corretiva, em local comum, programada para hoje). */
  async function novaOs(dados: Partial<typeof os.$inferInsert> & { critico?: boolean } = {}) {
    const { critico, ...resto } = dados;
    const [o] = await amb.db
      .insert(os)
      .values({
        numeroOrdem: String(++contadorOs),
        tipo: "corretiva",
        titulo: "DCV Desobstrução",
        localInstalacaoId: critico ? localCritico!.id : local!.id,
        equipeId: equipe.id,
        dataInicioProg: "2026-10-13",
        origem: "sap",
        ...resto,
      })
      .returning();
    return o!;
  }

  /** As respostas que não bloqueiam; com `bloquear`, o primeiro item eliminatório de verificação fica reprovado. */
  function respostas(bloquear = false) {
    const verificacao = itens.filter((i) => i.secao === "verificacao");
    const reprovado = bloquear ? verificacao.find((i) => i.tipo === "eliminatorio")! : null;
    return {
      reprovado,
      lista: verificacao.map((i) => (i.id === reprovado?.id ? { item_id: i.id, resposta: i.respostaBloqueante!, observacao: "Vazamento de gás" } : { item_id: i.id, resposta: i.respostaBloqueante === "sim" ? "nao" : "sim" })),
    };
  }

  /** Corpo de uma APR; o primeiro participante é o responsável. */
  async function corpoDaApr(participantes: UsuarioDeTeste[], o: { bloquear?: boolean; comEvidencia?: boolean } = {}) {
    const { reprovado, lista } = respostas(o.bloquear);
    return {
      id: randomUUID(),
      modelo_apr_id: m!.id,
      participantes: participantes.map((u, i) => ({ usuario_id: u.id, funcao: i === 0 ? "responsavel" : "executor" })),
      riscos: [],
      respostas: lista,
      evidencias: reprovado && o.comEvidencia !== false ? [{ id: await foto(), item_id: reprovado.id, capturada_em: agora() }] : [],
      observacao_geral: null,
      concluida_em: agora(),
    };
  }

  /** APR aprovada pelo evento `apr_concluida`; devolve o id e a resposta (com `pontos_ganhos`). */
  async function apr(como: UsuarioDeTeste, osId: string, participantes: UsuarioDeTeste[] = [como]) {
    const corpo = await corpoDaApr(participantes);
    const resposta = await enviar(como, evento("apr_concluida", corpo, osId));
    assert.equal(resposta.rejeitados.length, 0, JSON.stringify(resposta.rejeitados));
    return { aprId: corpo.id as string, resposta };
  }

  /** APR bloqueada como o app faz: `POST /aprs/avaliar` registra (sem evidência) e a evidência chega depois, no `apr_concluida`. */
  async function aprBloqueada(como: UsuarioDeTeste, osId: string, participantes: UsuarioDeTeste[] = [como]) {
    const corpo = await corpoDaApr(participantes, { bloquear: true });
    const { evidencias, ...semEvidencia } = corpo;
    // Na validação o técnico ainda não sabe o que reprovou: o item reprovado vai sem observação (ela chega com a evidência).
    const semObservacao = corpo.respostas.map(({ item_id, resposta }) => ({ item_id, resposta }));
    const avaliacao = await amb.esperar(200, "POST", "/aprs/avaliar", { como, json: { ...semEvidencia, respostas: semObservacao, os_id: osId } });
    assert.equal(avaliacao.resultado, "bloqueada");
    return {
      aprId: corpo.id as string,
      /** Envia a evidência (a observação já foi na validação). */
      async enviarEvidencia() {
        const r = await enviar(como, evento("apr_concluida", corpo, osId));
        assert.equal(r.rejeitados.length, 0, JSON.stringify(r.rejeitados));
        return r;
      },
    };
  }

  async function iniciar(como: UsuarioDeTeste, osId: string, aprId: string) {
    const id = randomUUID();
    const r = await enviar(como, evento("execucao_iniciada", { id, apr_id: aprId, inicio: agora() }, osId));
    assert.equal(r.rejeitados.length, 0, JSON.stringify(r.rejeitados));
    return id;
  }

  /** Encerra com a foto e a assinatura de todos os `participantes` (os da APR). */
  async function encerrar(como: UsuarioDeTeste, execId: string, participantes: UsuarioDeTeste[] = [como]) {
    const r = await enviar(
      como,
      evento("execucao_encerrada", {
        execucao_id: execId,
        fim: agora(),
        descricao_atividade: "Serviço feito",
        evidencias: [{ id: await foto(), capturada_em: agora() }],
        assinaturas: participantes.map((u) => ({ usuario_id: u.id })),
      }),
    );
    assert.equal(r.rejeitados.length, 0, JSON.stringify(r.rejeitados));
    return r;
  }

  async function interromper(como: UsuarioDeTeste, execId: string) {
    const r = await enviar(como, evento("execucao_interrompida", { execucao_id: execId, fim: agora(), motivo: "Risco de queda", evidencias: [{ id: await foto(), capturada_em: agora() }] }));
    assert.equal(r.rejeitados.length, 0, JSON.stringify(r.rejeitados));
    return r;
  }

  async function suspender(como: UsuarioDeTeste, execId: string) {
    const r = await enviar(como, evento("execucao_suspensa", { execucao_id: execId, fim: agora() }));
    assert.equal(r.rejeitados.length, 0, JSON.stringify(r.rejeitados));
    return r;
  }

  /** APR aprovada, execução e encerramento de uma vez. Devolve o id da execução e a resposta do encerramento. */
  async function servico(como: UsuarioDeTeste, osId: string, participantes: UsuarioDeTeste[] = [como]) {
    const { aprId, resposta: daApr } = await apr(como, osId, participantes);
    const execId = await iniciar(como, osId, aprId);
    const daExecucao = await encerrar(como, execId, participantes);
    return { aprId, execId, daApr, daExecucao };
  }

  /** O extrato da pessoa no banco; sem as conquistas (que cada teste confere à parte). */
  const extrato = (usuarioId: string, incluirConquistas = false) =>
    amb.db
      .select()
      .from(lancamentoPontos)
      .where(and(eq(lancamentoPontos.usuarioId, usuarioId), incluirConquistas ? undefined : ne(lancamentoPontos.regra, "conquista_obtida")))
      .orderBy(lancamentoPontos.ocorridoEm, lancamentoPontos.criadoEm);
  const regrasDe = async (usuarioId: string): Promise<RegraCodigo[]> => (await extrato(usuarioId)).map((l) => l.regra as RegraCodigo).sort();
  const pontosDe = async (usuarioId: string, incluirConquistas = false) => (await extrato(usuarioId, incluirConquistas)).reduce((t, l) => t + l.pontos, 0);
  const totalDeLancamentos = async () => (await amb.db.select({ n: sql<number>`count(*)::int` }).from(lancamentoPontos))[0]!.n;

  const como = (u: UsuarioDeTeste, metodo: string, caminho: string, o: OpcoesReq = {}) => amb.req(metodo, caminho, { ...o, como: u });

  return {
    amb,
    supervisor,
    admin,
    equipe,
    modelo: m!,
    itens,
    local: local!,
    localCritico: localCritico!,
    agora,
    enviar,
    evento,
    foto,
    tecnico,
    novaOs,
    corpoDaApr,
    apr,
    aprBloqueada,
    iniciar,
    encerrar,
    interromper,
    suspender,
    servico,
    extrato,
    regrasDe,
    pontosDe,
    totalDeLancamentos,
    como,
  };
}

/** PNG só com o cabeçalho (o envio confere o tipo e as dimensões, não decodifica a imagem). */
export function pngDeTeste(largura = 128, altura = 128): Uint8Array<ArrayBuffer> {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(largura, 16);
  b.writeUInt32BE(altura, 20);
  b.set([8, 6, 0, 0, 0], 24);
  return new Uint8Array(b);
}
export const arquivoPng = (largura = 128, altura = largura) => new File([pngDeTeste(largura, altura)], "imagem.png", { type: "image/png" });

export function formulario(campos: Record<string, string | number | boolean | null | undefined>, imagem: File | null = arquivoPng()) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) if (v !== undefined && v !== null) f.set(k, String(v));
  if (imagem) f.set("imagem", imagem);
  return f;
}

export type Campo = Awaited<ReturnType<typeof prepararCampo>>;
export type { Ambiente, UsuarioDeTeste };
