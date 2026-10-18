/**
 * Fixture dos testes de PDF, relatório da execução, e-mail e tarefas: monta direto nas tabelas uma OS com modelo de APR, APR,
 * execução, assinaturas e fotos, no modelo de dados da Reunião 3 (a APR assinada por cada participante, o encerramento assinado
 * só pelo responsável e a assinatura final do supervisor). Não passa pelas rotas de evento, para testar só essas fatias.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  alerta,
  apr,
  aprParticipante,
  aprResposta,
  aprRisco,
  evidencia,
  execucao,
  execucaoAssinatura,
  execucaoPausa,
  itemModeloApr,
  localInstalacao,
  modeloApr,
  os,
  riscoModeloApr,
  usuario,
} from "../src/db/schema";
import type { Ambiente } from "./ajuda";

/** PNG 1x1 válido, para o pdfkit ler. */
export const PNG_VALIDO = Uint8Array.from(
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/VscvDQAAAABJRU5ErkJggg==", "base64"),
);

export const hora = (iso: string) => new Date(iso);

export interface OpcoesOs {
  equipeId: string;
  status?: "liberada" | "pendente" | "em_execucao" | "encerrando" | "aguardando_supervisor" | "encerrada" | "cancelada";
  numeroOrdem?: string;
  /**
   * Cria a execução encerrada (e a APR aprovada que a amparou). O que mais existe depende do status: em `encerrando` o responsável
   * ainda não assinou o encerramento; a partir de `aguardando_supervisor` ele assinou (uma só assinatura: a dele); em `encerrada`
   * (o padrão) o supervisor também assinou. Outro status (`pendente`, por exemplo) fica com o encerramento assinado e sem a do supervisor.
   */
  encerrada?: boolean;
  /** Assinatura final do supervisor (os.ciencia_*): padrão = só no status `encerrada`. */
  ciencia?: boolean;
  /** Quem deu a assinatura final (o padrão é um supervisor criado pela fixture). */
  cienciaPor?: string;
  /** Trecho anterior de outro dia (a atividade de vários dias): suspenso (padrão) ou interrompido por risco. */
  trechoAnterior?: boolean | "interrompida";
  /** Cria a execução sem endereço em coordenadas: início, pausa e fim sem localização. */
  semLocalizacao?: boolean;
  /** Acrescenta uma pausa de saúde na execução que encerrou (lesão, por padrão). */
  saude?: "lesao" | "enfermidade";
  /** Um terceiro participante da APR que recusou (direito de recusa) e saiu dela. */
  recusante?: boolean;
  /** O modelo da APR não tem a coluna "Assinatura" na tabela de participantes (APR 01, 02, 03, 07, 09). */
  modeloSemColunaDeAssinatura?: boolean;
  /** Evidências em PDF (laudos) da execução que encerrou. */
  documentos?: number;
  fotos?: number;
  /** Grava os bytes das fotos e assinaturas no armazenamento (padrão: sim). */
  gravarImagens?: boolean;
  /** Bytes que o armazenamento devolve para as fotos. */
  bytesFoto?: Uint8Array;
}

export interface OsBasica {
  osId: string;
  numeroOrdem: string;
  localId: string;
}
export interface OsEncerrada extends OsBasica {
  execId: string;
  aprId: string;
  supervisorDaAprId: string;
  executanteId: string;
  /** Quem deu a assinatura final do supervisor (nulo quando a OS ainda não chegou lá). */
  supervisorId: string | null;
  recusanteId: string | null;
  anteriorId: string | null;
  fotos: string[];
  modeloId: string;
  itens: [string, string, string];
}

/** OS com APR aprovada e uma execução encerrada com 2 executantes, uma pausa de 30 min e as fotos pedidas. */
export async function criarOs(amb: Ambiente, o: OpcoesOs & { encerrada: true }): Promise<OsEncerrada>;
export async function criarOs(amb: Ambiente, o: OpcoesOs): Promise<OsBasica>;
export async function criarOs(amb: Ambiente, o: OpcoesOs): Promise<OsBasica | OsEncerrada> {
  const { db } = amb;
  const status = o.status ?? (o.encerrada ? "encerrada" : "liberada");
  const [local] = await db.insert(localInstalacao).values({ codigo: `LOCAL/${randomUUID().slice(0, 6)}`, endereco: "Rua das Flores, 10", critico: true }).returning();
  const numeroOrdem = o.numeroOrdem ?? `40${Math.floor(Math.random() * 1e5)}`;
  const [ordem] = await db
    .insert(os)
    .values({
      numeroOrdem,
      numeroNota: "N-123",
      tipo: "corretiva",
      tipoAtividade: "Desobstrução de DCV",
      titulo: "DCV Desobstrução de dreno",
      descricao: "Dreno entupido",
      equipamento: "DCV-01",
      localInstalacaoId: local!.id,
      equipeId: o.equipeId,
      prioridade: "Muito alto",
      dataInicioProg: "2026-10-09",
      dataFimProg: "2026-10-10",
      status,
      dataOrdem: "2026-10-01",
      criadoPorSap: "RFAVARO",
      origem: "sap",
    })
    .returning();
  const osId = ordem!.id;
  if (!o.encerrada) return { osId, numeroOrdem, localId: local!.id };

  const sup = await criarUsuarioSemLogin(amb, { nome: "Elismário dos Santos", matricula: `S${randomUUID().slice(0, 5)}`, cargo: "Técnico em Elétrica", registro: "ES-050003/D", equipeId: o.equipeId });
  const exe = await criarUsuarioSemLogin(amb, { nome: "Damião Pestana", matricula: `E${randomUUID().slice(0, 5)}`, cargo: "Eletricista", registro: null, equipeId: o.equipeId });

  const [modelo] = await db
    .insert(modeloApr)
    .values({
      codigo: `APR ${randomUUID().slice(0, 4)}`,
      versao: 4,
      dataDocumento: "2026-07-24",
      titulo: "ESPAÇO CONFINADO E/OU TRABALHO EM ALTURA",
      participantesComAssinatura: !o.modeloSemColunaDeAssinatura,
      pae: { titulo: "Plano de atendimento a Emergências - PAE", linhas: [{ rotulo: "Equipes", celulas: [{ coluna: 1, texto: "Grande Vitória" }, { coluna: 2, texto: "(27) 99999-0000" }] }] },
    })
    .returning();
  const [risco] = await db.insert(riscoModeloApr).values({ modeloAprId: modelo!.id, classificacao: "Veicular", nome: "Insolação", ordem: 1 }).returning();
  const [i1, i2, i3] = await db
    .insert(itemModeloApr)
    .values([
      { modeloAprId: modelo!.id, secao: "verificacao", ordem: 1, texto: "O local está sinalizado?", respostaBloqueante: "nao", tipo: "eliminatorio" },
      { modeloAprId: modelo!.id, secao: "verificacao", ordem: 2, texto: "O serviço requer iluminação auxiliar?", respostaBloqueante: "sim", tipo: "alerta" },
      { modeloAprId: modelo!.id, secao: "medida_preventiva", riscoId: risco!.id, ordem: 3, texto: "Faz uso do protetor solar?", tipo: "alerta" },
    ])
    .returning();

  // Modelo publicado é imutável: itens e riscos entram no rascunho, que só então é publicado.
  await db.update(modeloApr).set({ publicadoEm: hora("2026-07-24T12:00:00Z") }).where(eq(modeloApr.id, modelo!.id));

  const aprId = randomUUID();
  await db.insert(apr).values({ id: aprId, osId, modeloAprId: modelo!.id, preenchidaPor: sup.id, resultado: "aprovada", observacaoGeral: "Sem intercorrências", concluidaEm: hora("2026-10-09T11:50:00Z") });
  // Cada um assinou a APR na própria conta; o executante, no aparelho do responsável (presencial).
  await db.insert(aprParticipante).values([
    { aprId, usuarioId: sup.id, funcao: "responsavel", assinaturaPath: sup.assinatura, assinadaEm: hora("2026-10-09T11:51:00Z") },
    { aprId, usuarioId: exe.id, funcao: "executor", assinaturaPath: exe.assinatura, assinadaEm: hora("2026-10-09T11:52:00Z"), assinaturaPresencial: true },
  ]);
  let recusanteId: string | null = null;
  if (o.recusante) {
    const rec = await criarUsuarioSemLogin(amb, { nome: "Rita Recusante", matricula: `R${randomUUID().slice(0, 5)}`, cargo: "Auxiliar", registro: null, equipeId: o.equipeId });
    recusanteId = rec.id;
    await db.insert(aprParticipante).values({ aprId, usuarioId: rec.id, funcao: "executor", recusouEm: hora("2026-10-09T11:45:00Z"), recusaMotivo: "Não me sinto bem para trabalhar hoje" });
  }
  await db.insert(aprRisco).values({ aprId, riscoId: risco!.id });
  await db.insert(aprResposta).values([
    { aprId, itemId: i1!.id, resposta: "sim", respondidaEm: hora("2026-10-09T11:40:00Z") },
    { aprId, itemId: i2!.id, resposta: "sim", observacao: "Lanterna de cabeça", respondidaEm: hora("2026-10-09T11:41:00Z") },
    { aprId, itemId: i3!.id, resposta: "nao", respondidaEm: hora("2026-10-09T11:42:00Z") },
  ]);

  // Onde a pessoa estava (início, pausa e fim): nulo = "sem localização".
  const gps = (lat: number, lng: number) => (o.semLocalizacao ? {} : { latitude: lat, longitude: lng });
  let anteriorId: string | null = null;
  if (o.trechoAnterior) {
    const anteriorApr = randomUUID();
    anteriorId = randomUUID();
    await db.insert(apr).values({ id: anteriorApr, osId, modeloAprId: modelo!.id, preenchidaPor: sup.id, resultado: "aprovada", concluidaEm: hora("2026-10-08T11:50:00Z") });
    await db.insert(aprParticipante).values({ aprId: anteriorApr, usuarioId: sup.id, funcao: "responsavel", assinaturaPath: sup.assinatura, assinadaEm: hora("2026-10-08T11:51:00Z") });
    const interrompida = o.trechoAnterior === "interrompida";
    await db.insert(execucao).values({
      id: anteriorId,
      osId,
      aprId: anteriorApr,
      executorId: sup.id,
      numeroPessoas: 2,
      inicio: hora("2026-10-08T12:00:00Z"),
      fim: hora("2026-10-08T14:00:00Z"),
      resultado: interrompida ? "interrompida" : "suspensa",
      ...(interrompida ? { motivo: "Vazamento no ramal" } : { suspensaoMotivo: "fim_expediente" as const }),
      ...(o.semLocalizacao ? {} : { inicioLatitude: -20.3, inicioLongitude: -40.3, fimLatitude: -20.3001, fimLongitude: -40.3002 }),
    });
  }

  // O encerramento tem dois passos: o clique grava o fim (`encerrando`); o responsável assina depois (a única assinatura do encerramento).
  const assinouOEncerramento = status !== "encerrando";
  const execId = randomUUID();
  await db.insert(execucao).values({
    id: execId,
    osId,
    aprId,
    executorId: sup.id,
    numeroPessoas: 2,
    inicio: hora("2026-10-09T12:00:00Z"),
    fim: hora("2026-10-09T15:00:00Z"),
    resultado: "encerrada",
    descricaoAtividade: "Dreno desobstruído e testado",
    encerramentoAssinadoEm: assinouOEncerramento ? hora("2026-10-09T15:01:00Z") : null,
    ...(o.semLocalizacao ? {} : { inicioLatitude: -20.3155, inicioLongitude: -40.3128, fimLatitude: -20.3158, fimLongitude: -40.313 }),
  });
  await db.insert(execucaoPausa).values({ id: randomUUID(), execucaoId: execId, inicio: hora("2026-10-09T13:00:00Z"), fim: hora("2026-10-09T13:30:00Z"), motivo: "aguardando", complemento: "Peça do almoxarifado", ...gps(-20.3156, -40.3129) });
  if (o.saude) {
    await db.insert(execucaoPausa).values({ id: randomUUID(), execucaoId: execId, inicio: hora("2026-10-09T14:00:00Z"), fim: hora("2026-10-09T14:10:00Z"), motivo: o.saude, ...gps(-20.3157, -40.3127) });
  }
  if (assinouOEncerramento) {
    await db.insert(execucaoAssinatura).values({ execucaoId: execId, usuarioId: sup.id, assinaturaPath: sup.assinatura, assinadaEm: hora("2026-10-09T15:01:00Z") });
  }
  const fotos: string[] = [];
  for (let i = 0; i < (o.fotos ?? 0); i++) {
    const fotoPath = randomUUID();
    fotos.push(fotoPath);
    await db.insert(evidencia).values({ id: randomUUID(), execucaoId: execId, fotoPath, capturadaEm: hora("2026-10-09T14:30:00Z"), latitude: i === 0 ? -20.3155 : null, longitude: i === 0 ? -40.3128 : null });
    if (o.gravarImagens !== false) await amb.armazenamento.gravar("fotos", fotoPath, o.bytesFoto ?? PNG_VALIDO, "image/png");
  }
  for (let i = 0; i < (o.documentos ?? 0); i++) {
    await db.insert(evidencia).values({ id: randomUUID(), execucaoId: execId, tipo: "pdf", fotoPath: randomUUID(), nomeArquivo: `laudo-${i + 1}.pdf`, capturadaEm: hora("2026-10-09T14:40:00Z") });
  }

  // A assinatura final do supervisor (a ciência): só na OS concluída, ou quando o teste pede.
  let supervisorId: string | null = null;
  if (o.ciencia ?? status === "encerrada") {
    supervisorId = o.cienciaPor ?? (await criarUsuarioSemLogin(amb, { nome: "Heloísa Supervisora", matricula: `H${randomUUID().slice(0, 5)}`, cargo: "Supervisora de Manutenção", registro: null, equipeId: o.equipeId })).id;
    const [u] = await db.select({ assinaturaPath: usuario.assinaturaPath }).from(usuario).where(eq(usuario.id, supervisorId));
    await db.update(os).set({ cienciaPor: supervisorId, cienciaEm: hora("2026-10-10T14:30:00Z"), cienciaAssinaturaPath: u!.assinaturaPath }).where(eq(os.id, osId));
    if (o.gravarImagens !== false && u!.assinaturaPath) await amb.armazenamento.gravar("assinaturas", u!.assinaturaPath, PNG_VALIDO, "image/png");
  }
  if (o.gravarImagens !== false) {
    await amb.armazenamento.gravar("assinaturas", sup.assinatura, PNG_VALIDO, "image/png");
    await amb.armazenamento.gravar("assinaturas", exe.assinatura, PNG_VALIDO, "image/png");
  }
  return { osId, numeroOrdem, localId: local!.id, execId, aprId, supervisorDaAprId: sup.id, executanteId: exe.id, supervisorId, recusanteId, anteriorId, fotos, modeloId: modelo!.id, itens: [i1!.id, i2!.id, i3!.id] as [string, string, string] };
}

/** Usuário só no banco (sem conta de login), com assinatura de perfil. */
async function criarUsuarioSemLogin(amb: Ambiente, d: { nome: string; matricula: string; cargo: string | null; registro: string | null; equipeId: string }) {
  const id = randomUUID();
  const assinatura = randomUUID();
  await amb.db.insert(usuario).values({
    id,
    nome: d.nome,
    matricula: d.matricula,
    email: `${d.matricula.toLowerCase()}@empresa.com.br`,
    cargo: d.cargo,
    registroProfissional: d.registro,
    perfil: "tecnico",
    equipeId: d.equipeId,
    senhaProvisoria: false,
    assinaturaPath: assinatura,
    assinaturaEm: hora("2026-01-01T00:00:00Z"),
  });
  return { id, assinatura };
}

/**
 * Texto que o PDF sem compressão mostra (os `TJ` do pdfkit com as fontes padrão vêm em hexadecimal, em Latin-1). O número só casa
 * inteiro (a espiada `(?=...)`): sem ela, os vetores `/Rect [...]` das anotações de link, com números longos, travavam a expressão.
 */
export function textoDoPdf(bytes: Uint8Array): string {
  const bruto = Buffer.from(bytes).toString("latin1");
  const linhas: string[] = [];
  for (const m of bruto.matchAll(/\[((?:<[0-9a-f]*>|-?[\d.]+(?=[\s<\]])|\s)+)\]\s*TJ/g)) {
    linhas.push([...m[1]!.matchAll(/<([0-9a-f]*)>/g)].map((h) => Buffer.from(h[1]!, "hex").toString("latin1")).join(""));
  }
  return linhas.join("\n");
}

/** Páginas do PDF (`/Type /Page`, sem contar `/Type /Pages`). */
export const paginasDoPdf = (bytes: Uint8Array) => (Buffer.from(bytes).toString("latin1").match(/\/Type \/Page(?![s\w])/g) ?? []).length;

/** Alerta `bloqueio` (ou outro tipo) para a OS. */
export async function criarAlerta(amb: Ambiente, d: { osId: string; destinatarioId: string; tipo?: "bloqueio" | "apoio_encerrado"; detalhe?: string; criadoEm?: Date }) {
  const [a] = await amb.db
    .insert(alerta)
    .values({ tipo: d.tipo ?? "bloqueio", osId: d.osId, destinatarioId: d.destinatarioId, detalhe: d.detalhe ?? "APR bloqueada", criadoEm: d.criadoEm ?? amb.relogio.agora })
    .returning();
  return a!;
}
