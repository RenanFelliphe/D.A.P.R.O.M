/**
 * API fictícia do Campo de treino: responde, com a MESMA forma das respostas reais (snake_case, `{erro: {codigo,
 * mensagem}}` nos erros), os endpoints que a área de campo (`/app/*`) usa, sobre o estado em memória (`armazem.ts`).
 * As regras de eventos (APR, bloqueio por item eliminatório, iniciar, pausar, suspender, interromper, cancelar e
 * encerrar) repetem as de `api/src/dominio/eventos-*.ts`; o status da OS é derivado como em `dominio/status-os.ts`.
 *
 * Simplificações (a `api` real faz mais): sem fila offline (`/sync/pull` não existe aqui), sem alertas por e-mail, sem
 * reprogramação nem cancelamento (são do supervisor e do admin e respondem `403`), a ciência e `/alertas` idem, a troca
 * de senha só confere os dois campos, o PDF da OS é um documento genérico de treino e as fotos e os PDFs enviados ficam na
 * memória (até 2 MB cada). O catálogo de serviço é fixo e só de leitura (`treino/catalogo.ts`). Qualquer endereço que o
 * campo não usa responde `404 indisponivel_no_treino`.
 */
import type { CategoriaMaterial, ServicoDoCatalogo } from "../lib/catalogo";
import type { Usuario } from "../lib/tipos";
import { obterEstado } from "./armazem";
import { materiaisDoTreino, servicosDoTreino } from "./catalogo";
import { diaDe, statusDerivado, type AlertaReg, type AprReg, type EstadoTreino, type ExecucaoReg, type ItemRegDoModelo, type ModeloReg, type OsReg, type UsuarioTreino } from "./dados";
import { idTreino } from "./ids";

// ---------------------------------------------------------------------------------------------------------------
// Resposta e erros
// ---------------------------------------------------------------------------------------------------------------

export interface RespostaTreino {
  status: number;
  /** Corpo JSON (ausente quando há `binario`). */
  corpo?: unknown;
  /** Imagem ou PDF (fotos, assinaturas e o PDF da OS). */
  binario?: { tipo: string; bytes: Uint8Array; nome?: string };
}

type Consulta = Record<string, string | number | boolean | null | undefined> | URLSearchParams;

class ErroTreino extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}
const naoEncontrado = (mensagem = "Registro não encontrado") => new ErroTreino(404, "nao_encontrado", mensagem);
const proibido = (mensagem = "Seu perfil não pode fazer isto") => new ErroTreino(403, "proibido", mensagem);
const invalido = (codigo: string, mensagem: string) => new ErroTreino(422, codigo, mensagem);
const conflito = (codigo: string, mensagem: string) => new ErroTreino(409, codigo, mensagem);

const ok = (corpo: unknown, status = 200): RespostaTreino => ({ status, corpo });

/** Um evento pode ser recusado para sempre (`rejeitado`) ou ficar pendente até a causa sumir (`pendente`). */
class Rejeicao extends Error {
  constructor(
    public readonly situacao: "rejeitado" | "pendente",
    public readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}
const rejeitar = (codigo: string, mensagem: string) => new Rejeicao("rejeitado", codigo, mensagem);
const adiar = (codigo: string, mensagem: string) => new Rejeicao("pendente", codigo, mensagem);

// ---------------------------------------------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------------------------------------------

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const vazio = (s: string | null | undefined) => !s || s.trim() === "";
const unico = <T>(itens: T[]) => new Set(itens).size === itens.length;

const VARIANTES: Record<string, string> = { a: "áàâãäå", e: "éèêë", i: "íìîï", o: "óòôõö", u: "úùûü", c: "ç", n: "ñ", y: "ýÿ" };
const TROCA = new Map<string, string>(Object.entries(VARIANTES).flatMap(([base, letras]) => [...letras].map((l) => [l, base] as const)));
/** Minúsculo e sem acento, como a busca real compara. */
const normalizar = (texto: string) => Array.from(texto.toLowerCase(), (c) => TROCA.get(c) ?? c).join("");
const contem = (campos: (string | null | undefined)[], termo: string) => {
  const t = normalizar(termo.trim());
  return campos.some((c) => c != null && normalizar(c).includes(t));
};
const igual = (campos: (string | null | undefined)[], termo: string) => {
  const t = normalizar(termo.trim());
  return campos.some((c) => c != null && normalizar(c.trim()) === t);
};

function lerConsulta(consulta: Consulta | undefined): Record<string, string> {
  const saida: Record<string, string> = {};
  if (!consulta) return saida;
  const pares = consulta instanceof URLSearchParams ? [...consulta.entries()] : Object.entries(consulta);
  for (const [chave, valor] of pares) if (valor !== undefined && valor !== null && String(valor) !== "") saida[chave] = String(valor);
  return saida;
}

function booleano(valor: string | undefined, nome: string): boolean | undefined {
  if (valor === undefined) return undefined;
  if (valor === "true") return true;
  if (valor === "false") return false;
  throw invalido("validacao", `${nome}: use true ou false`);
}

function paginacao(q: Record<string, string>) {
  const pagina = q.pagina === undefined ? 1 : Number(q.pagina);
  const tamanho = q.tamanho === undefined ? 50 : Number(q.tamanho);
  if (!Number.isInteger(pagina) || pagina < 1) throw invalido("validacao", "pagina: informe um inteiro a partir de 1");
  if (!Number.isInteger(tamanho) || tamanho < 1 || tamanho > 200) throw invalido("validacao", "tamanho: informe um inteiro de 1 a 200");
  return { pagina, tamanho, de: (pagina - 1) * tamanho };
}
const meta = (p: { pagina: number; tamanho: number }, total: number) => ({ pagina: p.pagina, tamanho: p.tamanho, total });

const emMinutos = (ms: number) => Math.round(ms / 60_000);

function tempoDaExecucao(e: Pick<ExecucaoReg, "inicio" | "fim" | "pausas">) {
  if (e.fim === null) return null;
  const inicio = new Date(e.inicio).getTime();
  const fim = new Date(e.fim).getTime();
  let pausaMs = 0;
  for (const p of e.pausas) {
    const de = Math.max(new Date(p.inicio).getTime(), inicio);
    const ate = Math.min(p.fim ? new Date(p.fim).getTime() : fim, fim);
    if (ate > de) pausaMs += ate - de;
  }
  return { totalMs: fim - inicio, pausaMs, liquidoMs: fim - inicio - pausaMs };
}

// ---------------------------------------------------------------------------------------------------------------
// Serialização (formas reais)
// ---------------------------------------------------------------------------------------------------------------

const equipeApi = (e: EstadoTreino) => ({ ...e.equipe });
const nomeDe = (e: EstadoTreino, id: string) => e.usuarios.find((u) => u.id === id)?.nome ?? "Usuário";
const usuarioDe = (e: EstadoTreino, id: string) => e.usuarios.find((u) => u.id === id);
const localDe = (e: EstadoTreino, o: OsReg) => e.locais.find((l) => l.id === o.local_instalacao_id)!;
const modeloPorId = (e: EstadoTreino, id: string) => e.modelos.find((m) => m.id === id)!;

/** Usuário como `GET /usuarios` o devolve ao técnico: sem e-mail. */
function usuarioPublico(u: UsuarioTreino) {
  const { email: _email, ...resto } = u;
  void _email;
  return resto;
}

const pdfPronto = (o: OsReg, agora: Date) => o.pdf_path !== null && (o.pdf_em === null || new Date(o.pdf_em) <= agora);
const LIMITE_EXECUCAO_ABERTA_MS = 12 * 3_600_000;

function horasAberta(e: EstadoTreino, osId: string, agora: Date): number | null {
  const abertas = e.execucoes.filter((x) => x.os_id === osId && x.resultado === null).sort((a, b) => a.inicio.localeCompare(b.inicio));
  if (abertas.length === 0) return null;
  const ms = agora.getTime() - new Date(abertas[0]!.inicio).getTime();
  return ms > LIMITE_EXECUCAO_ABERTA_MS ? Math.floor(ms / 3_600_000) : null;
}

const atrasada = (o: OsReg, hoje: string) => (o.status === "liberada" || o.status === "pendente") && (o.data_fim_prog ?? o.data_inicio_prog) < hoje;

function osResumo(e: EstadoTreino, o: OsReg, agora: Date) {
  const l = localDe(e, o);
  return {
    id: o.id,
    numero_ordem: o.numero_ordem,
    numero_nota: o.numero_nota,
    tipo: o.tipo,
    titulo: o.titulo,
    status: o.status,
    equipe_id: o.equipe_id,
    equipe_nome: e.equipe.nome,
    local_instalacao: { id: l.id, codigo: l.codigo, cliente: l.cliente, critico: l.critico },
    equipamento: o.equipamento,
    prioridade: o.prioridade,
    data_inicio_prog: o.data_inicio_prog,
    data_fim_prog: o.data_fim_prog,
    pdf_pronto: pdfPronto(o, agora),
    ciencia_em: o.ciencia_em,
    execucao_aberta_ha_horas: horasAberta(e, o.id, agora),
    atrasada: atrasada(o, diaDe(agora)),
  };
}

const STATUS_OS = ["liberada", "pendente", "em_execucao", "encerrada", "cancelada"] as const;
const PESO_PRIORIDADE: Record<string, number> = { "muito alto": 4, alto: 3, médio: 2, medio: 2, baixo: 1 };

interface FiltrosOs {
  equipe_id?: string;
  tipo?: string;
  critica?: boolean;
  periodo?: string;
  status?: string;
  numero_ordem?: string;
  busca?: string;
  ordem?: string;
}

function filtrosDeOs(q: Record<string, string>): FiltrosOs {
  if (q.status && !(STATUS_OS as readonly string[]).includes(q.status)) throw invalido("validacao", "status: valor inválido");
  if (q.tipo && !["preventiva", "corretiva"].includes(q.tipo)) throw invalido("validacao", "tipo: valor inválido");
  if (q.periodo && !/^\d{4}-(0[1-9]|1[0-2])$/.test(q.periodo)) throw invalido("validacao", "periodo: Use o formato AAAA-MM");
  if (q.ordem && !["prioridade", "data_limite"].includes(q.ordem)) throw invalido("validacao", "ordem: valor inválido");
  return { equipe_id: q.equipe_id, tipo: q.tipo, critica: booleano(q.critica, "critica"), periodo: q.periodo, status: q.status, numero_ordem: q.numero_ordem, busca: q.busca, ordem: q.ordem };
}

function listarOs(e: EstadoTreino, f: FiltrosOs, pag: { pagina: number; tamanho: number; de: number }, agora: Date) {
  const passa = (o: OsReg, comStatus: boolean) => {
    const l = localDe(e, o);
    if (f.equipe_id && o.equipe_id !== f.equipe_id) return false;
    if (f.tipo && o.tipo !== f.tipo) return false;
    if (f.critica !== undefined && l.critico !== f.critica) return false;
    if (f.periodo && o.data_inicio_prog.slice(0, 7) !== f.periodo) return false;
    if (comStatus && f.status && o.status !== f.status) return false;
    if (f.numero_ordem && o.numero_ordem !== f.numero_ordem.trim()) return false;
    if (f.busca && !contem([o.numero_ordem, o.titulo, l.codigo, o.numero_nota, l.cliente], f.busca)) return false;
    return true;
  };
  const peso = (o: OsReg) => PESO_PRIORIDADE[(o.prioridade ?? "").toLowerCase()] ?? 0;
  const limite = (o: OsReg) => o.data_fim_prog ?? o.data_inicio_prog;
  const critico = (o: OsReg) => (localDe(e, o).critico ? 1 : 0);
  const todas = e.os.filter((o) => passa(o, true)).sort((a, b) => {
    const porPrioridade = peso(b) - peso(a);
    const porData = limite(a).localeCompare(limite(b));
    const principal = f.ordem === "data_limite" ? porData || porPrioridade : porPrioridade || porData;
    return principal || critico(b) - critico(a) || (a.numero_ordem ?? "").localeCompare(b.numero_ordem ?? "") || a.id.localeCompare(b.id);
  });
  const contagem = Object.fromEntries(STATUS_OS.map((s) => [s, 0])) as Record<(typeof STATUS_OS)[number], number>;
  for (const o of e.os) if (passa(o, false)) contagem[o.status]++;
  return { itens: todas.slice(pag.de, pag.de + pag.tamanho).map((o) => osResumo(e, o, agora)), total: todas.length, contagem };
}

function aprsApi(e: EstadoTreino, osId: string) {
  return e.aprs
    .filter((a) => a.os_id === osId)
    .sort((a, b) => a.concluida_em.localeCompare(b.concluida_em) || a.id.localeCompare(b.id))
    .map((a) => {
      const modelo = modeloPorId(e, a.modelo_apr_id);
      const completas = [...a.respostas]
        .map((r) => ({ r, item: modelo.itens.find((i) => i.id === r.item_id)! }))
        .sort((x, y) => x.item.ordem - y.item.ordem)
        .map(({ r, item }) => {
          const reprovado = item.tipo === "eliminatorio" && item.resposta_bloqueante !== null && r.resposta === item.resposta_bloqueante;
          return {
            item_id: item.id,
            secao: item.secao,
            ordem: item.ordem,
            texto: item.texto,
            risco_id: item.risco_id,
            resposta: r.resposta,
            observacao: r.observacao,
            respondida_em: r.respondida_em,
            reprovado,
          };
        });
      const preenchedor = usuarioDe(e, a.preenchida_por);
      return {
        id: a.id,
        os_id: a.os_id,
        resultado: a.resultado,
        observacao_geral: a.observacao_geral,
        concluida_em: a.concluida_em,
        preenchida_por: { id: a.preenchida_por, nome: preenchedor?.nome ?? "Usuário" },
        modelo: { codigo: modelo.codigo, versao: modelo.versao, titulo: modelo.titulo },
        participantes: a.participantes
          .map((p) => {
            const u = usuarioDe(e, p.usuario_id);
            return { usuario_id: p.usuario_id, nome: u?.nome ?? "Participante", matricula: u?.matricula ?? "", funcao: p.funcao, assinatura_path: p.assinatura_path, assinada_em: p.assinada_em };
          })
          .sort((x, y) => x.funcao.localeCompare(y.funcao) || x.nome.localeCompare(y.nome)),
        riscos: modelo.riscos.filter((r) => a.riscos.includes(r.id)).map((r) => ({ id: r.id, classificacao: r.classificacao, nome: r.nome })),
        respostas: completas,
        materiais: (a.materiais ?? [])
          .map((m) => {
            const cadastro = descricaoDoMaterial(e, m.material_id);
            return {
              material_id: m.material_id,
              descricao: cadastro?.descricao ?? "Material",
              unidade: cadastro?.unidade ?? "un",
              categoria: (cadastro?.categoria ?? "material") as CategoriaMaterial,
              obrigatorio: m.obrigatorio,
              levou: m.levou,
              foto: m.foto ? { foto_path: m.foto.arquivo_id, capturada_em: m.foto.capturada_em, latitude: m.foto.latitude, longitude: m.foto.longitude } : null,
            };
          })
          .sort((x, y) => Number(y.obrigatorio) - Number(x.obrigatorio) || x.descricao.localeCompare(y.descricao)),
        itens_reprovados: completas
          .filter((r) => r.reprovado)
          .map((r) => ({
            item_id: r.item_id,
            texto: r.texto,
            resposta: r.resposta,
            observacao: r.observacao,
            fotos: a.evidencias
              .filter((f) => f.item_id === r.item_id && f.tipo !== "pdf")
              .map((f) => ({ id: f.id, foto_path: f.arquivo_id, capturada_em: f.capturada_em, latitude: f.latitude, longitude: f.longitude })),
            documentos: a.evidencias
              .filter((f) => f.item_id === r.item_id && f.tipo === "pdf")
              .map((f) => ({ id: f.id, arquivo_path: f.arquivo_id, nome: f.nome ?? null, capturada_em: f.capturada_em })),
          })),
      };
    });
}

function execucoesApi(e: EstadoTreino, osId: string) {
  return e.execucoes
    .filter((x) => x.os_id === osId)
    .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.id.localeCompare(b.id))
    .map((x) => {
      const u = usuarioDe(e, x.executor_id);
      const tempo = tempoDaExecucao(x);
      return {
        id: x.id,
        apr_id: x.apr_id,
        executor: { id: x.executor_id, nome: u?.nome ?? "Usuário", matricula: u?.matricula ?? "" },
        numero_pessoas: x.numero_pessoas,
        inicio: x.inicio,
        fim: x.fim,
        resultado: x.resultado,
        descricao_atividade: x.descricao_atividade,
        motivo: x.motivo,
        dados_inspecao: x.dados_inspecao,
        tempo_liquido_min: tempo ? emMinutos(tempo.liquidoMs) : null,
        pausa_min: tempo ? emMinutos(tempo.pausaMs) : null,
        pausas: [...x.pausas].sort((a, b) => a.inicio.localeCompare(b.inicio)).map((p) => ({ ...p })),
        assinaturas: x.assinaturas
          .map((a) => {
            const p = usuarioDe(e, a.usuario_id);
            return { usuario_id: a.usuario_id, nome: p?.nome ?? "Participante", matricula: p?.matricula ?? "", assinatura_path: a.assinatura_path, assinada_em: a.assinada_em };
          })
          .sort((a, b) => a.nome.localeCompare(b.nome)),
        fotos: [...x.fotos].sort((a, b) => a.capturada_em.localeCompare(b.capturada_em)).map((f) => ({ ...f })),
        documentos: [...(x.documentos ?? [])].sort((a, b) => a.capturada_em.localeCompare(b.capturada_em)).map((d) => ({ ...d })),
      };
    });
}

function alertasApi(e: EstadoTreino, osId: string) {
  return e.alertas
    .filter((a) => a.os_id === osId)
    .sort((a, b) => a.criado_em.localeCompare(b.criado_em))
    .map((a) => ({ id: a.id, tipo: a.tipo, detalhe: a.detalhe, destinatario_id: a.destinatario_id, destinatario_nome: nomeDe(e, a.destinatario_id), email_enviado_em: a.email_enviado_em, lido_em: a.lido_em, criado_em: a.criado_em }));
}

function linhaDoTempo(aprs: ReturnType<typeof aprsApi>, execs: ReturnType<typeof execucoesApi>, alertas: ReturnType<typeof alertasApi>) {
  const itens: { em: string; tipo: string; descricao: string }[] = [];
  for (const a of aprs) itens.push({ em: a.concluida_em, tipo: "apr_concluida", descricao: `APR ${a.resultado} (${a.modelo.codigo} v${a.modelo.versao}) por ${a.preenchida_por.nome}` });
  for (const x of execs) {
    itens.push({ em: x.inicio, tipo: "execucao_iniciada", descricao: `Execução iniciada por ${x.executor.nome}` });
    for (const p of x.pausas) {
      itens.push({ em: p.inicio, tipo: "pausa_iniciada", descricao: `Pausa iniciada${p.motivo ? ` (${p.motivo})` : ""}` });
      if (p.fim) itens.push({ em: p.fim, tipo: "pausa_encerrada", descricao: "Pausa encerrada" });
    }
    if (x.fim && x.resultado) {
      itens.push({ em: x.fim, tipo: `execucao_${x.resultado}`, descricao: `Execução ${x.resultado} por ${x.executor.nome}${x.resultado === "interrompida" && x.motivo ? `: ${x.motivo}` : ""}` });
    }
  }
  for (const a of alertas) itens.push({ em: a.criado_em, tipo: "alerta", descricao: `Alerta ${a.tipo}: ${a.detalhe}` });
  return itens.map((item, i) => ({ item, i })).sort((a, b) => new Date(a.item.em).getTime() - new Date(b.item.em).getTime() || a.i - b.i).map((x) => x.item);
}

function detalheDaOs(e: EstadoTreino, o: OsReg, agora: Date) {
  const aprs = aprsApi(e, o.id);
  const execucoes = execucoesApi(e, o.id);
  const alertas = alertasApi(e, o.id);
  return {
    os: {
      ...o,
      local_instalacao: { ...localDe(e, o) },
      equipe: { id: e.equipe.id, nome: e.equipe.nome, centro_trabalho: e.equipe.centro_trabalho, supervisor_id: e.equipe.supervisor_id },
      ciencia_por_nome: o.ciencia_por ? nomeDe(e, o.ciencia_por) : null,
      modelo_apr_codigo: o.modelo_apr_codigo,
      pdf_pronto: pdfPronto(o, agora),
      execucao_aberta_ha_horas: horasAberta(e, o.id, agora),
      atrasada: atrasada(o, diaDe(agora)),
      eventos_com_relogio_suspeito: 0,
    },
    servico: servicoDaOs(e, o),
    aprs,
    execucoes,
    alertas,
    reprogramacoes: [],
    linha_do_tempo: linhaDoTempo(aprs, execucoes, alertas),
  };
}

/** O catálogo de treino, com o modelo de APR que as OS de cada serviço usam. */
const catalogoDe = (e: EstadoTreino): ServicoDoCatalogo[] => servicosDoTreino((codigo) => e.os.find((o) => o.codigo_atividade === codigo)?.modelo_apr_codigo ?? null);

/** O serviço da OS no catálogo (`servico` do detalhe); nulo quando a OS não tem atividade. */
function servicoDaOs(e: EstadoTreino, o: OsReg) {
  if (!o.codigo_atividade) return null;
  const s = catalogoDe(e).find((x) => x.codigo === o.codigo_atividade);
  return s ? { codigo: s.codigo, descricao: s.descricao, materiais: s.materiais } : { codigo: o.codigo_atividade, descricao: o.tipo_atividade ?? o.codigo_atividade, materiais: [] };
}

function osPorId(e: EstadoTreino, id: string): OsReg {
  const o = e.os.find((x) => x.id === id);
  if (!o) throw naoEncontrado("OS não encontrada");
  return o;
}

// ---------------------------------------------------------------------------------------------------------------
// Modelos de APR
// ---------------------------------------------------------------------------------------------------------------

const resumoDoModelo = (e: EstadoTreino, m: ModeloReg) => ({
  id: m.id,
  codigo: m.codigo,
  versao: m.versao,
  titulo: m.titulo,
  data_documento: m.data_documento,
  publicado_em: m.publicado_em,
  arquivado_em: null,
  rascunho: false,
  itens_total: m.itens.length,
  aprs_total: e.aprs.filter((a) => a.modelo_apr_id === m.id).length,
  atividades_total: e.os.filter((o) => o.modelo_apr_codigo === m.codigo).length,
});

/** O técnico recebe o modelo sem `tipo`, `resposta_bloqueante` e `evidencia`: não pode saber o que é eliminatório. */
function completoDoModelo(m: ModeloReg) {
  return {
    ...m,
    riscos: m.riscos.map((r) => ({ ...r })),
    itens: m.itens.map((i) => ({
      id: i.id,
      secao: i.secao,
      risco_id: i.risco_id,
      risco_ordem: i.risco_id ? (m.riscos.find((r) => r.id === i.risco_id)?.ordem ?? null) : null,
      ordem: i.ordem,
      texto: i.texto,
      permite_na: i.permite_na,
    })),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Arquivos (fotos, assinaturas e PDFs de evidência) e PDF da OS
// ---------------------------------------------------------------------------------------------------------------

const LIMITE_ARQUIVO = { foto: 10 * 1024 * 1024, assinatura: 1024 * 1024, pdf: 10 * 1024 * 1024 } as const;
/** A assinatura `%PDF-` no começo do arquivo, como a `api` confere. */
const ehPdf = (bytes: Uint8Array) => new TextDecoder("latin1").decode(bytes.subarray(0, 1024)).includes("%PDF-");
const LIMITE_GUARDADO = 2 * 1024 * 1024;

const xml = (t: string) => t.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

function desenharSvg(tipo: "foto" | "assinatura", rotulo: string): Uint8Array {
  const svg =
    tipo === "assinatura"
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="160" viewBox="0 0 480 160"><rect width="480" height="160" fill="#fff"/><path d="M20 128 C120 118 220 134 460 122" stroke="#1d3a6b" stroke-width="2" fill="none" opacity=".55"/><text x="24" y="100" font-family="'Brush Script MT','Segoe Script',cursive" font-style="italic" font-size="52" fill="#1d3a6b">${xml(rotulo)}</text></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d7dde6"/><stop offset="1" stop-color="#9fb0c4"/></linearGradient></defs><rect width="640" height="480" fill="url(#g)"/><rect x="200" y="150" width="240" height="170" rx="10" fill="none" stroke="#51647d" stroke-width="6"/><circle cx="320" cy="235" r="44" fill="none" stroke="#51647d" stroke-width="6"/><text x="320" y="390" text-anchor="middle" font-family="sans-serif" font-size="26" fill="#2c3b50">Foto de treino</text><text x="320" y="425" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#2c3b50">${xml(rotulo)}</text></svg>`;
  return new TextEncoder().encode(svg);
}

/** PDF mínimo (Helvetica, uma página) com as linhas dadas; o texto vai em Latin-1 para manter os acentos. */
export function gerarPdfTreino(linhas: string[]): Uint8Array {
  const esc = (t: string) => t.replace(/[\\()]/g, "\\$&").replace(/[^\x20-\xff]/g, "?");
  const conteudo = ["BT", "/F1 16 Tf", "56 780 Td", "20 TL", ...linhas.map((l, i) => `${i === 0 ? "" : "T* "}(${esc(l)}) Tj`), "ET"].join("\n");
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`,
  ];
  let saida = "%PDF-1.4\n";
  const posicoes: number[] = [];
  objetos.forEach((o, i) => {
    posicoes.push(saida.length);
    saida += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = saida.length;
  saida += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${posicoes.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("")}`;
  saida += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(saida.length);
  for (let i = 0; i < saida.length; i++) bytes[i] = saida.charCodeAt(i) & 0xff;
  return bytes;
}

function pdfDaOs(e: EstadoTreino, o: OsReg): Uint8Array {
  const l = localDe(e, o);
  const execs = execucoesApi(e, o.id).filter((x) => x.resultado === "encerrada");
  return gerarPdfTreino([
    "DOCUMENTO DE TREINAMENTO - SEM VALOR OPERACIONAL",
    "",
    `OS ${o.numero_ordem ?? "sem numero"} - ${o.titulo}`,
    `Local: ${l.codigo}${l.cliente ? ` (${l.cliente})` : ""}`,
    `Equipe: ${e.equipe.nome}`,
    `Tipo: ${o.tipo}   Prioridade: ${o.prioridade ?? "-"}`,
    "",
    ...execs.flatMap((x) => [`Execucao por ${x.executor.nome}: ${x.inicio.slice(0, 16).replace("T", " ")} a ${(x.fim ?? "").slice(0, 16).replace("T", " ")} (UTC)`, `Atividade: ${x.descricao_atividade ?? "-"}`]),
    "",
    "Este PDF foi gerado pelo Campo de treino: nenhuma informacao real foi usada.",
  ]);
}

/** Arquivo (foto, assinatura ou PDF) do treino do técnico, para o endereço `/api/treino/arquivos/{id}`; `null` se não existe. */
export function arquivoDoTreino(usuario: Usuario, id: string): { tipo: string; bytes: Uint8Array } | null {
  const a = obterEstado(usuario).arquivos.get(id);
  if (!a) return null;
  if (a.bytes) return { tipo: a.mime, bytes: a.bytes };
  // PDF grande demais para a memória do treino: um documento genérico no lugar.
  if (a.tipo === "pdf") return { tipo: "application/pdf", bytes: gerarPdfTreino(["DOCUMENTO DE TREINAMENTO", "", a.rotulo]) };
  return { tipo: "image/svg+xml", bytes: desenharSvg(a.tipo, a.rotulo) };
}

interface EnvioDeArquivo {
  arquivo?: { type?: string; size?: number; arrayBuffer?: () => Promise<ArrayBuffer> };
  tipo?: unknown;
}

async function receberArquivo(e: EstadoTreino, id: string, corpo: unknown): Promise<RespostaTreino> {
  const envio = (corpo ?? {}) as EnvioDeArquivo;
  const arquivo = envio.arquivo;
  if (!arquivo || typeof arquivo.arrayBuffer !== "function") throw invalido("validacao", 'arquivo: envie o arquivo no campo multipart "arquivo"');
  if (envio.tipo !== "foto" && envio.tipo !== "assinatura" && envio.tipo !== "pdf") throw invalido("validacao", 'tipo: use "foto", "assinatura" ou "pdf"');
  const tipo = envio.tipo;
  if (tipo !== "pdf" && !(arquivo.type ?? "").startsWith("image/")) throw invalido("tipo_de_arquivo", "Envie uma imagem");
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  if (bytes.length === 0) throw invalido("arquivo_vazio", "Arquivo vazio");
  const limite = LIMITE_ARQUIVO[tipo];
  if (bytes.length > limite) throw new ErroTreino(413, "arquivo_grande", `Arquivo maior que ${limite / 1024 / 1024} MB`);
  if (tipo === "pdf" && !ehPdf(bytes)) throw invalido("tipo_de_arquivo", "Envie um arquivo PDF");
  const existente = e.arquivos.get(id);
  if (existente) {
    const mesmo = existente.bytes && existente.bytes.length === bytes.length && existente.bytes.every((b, i) => b === bytes[i]);
    if (!mesmo) throw conflito("arquivo_diferente", "Já existe outro arquivo com este id");
  } else {
    // Imagens grandes demais para a memória do treino ficam só como metadados (a imagem é desenhada na hora).
    const rotulo = tipo === "foto" ? "Foto enviada" : tipo === "pdf" ? "PDF enviado" : "Assinatura enviada";
    e.arquivos.set(id, { id, tipo, mime: tipo === "pdf" ? "application/pdf" : arquivo.type!, bytes: bytes.length <= LIMITE_GUARDADO ? bytes : null, rotulo });
  }
  return ok({ id, caminho: id });
}

// ---------------------------------------------------------------------------------------------------------------
// Eventos de campo (`POST /eventos`)
// ---------------------------------------------------------------------------------------------------------------

const EVENTO_TIPOS = ["apr_concluida", "execucao_iniciada", "pausa_iniciada", "pausa_encerrada", "execucao_encerrada", "execucao_interrompida", "execucao_suspensa", "execucao_cancelada"] as const;
type EventoTipo = (typeof EVENTO_TIPOS)[number];
const RESPOSTAS = ["sim", "nao", "na"];
const FUNCOES = ["responsavel", "executor"];
const MOTIVOS_PAUSA = ["almoco", "descanso", "outro"];
const MAX_FOTOS = 10;
const MAX_PDFS = 5;
const MAX_EVENTOS = 500;
const CANCELAR_ATE_MS = 10 * 60_000;

interface EventoRecebido {
  id: string;
  tipo: EventoTipo;
  os_id: string | null;
  payload: Record<string, unknown>;
  ocorrido_em: Date;
}

interface Contexto {
  e: EstadoTreino;
  eu: UsuarioTreino;
  evento: EventoRecebido;
  agora: Date;
  saida: { alertas: string[]; aprs: { id: string; resultado: string }[]; osAfetadas: Set<string> };
  /** A APR bloqueada é registrada na validação (`POST /aprs/avaliar`); a evidência dos reprovados chega depois. */
  evidenciaDepois?: boolean;
}

// Leitura do payload (o que o `zod` da `api` valida).
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
function invalidoNoPayload(campo: string, regra: string): never {
  throw rejeitar("payload_invalido", `${campo}: ${regra}`);
}
const campoUuid = (o: Record<string, unknown>, c: string, obrigatorio = true): string | undefined => {
  const v = o[c];
  if (v === undefined || v === null) return obrigatorio ? invalidoNoPayload(c, "Informe o campo") : undefined;
  if (typeof v !== "string" || !REGEX_UUID.test(v)) return invalidoNoPayload(c, "Identificador inválido");
  return v;
};
const campoInstante = (o: Record<string, unknown>, c: string, obrigatorio = true): Date | undefined => {
  const v = o[c];
  if (v === undefined || v === null) return obrigatorio ? invalidoNoPayload(c, "Informe a data e hora") : undefined;
  const d = typeof v === "string" ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return invalidoNoPayload(c, "Data e hora inválidas");
  return d;
};
const campoTexto = (o: Record<string, unknown>, c: string): string | null => {
  const v = o[c];
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") return invalidoNoPayload(c, "Informe um texto");
  return v;
};
const campoLista = (o: Record<string, unknown>, c: string, obrigatorio = false): unknown[] => {
  const v = o[c];
  if (v === undefined || v === null) return obrigatorio ? invalidoNoPayload(c, "Informe a lista") : [];
  if (!Array.isArray(v)) return invalidoNoPayload(c, "Informe uma lista");
  return v;
};

/** Um item da conferência dos materiais, como o aparelho envia: o material, se levou e a foto (só de quem levou). */
interface MaterialDaAprLido {
  material_id: string;
  levou: boolean;
  foto: { arquivo_id: string; capturada_em: Date; latitude: number | null; longitude: number | null } | null;
}
function lerMateriais(o: Record<string, unknown>): MaterialDaAprLido[] {
  return campoLista(o, "materiais").map((bruto, i) => {
    const x = obj(bruto);
    if (typeof x.levou !== "boolean") invalidoNoPayload(`materiais.${i}.levou`, "Informe true ou false");
    let foto: MaterialDaAprLido["foto"] = null;
    if (x.foto !== undefined && x.foto !== null) {
      const f = obj(x.foto);
      const lat = f.latitude ?? null;
      const lon = f.longitude ?? null;
      if ((lat !== null && typeof lat !== "number") || (lon !== null && typeof lon !== "number")) invalidoNoPayload(`materiais.${i}.foto`, "Informe latitude e longitude numéricas");
      if ((lat === null) !== (lon === null)) invalidoNoPayload(`materiais.${i}.foto`, "Informe latitude e longitude juntas");
      foto = { arquivo_id: campoUuid(f, "arquivo_id")!, capturada_em: campoInstante(f, "capturada_em")!, latitude: lat as number | null, longitude: lon as number | null };
    }
    return { material_id: campoUuid(x, "material_id")!, levou: x.levou, foto };
  });
}

interface Evidencia {
  id: string;
  arquivo_id?: string;
  /** `foto` (padrão) ou `pdf`. */
  tipo: "foto" | "pdf";
  /** Nome do PDF anexado; ignorado na foto. */
  nome: string | null;
  item_id?: string;
  capturada_em: Date;
  latitude: number | null;
  longitude: number | null;
}
function lerEvidencias(o: Record<string, unknown>): Evidencia[] {
  return campoLista(o, "evidencias").map((bruto, i) => {
    const x = obj(bruto);
    const lat = x.latitude ?? null;
    const lon = x.longitude ?? null;
    if ((lat !== null && typeof lat !== "number") || (lon !== null && typeof lon !== "number")) invalidoNoPayload(`evidencias.${i}`, "Informe latitude e longitude numéricas");
    if ((lat === null) !== (lon === null)) invalidoNoPayload(`evidencias.${i}`, "Informe latitude e longitude juntas");
    const tipo = x.tipo ?? "foto";
    if (tipo !== "foto" && tipo !== "pdf") invalidoNoPayload(`evidencias.${i}.tipo`, "Valor inválido");
    const nome = campoTexto(x, "nome")?.trim().slice(0, 200) || null;
    return {
      id: campoUuid(x, "id")!,
      arquivo_id: campoUuid(x, "arquivo_id", false),
      tipo: tipo as "foto" | "pdf",
      nome: tipo === "pdf" ? nome : null,
      item_id: campoUuid(x, "item_id", false),
      capturada_em: campoInstante(x, "capturada_em")!,
      latitude: lat as number | null,
      longitude: lon as number | null,
    };
  });
}

/** A evidência gravada na APR (foto ou PDF de um item reprovado). */
const evidenciaDaApr = (ev: Evidencia): AprReg["evidencias"][number] => ({
  id: ev.id,
  arquivo_id: ev.arquivo_id ?? ev.id,
  item_id: ev.item_id!,
  capturada_em: ev.capturada_em.toISOString(),
  latitude: ev.latitude,
  longitude: ev.longitude,
  tipo: ev.tipo,
  nome: ev.nome,
});

/** O item tem o arquivo que a evidência dele exige (foto ou PDF; o de texto, nenhum)? */
const temOArquivoExigido = (i: ItemRegDoModelo, arquivos: { item_id?: string; tipo?: "foto" | "pdf" }[]) =>
  i.evidencia === "texto" || arquivos.some((a) => a.item_id === i.id && (a.tipo ?? "foto") === i.evidencia);

/** Fotos e PDFs da execução: ao menos uma foto é exigida por quem chama; aqui, só os limites. */
function conferirArquivosDaExecucao(evidencias: Evidencia[]) {
  if (evidencias.filter((ev) => ev.tipo === "foto").length > MAX_FOTOS) throw rejeitar("fotos_demais", `No máximo ${MAX_FOTOS} fotos por execução`);
  if (evidencias.filter((ev) => ev.tipo === "pdf").length > MAX_PDFS) throw rejeitar("pdfs_demais", `No máximo ${MAX_PDFS} documentos em PDF por execução`);
}
const fotosDaExecucao = (evidencias: Evidencia[]) =>
  evidencias.filter((ev) => ev.tipo === "foto").map((ev) => ({ id: ev.id, foto_path: ev.arquivo_id ?? ev.id, capturada_em: ev.capturada_em.toISOString(), latitude: ev.latitude, longitude: ev.longitude }));
const documentosDaExecucao = (evidencias: Evidencia[]) =>
  evidencias.filter((ev) => ev.tipo === "pdf").map((ev) => ({ id: ev.id, arquivo_path: ev.arquivo_id ?? ev.id, nome: ev.nome, capturada_em: ev.capturada_em.toISOString() }));

function exigirArquivo(ctx: Contexto, id: string) {
  if (!ctx.e.arquivos.has(id)) throw adiar("arquivo_ausente", `O arquivo ${id} ainda não foi enviado`);
}

function carregarOsDoUsuario(ctx: Contexto, osId: string) {
  const o = ctx.e.os.find((x) => x.id === osId);
  if (!o) throw rejeitar("os_inexistente", "OS não encontrada");
  return o;
}

function criarAlerta(ctx: Contexto, osId: string, tipo: string, detalhe: string) {
  const id = idTreino("4", ctx.e.proximoAlerta++);
  const alerta: AlertaReg = { id, os_id: osId, tipo, detalhe, destinatario_id: ctx.e.equipe.supervisor_id!, email_enviado_em: null, lido_em: null, criado_em: ctx.agora.toISOString() };
  ctx.e.alertas.push(alerta);
  ctx.saida.alertas.push(id);
}

/** O payload da APR (o que o `zod` da `api` valida). */
function lerApr(bruto: unknown) {
  const p = obj(bruto);
  const participantes = campoLista(p, "participantes", true).map((bp, i) => {
    const x = obj(bp);
    const funcao = x.funcao;
    if (typeof funcao !== "string" || !FUNCOES.includes(funcao)) invalidoNoPayload(`participantes.${i}.funcao`, "Valor inválido");
    return { usuario_id: campoUuid(x, "usuario_id")!, funcao: funcao as "responsavel" | "executor", assinada_em: campoInstante(x, "assinada_em", false) };
  });
  if (participantes.length === 0) invalidoNoPayload("participantes", "Informe ao menos um participante");
  return {
    id: campoUuid(p, "id")!,
    osPayload: campoUuid(p, "os_id", false),
    modeloId: campoUuid(p, "modelo_apr_id")!,
    participantes,
    riscos: campoLista(p, "riscos").map((r, i) => (typeof r === "string" && REGEX_UUID.test(r) ? r : invalidoNoPayload(`riscos.${i}`, "Identificador inválido"))),
    respostas: campoLista(p, "respostas", true).map((br, i) => {
      const x = obj(br);
      const resposta = x.resposta;
      if (typeof resposta !== "string" || !RESPOSTAS.includes(resposta)) invalidoNoPayload(`respostas.${i}.resposta`, "Valor inválido");
      return { item_id: campoUuid(x, "item_id")!, resposta: resposta as "sim" | "nao" | "na", observacao: campoTexto(x, "observacao"), respondida_em: campoInstante(x, "respondida_em", false) };
    }),
    evidencias: lerEvidencias(p),
    materiais: lerMateriais(p),
    observacaoGeral: campoTexto(p, "observacao_geral"),
    concluidaEm: campoInstante(p, "concluida_em")!,
  };
}
type AprLida = ReturnType<typeof lerApr>;

const reprovou = (i: ItemRegDoModelo, resposta: string | undefined) => i.tipo === "eliminatorio" && i.resposta_bloqueante !== null && resposta === i.resposta_bloqueante;

/**
 * Confere a APR contra a OS, a equipe e o modelo, sem gravar nada, e diz o que reprovou (`conferirApr` da `api`). Vale
 * na validação e no registro, e tudo é conferido antes do resultado: a recusa nunca depende de a APR reprovar.
 */
function conferirApr(ctx: Contexto, osId: string, p: AprLida) {
  const { e, eu } = ctx;
  const ordem = carregarOsDoUsuario(ctx, osId);
  if (e.execucoes.some((x) => x.os_id === ordem.id && x.resultado === null)) throw rejeitar("os_em_execucao", "Esta OS já está em execução");
  if (ordem.status === "encerrada") throw rejeitar("os_encerrada", "Esta OS já foi encerrada");

  const modelo = e.modelos.find((m) => m.id === p.modeloId);
  if (!modelo || !modelo.publicado_em) throw rejeitar("modelo_invalido", "Modelo de APR inexistente ou não publicado");

  const ids = p.participantes.map((x) => x.usuario_id);
  if (!unico(ids)) throw rejeitar("participante_repetido", "Participante repetido");
  if (!ids.includes(eu.id)) throw rejeitar("participante_obrigatorio", "O técnico logado precisa ser participante da APR");
  if (p.participantes.filter((x) => x.funcao === "responsavel").length !== 1) throw rejeitar("responsavel_obrigatorio", "A APR precisa de exatamente um responsável");
  const pessoas = ids.map((i) => usuarioDe(e, i));
  if (pessoas.some((x) => !x)) throw rejeitar("participante_invalido", "Participante não encontrado");
  for (const pessoa of pessoas as UsuarioTreino[]) {
    if (pessoa.equipe_id !== ordem.equipe_id) throw rejeitar("participante_fora_da_equipe", `${pessoa.nome} não é da equipe da OS`);
    if (!pessoa.assinatura_path) throw rejeitar("assinatura_ausente", `${pessoa.nome} ainda não cadastrou a assinatura no perfil`);
  }

  const idsDeRisco = new Set(modelo.riscos.map((r) => r.id));
  if (!unico(p.riscos)) throw rejeitar("risco_repetido", "Risco marcado repetido");
  if (p.riscos.some((r) => !idsDeRisco.has(r))) throw rejeitar("risco_invalido", "Risco que não pertence ao modelo da APR");
  const marcados = new Set(p.riscos);

  const respostaPorItem = new Map<string, AprLida["respostas"][number]>();
  for (const r of p.respostas) {
    const item = modelo.itens.find((i) => i.id === r.item_id);
    if (!item) throw rejeitar("item_invalido", "Resposta a um item que não pertence ao modelo da APR");
    if (respostaPorItem.has(r.item_id)) throw rejeitar("resposta_repetida", "Item respondido mais de uma vez");
    if (item.secao === "medida_preventiva" && !marcados.has(item.risco_id!)) throw rejeitar("resposta_fora_dos_riscos", "Resposta a uma medida de um risco que não foi marcado");
    if (r.resposta === "na" && !item.permite_na) throw rejeitar("na_nao_permitido", `"NA" não é permitido em: ${item.texto}`);
    if (r.resposta === "na" && vazio(r.observacao)) throw rejeitar("observacao_obrigatoria", `"NA" exige observação em: ${item.texto}`);
    respostaPorItem.set(r.item_id, r);
  }

  const faltando = modelo.itens.filter((i) => (i.secao === "verificacao" || marcados.has(i.risco_id!)) && !respostaPorItem.has(i.id));
  if (faltando.length > 0) throw rejeitar("respostas_incompletas", `Faltam respostas em ${faltando.length} item(ns)`);

  // Os materiais do serviço: o obrigatório sem a foto do item bloqueia a APR, como um item reprovado.
  const { linhas: materiais, faltando: materiaisFaltando } = conferirMateriais(ctx, ordem, p.materiais);

  const reprovados = modelo.itens.filter((i) => reprovou(i, respostaPorItem.get(i.id)?.resposta)).sort((a, b) => a.ordem - b.ordem);
  return { ordem, modelo, respostaPorItem, reprovados, materiais, materiaisFaltando };
}

/** Um item obrigatório que não ficou comprovado: `levou` diz se o técnico o levou mas não mandou a foto. */
interface MaterialFaltando {
  material_id: string;
  descricao: string;
  levou: boolean;
}

/**
 * Confere a lista enviada contra a lista do serviço da OS (`conferirMateriais` da `api`): cada material é da lista e
 * aparece uma vez, só quem levou tem foto, e a foto já subiu. O obrigatório que não veio, ou veio sem foto, é `faltando`.
 */
function conferirMateriais(ctx: Contexto, ordem: OsReg, enviados: MaterialDaAprLido[]) {
  const lista = servicoDaOs(ctx.e, ordem)?.materiais ?? [];
  const daLista = new Map(lista.map((m) => [m.material_id, m]));
  const vistos = new Set<string>();
  const linhas: NonNullable<AprReg["materiais"]> = [];
  for (const m of enviados) {
    if (vistos.has(m.material_id)) throw rejeitar("material_repetido", "Material conferido mais de uma vez");
    vistos.add(m.material_id);
    const item = daLista.get(m.material_id);
    if (!item) throw rejeitar("material_invalido", "Material que não pertence ao serviço da OS");
    if (m.foto && !m.levou) throw rejeitar("foto_sem_material", `Foto de um material que não foi levado: ${item.descricao}`);
    linhas.push({
      material_id: item.material_id,
      obrigatorio: item.obrigatorio,
      levou: m.levou,
      foto: m.foto ? { arquivo_id: m.foto.arquivo_id, capturada_em: m.foto.capturada_em.toISOString(), latitude: m.foto.latitude, longitude: m.foto.longitude } : null,
    });
  }
  // O obrigatório que nem foi conferido conta como não levado.
  for (const item of lista) if (item.obrigatorio && !vistos.has(item.material_id)) linhas.push({ material_id: item.material_id, obrigatorio: true, levou: false, foto: null });
  for (const l of linhas) if (l.foto) exigirArquivo(ctx, l.foto.arquivo_id);
  return { linhas, faltando: faltandoDe(ctx.e, linhas) };
}

const descricaoDoMaterial = (e: EstadoTreino, id: string) => materiaisDoTreino(e.criadoEm).find((m) => m.id === id);

/** Os obrigatórios de uma conferência que não ficaram comprovados (não levados, ou levados sem a foto). */
function faltandoDe(e: EstadoTreino, linhas: NonNullable<AprReg["materiais"]>): MaterialFaltando[] {
  return linhas
    .filter((l) => l.obrigatorio && !(l.levou && l.foto))
    .map((l) => ({ material_id: l.material_id, descricao: descricaoDoMaterial(e, l.material_id)?.descricao ?? "Material", levou: l.levou }));
}

/** Os itens que reprovaram uma APR já gravada, na ordem do modelo. */
function reprovadosGravados(e: EstadoTreino, a: AprReg) {
  const modelo = e.modelos.find((m) => m.id === a.modelo_apr_id)!;
  return modelo.itens.filter((i) => reprovou(i, a.respostas.find((r) => r.item_id === i.id)?.resposta)).sort((x, y) => x.ordem - y.ordem);
}

/** A APR bloqueada na validação recebe a evidência dos reprovados; as respostas não mudam, e a completa não aceita mais nada. */
function completarEvidencia(ctx: Contexto, a: AprReg, p: AprLida) {
  const reprovados = reprovadosGravados(ctx.e, a);
  const gravada = (i: ItemRegDoModelo) => a.respostas.find((r) => r.item_id === i.id)!;
  const completo = (i: ItemRegDoModelo, observacao: string | null | undefined, novas: Evidencia[] = []) => !vazio(observacao) && temOArquivoExigido(i, [...a.evidencias, ...novas]);
  if (reprovados.every((i) => completo(i, gravada(i).observacao))) return;

  for (const ev of p.evidencias) {
    if (!ev.item_id || !a.respostas.some((r) => r.item_id === ev.item_id)) throw rejeitar("evidencia_invalida", "Evidência ligada a um item que a APR não respondeu");
  }
  const enviada = new Map(p.respostas.map((r) => [r.item_id, r.observacao]));
  const observacaoDe = (i: ItemRegDoModelo) => (vazio(gravada(i).observacao) ? enviada.get(i.id) : gravada(i).observacao);
  const semEvidencia = reprovados.filter((i) => !completo(i, observacaoDe(i), p.evidencias));
  if (semEvidencia.length > 0) throw rejeitar("evidencia_faltando", `Falta evidência em ${semEvidencia.length} item(ns)`);
  for (const ev of p.evidencias) exigirArquivo(ctx, ev.arquivo_id ?? ev.id);

  for (const i of reprovados) {
    const texto = enviada.get(i.id);
    if (vazio(gravada(i).observacao) && !vazio(texto)) gravada(i).observacao = texto!.trim();
  }
  for (const ev of p.evidencias) {
    if (a.evidencias.some((x) => x.id === ev.id)) continue;
    a.evidencias.push(evidenciaDaApr(ev));
  }
}

function aplicarAprConcluida(ctx: Contexto, osIdEnvelope: string | null, bruto: unknown) {
  const { e, eu } = ctx;
  const p = lerApr(bruto);

  const osId = osIdEnvelope ?? p.osPayload;
  if (!osId) throw rejeitar("os_obrigatoria", "Informe a OS da APR");
  if (p.osPayload && p.osPayload !== osId) throw rejeitar("os_divergente", "A OS do evento difere da OS do payload");

  // A mesma APR já gravada: as respostas não mudam; a bloqueada na validação recebe a evidência de quem a preencheu.
  const existente = e.aprs.find((a) => a.id === p.id);
  if (existente) {
    if (existente.resultado === "bloqueada" && existente.preenchida_por === eu.id) completarEvidencia(ctx, existente, p);
    ctx.saida.aprs.push({ id: existente.id, resultado: existente.resultado });
    ctx.saida.osAfetadas.add(existente.os_id);
    return;
  }

  const { ordem, modelo, respostaPorItem, reprovados, materiais, materiaisFaltando } = conferirApr(ctx, osId, p);
  ctx.saida.osAfetadas.add(ordem.id);

  // Item reprovado: exige observação e, se o item pede foto ou PDF, ao menos um desse tipo (na validação, a evidência chega depois).
  for (const ev of p.evidencias) {
    if (!ev.item_id || !respostaPorItem.has(ev.item_id)) throw rejeitar("evidencia_invalida", "Evidência ligada a um item que a APR não respondeu");
  }
  const semEvidencia = reprovados.filter((i) => vazio(respostaPorItem.get(i.id)!.observacao) || !temOArquivoExigido(i, p.evidencias));
  if (semEvidencia.length > 0 && !ctx.evidenciaDepois) throw rejeitar("evidencia_faltando", `Falta evidência em ${semEvidencia.length} item(ns)`);
  for (const ev of p.evidencias) exigirArquivo(ctx, ev.arquivo_id ?? ev.id);

  const resultado = reprovados.length > 0 || materiaisFaltando.length > 0 ? "bloqueada" : "aprovada";
  const concluidaEm = p.concluidaEm;
  const registro: AprReg = {
    id: p.id,
    os_id: ordem.id,
    modelo_apr_id: modelo.id,
    preenchida_por: eu.id,
    resultado,
    observacao_geral: vazio(p.observacaoGeral) ? null : p.observacaoGeral!.trim(),
    concluida_em: concluidaEm.toISOString(),
    participantes: p.participantes.map((x) => ({ usuario_id: x.usuario_id, funcao: x.funcao, assinatura_path: usuarioDe(e, x.usuario_id)!.assinatura_path!, assinada_em: (x.assinada_em ?? concluidaEm).toISOString() })),
    riscos: p.riscos,
    respostas: p.respostas.map((r) => ({ item_id: r.item_id, resposta: r.resposta, observacao: vazio(r.observacao) ? null : r.observacao!.trim(), respondida_em: (r.respondida_em ?? concluidaEm).toISOString() })),
    evidencias: p.evidencias.map(evidenciaDaApr),
    materiais,
  };
  e.aprs.push(registro);
  ctx.saida.aprs.push({ id: p.id, resultado });

  if (resultado === "bloqueada") {
    const itens = reprovados.map((i) => {
      const observacao = respostaPorItem.get(i.id)!.observacao?.trim();
      return observacao ? `${i.texto} — ${observacao}` : i.texto;
    });
    const motivos = [
      reprovados.length > 0 ? `${reprovados.length} item(ns) reprovado(s)` : null,
      materiaisFaltando.length > 0 ? `${materiaisFaltando.length} material(is) obrigatório(s) sem comprovação` : null,
    ].filter((m) => m !== null);
    const detalhe = [...itens, ...materiaisFaltando.map((m) => `${m.descricao} — ${m.levou ? "sem foto" : "não levou"}`)].join("; ");
    criarAlerta(ctx, ordem.id, "bloqueio", `APR bloqueada (${motivos.join(" e ")}): ${detalhe}`);
  }
}

// ---- Execução -------------------------------------------------------------------------------------------------

function execucaoDoUsuario(ctx: Contexto, id: string, aceitarFinalizada = false): ExecucaoReg {
  const x = ctx.e.execucoes.find((y) => y.id === id);
  if (!x) throw adiar("execucao_ausente", "A execução ainda não foi recebida");
  carregarOsDoUsuario(ctx, x.os_id);
  if (x.executor_id !== ctx.eu.id) throw rejeitar("execucao_de_outro", "Só quem iniciou a execução pode alterá-la");
  ctx.saida.osAfetadas.add(x.os_id);
  if (x.resultado !== null && !aceitarFinalizada) throw rejeitar("execucao_finalizada", "A execução já foi finalizada");
  return x;
}

function fecharPausaAberta(x: ExecucaoReg, fim: Date) {
  for (const p of x.pausas) if (p.fim === null) p.fim = fim.toISOString();
}

function aplicarExecucaoIniciada(ctx: Contexto, osIdEnvelope: string | null, bruto: unknown) {
  const { e, eu } = ctx;
  const p = obj(bruto);
  const id = campoUuid(p, "id")!;
  const osPayload = campoUuid(p, "os_id", false);
  const aprId = campoUuid(p, "apr_id")!;
  const numeroPessoas = p.numero_pessoas;
  if (numeroPessoas !== undefined && numeroPessoas !== null && (!Number.isInteger(numeroPessoas) || (numeroPessoas as number) < 1)) invalidoNoPayload("numero_pessoas", "Informe um inteiro a partir de 1");
  const inicio = campoInstante(p, "inicio")!;
  const osId = osIdEnvelope ?? osPayload;
  if (!osId) throw rejeitar("os_obrigatoria", "Informe a OS da execução");

  const jaExiste = e.execucoes.find((x) => x.id === id);
  if (jaExiste) {
    ctx.saida.osAfetadas.add(jaExiste.os_id);
    return;
  }
  const ordem = carregarOsDoUsuario(ctx, osId);
  ctx.saida.osAfetadas.add(ordem.id);

  const a = e.aprs.find((x) => x.id === aprId);
  if (!a) throw adiar("apr_ausente", "A APR ainda não foi recebida");
  if (a.os_id !== ordem.id || a.resultado !== "aprovada") throw rejeitar("apr_invalida", "Preencha a APR antes de iniciar");
  if (diaDe(a.concluida_em) !== diaDe(inicio)) throw rejeitar("apr_vencida", "A APR é de outro dia: faça uma APR nova");
  if (!a.participantes.some((x) => x.usuario_id === eu.id)) throw rejeitar("fora_da_apr", "Você não é participante desta APR");
  if (e.execucoes.some((x) => x.apr_id === a.id && x.resultado !== "cancelada")) throw rejeitar("apr_ja_usada", "Esta APR já amparou uma execução: faça uma APR nova");
  if (e.execucoes.some((x) => x.executor_id === eu.id && x.resultado === null && diaDe(x.inicio) !== diaDe(inicio))) {
    throw rejeitar("execucao_esquecida", "Suspenda a execução de outro dia antes de iniciar uma nova");
  }
  if (e.execucoes.some((x) => x.os_id === ordem.id && x.resultado === null)) throw rejeitar("os_em_execucao", "Esta OS já está em execução");
  if (ordem.status === "encerrada") throw rejeitar("os_encerrada", "Esta OS já foi encerrada");

  e.execucoes.push({
    id,
    os_id: ordem.id,
    apr_id: a.id,
    executor_id: eu.id,
    numero_pessoas: (numeroPessoas as number | undefined | null) ?? a.participantes.length,
    inicio: inicio.toISOString(),
    fim: null,
    resultado: null,
    descricao_atividade: null,
    motivo: null,
    dados_inspecao: null,
    pausas: [],
    assinaturas: [],
    fotos: [],
  });
}

function aplicarPausaIniciada(ctx: Contexto, bruto: unknown) {
  const p = obj(bruto);
  const id = campoUuid(p, "id")!;
  const execucaoId = campoUuid(p, "execucao_id")!;
  const inicio = campoInstante(p, "inicio")!;
  const motivo = p.motivo ?? null;
  if (motivo !== null && (typeof motivo !== "string" || !MOTIVOS_PAUSA.includes(motivo))) invalidoNoPayload("motivo", "Valor inválido");
  if (ctx.e.execucoes.some((x) => x.pausas.some((y) => y.id === id))) return;
  const x = execucaoDoUsuario(ctx, execucaoId);
  if (inicio.toISOString() < x.inicio) throw rejeitar("pausa_antes_do_inicio", "A pausa não pode começar antes da execução");
  if (x.pausas.some((y) => y.fim === null)) throw rejeitar("pausa_aberta", "Já existe uma pausa aberta nesta execução");
  x.pausas.push({ id, inicio: inicio.toISOString(), fim: null, motivo: motivo as "almoco" | "descanso" | "outro" | null });
}

function aplicarPausaEncerrada(ctx: Contexto, bruto: unknown) {
  const p = obj(bruto);
  const pausaId = campoUuid(p, "pausa_id")!;
  const fim = campoInstante(p, "fim")!;
  const x = ctx.e.execucoes.find((y) => y.pausas.some((z) => z.id === pausaId));
  const pausa = x?.pausas.find((z) => z.id === pausaId);
  if (!x || !pausa) throw adiar("pausa_ausente", "A pausa ainda não foi recebida");
  if (pausa.fim) return;
  execucaoDoUsuario(ctx, x.id);
  if (fim.toISOString() < pausa.inicio) throw rejeitar("fim_antes_do_inicio", "O fim da pausa é anterior ao início");
  if (diaDe(pausa.inicio) !== diaDe(fim)) throw rejeitar("continuar_invalido", "Faça uma APR nova para retomar");
  pausa.fim = fim.toISOString();
}

function aplicarExecucaoEncerrada(ctx: Contexto, bruto: unknown) {
  const { e } = ctx;
  const p = obj(bruto);
  const execucaoId = campoUuid(p, "execucao_id")!;
  const fim = campoInstante(p, "fim")!;
  const descricao = campoTexto(p, "descricao_atividade");
  const evidencias = lerEvidencias(p);
  const assinaturas = campoLista(p, "assinaturas").map((b) => {
    const x = obj(b);
    return { usuario_id: campoUuid(x, "usuario_id")!, assinada_em: campoInstante(x, "assinada_em", false) };
  });
  const x = execucaoDoUsuario(ctx, execucaoId, true);
  if (x.resultado === "encerrada") return;
  if (x.resultado !== null) throw rejeitar("execucao_finalizada", "A execução já foi finalizada");
  if (fim.toISOString() < x.inicio) throw rejeitar("fim_antes_do_inicio", "O fim é anterior ao início da execução");

  const apr = e.aprs.find((a) => a.id === x.apr_id)!;
  const participantes = apr.participantes.map((pp) => ({ usuarioId: pp.usuario_id, pessoa: usuarioDe(e, pp.usuario_id)! }));
  const assinaram = new Set(assinaturas.map((a) => a.usuario_id));
  const todosAssinaram = participantes.every((pp) => assinaram.has(pp.usuarioId)) && assinaturas.every((a) => participantes.some((pp) => pp.usuarioId === a.usuario_id));
  if (vazio(descricao) || !evidencias.some((ev) => ev.tipo === "foto") || !todosAssinaram) throw rejeitar("encerramento_incompleto", "Descrição, foto e assinaturas de todos são obrigatórias");
  conferirArquivosDaExecucao(evidencias);
  const semAssinatura = participantes.find((pp) => !pp.pessoa.assinatura_path);
  if (semAssinatura) throw rejeitar("assinatura_ausente", `${semAssinatura.pessoa.nome} ainda não cadastrou a assinatura no perfil`);
  for (const ev of evidencias) exigirArquivo(ctx, ev.arquivo_id ?? ev.id);

  fecharPausaAberta(x, fim);
  x.fim = fim.toISOString();
  x.resultado = "encerrada";
  x.descricao_atividade = descricao!.trim();
  x.dados_inspecao = obj(p).dados_inspecao ?? null;
  x.assinaturas = participantes.map((pp) => ({ usuario_id: pp.usuarioId, assinatura_path: pp.pessoa.assinatura_path!, assinada_em: (assinaturas.find((a) => a.usuario_id === pp.usuarioId)?.assinada_em ?? fim).toISOString() }));
  x.fotos = fotosDaExecucao(evidencias);
  x.documentos = documentosDaExecucao(evidencias);

  const ordem = e.os.find((o) => o.id === x.os_id)!;
  if (ordem.pdf_path === null) {
    // O PDF "fica pronto" uns segundos depois, como a tarefa em segundo plano da `api`.
    ordem.pdf_path = idTreino("7", Number(ordem.numero_ordem?.slice(-3) ?? "0") || 1);
    ordem.pdf_em = new Date(ctx.agora.getTime() + 3000).toISOString();
  }
}

function aplicarExecucaoInterrompida(ctx: Contexto, bruto: unknown) {
  const p = obj(bruto);
  const execucaoId = campoUuid(p, "execucao_id")!;
  const fim = campoInstante(p, "fim")!;
  const motivo = campoTexto(p, "motivo");
  const evidencias = lerEvidencias(p);
  const x = execucaoDoUsuario(ctx, execucaoId, true);
  if (x.resultado === "interrompida") return;
  if (x.resultado !== null) throw rejeitar("execucao_finalizada", "A execução já foi finalizada");
  if (vazio(motivo) || !evidencias.some((ev) => ev.tipo === "foto")) throw rejeitar("interrupcao_incompleta", "Motivo e ao menos uma foto são obrigatórios");
  if (fim.toISOString() < x.inicio) throw rejeitar("fim_antes_do_inicio", "O fim é anterior ao início da execução");
  conferirArquivosDaExecucao(evidencias);
  for (const ev of evidencias) exigirArquivo(ctx, ev.arquivo_id ?? ev.id);

  fecharPausaAberta(x, fim);
  x.fim = fim.toISOString();
  x.resultado = "interrompida";
  x.motivo = motivo!.trim();
  x.fotos = fotosDaExecucao(evidencias);
  x.documentos = documentosDaExecucao(evidencias);
  criarAlerta(ctx, x.os_id, "bloqueio", `Execução interrompida por risco: ${motivo!.trim()}`);
}

function aplicarExecucaoSuspensa(ctx: Contexto, bruto: unknown) {
  const p = obj(bruto);
  const execucaoId = campoUuid(p, "execucao_id")!;
  const fim = campoInstante(p, "fim")!;
  const x = execucaoDoUsuario(ctx, execucaoId, true);
  if (x.resultado === "suspensa") return;
  if (x.resultado !== null) throw rejeitar("execucao_finalizada", "A execução já foi finalizada");
  if (fim.toISOString() < x.inicio) throw rejeitar("fim_antes_do_inicio", "O fim é anterior ao início da execução");
  fecharPausaAberta(x, fim);
  x.fim = fim.toISOString();
  x.resultado = "suspensa";
}

function aplicarExecucaoCancelada(ctx: Contexto, bruto: unknown) {
  const p = obj(bruto);
  const execucaoId = campoUuid(p, "execucao_id")!;
  const x = execucaoDoUsuario(ctx, execucaoId, true);
  if (x.resultado === "cancelada") return;
  if (x.resultado !== null) throw rejeitar("execucao_finalizada", "A execução já foi finalizada");
  if (ctx.evento.ocorrido_em.getTime() - new Date(x.inicio).getTime() > CANCELAR_ATE_MS) throw rejeitar("cancelamento_fora_do_prazo", "Só dá para cancelar em até 10 minutos depois do início");
  if (x.pausas.length > 0 || x.fotos.length > 0) throw rejeitar("cancelamento_invalido", "Execução com pausa ou foto não pode ser cancelada");
  const fim = ctx.evento.ocorrido_em.toISOString() < x.inicio ? x.inicio : ctx.evento.ocorrido_em.toISOString();
  x.fim = fim;
  x.resultado = "cancelada";
}

function despachar(ctx: Contexto) {
  const { evento } = ctx;
  switch (evento.tipo) {
    case "apr_concluida":
      return aplicarAprConcluida(ctx, evento.os_id, evento.payload);
    case "execucao_iniciada":
      return aplicarExecucaoIniciada(ctx, evento.os_id, evento.payload);
    case "pausa_iniciada":
      return aplicarPausaIniciada(ctx, evento.payload);
    case "pausa_encerrada":
      return aplicarPausaEncerrada(ctx, evento.payload);
    case "execucao_encerrada":
      return aplicarExecucaoEncerrada(ctx, evento.payload);
    case "execucao_interrompida":
      return aplicarExecucaoInterrompida(ctx, evento.payload);
    case "execucao_suspensa":
      return aplicarExecucaoSuspensa(ctx, evento.payload);
    case "execucao_cancelada":
      return aplicarExecucaoCancelada(ctx, evento.payload);
  }
}

function lerEnvio(corpo: unknown): EventoRecebido[] {
  const lista = obj(corpo).eventos;
  if (!Array.isArray(lista) || lista.length < 1 || lista.length > MAX_EVENTOS) throw invalido("validacao", `eventos: envie de 1 a ${MAX_EVENTOS} eventos`);
  return lista.map((bruto, i) => {
    const x = obj(bruto);
    const erro = (campo: string, regra: string) => invalido("validacao", `eventos.${i}.${campo}: ${regra}`);
    if (typeof x.id !== "string" || !REGEX_UUID.test(x.id)) throw erro("id", "Identificador inválido");
    if (typeof x.tipo !== "string" || !(EVENTO_TIPOS as readonly string[]).includes(x.tipo)) throw erro("tipo", "Tipo de evento inválido");
    if (x.os_id !== undefined && x.os_id !== null && (typeof x.os_id !== "string" || !REGEX_UUID.test(x.os_id))) throw erro("os_id", "Identificador inválido");
    if (!x.payload || typeof x.payload !== "object" || Array.isArray(x.payload)) throw erro("payload", "Informe o payload");
    const ocorrido = typeof x.ocorrido_em === "string" ? new Date(x.ocorrido_em) : null;
    if (!ocorrido || Number.isNaN(ocorrido.getTime())) throw erro("ocorrido_em", "Data e hora inválidas");
    return { id: x.id, tipo: x.tipo as EventoTipo, os_id: (x.os_id as string | null | undefined) ?? null, payload: x.payload as Record<string, unknown>, ocorrido_em: ocorrido };
  });
}

function processarEventos(e: EstadoTreino, eu: UsuarioTreino, corpo: unknown, agora: Date) {
  const recebidos = lerEnvio(corpo);
  const saida = { confirmados: [] as string[], alertas: [] as string[], aprs: [] as { id: string; resultado: string }[], os: [] as { id: string; status: string }[], rejeitados: [] as { id: string; codigo: string; mensagem: string }[], pendentes: [] as { id: string; codigo: string; mensagem: string }[] };
  const afetadas = new Set<string>();
  for (const ev of [...recebidos].sort((a, b) => a.ocorrido_em.getTime() - b.ocorrido_em.getTime())) {
    const parcial: Contexto["saida"] = { alertas: [], aprs: [], osAfetadas: new Set() };
    try {
      const osDoEnvelope = ev.os_id ?? (typeof ev.payload.os_id === "string" ? ev.payload.os_id : null);
      if (osDoEnvelope && !e.os.some((o) => o.id === osDoEnvelope)) throw rejeitar("os_inexistente", "OS não encontrada");
      if (e.eventos.has(ev.id)) {
        // Já aplicado: confirma sem efeito (a resposta ainda informa o resultado da APR).
        const apr = ev.tipo === "apr_concluida" && typeof ev.payload.id === "string" ? e.aprs.find((a) => a.id === ev.payload.id) : undefined;
        if (apr) {
          parcial.aprs.push({ id: apr.id, resultado: apr.resultado });
          parcial.osAfetadas.add(apr.os_id);
        }
      } else {
        despachar({ e, eu, evento: ev, agora, saida: parcial });
        e.eventos.add(ev.id);
      }
      for (const id of parcial.osAfetadas) {
        const o = e.os.find((x) => x.id === id);
        if (o) o.status = statusDerivado(e, o);
        afetadas.add(id);
      }
      saida.confirmados.push(ev.id);
      saida.alertas.push(...parcial.alertas);
      saida.aprs.push(...parcial.aprs);
    } catch (erro) {
      if (!(erro instanceof Rejeicao)) throw erro;
      (erro.situacao === "pendente" ? saida.pendentes : saida.rejeitados).push({ id: ev.id, codigo: erro.codigo, mensagem: erro.message });
    }
  }
  saida.os = [...afetadas].map((id) => ({ id, status: e.os.find((o) => o.id === id)!.status }));
  return saida;
}

// ---------------------------------------------------------------------------------------------------------------
// Usuários, equipes e busca
// ---------------------------------------------------------------------------------------------------------------

const camposDeUsuario = (u: UsuarioTreino) => [u.nome, u.matricula, u.cargo, u.email, u.registro_profissional];
const camposDeEquipe = (e: EstadoTreino) => [e.equipe.nome, e.equipe.centro_trabalho];

function linhaDeExecucaoDoPerfil(e: EstadoTreino, x: ExecucaoReg, agora: Date) {
  const o = e.os.find((y) => y.id === x.os_id)!;
  const tempo = tempoDaExecucao(x);
  return { id: x.id, os_id: o.id, numero_ordem: o.numero_ordem, titulo: o.titulo, local_codigo: localDe(e, o).codigo, inicio: x.inicio, fim: x.fim!, tempo_liquido_min: tempo ? emMinutos(tempo.liquidoMs) : null, pdf_pronto: pdfPronto(o, agora) };
}

const encerradasDe = (e: EstadoTreino, usuarioId: string) =>
  e.execucoes.filter((x) => x.executor_id === usuarioId && x.resultado === "encerrada").sort((a, b) => (b.fim ?? "").localeCompare(a.fim ?? "") || b.id.localeCompare(a.id));

// ---------------------------------------------------------------------------------------------------------------
// Roteamento
// ---------------------------------------------------------------------------------------------------------------

interface Chamada {
  e: EstadoTreino;
  eu: UsuarioTreino;
  usuario: Usuario;
  q: Record<string, string>;
  corpo: unknown;
  params: Record<string, string>;
  agora: Date;
}
type Tratador = (c: Chamada) => RespostaTreino | Promise<RespostaTreino>;

const rotas: { metodo: string; regex: RegExp; nomes: string[]; tratar: Tratador }[] = [];
function rota(metodo: string, padrao: string, tratar: Tratador) {
  const nomes: string[] = [];
  const regex = new RegExp(`^${padrao.replace(/:([a-z_]+)/g, (_t, n: string) => (nomes.push(n), "([^/]+)"))}$`);
  rotas.push({ metodo, regex, nomes, tratar });
}

// ---- /me --------------------------------------------------------------------------------------------------------

rota("GET", "/me", ({ e, eu, usuario }) => {
  // O usuário real (com o que a `api` informa, como o e-mail e o estado do treinamento) na equipe fictícia, sem supervisão.
  const { id: _id, ...real } = usuario as Usuario & Record<string, unknown>;
  void _id;
  return ok({
    usuario: { ...real, id: eu.id, perfil: "tecnico", equipe_id: e.equipe.id, ativo: true, senha_provisoria: false, assinatura_path: eu.assinatura_path, assinatura_em: eu.assinatura_em },
    equipe: equipeApi(e),
    equipes_supervisionadas: [],
  });
});

rota("PUT", "/me/treinamento", ({ corpo }) => {
  const estado = obj(corpo).estado;
  if (typeof estado !== "string" || !["nao_iniciado", "concluido", "pulado"].includes(estado)) throw invalido("validacao", "estado: valor inválido");
  return ok({ treinamento: { estado, em: estado === "nao_iniciado" ? null : new Date().toISOString() } });
});

rota("PUT", "/me/assinatura", ({ e, eu, corpo, agora }) => {
  const arquivoId = obj(corpo).arquivo_id;
  if (typeof arquivoId !== "string" || !REGEX_UUID.test(arquivoId)) throw invalido("validacao", "arquivo_id: Identificador inválido");
  if (e.arquivos.get(arquivoId)?.tipo !== "assinatura") throw invalido("arquivo_inexistente", "Envie a imagem da assinatura antes (PUT /arquivos/{id})");
  eu.assinatura_path = arquivoId;
  eu.assinatura_em = agora.toISOString();
  return ok({ assinatura_path: arquivoId });
});

rota("GET", "/me/execucoes-abertas", ({ e, eu }) =>
  ok({
    execucoes: e.execucoes
      .filter((x) => x.executor_id === eu.id && x.resultado === null)
      .sort((a, b) => a.inicio.localeCompare(b.inicio))
      .map((x) => {
        const o = e.os.find((y) => y.id === x.os_id)!;
        return { id: x.id, os_id: x.os_id, apr_id: x.apr_id, inicio: x.inicio, numero_ordem: o.numero_ordem, titulo: o.titulo };
      }),
  }),
);

rota("GET", "/me/historico", ({ e, eu, agora }) => {
  const desde = agora.getTime() - 60 * 86_400_000;
  return ok({
    execucoes: encerradasDe(e, eu.id)
      .filter((x) => new Date(x.fim!).getTime() >= desde)
      .map((x) => {
        const o = e.os.find((y) => y.id === x.os_id)!;
        const tempo = tempoDaExecucao(x);
        return { id: x.id, os_id: o.id, numero_ordem: o.numero_ordem, titulo: o.titulo, local_codigo: localDe(e, o).codigo, inicio: x.inicio, fim: x.fim, tempo_liquido_min: tempo ? emMinutos(tempo.liquidoMs) : null, pausa_min: tempo ? emMinutos(tempo.pausaMs) : null, pdf_pronto: pdfPronto(o, agora) };
      }),
  });
});

rota("POST", "/auth/trocar-senha", ({ corpo }) => {
  const { senha_atual, senha_nova } = obj(corpo);
  if (typeof senha_atual !== "string" || senha_atual === "") throw invalido("validacao", "senha_atual: Informe a senha atual");
  if (typeof senha_nova !== "string" || senha_nova.length < 8) throw invalido("validacao", "senha_nova: use ao menos 8 caracteres");
  if (senha_atual === senha_nova) throw invalido("senha_igual", "A senha nova precisa ser diferente da atual");
  return ok({});
});

// ---- OS ---------------------------------------------------------------------------------------------------------

rota("GET", "/os", ({ e, q, agora }) => {
  const filtros = filtrosDeOs(q);
  const pag = paginacao(q);
  const { itens, total, contagem } = listarOs(e, filtros, pag, agora);
  return ok({ os: itens, contagem_por_status: contagem, ...meta(pag, total) });
});
rota("GET", "/os/:id", ({ e, params, agora }) => ok(detalheDaOs(e, osPorId(e, params.id!), agora)));
rota("GET", "/os/:id/aprs", ({ e, params }) => ok({ aprs: aprsApi(e, osPorId(e, params.id!).id) }));
rota("GET", "/os/:id/pdf", ({ e, params }) => {
  const o = osPorId(e, params.id!);
  if (o.status !== "encerrada") throw conflito("os_nao_encerrada", "A OS ainda não foi encerrada");
  return { status: 200, binario: { tipo: "application/pdf", bytes: pdfDaOs(e, o), nome: `os-${o.id}.pdf` } };
});
rota("POST", "/os/:id/ciencia", () => {
  throw proibido();
});
rota("POST", "/os/:id/reprogramar", () => {
  throw proibido();
});
rota("POST", "/os/:id/cancelar", () => {
  throw proibido();
});
rota("GET", "/alertas", () => {
  throw proibido();
});

rota("GET", "/historico", ({ e, q }) => {
  const localId = q.local_instalacao_id;
  if (!localId || !REGEX_UUID.test(localId)) throw invalido("validacao", "local_instalacao_id: Identificador inválido");
  const pag = paginacao(q);
  const todas = e.execucoes
    .filter((x) => x.resultado === "encerrada")
    .map((x) => ({ x, o: e.os.find((y) => y.id === x.os_id)! }))
    .filter(({ o }) => o.local_instalacao_id === localId && (!q.equipamento || (o.equipamento ?? "").toLowerCase() === q.equipamento.trim().toLowerCase()))
    .sort((a, b) => (b.x.fim ?? "").localeCompare(a.x.fim ?? "") || b.x.id.localeCompare(a.x.id));
  const itens = todas.slice(pag.de, pag.de + pag.tamanho).map(({ x, o }) => {
    const tempo = tempoDaExecucao(x);
    return {
      id: x.id,
      os: { id: o.id, numero_ordem: o.numero_ordem, titulo: o.titulo, equipamento: o.equipamento },
      executor: { id: x.executor_id, nome: nomeDe(e, x.executor_id) },
      inicio: x.inicio,
      fim: x.fim,
      descricao_atividade: x.descricao_atividade,
      tempo_liquido_min: tempo ? emMinutos(tempo.liquidoMs) : null,
    };
  });
  return ok({ execucoes: itens, ...meta(pag, todas.length) });
});

// ---- Modelos de APR ---------------------------------------------------------------------------------------------

rota("GET", "/modelos-apr", ({ e, q }) => {
  const pag = paginacao(q);
  const arquivados = booleano(q.arquivados, "arquivados");
  const todos = arquivados ? [] : e.modelos.filter((m) => !q.codigo || m.codigo === q.codigo).sort((a, b) => a.codigo.localeCompare(b.codigo) || b.versao - a.versao);
  return ok({ modelos: todos.slice(pag.de, pag.de + pag.tamanho).map((m) => resumoDoModelo(e, m)), ...meta(pag, todos.length) });
});
rota("GET", "/modelos-apr/:codigo", ({ e, params }) => {
  const codigo = decodeURIComponent(params.codigo!);
  const versoes = e.modelos.filter((m) => m.codigo === codigo).sort((a, b) => b.versao - a.versao);
  if (versoes.length === 0) throw naoEncontrado("Modelo não encontrado");
  return ok({ codigo, titulo: versoes[0]!.titulo, arquivado_em: null, versoes: versoes.map((m) => resumoDoModelo(e, m)) });
});
rota("GET", "/modelos-apr/:codigo/versoes/:versao", ({ e, params }) => {
  const codigo = decodeURIComponent(params.codigo!);
  const versoes = e.modelos.filter((m) => m.codigo === codigo).sort((a, b) => b.versao - a.versao);
  const m = params.versao === "publicada" ? versoes[0] : versoes.find((v) => String(v.versao) === params.versao);
  if (!m) throw naoEncontrado("Modelo não encontrado");
  return ok(completoDoModelo(m));
});

// ---- Pessoas e equipes ------------------------------------------------------------------------------------------

rota("GET", "/usuarios", ({ e, q }) => {
  const pag = paginacao(q);
  const supervisor = booleano(q.supervisor, "supervisor");
  if (q.perfil && !["tecnico", "admin"].includes(q.perfil)) throw invalido("validacao", "perfil: valor inválido");
  const todos = e.usuarios
    .filter((u) => u.ativo)
    .filter((u) => !q.equipe_id || q.equipe_id !== e.equipe.id || u.equipe_id === e.equipe.id)
    .filter((u) => !q.perfil || u.perfil === q.perfil)
    .filter((u) => supervisor === undefined || (u.id === e.equipe.supervisor_id) === supervisor)
    .filter((u) => !q.busca || contem(camposDeUsuario(u), q.busca))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  return ok({ usuarios: todos.slice(pag.de, pag.de + pag.tamanho).map(usuarioPublico), ...meta(pag, todos.length) });
});

rota("GET", "/usuarios/:id", ({ e, params, agora }) => {
  const alvo = usuarioDe(e, params.id!);
  if (!alvo || !alvo.ativo) throw naoEncontrado("Usuário não encontrado");
  const supervisor = e.equipe.supervisor_id ? usuarioDe(e, e.equipe.supervisor_id) : undefined;
  const feitas = encerradasDe(e, alvo.id);
  return ok({
    usuario: usuarioPublico(alvo),
    equipe: equipeApi(e),
    supervisor: supervisor ? { id: supervisor.id, nome: supervisor.nome } : null,
    membros: e.usuarios.filter((u) => u.ativo).sort((a, b) => a.nome.localeCompare(b.nome)).map((u) => ({ id: u.id, nome: u.nome, matricula: u.matricula, cargo: u.cargo, perfil: u.perfil })),
    resumo: { os_encerradas: feitas.length, em_andamento: e.execucoes.filter((x) => x.executor_id === alvo.id && x.resultado === null).length, ultima_encerrada_em: feitas[0]?.fim ?? null },
    execucoes: feitas.slice(0, 10).map((x) => linhaDeExecucaoDoPerfil(e, x, agora)),
  });
});

rota("GET", "/equipes", ({ e, q }) => {
  const pag = paginacao(q);
  const global = booleano(q.global, "global");
  const visivel = (!q.id || q.id === e.equipe.id) && (!q.supervisor_id || q.supervisor_id === e.equipe.supervisor_id) && (!q.busca || contem(camposDeEquipe(e), q.busca));
  if (!q.busca && !global) return ok({ equipes: [equipeApi(e)].slice(pag.de, pag.de + pag.tamanho), ...meta(pag, 1) });
  const itens = visivel
    ? [{ ...equipeApi(e), supervisor_nome: e.equipe.supervisor_id ? nomeDe(e, e.equipe.supervisor_id) : null, total_membros: e.usuarios.filter((u) => u.ativo).length }]
    : [];
  return ok({ equipes: itens.slice(pag.de, pag.de + pag.tamanho), ...meta(pag, itens.length) });
});

rota("GET", "/equipes/:id", ({ e, params, agora }) => {
  if (params.id !== e.equipe.id) throw naoEncontrado("Equipe não encontrada");
  const sup = e.equipe.supervisor_id ? usuarioDe(e, e.equipe.supervisor_id) : undefined;
  const { itens, total, contagem } = listarOs(e, {}, { pagina: 1, tamanho: 8, de: 0 }, agora);
  return ok({
    equipe: equipeApi(e),
    supervisor: sup ? { id: sup.id, nome: sup.nome, matricula: sup.matricula, cargo: sup.cargo } : null,
    membros: e.usuarios.filter((u) => u.ativo).sort((a, b) => a.nome.localeCompare(b.nome)).map((u) => ({ id: u.id, nome: u.nome, matricula: u.matricula, cargo: u.cargo, perfil: u.perfil, ativo: u.ativo })),
    contagem_por_status: contagem,
    total_os: total,
    os_recentes: itens,
  });
});

rota("GET", "/busca/exata", ({ e, q }) => {
  if (!q.q) throw invalido("validacao", "q: Informe o texto");
  const achados: { tipo: "usuario" | "equipe" | "os"; id: string }[] = [
    ...e.usuarios.filter((u) => u.ativo && igual(camposDeUsuario(u), q.q!)).map((u) => ({ tipo: "usuario" as const, id: u.id })),
    ...(igual(camposDeEquipe(e), q.q) ? [{ tipo: "equipe" as const, id: e.equipe.id }] : []),
    ...e.os.filter((o) => igual([o.numero_ordem, o.titulo, localDe(e, o).codigo, o.numero_nota, localDe(e, o).cliente], q.q!)).map((o) => ({ tipo: "os" as const, id: o.id })),
  ];
  return ok({ achado: achados.length === 1 ? achados[0]! : null });
});

// ---- Arquivos e eventos -----------------------------------------------------------------------------------------

rota("PUT", "/arquivos/:id", ({ e, params, corpo }) => {
  if (!REGEX_UUID.test(params.id!)) throw invalido("validacao", "id: Identificador inválido");
  return receberArquivo(e, params.id!, corpo);
});
rota("GET", "/arquivos/:id/url", ({ e, params }) => {
  if (!e.arquivos.has(params.id!)) throw naoEncontrado("Arquivo não encontrado");
  return ok({ url: `/api/treino/arquivos/${params.id}` });
});

rota("POST", "/eventos", ({ e, eu, corpo, agora }) => ok(processarEventos(e, eu, corpo, agora)));

// ---- Catálogo de serviço (só leitura) ----------------------------------------------------------------------------

rota("GET", "/catalogo/servicos", ({ e, q }) => {
  const pag = paginacao(q);
  const semMateriais = booleano(q.sem_materiais, "sem_materiais");
  if (q.material_id && !REGEX_UUID.test(q.material_id)) throw invalido("validacao", "material_id: Identificador inválido");
  const todos = catalogoDe(e)
    .filter((s) => !q.busca || contem([s.codigo, s.descricao], q.busca))
    .filter((s) => !semMateriais || s.materiais.length === 0)
    .filter((s) => !q.material_id || s.materiais.some((m) => m.material_id === q.material_id));
  return ok({ servicos: todos.slice(pag.de, pag.de + pag.tamanho), ...meta(pag, todos.length) });
});

rota("GET", "/catalogo/servicos/:codigo", ({ e, params }) => {
  const s = catalogoDe(e).find((x) => x.codigo === params.codigo);
  if (!s) throw naoEncontrado("Serviço não encontrado");
  return ok(s);
});

rota("GET", "/catalogo/materiais", ({ e, q }) => {
  const pag = paginacao(q);
  const ativo = booleano(q.ativo, "ativo");
  if (q.categoria && !["material", "ferramenta", "epi"].includes(q.categoria)) throw invalido("validacao", "categoria: valor inválido");
  const todos = materiaisDoTreino(e.criadoEm)
    .filter((m) => !q.busca || contem([m.descricao, m.codigo], q.busca))
    .filter((m) => !q.categoria || m.categoria === q.categoria)
    .filter((m) => ativo === undefined || m.ativo === ativo)
    .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.descricao.localeCompare(b.descricao));
  return ok({ materiais: todos.slice(pag.de, pag.de + pag.tamanho), ...meta(pag, todos.length) });
});

// No treino o técnico não edita o catálogo, como na `api` (só o admin).
for (const metodo of ["POST", "PUT", "DELETE"]) {
  for (const caminho of ["/catalogo/materiais", "/catalogo/materiais/:id", "/catalogo/servicos/:codigo"]) {
    rota(metodo, caminho, () => {
      throw proibido();
    });
  }
}

/** A recusa da APR como erro HTTP, como a `api` faz em `POST /aprs/avaliar`. */
function recusaDaAvaliacao(erro: Rejeicao) {
  if (erro.codigo === "payload_invalido") return invalido("validacao", erro.message);
  if (erro.codigo === "os_inexistente") return naoEncontrado("OS não encontrada");
  if (erro.codigo === "os_em_execucao" || erro.codigo === "os_encerrada") return conflito(erro.codigo, erro.message);
  return invalido(erro.codigo, erro.message);
}

const resultadoDaAvaliacao = (reprovados: ItemRegDoModelo[], materiaisFaltando: MaterialFaltando[]) => ({
  resultado: reprovados.length > 0 || materiaisFaltando.length > 0 ? "bloqueada" : "aprovada",
  reprovados: reprovados.map((i) => ({ item_id: i.id, texto: i.texto, evidencia: i.evidencia })),
  materiais_faltando: materiaisFaltando,
});

/**
 * `POST /aprs/avaliar`: confere a APR inteira (as regras do registro, antes do resultado) e diz se ela passa. É a única
 * hora em que o técnico fica sabendo quais itens são eliminatórios. A aprovada não é gravada; a bloqueada vale na hora:
 * fica registrada já aqui (OS pendente, alerta ao supervisor), e a evidência dos reprovados chega no `apr_concluida`.
 */
rota("POST", "/aprs/avaliar", ({ e, eu, corpo, agora }) => {
  const bruto = obj(corpo);
  try {
    const osId = campoUuid(bruto, "os_id")!;
    const p = lerApr(bruto);
    // A resposta anterior se perdeu e o técnico validou de novo: vale o que ficou gravado.
    const existente = e.aprs.find((a) => a.id === p.id);
    if (existente) {
      if (existente.os_id !== osId || existente.preenchida_por !== eu.id) throw conflito("apr_existente", "Esta APR já foi registrada");
      return ok(resultadoDaAvaliacao(reprovadosGravados(e, existente), faltandoDe(e, existente.materiais ?? [])));
    }
    const ctx: Contexto = {
      e,
      eu,
      evento: { id: crypto.randomUUID(), tipo: "apr_concluida", os_id: osId, payload: bruto, ocorrido_em: agora },
      agora,
      saida: { alertas: [], aprs: [], osAfetadas: new Set() },
      evidenciaDepois: true,
    };
    const { ordem, reprovados, materiaisFaltando } = conferirApr(ctx, osId, p);
    if (reprovados.length > 0 || materiaisFaltando.length > 0) {
      aplicarAprConcluida(ctx, osId, { ...bruto, evidencias: [] });
      ordem.status = statusDerivado(e, ordem);
    }
    return ok(resultadoDaAvaliacao(reprovados, materiaisFaltando));
  } catch (erro) {
    if (erro instanceof Rejeicao) throw recusaDaAvaliacao(erro);
    throw erro;
  }
});

// ---------------------------------------------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------------------------------------------

/**
 * Responde uma chamada da área de campo no lugar da `api` real. `usuario` é o técnico real (de `GET /me`); `caminho` vem
 * sem o domínio (`/os/123`, com ou sem a barra inicial); `corpo` é o JSON já lido ou, no envio de arquivos, `{arquivo,
 * tipo}` do formulário multipart. Nunca lança: erros viram `{erro: {codigo, mensagem}}` com o status que a `api` daria.
 */
export async function responderTreino(usuario: Usuario, metodo: string, caminho: string, consulta?: Consulta, corpo?: unknown): Promise<RespostaTreino> {
  const e = obterEstado(usuario);
  const eu = e.usuarios.find((u) => u.id === usuario.id)!;
  const limpo = `/${caminho.split("?")[0]!.replace(/^\/+|\/+$/g, "")}`;
  const verbo = metodo.toUpperCase();
  try {
    for (const r of rotas) {
      if (r.metodo !== verbo) continue;
      const m = r.regex.exec(limpo);
      if (!m) continue;
      const params: Record<string, string> = {};
      r.nomes.forEach((n, i) => (params[n] = decodeURIComponent(m[i + 1]!)));
      return await r.tratar({ e, eu, usuario, q: lerConsulta(consulta), corpo, params, agora: new Date() });
    }
    throw new ErroTreino(404, "indisponivel_no_treino", "Este recurso não existe no campo de treino");
  } catch (erro) {
    if (erro instanceof ErroTreino) return { status: erro.status, corpo: { erro: { codigo: erro.codigo, mensagem: erro.message } } };
    console.error("[treino] erro inesperado", erro);
    return { status: 500, corpo: { erro: { codigo: "erro_interno", mensagem: "Erro interno" } } };
  }
}

/** Converte a resposta da API fictícia numa `Response` (para `chamarApi` e para o handler `/api`). */
export function emResponse(r: RespostaTreino): Response {
  if (r.binario) {
    const cabecalhos: Record<string, string> = { "Content-Type": r.binario.tipo, "Cache-Control": "private, no-store" };
    if (r.binario.nome) cabecalhos["Content-Disposition"] = `inline; filename="${r.binario.nome}"`;
    return new Response(r.binario.bytes as unknown as BodyInit, { status: r.status, headers: cabecalhos });
  }
  return new Response(JSON.stringify(r.corpo ?? {}), { status: r.status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}

