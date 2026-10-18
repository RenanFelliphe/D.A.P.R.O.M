import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNotNull, like, sql } from "drizzle-orm";
import type { Deps } from "../../deps";
import { emailDoNome, gerarSenhaInicial } from "../../dominio/usuarios";
import { processarEventos } from "../../dominio/eventos";
import { avisarAusencia, conferirAusencias } from "../../dominio/ausencia";
import { garantirRepresentantes } from "../../dominio/representacao";
import { dataBr, somarDias } from "../../dominio/tempo";
import type { UsuarioAutenticado } from "../../http/autenticacao";
import { enfileirarTarefa } from "../../servicos/fila";
import { verificarCiclos, type Intervalo } from "../../dominio/preventivas";
import { recalcularStatusOs } from "../../dominio/status-os";
import { alerta, atividade, ausencia, ausenciaAto, equipe, itemModeloApr, localInstalacao, modeloApr, os, planoPreventiva, planoPreventivaPergunta, reprogramacao, riscoModeloApr, usuario, type CicloBase, type Perfil } from "../schema";
import { popularCatalogoDemo } from "./catalogo-demo";
import { espelharOsDoSapNoSimulador } from "./ordens-sap";
import { carregarRegistroDosUsuarios } from "./registro-rh";
import { preencherHistoricoDaGamificacao } from "./gamificacao-historico";
import { documentoDemo } from "./documento-demo";
import { assinaturaDemo, fotoDemo } from "./imagens-demo";

/**
 * Dados fictícios para demonstração: usuários e equipes, locais, o catálogo de serviço (materiais de alguns serviços) e
 * OS em todos os estados do fluxo (liberadas, em execução, pendentes por APR bloqueada, suspensão ou interrupção,
 * encerradas com e sem ciência, canceladas, reprogramadas, de apoio), com fotos e alguns documentos em PDF, e o ciclo das
 * preventivas (cada uma no próprio plano de manutenção, com intervalos que deixam ciclos em dia, próximos, vencidos, aguardando
 * execução e sem intervalo). APRs, execuções, alertas e tarefas de PDF passam pelas mesmas regras da `api`
 * (`processarEventos`), com a hora de cada evento no passado, então o resultado é o que as telas mostrariam depois de
 * semanas de uso. Tudo é inventado; nunca rode com dados reais.
 */

const PREFIXO_ORDEM = "5100";

/** O checklist de inspeção do retificador (plano 10573, item 10603), a partir do exemplo da OS 4019821. */
const CHECKLIST_DO_RETIFICADOR = [
  "Tensão de entrada (Vac) dentro da faixa?",
  "Tensão de saída (Vcc) dentro da faixa?",
  "Telemetria funcionando?",
  "Fusíveis e DPS íntegros?",
  "Bornes reapertados?",
  "Gabinete limpo e sem corrosão?",
];

/** O checklist de inspeção do plano das válvulas de bloqueio. */
const CHECKLIST_DE_VALVULA = [
  "A válvula aciona sem esforço excessivo?",
  "Sem vazamento na gaxeta e nas conexões?",
  "Indicador de posição íntegro?",
  "Lubrificação feita?",
];

type Item = typeof itemModeloApr.$inferSelect;
type Risco = typeof riscoModeloApr.$inferSelect;
interface ModeloCarregado {
  id: string;
  codigo: string;
  itens: Item[];
  riscos: Risco[];
}

export interface ResultadoDemo {
  jaPopulado: boolean;
  usuariosCriados: { email: string; matricula: string; perfil: Perfil; senha: string }[];
  contagem: Record<string, number>;
}

const BR = 3 * 3600_000; // America/Sao_Paulo é UTC−3, sem horário de verão desde 2019

/**
 * Os instantes de um cenário "agora" (cada um, minutos antes de `agora`), todos no mesmo dia de Brasília: a `api` só aceita a
 * execução no dia da APR. Quando o cenário atravessaria a meia-noite, ele passa a começar logo depois dela ou, se assim
 * terminaria depois de `agora`, fica inteiro no dia anterior; a distância entre os instantes não muda.
 */
export function noMesmoDia(agora: Date, minutosAtras: number[]): Date[] {
  const hoje = new Date(agora.getTime() - BR);
  const meiaNoite = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()) + BR;
  const instantes = minutosAtras.map((min) => agora.getTime() - min * 60_000);
  const [primeiro, ultimo] = [Math.min(...instantes), Math.max(...instantes)];
  let ajuste = 0;
  if (primeiro < meiaNoite && ultimo >= meiaNoite) {
    ajuste = meiaNoite + 60_000 - primeiro;
    if (ultimo + ajuste > agora.getTime()) ajuste = meiaNoite - 60_000 - ultimo;
  }
  return instantes.map((t) => new Date(t + ajuste));
}

export async function popularDemo(depsOriginais: Deps): Promise<ResultadoDemo> {
  const { db } = depsOriginais;
  const [existente] = await db.select({ id: os.id }).from(os).where(like(os.numeroOrdem, `${PREFIXO_ORDEM}%`)).limit(1);
  if (existente) return { jaPopulado: true, usuariosCriados: [], contagem: {} };

  const real = depsOriginais.agora();
  const relogio = { t: real };
  const deps: Deps = { ...depsOriginais, agora: () => relogio.t };

  /** Instante `diasAtras` dias antes de hoje, às `h:m` no horário de Brasília. */
  const hojeBR = new Date(real.getTime() - BR);
  const em = (diasAtras: number, h: number, m = 0) => new Date(Date.UTC(hojeBR.getUTCFullYear(), hojeBR.getUTCMonth(), hojeBR.getUTCDate() - diasAtras, h + 3, m));
  const dia = (diasAtras: number) => em(diasAtras, 12).toISOString().slice(0, 10);
  const minutosAtras = (min: number) => new Date(real.getTime() - min * 60_000);

  // ---------- equipes e usuários -------------------------------------------------------------------------------
  const equipes: Record<string, string> = {};
  for (const [centro, nome] of [
    ["SERV_ESP", "Serviços Especiais"],
    ["INSTRUM", "Instrumentação"],
    ["LAB_QUI", "Laboratório Químico"],
  ] as const) {
    const [e] = await db.select({ id: equipe.id }).from(equipe).where(eq(equipe.centroTrabalho, centro));
    equipes[centro] = e?.id ?? (await db.insert(equipe).values({ nome, centroTrabalho: centro }).returning({ id: equipe.id }))[0]!.id;
  }

  const criados: ResultadoDemo["usuariosCriados"] = [];
  const usuarios: Record<string, UsuarioAutenticado> = {};
  const carregarUsuario = async (matricula: string) => {
    const [u] = await db.select().from(usuario).where(eq(sql`lower(${usuario.matricula})`, matricula.toLowerCase()));
    if (!u) return null;
    if (!u.assinaturaPath && u.perfil !== "admin") {
      const id = randomUUID();
      await deps.armazenamento.gravar("assinaturas", id, assinaturaDemo(matricula.length + matricula.charCodeAt(matricula.length - 1)), "image/png");
      await db.update(usuario).set({ assinaturaPath: id, assinaturaEm: deps.agora() }).where(eq(usuario.id, u.id));
      u.assinaturaPath = id;
    }
    return { id: u.id, nome: u.nome, matricula: u.matricula, email: u.email, perfil: u.perfil, equipeId: u.equipeId, equipesSupervisionadas: (await db.select({ id: equipe.id }).from(equipe).where(eq(equipe.supervisorId, u.id))).map((e) => e.id), equipesRepresentadas: [], ativo: u.ativo, senhaProvisoria: u.senhaProvisoria, assinaturaPath: u.assinaturaPath, ausencia: null } satisfies UsuarioAutenticado;
  };
  const garantir = async (matricula: string, nome: string, perfil: Perfil, centro: string | null, cargo: string | null = null) => {
    let u = await carregarUsuario(matricula);
    if (!u) {
      const senha = gerarSenhaInicial();
      const email = emailDoNome(nome);
      const conta = await deps.auth.criarConta(email, senha);
      await db.insert(usuario).values({
        id: conta.id,
        nome,
        matricula,
        email,
        cargo,
        perfil,
        equipeId: centro ? equipes[centro]! : null,
        senhaProvisoria: true,
      });
      criados.push({ email, matricula, perfil, senha });
      u = (await carregarUsuario(matricula))!;
    }
    usuarios[matricula] = u;
    return u;
  };

  const sup1 = await garantir("sup1", "Sandra Supervisora", "tecnico", "SERV_ESP");
  const sup2 = await garantir("sup2", "Saulo Supervisor", "tecnico", "INSTRUM");
  const tec1 = await garantir("tec1", "Tiago Técnico", "tecnico", "SERV_ESP", "Técnico em Gás");
  const tec2 = await garantir("tec2", "Taís Técnica", "tecnico", "SERV_ESP", "Técnica em Gás");
  const tec5 = await garantir("tec5", "Tadeu Técnico", "tecnico", "SERV_ESP", "Técnico em Gás");
  const tec3 = await garantir("tec3", "Tomás Técnico", "tecnico", "INSTRUM", "Técnico em Instrumentação");
  const tec4 = await garantir("tec4", "Tânia Técnica", "tecnico", "INSTRUM", "Técnica em Instrumentação");
  const adm = await garantir("adm", "Ana Administradora", "admin", null);
  await db.update(equipe).set({ supervisorId: sup1.id }).where(and(eq(equipe.id, equipes.SERV_ESP!), sql`${equipe.supervisorId} is null`));
  await db.update(equipe).set({ supervisorId: sup2.id }).where(and(eq(equipe.id, equipes.INSTRUM!), sql`${equipe.supervisorId} is null`));
  // Toda equipe tem quem represente o supervisor (o técnico mais antigo da equipe que não é ele).
  await garantirRepresentantes(db);

  // O registro de funcionários simulado ganha o funcionário de cada usuário (e uns 30 sem conta, para demonstrar o cadastro).
  if (deps.config.rhSimulado) await carregarRegistroDosUsuarios(db, { aleatorios: 30, agora: real });

  // ---------- locais ---------------------------------------------------------------------------------------------
  const locaisDef: [string, string, string | null, boolean][] = [
    ["VILA VELHA/REDE VILA VELHA", "Av. Carlos Lindenberg, 1200 — Vila Velha/ES", null, false],
    ["ERP SERRA/ESTACAO ERP SERRA", "Rod. ES-010, km 4 — Serra/ES", "Suzano", true],
    ["GUARAPARI/ESTACAO GUARAPARI", "Rod. do Sol, km 21 — Guarapari/ES", null, false],
    ["CARIACICA/RAMAL CARIACICA", "Av. Mário Gurgel, 800 — Cariacica/ES", null, false],
    ["VITORIA/ESTACAO VITORIA", "Av. Dante Michelini, 55 — Vitória/ES", null, false],
    ["SERRA/ESTACAO SERRA SUL", "Rua da Fábrica, 310 — Serra/ES", null, false],
    ["TUBARAO/PR PONTO DE RECEBIMENTO", "Av. Brigadeiro Eduardo Gomes, s/n — Vitória/ES", "Vale", true],
    ["ARACRUZ/ERS ARACRUZ", "Rod. ES-257, km 6 — Aracruz/ES", "Suzano", true],
    ["LINHARES/REDE LINHARES", "Av. Nossa Senhora da Conceição, 90 — Linhares/ES", null, false],
  ];
  const local: Record<string, string> = {};
  for (const [codigo, endereco, cliente, critico] of locaisDef) {
    const [l] = await db.select({ id: localInstalacao.id }).from(localInstalacao).where(eq(localInstalacao.codigo, codigo));
    local[codigo] = l?.id ?? (await db.insert(localInstalacao).values({ codigo, endereco, plusCode: "6RQ7+XJ Vitória", cliente, critico }).returning({ id: localInstalacao.id }))[0]!.id;
  }
  const L = {
    vv: local["VILA VELHA/REDE VILA VELHA"]!,
    erp: local["ERP SERRA/ESTACAO ERP SERRA"]!,
    gua: local["GUARAPARI/ESTACAO GUARAPARI"]!,
    cari: local["CARIACICA/RAMAL CARIACICA"]!,
    vit: local["VITORIA/ESTACAO VITORIA"]!,
    sul: local["SERRA/ESTACAO SERRA SUL"]!,
    pr: local["TUBARAO/PR PONTO DE RECEBIMENTO"]!,
    ers: local["ARACRUZ/ERS ARACRUZ"]!,
    lin: local["LINHARES/REDE LINHARES"]!,
  };

  // ---------- modelos de APR e atividades --------------------------------------------------------------------------
  const carregarModelo = async (codigo: string): Promise<ModeloCarregado> => {
    const [m] = await db.select().from(modeloApr).where(and(eq(modeloApr.codigo, codigo), isNotNull(modeloApr.publicadoEm))).orderBy(desc(modeloApr.versao)).limit(1);
    if (!m) throw new Error(`Modelo ${codigo} não está publicado: rode a api uma vez para a carga inicial.`);
    return { id: m.id, codigo, itens: await db.select().from(itemModeloApr).where(eq(itemModeloApr.modeloAprId, m.id)), riscos: await db.select().from(riscoModeloApr).where(eq(riscoModeloApr.modeloAprId, m.id)) };
  };
  const apr01 = await carregarModelo("APR 01");
  const apr02 = await carregarModelo("APR 02");
  const apr03 = await carregarModelo("APR 03");
  // A primeira atividade da planilha de cada modelo (só o serviço do catálogo: quem escolhe o modelo da APR é o técnico).
  const atividadeDaCarga = async (codigo: string) => (await db.select({ codigo: atividade.codigo }).from(atividade).where(eq(atividade.codigo, codigo)).limit(1))[0]?.codigo ?? null;
  const ativ = {
    1: await atividadeDaCarga("Medição"),
    2: await atividadeDaCarga("Ação em caso de urgência e emergências com odorante (mercaptana)"),
    3: await atividadeDaCarga("Lavagem de Estação"),
  };
  await popularCatalogoDemo(db, Object.values(ativ));

  // ---------- arquivos --------------------------------------------------------------------------------------------
  let contadorFotos = 0;
  const foto = async () => {
    const id = randomUUID();
    await deps.armazenamento.gravar("fotos", id, fotoDemo(contadorFotos++), "image/png");
    return id;
  };
  /** Documento em PDF anexado como evidência: devolve o item de `evidencias` do evento. */
  interface DocumentoDemo {
    nome: string;
    titulo: string;
    linhas: string[];
  }
  const documento = async (d: DocumentoDemo, quando: Date, itemId?: string) => {
    const id = randomUUID();
    await deps.armazenamento.gravar("documentos", id, documentoDemo(d.titulo, d.linhas), "application/pdf");
    return { id, tipo: "pdf", nome: d.nome, ...(itemId ? { item_id: itemId } : {}), capturada_em: quando.toISOString() };
  };

  // ---------- OS -------------------------------------------------------------------------------------------------
  let numero = Number(`${PREFIXO_ORDEM}001`);
  interface DadosOs {
    tipo?: "corretiva" | "preventiva";
    titulo: string;
    descricao?: string;
    equipamento?: string;
    local: string;
    equipe?: string;
    prioridade?: string;
    inicio: number; // dias atrás (negativo = no futuro)
    fim?: number;
    atividade?: string | null;
    solicitante?: string | null;
    origem?: "sap" | "planilha" | "apoio";
    apoioDe?: string;
    /**
     * Plano da preventiva (sem ele, um plano próprio), o intervalo entre ciclos (sem ele, o plano fica sem intervalo) e o checklist
     * de inspeção (as perguntas, na ordem; o plano é gravado na primeira OS que o traz, para o encerramento já pedir o checklist).
     */
    ciclo?: { plano?: string; item?: string; intervalo?: Intervalo; base?: CicloBase; checklist?: string[] };
  }
  /** Os planos das preventivas criadas: gravados no fim, com o intervalo de cada um. */
  const ciclos = new Map<string, { plano: string; item: string; intervalo?: Intervalo; base?: CicloBase }>();
  /** As perguntas dos planos que têm checklist, por plano/item: o encerramento das OS deles responde a todas. */
  const perguntasDosPlanos = new Map<string, { id: string; texto: string }[]>();
  let proximoPlano = 10_800;
  const criarOs = async (d: DadosOs) => {
    const tipo = d.tipo ?? "corretiva";
    const apoio = d.origem === "apoio";
    let ciclo: { plano: string; item: string } | null = null;
    if (tipo === "preventiva" && !apoio) {
      const plano = d.ciclo?.plano ?? String(proximoPlano++);
      const item = d.ciclo?.item ?? String(Number(plano) + 200);
      ciclo = { plano, item };
      const { checklist, ...regras } = d.ciclo ?? {};
      ciclos.set(`${plano}/${item}`, { ...ciclos.get(`${plano}/${item}`), ...regras, plano, item });
      if (checklist && !perguntasDosPlanos.has(`${plano}/${item}`)) {
        const [criado] = await db
          .insert(planoPreventiva)
          .values({ planoManutencao: plano, itemManutencao: item, intervaloQuantidade: regras.intervalo?.quantidade ?? null, intervaloUnidade: regras.intervalo?.unidade ?? null, contarAPartir: regras.base ?? "execucao" })
          .returning({ id: planoPreventiva.id });
        const perguntas = await db
          .insert(planoPreventivaPergunta)
          .values(checklist.map((texto, posicao) => ({ planoId: criado!.id, texto, posicao })))
          .returning({ id: planoPreventivaPergunta.id, texto: planoPreventivaPergunta.texto, posicao: planoPreventivaPergunta.posicao });
        perguntasDosPlanos.set(`${plano}/${item}`, perguntas.sort((a, b) => a.posicao - b.posicao).map(({ id, texto }) => ({ id, texto })));
      }
    }
    const [o] = await db
      .insert(os)
      .values({
        numeroOrdem: apoio ? null : String(numero++),
        numeroNota: apoio ? null : String(10_006_000 + numero),
        tipo,
        tipoAtividade: tipo === "corretiva" ? "Z01-Manutenção Corretiva" : "Z02-Manutenção Preventiva",
        codigoAtividade: d.atividade ?? null,
        titulo: d.titulo,
        descricao: d.descricao ?? "Executar conforme a instrução da atividade. Materiais: kit de vedação, lacre, vaselina. Ferramentas: chaves e torquímetro.",
        equipamento: d.equipamento ?? null,
        localInstalacaoId: d.local,
        equipeId: d.equipe ?? equipes.SERV_ESP!,
        planoManutencao: ciclo?.plano ?? null,
        itemManutencao: ciclo?.item ?? null,
        prioridade: d.prioridade ?? "Médio",
        dataInicioProg: dia(d.inicio),
        dataFimProg: d.fim === undefined ? null : dia(d.fim),
        dataOrdem: dia(d.inicio + 10),
        criadoPorSap: apoio ? null : "RFAVARO",
        statusSap: apoio ? null : "LIB IMPR",
        solicitante: d.solicitante ?? null,
        osOrigemId: d.apoioDe ?? null,
        origem: d.origem ?? "sap",
      })
      .returning({ id: os.id });
    return o!.id;
  };

  // ---------- eventos ----------------------------------------------------------------------------------------------
  const enviar = async (u: UsuarioAutenticado, tipo: string, osId: string | null, payload: Record<string, unknown>, quando: Date) => {
    relogio.t = quando;
    const r = await processarEventos(deps, u, [{ id: randomUUID(), tipo: tipo as never, os_id: osId, payload, ocorrido_em: quando }]);
    const recusa = r.rejeitados[0] ?? r.pendentes[0];
    if (recusa) throw new Error(`Evento ${tipo} recusado (${recusa.codigo}): ${recusa.mensagem}`);
    return r;
  };

  const respostasLimpas = (m: ModeloCarregado, marcados: Risco[], opcoes: { avisoNoAlerta?: boolean; falhar?: Item[] } = {}) => {
    const falhar = new Map((opcoes.falhar ?? []).map((i) => [i.id, i]));
    let avisou = false;
    const marcadosIds = new Set(marcados.map((r) => r.id));
    const respostas: { item_id: string; resposta: string; observacao?: string }[] = [];
    for (const i of m.itens) {
      if (i.secao === "medida_preventiva") {
        if (marcadosIds.has(i.riscoId!)) respostas.push({ item_id: i.id, resposta: "sim" });
        continue;
      }
      if (falhar.has(i.id)) {
        respostas.push({ item_id: i.id, resposta: i.respostaBloqueante!, observacao: observacaoDeFalha(i) });
      } else if (i.tipo === "alerta" && opcoes.avisoNoAlerta && !avisou) {
        avisou = true;
        respostas.push({ item_id: i.id, resposta: i.respostaBloqueante! });
      } else {
        respostas.push({ item_id: i.id, resposta: i.respostaBloqueante === "sim" ? "nao" : "sim" });
      }
    }
    return respostas;
  };
  const observacaoDeFalha = (i: Item) =>
    i.evidencia === "texto"
      ? "Colaborador relatou desconforto e exerceu o direito de recusa."
      : /gás|gas|vazamento|explos/i.test(i.texto)
        ? "Odor de gás no local; detector indicou concentração acima do limite."
        : "Condição encontrada fora do padrão; a atividade não pode começar até a correção.";

  const aprPayload = async (
    m: ModeloCarregado,
    participantes: UsuarioAutenticado[],
    quando: Date,
    opcoes: { riscos?: number; avisoNoAlerta?: boolean; falhar?: Item[]; observacao?: string; documentoNoPrimeiro?: DocumentoDemo } = {},
  ) => {
    const marcados = m.riscos.slice(0, opcoes.riscos ?? 0);
    const falhar = opcoes.falhar ?? [];
    const evidencias: Record<string, unknown>[] = [];
    for (const item of falhar.filter((i) => i.evidencia === "foto")) {
      const n = 1 + (contadorFotos % 2);
      for (let k = 0; k < n; k++) evidencias.push({ id: await foto(), item_id: item.id, capturada_em: quando.toISOString(), latitude: -20.31 + k * 0.0003, longitude: -40.29 });
    }
    if (opcoes.documentoNoPrimeiro && falhar[0]) evidencias.push(await documento(opcoes.documentoNoPrimeiro, quando, falhar[0].id));
    return {
      id: randomUUID(),
      modelo_apr_id: m.id,
      participantes: participantes.map((u, i) => ({ usuario_id: u.id, funcao: i === 0 ? "responsavel" : "executor" })),
      riscos: marcados.map((r) => r.id),
      respostas: respostasLimpas(m, marcados, { avisoNoAlerta: opcoes.avisoNoAlerta, falhar }),
      evidencias,
      observacao_geral: opcoes.observacao ?? null,
      concluida_em: quando.toISOString(),
    };
  };
  const primeiroEliminatorio = (m: ModeloCarregado, n = 1, aPartirDe = 0) => m.itens.filter((i) => i.secao === "verificacao" && i.tipo === "eliminatorio" && i.evidencia === "foto").slice(aPartirDe, aPartirDe + n);
  const itemDeTexto = (m: ModeloCarregado) => m.itens.find((i) => i.tipo === "eliminatorio" && i.evidencia === "texto");

  /**
   * Registra a APR e, se ela passou, cada participante a assina na própria conta (`apr_assinada`), a um ou dois minutos de
   * distância um do outro. `semAssinar` deixa a APR esperando a assinatura de quem ainda não assinou (a demonstração do aviso).
   */
  const aprovar = async (
    u: UsuarioAutenticado,
    osId: string,
    m: ModeloCarregado,
    equipeTec: UsuarioAutenticado[],
    quando: Date,
    opcoes: Parameters<typeof aprPayload>[3] & { semAssinar?: UsuarioAutenticado[] } = {},
  ) => {
    const p = await aprPayload(m, equipeTec, quando, opcoes);
    await enviar(u, "apr_concluida", osId, p, quando);
    if ((opcoes.falhar ?? []).length === 0) {
      for (const [i, pessoa] of equipeTec.entries()) {
        if (opcoes.semAssinar?.some((x) => x.id === pessoa.id)) continue;
        const assinou = new Date(quando.getTime() + (i + 1) * 60_000);
        await enviar(pessoa, "apr_assinada", osId, { apr_id: p.id, assinada_em: assinou.toISOString() }, assinou);
      }
    }
    return p.id as string;
  };

  interface OpcoesExecucao {
    inicio: Date;
    duracaoMin?: number;
    pausa?: [number, number]; // minutos depois do início: começa e termina
    fotos?: number;
    /** PDFs anexados ao encerramento, além das fotos. */
    documentos?: DocumentoDemo[];
    descricao?: string;
    resultado?: "encerrada" | "suspensa" | "interrompida" | "aberta" | "pausada";
    motivo?: string;
    /** O checklist de inspeção da preventiva: por padrão tudo marcado; `naoMarcados` e `observacoes` (pela posição da pergunta) mudam isso. */
    checklist?: { naoMarcados?: Record<number, string>; observacoes?: Record<number, string> };
    /** A inspeção sem estrutura, de antes do checklist (só para OS cujo plano não tem checklist). */
    inspecao?: Record<string, unknown>;
    /** O responsável encerrou a OS (o tempo parou), mas ainda não preencheu nem assinou o encerramento: a OS fica `encerrando`. */
    semAssinarEncerramento?: boolean;
  }
  /** O `dados_inspecao` do encerramento: as respostas ao checklist do plano da OS, quando ele tem; senão, a inspeção sem estrutura. */
  const dadosDaInspecao = async (osId: string, o: OpcoesExecucao) => {
    const [ordem] = await db.select({ plano: os.planoManutencao, item: os.itemManutencao }).from(os).where(eq(os.id, osId));
    const perguntas = ordem?.plano ? perguntasDosPlanos.get(`${ordem.plano}/${ordem.item}`) : undefined;
    if (!perguntas) return o.inspecao ?? null;
    return {
      itens: perguntas.map((p, i) => {
        const naoMarcado = o.checklist?.naoMarcados?.[i];
        return { pergunta_id: p.id, marcado: naoMarcado === undefined, observacao: naoMarcado ?? o.checklist?.observacoes?.[i] ?? null };
      }),
    };
  };
  const executar = async (u: UsuarioAutenticado, osId: string, aprId: string, participantes: UsuarioAutenticado[], o: OpcoesExecucao) => {
    const exId = randomUUID();
    const t = (min: number) => new Date(o.inicio.getTime() + min * 60_000);
    await enviar(u, "execucao_iniciada", osId, { id: exId, apr_id: aprId, numero_pessoas: participantes.length, inicio: o.inicio.toISOString(), latitude: -20.3101, longitude: -40.2902 }, o.inicio);
    const dur = o.duracaoMin ?? 150;
    if (o.pausa) {
      const pausaId = randomUUID();
      await enviar(u, "pausa_iniciada", null, { id: pausaId, execucao_id: exId, inicio: t(o.pausa[0]).toISOString(), motivo: "almoco", latitude: -20.3104, longitude: -40.2899 }, t(o.pausa[0]));
      if (o.resultado !== "pausada") await enviar(u, "pausa_encerrada", null, { pausa_id: pausaId, fim: t(o.pausa[1]).toISOString() }, t(o.pausa[1]));
    }
    const fim = t(dur);
    const resultado = o.resultado ?? "encerrada";
    if (resultado === "encerrada") {
      const evidencias: Record<string, unknown>[] = [];
      for (let k = 0; k < (o.fotos ?? 2); k++) evidencias.push({ id: await foto(), capturada_em: t(dur - 20 + k).toISOString(), latitude: -20.31 + k * 0.0004, longitude: -40.29 - k * 0.0002 });
      for (const d of o.documentos ?? []) evidencias.push(await documento(d, t(dur - 5)));
      // O encerramento tem dois passos: o clique em "Encerrar OS" (o tempo para) e, minutos depois, a descrição, as fotos e a assinatura.
      await enviar(u, "execucao_encerrada", osId, { execucao_id: exId, fim: fim.toISOString(), latitude: -20.3102, longitude: -40.2901 }, fim);
      if (!o.semAssinarEncerramento) {
        const assinou = new Date(fim.getTime() + 4 * 60_000);
        await enviar(u, "encerramento_assinado", osId, {
          execucao_id: exId,
          assinada_em: assinou.toISOString(),
          descricao_atividade: o.descricao ?? "Atividade executada conforme o procedimento; equipamento testado e liberado para operação.",
          dados_inspecao: await dadosDaInspecao(osId, o),
          evidencias,
        }, assinou);
      }
    } else if (resultado === "suspensa") {
      await enviar(u, "execucao_suspensa", osId, { execucao_id: exId, fim: fim.toISOString(), motivo: "fim_expediente", latitude: -20.3102, longitude: -40.2901 }, fim);
    } else if (resultado === "interrompida") {
      await enviar(u, "execucao_interrompida", osId, { execucao_id: exId, fim: fim.toISOString(), motivo: o.motivo ?? "Risco identificado durante a atividade.", evidencias: [{ id: await foto(), capturada_em: fim.toISOString(), latitude: -20.31, longitude: -40.29 }], latitude: -20.31, longitude: -40.29 }, fim);
    }
    return exId;
  };

  /** A assinatura final do supervisor (a ciência): a OS passa de `aguardando_supervisor` a `encerrada` e o PDF é enfileirado. */
  const darCiencia = async (osId: string, supervisor: UsuarioAutenticado, quando: Date) => {
    await db.update(os).set({ cienciaPor: supervisor.id, cienciaEm: quando, cienciaAssinaturaPath: supervisor.assinaturaPath }).where(eq(os.id, osId));
    await recalcularStatusOs(db, osId);
    await enfileirarTarefa(db, "pdf_os", osId);
  };

  const dupla = [tec1, tec2];
  const dupla2 = [tec2, tec5];
  const trio = [tec1, tec2, tec5];
  const duplaI = [tec3, tec4];

  // ================= ENCERRADAS (históricas, para indicadores, histórico e PDF) =====================================
  // 0. o ciclo anterior do retificador (mensal), 48 dias atrás: o histórico do plano mostra dois ciclos
  let id = await criarOs({ tipo: "preventiva", titulo: "1.2 - Inspeção Funcional de Retificador", equipamento: "Retificador de proteção catódica RTF-03", local: L.erp, prioridade: "Alto", inicio: 49, fim: 47, atividade: ativ[3], ciclo: { plano: "10573", item: "10603", intervalo: { quantidade: 1, unidade: "mes" }, checklist: CHECKLIST_DO_RETIFICADOR } });
  let apr = await aprovar(tec1, id, apr03, dupla, em(48, 8, 5), { riscos: 3 });
  await executar(tec1, id, apr, dupla, { inicio: em(48, 8, 20), duracaoMin: 185, fotos: 2, descricao: "Inspeção funcional do ciclo anterior: tensões dentro da faixa e bornes reapertados." });
  await darCiencia(id, sup1, em(47, 9, 0));

  // 1. preventiva, retificador, 18 dias atrás: APR 03 com riscos e medidas; ciência dada
  id = await criarOs({ tipo: "preventiva", titulo: "1.2 - Inspeção Funcional de Retificador", equipamento: "Retificador de proteção catódica RTF-03", local: L.erp, prioridade: "Alto", inicio: 19, fim: 18, atividade: ativ[3], ciclo: { plano: "10573", item: "10603", intervalo: { quantidade: 1, unidade: "mes" } } });
  apr = await aprovar(tec1, id, apr03, dupla, em(18, 8, 5), { riscos: 3, avisoNoAlerta: true, observacao: "Acesso pela portaria lateral; EPI completo conferido." });
  await executar(tec1, id, apr, dupla, { inicio: em(18, 8, 20), duracaoMin: 200, pausa: [90, 105], fotos: 3, descricao: "Inspeção funcional concluída: tensões de entrada e saída dentro da faixa, fusíveis e DPS íntegros, bornes reapertados.",
    checklist: { observacoes: { 0: "Tensão de entrada: 221 Vac", 1: "Tensão de saída: 24,6 Vcc; horímetro: 18.420 h" } },
    documentos: [{ nome: "relatorio-medicao-RTF-03.pdf", titulo: "Relatório de medição - Retificador RTF-03", linhas: ["Tensão de entrada: 221 Vac", "Tensão de saída: 24,6 Vcc", "Tensão de shunt: 48 mV", "Horímetro: 18.420 h", "Resultado: dentro da faixa de operação."] }],
  });
  await darCiencia(id, sup1, em(17, 9, 30));

  // 2. corretiva, caixa de válvula, 14 dias atrás, ciência dada
  id = await criarOs({ titulo: "DCV Desobstrução de caixa de válvula", equipamento: "Caixa de válvula CV-118", local: L.vv, prioridade: "Muito alto", inicio: 15, fim: 14, atividade: ativ[1], solicitante: "Central de Atendimento" });
  apr = await aprovar(tec2, id, apr01, [tec2, tec5], em(14, 7, 40), { avisoNoAlerta: true });
  await executar(tec2, id, apr, [tec2, tec5], { inicio: em(14, 7, 55), duracaoMin: 135, fotos: 2, descricao: "Caixa de válvula desobstruída com sucção; acionamento da válvula testado e tampa recolocada." });
  await darCiencia(id, sup1, em(13, 10, 0));

  // 3. preventiva, válvulas, 9 dias atrás, sem ciência (aguarda o supervisor); o checklist volta com um item não marcado (e o alerta)
  id = await criarOs({ tipo: "preventiva", titulo: "Teste, manutenção e válvulas", equipamento: "Válvula de bloqueio VB-12", local: L.gua, prioridade: "Médio", inicio: 10, fim: 9, atividade: ativ[2], ciclo: { intervalo: { quantidade: 1, unidade: "semana" }, checklist: CHECKLIST_DE_VALVULA } });
  apr = await aprovar(tec1, id, apr02, trio, em(9, 8, 0), { riscos: 2 });
  await executar(tec1, id, apr, trio, {
    inicio: em(9, 8, 15),
    duracaoMin: 240,
    pausa: [120, 150],
    fotos: 2,
    checklist: { naoMarcados: { 1: "Gotejamento leve na gaxeta; reaperto feito, acompanhar no próximo ciclo." } },
  });

  // 4. corretiva, manômetro, 6 dias atrás, sem ciência
  id = await criarOs({ titulo: "Troca de manômetro com leitura inconsistente", equipamento: "Manômetro MN-0452", local: L.cari, prioridade: "Alto", inicio: 7, fim: 6 });
  apr = await aprovar(tec5, id, apr01, dupla2, em(6, 13, 10));
  // O tempo parou, mas o responsável ainda não preencheu nem assinou o encerramento: a OS fica "encerrando".
  await executar(tec5, id, apr, dupla2, { inicio: em(6, 13, 25), duracaoMin: 95, fotos: 2, descricao: "Manômetro substituído e calibrado; leitura conferida com padrão.", semAssinarEncerramento: true });

  // 5. preventiva, ERS Suzano (cliente crítico), 3 dias atrás, sem ciência
  id = await criarOs({ tipo: "preventiva", titulo: "Lavagem de Estação", equipamento: "Estação redutora ERS-02", local: L.ers, prioridade: "Alto", inicio: 4, fim: 3, atividade: ativ[1], ciclo: { intervalo: { quantidade: 10, unidade: "dia" } } });
  apr = await aprovar(tec1, id, apr01, dupla, em(3, 8, 30), { riscos: 1 });
  await executar(tec1, id, apr, dupla, { inicio: em(3, 8, 45), duracaoMin: 170, pausa: [100, 115], fotos: 0, descricao: "" });

  // ================= PENDENTES =====================================================================================
  // 6. APR bloqueada (vazamento): duas fotos, alerta ao supervisor não lido; retomada ainda não feita
  id = await criarOs({ titulo: "Reparo de vazamento em ramal", equipamento: "Ramal RM-204", local: L.sul, prioridade: "Muito alto", inicio: 2, fim: 1, atividade: ativ[1] });
  await aprovar(tec2, id, apr01, [tec2, tec5], em(2, 9, 5), {
    falhar: primeiroEliminatorio(apr01, 2),
    documentoNoPrimeiro: { nome: "registro-detector-gas.pdf", titulo: "Registro do detector de gases", linhas: ["Equipamento: detector portátil de 4 gases", "Leitura no ramal RM-204: 18% do LIE", "Limite para liberar a atividade: 10% do LIE", "Conclusão: atividade não liberada."] },
  });

  // 6b. APR aprovada num serviço com lista de materiais recomendados: a lista é só consulta, não trava a liberação
  id = await criarOs({ titulo: "Aferição de manômetro padrão", equipamento: "Manômetro MN-12", local: L.gua, equipe: equipes.INSTRUM, prioridade: "Alto", inicio: 2, fim: 1, atividade: "Medição" });
  // ...e o Tiago ainda não assinou: a APR espera a assinatura dele, e o aviso aparece no sino (a execução só começa com todos).
  await aprovar(tec3, id, apr01, duplaI, em(2, 10, 30), { semAssinar: [tec4] });

  // 7. APR bloqueada por condição pessoal (justificativa em texto, sem foto) — alerta lido
  id = await criarOs({ tipo: "preventiva", titulo: "Calibração de PSV", equipamento: "PSV-0312", local: L.pr, prioridade: "Alto", inicio: 2, fim: 1, atividade: ativ[3], ciclo: { intervalo: { quantidade: 1, unidade: "semestre" } } });
  const textual = itemDeTexto(apr03);
  await aprovar(tec1, id, apr03, dupla, em(2, 8, 20), { falhar: textual ? [textual] : primeiroEliminatorio(apr03, 1) });

  // 8. bloqueada num dia e retomada com APR nova no outro, mas suspensa no fim do expediente
  id = await criarOs({ titulo: "Substituição de regulador de pressão", equipamento: "Regulador RG-07", local: L.vit, prioridade: "Alto", inicio: 3, fim: 1, atividade: ativ[2] });
  await aprovar(tec5, id, apr02, dupla2, em(2, 8, 0), { falhar: primeiroEliminatorio(apr02, 1, 1) });
  apr = await aprovar(tec5, id, apr02, dupla2, em(1, 8, 10));
  await executar(tec5, id, apr, dupla2, { inicio: em(1, 8, 25), duracaoMin: 285, resultado: "suspensa", pausa: [110, 140] });

  // 9. interrompida por risco (alerta de bloqueio) + OS de apoio para a Instrumentação, já executada: alerta de apoio encerrado
  const idOriginal = await criarOs({ titulo: "Reaperto de bornes em painel de retificação", equipamento: "Painel PN-14", local: L.erp, prioridade: "Muito alto", inicio: 3, fim: 2 });
  apr = await aprovar(tec1, idOriginal, apr01, dupla, em(2, 9, 0));
  await executar(tec1, idOriginal, apr, dupla, { inicio: em(2, 9, 15), duracaoMin: 40, resultado: "interrompida", motivo: "Umidade no painel com risco de curto-circuito; atividade interrompida até a secagem." });
  const idApoio = await criarOs({ titulo: "Apoio: secagem e inspeção elétrica do painel PN-14", equipamento: "Painel PN-14", local: L.erp, equipe: equipes.INSTRUM, prioridade: "Muito alto", inicio: 2, fim: 1, apoioDe: idOriginal, origem: "apoio" });
  apr = await aprovar(tec3, idApoio, apr01, duplaI, em(1, 8, 40));
  await executar(tec3, idApoio, apr, duplaI, { inicio: em(1, 8, 55), duracaoMin: 150, fotos: 2, descricao: "Painel seco e inspecionado; isolação medida e liberada para a equipe de Serviços Especiais retomar." });

  // 10. execução esquecida em andamento desde ontem ("execução aberta há mais de 12 h" no quadro)
  id = await criarOs({ titulo: "Inspeção de rede em área de expansão", equipamento: "Rede RD-330", local: L.lin, prioridade: "Médio", inicio: 1, fim: 0, atividade: ativ[1] });
  apr = await aprovar(tec2, id, apr01, [tec2, tec5], em(1, 10, 0));
  await executar(tec2, id, apr, [tec2, tec5], { inicio: em(1, 10, 15), resultado: "aberta", duracaoMin: 0 });

  // ================= EM EXECUÇÃO AGORA ==============================================================================
  // Logo depois da meia-noite, a APR e o início não podem cair em dias diferentes (`noMesmoDia`).
  // 11. em andamento (tec1 + tec2), iniciada há ~75 min
  id = await criarOs({ tipo: "preventiva", titulo: "Tratamento em corrosão e pintura", equipamento: "Tubulação TB-09", local: L.vv, prioridade: "Médio", inicio: 0, fim: -1, atividade: ativ[2], ciclo: { intervalo: { quantidade: 1, unidade: "ano" } } });
  const [aprEmAndamento, inicioEmAndamento] = noMesmoDia(real, [95, 80]);
  apr = await aprovar(tec1, id, apr02, dupla, aprEmAndamento!, { riscos: 2 });
  await executar(tec1, id, apr, dupla, { inicio: inicioEmAndamento!, resultado: "aberta", duracaoMin: 0 });

  // 12. em pausa (almoço) neste momento (instrumentação); a pausa começa 60 min depois do início (55 min atrás)
  id = await criarOs({ tipo: "preventiva", titulo: "Medição: calibração de transmissor de pressão", equipamento: "Transmissor PT-101", local: L.cari, equipe: equipes.INSTRUM, prioridade: "Médio", inicio: 0, fim: 0, ciclo: { intervalo: { quantidade: 1, unidade: "trimestre" }, base: "programacao" } });
  const [aprEmPausa, inicioEmPausa] = noMesmoDia(real, [130, 115, 55]);
  apr = await aprovar(tec3, id, apr01, duplaI, aprEmPausa!);
  await executar(tec3, id, apr, duplaI, { inicio: inicioEmPausa!, resultado: "pausada", pausa: [60, 90], duracaoMin: 0 });

  // ================= LIBERADAS ======================================================================================
  // atrasada sem justificativa, atrasada com reprogramação (justificada), no prazo, futuras, críticas e de outras equipes
  // `inicio` e `fim` são "dias atrás" (negativo = no futuro); o fim nunca é anterior ao início.
  const liberadas: DadosOs[] = [
    { titulo: "Inspeção funcional de odorizador", tipo: "preventiva", equipamento: "Odorizador OD-01", local: L.erp, prioridade: "Alto", inicio: 5, fim: 4, atividade: ativ[3], ciclo: { intervalo: { quantidade: 1, unidade: "mes" }, base: "programacao" } }, // será reprogramada
    { titulo: "Lavagem de estação (atrasada)", tipo: "preventiva", equipamento: "Estação ERP-02", local: L.erp, prioridade: "Médio", inicio: 8, fim: 7, atividade: ativ[1], ciclo: { intervalo: { quantidade: 2, unidade: "semana" }, base: "programacao" } }, // atrasada sem justificativa
    { titulo: "Substituição de lacres em medidores", equipamento: "Medidor G25", local: L.gua, prioridade: "Baixo", inicio: 0, fim: -1 },
    { titulo: "Teste de estanqueidade em estação", tipo: "preventiva", equipamento: "Estação ERS-05", local: L.ers, prioridade: "Alto", inicio: -1, fim: -2, atividade: ativ[2] },
    { titulo: "Limpeza de filtro separador", tipo: "preventiva", equipamento: "Filtro separador FS-01", local: L.pr, prioridade: "Médio", inicio: -2, fim: -3, atividade: ativ[1] },
    { titulo: "Manutenção de válvulas em ponto de recebimento", tipo: "preventiva", equipamento: "Válvula VB-21", local: L.pr, prioridade: "Muito alto", inicio: -3, fim: -4, atividade: ativ[2], ciclo: { intervalo: { quantidade: 1, unidade: "bimestre" }, base: "programacao" } },
    { titulo: "Inspeção de rede de distribuição", tipo: "preventiva", equipamento: "Rede RD-118", local: L.lin, prioridade: "Baixo", inicio: -6, fim: -8, atividade: ativ[3], ciclo: { intervalo: { quantidade: 1, unidade: "semestre" }, base: "programacao" } },
    { titulo: "Verificação de vazamento reportado por cliente", equipamento: "Ramal residencial", local: L.sul, prioridade: "Muito alto", inicio: 0, fim: 0, solicitante: "Cliente: Condomínio Jardins" },
    { titulo: "Corretiva urgente: odor de gás em quadra residencial", equipamento: "Rede RD-077", local: L.vv, prioridade: "Muito alto", inicio: 0, fim: 0, solicitante: "Corpo de Bombeiros" },
    { titulo: "Calibração de manômetros da estação", tipo: "preventiva", equipamento: "Manômetros MN-04/05/06", local: L.vit, equipe: equipes.INSTRUM, prioridade: "Médio", inicio: 2, fim: 1, ciclo: { intervalo: { quantidade: 1, unidade: "quinzena" }, base: "programacao" } },
    { titulo: "Troca de transmissor de temperatura", equipamento: "Transmissor TT-22", local: L.cari, equipe: equipes.INSTRUM, prioridade: "Alto", inicio: -1, fim: -2 },
    { titulo: "Coleta e análise de amostra de gás", tipo: "preventiva", equipamento: "Cromatógrafo CG-01", local: L.sul, equipe: equipes.LAB_QUI, prioridade: "Médio", inicio: -2, fim: -3, ciclo: { intervalo: { quantidade: 1, unidade: "mes" } } },
  ];
  const idsLiberadas: string[] = [];
  for (const d of liberadas) idsLiberadas.push(await criarOs(d));

  // reprogramada pelo admin: a OS atrasada (índice 0) ganha nova data e justificativa
  const reprog = idsLiberadas[0]!;
  await db.insert(reprogramacao).values({ osId: reprog, usuarioId: adm.id, dataAnterior: dia(5), dataNova: dia(-2), equipeAnteriorId: equipes.SERV_ESP!, equipeNovaId: equipes.SERV_ESP!, justificativa: "Aguardando liberação de acesso à estação pelo cliente." });
  await db.update(os).set({ dataInicioProg: dia(-2), dataFimProg: dia(-3) }).where(eq(os.id, reprog));

  // ================= APOIO CANCELADO ================================================================================
  const cancelada = await criarOs({ titulo: "Apoio aberto em duplicidade", local: L.erp, equipe: equipes.INSTRUM, prioridade: "Baixo", inicio: 4, fim: 4, apoioDe: idOriginal, origem: "apoio" });
  await db.update(os).set({ status: "cancelada", canceladaEm: minutosAtras(60 * 24 * 3), canceladaPor: adm.id, justificativaCancelamento: "Apoio aberto em duplicidade; o primeiro segue em andamento." }).where(eq(os.id, cancelada));

  // ================= CICLO DAS PREVENTIVAS ===========================================================================
  // Um plano por preventiva; "Teste de estanqueidade" e "Limpeza de filtro separador" ficam sem intervalo, para o admin definir.
  for (const c of ciclos.values()) {
    await db
      .insert(planoPreventiva)
      .values({
        planoManutencao: c.plano,
        itemManutencao: c.item,
        intervaloQuantidade: c.intervalo?.quantidade ?? null,
        intervaloUnidade: c.intervalo?.unidade ?? null,
        contarAPartir: c.base ?? "execucao",
      })
      .onConflictDoNothing();
  }
  await verificarCiclos(db, real);

  // ================= AUSÊNCIAS ======================================================================================
  // Uma em curso (Tadeu), uma agendada (Taís), uma vencida (Tânia) e um pedido que aguarda o supervisor (Tomás): ninguém com execução
  // aberta nas OS da demonstração entra em ausência em curso (o início a suspenderia). Os atos e os avisos
  // são gravados como as regras da `api` os gravariam; a conferência periódica aplica o início das que já começaram (desfaz as
  // reservas, suspende a execução aberta) e avisa o supervisor da vencida.
  const ausenciaDemo = async (
    quem: UsuarioAutenticado,
    quemAprova: UsuarioAutenticado,
    d: { motivo: string; inicio: number; retorno: number; estado: "pedida" | "confirmada"; origem: "pedido" | "supervisor"; criadaHaDias: number },
  ) => {
    const criadaEm = em(d.criadaHaDias, 9);
    const dias = Math.round((Date.parse(dia(d.retorno)) - Date.parse(dia(d.inicio))) / 86_400_000);
    const [a] = await db
      .insert(ausencia)
      .values({
        usuarioId: quem.id,
        equipeId: quem.equipeId!,
        supervisorId: d.estado === "confirmada" ? quemAprova.id : null,
        motivo: d.motivo,
        inicio: dia(d.inicio),
        retorno: dia(d.retorno),
        diasInformados: d.origem === "pedido" ? dias : null,
        estado: d.estado,
        origem: d.origem,
        criadaEm,
      })
      .returning();
    const ato = (tipo: "pedido" | "registro" | "aprovacao" | "confirmacao", autor: UsuarioAutenticado, minutos: number, assina: boolean) =>
      db.insert(ausenciaAto).values({ ausenciaId: a!.id, tipo, autorId: autor.id, em: new Date(criadaEm.getTime() + minutos * 60_000), assinaturaPath: assina ? autor.assinaturaPath : null, dados: { motivo: d.motivo, inicio: a!.inicio, retorno: a!.retorno } });
    if (d.origem === "supervisor") await ato("registro", quemAprova, 0, true);
    else {
      await ato("pedido", quem, 0, false);
      if (d.estado === "confirmada") {
        await ato("aprovacao", quemAprova, 30, true);
        await ato("confirmacao", quem, 60, true);
      }
    }
    return a!;
  };
  await ausenciaDemo(tec5, sup1, { motivo: "Férias", inicio: 3, retorno: -4, estado: "confirmada", origem: "pedido", criadaHaDias: 20 });
  const agendada = await ausenciaDemo(tec2, sup1, { motivo: "Treinamento de segurança", inicio: -5, retorno: -8, estado: "confirmada", origem: "supervisor", criadaHaDias: 2 });
  await avisarAusencia(db, { tipo: "ausencia_registrada", ausenciaId: agendada.id, usuarioAlvoId: tec2.id, destinatarios: [tec2.id], detalhe: `${sup1.nome} registrou uma ausência para você de ${dataBr(agendada.inicio)} a ${dataBr(somarDias(agendada.retorno, -1))}, com retorno em ${dataBr(agendada.retorno)}. Motivo: ${agendada.motivo}`, agora: em(2, 9) });
  await ausenciaDemo(tec4, sup2, { motivo: "Atestado médico", inicio: 10, retorno: 1, estado: "confirmada", origem: "supervisor", criadaHaDias: 10 });
  const pedida = await ausenciaDemo(tec3, sup2, { motivo: "Viagem a trabalho em outra filial", inicio: -10, retorno: -17, estado: "pedida", origem: "pedido", criadaHaDias: 0 });
  await avisarAusencia(db, { tipo: "ausencia_pedida", ausenciaId: pedida.id, usuarioAlvoId: tec3.id, destinatarios: [sup2.id], detalhe: `${tec3.nome} pediu ausência de ${dataBr(pedida.inicio)} a ${dataBr(somarDias(pedida.retorno, -1))}, com retorno em ${dataBr(pedida.retorno)}. Motivo: ${pedida.motivo}`, agora: minutosAtras(90) });
  await conferirAusencias(db, real);

  // ================= GAMIFICAÇÃO ====================================================================================
  // APRs e execuções já pontuaram pelas regras da `api` (`processarEventos`); as ciências, as assinaturas e os intervalos do ciclo
  // foram gravados direto, então o preenchimento do histórico (que não duplica o que já foi lançado) completa o extrato, fecha as
  // temporadas passadas e concede as conquistas.
  await preencherHistoricoDaGamificacao(db, real, { forcar: true });

  // ================= ALERTAS: parte já lida =========================================================================
  const lidos = await db.select({ id: alerta.id }).from(alerta).orderBy(alerta.criadoEm);
  if (lidos.length > 2) await db.update(alerta).set({ lidoEm: minutosAtras(60 * 20) }).where(inArray(alerta.id, lidos.slice(0, Math.floor(lidos.length / 2)).map((a) => a.id)));

  // ---------- resumo ---------------------------------------------------------------------------------------------
  const contagem: Record<string, number> = {};
  for (const [rotulo, tabela] of [["os", "os"], ["apr", "apr"], ["execucoes", "execucao"], ["eventos", "evento_campo"], ["alertas", "alerta"], ["tarefas_pdf_pendentes", "tarefa"]] as const) {
    const filtro = rotulo === "tarefas_pdf_pendentes" ? sql` where tipo = 'pdf_os' and estado = 'pendente'` : sql``;
    const r = await db.execute(sql`select count(*)::int as n from ${sql.identifier(tabela)}${filtro}`);
    contagem[rotulo] = Number(((r as unknown as { rows: { n: number }[] }).rows ?? (r as unknown as { n: number }[]))[0]!.n);
  }
  // O SAP simulado passa a ter as ordens das OS que a carga criou, para o SAP e o SYNQ OS concordarem desde o início.
  if (deps.config.sapSimulado) contagem["ordens do SAP simulado"] = await espelharOsDoSapNoSimulador(db);

  return { jaPopulado: false, usuariosCriados: criados, contagem };
}

