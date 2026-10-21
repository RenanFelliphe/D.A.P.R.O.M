import type { Colega, EscolhaDoModelo, ModeloCompleto } from "@shared/api/apr";
import type { ExecucaoAberta, ExecucaoDaApi } from "@shared/api/execucao-tempo";
import type { AprDaOs, DetalheDaOs, ExecucaoDaOs, ListaDeOs, OsResumo } from "@shared/api/os-app";
import { ordemDosStatus } from "@shared/api/os-app";
import type { OsStatus } from "@shared/api/tipos";
import { ErroDaApi } from "../api/erros";
import type { Banco } from "./banco";
import { lerAprsDaOs, lerAtividade, lerEquipe, lerExecucoesDaOs, lerLocal, lerModelo, lerModelosPublicados, lerOs, lerTodasAsExecucoes, lerTodasAsOs, lerTodosOsLocais, lerUsuarios, situacaoDaCopia } from "./copia";
import { eventosPendentes } from "./fila";
import { osDoEvento, projetar, type EstadoDaOs } from "./projecao";
import type { AprDaCopia, ExecucaoDaCopia, OsDaCopia, UsuarioDaCopia } from "./tipos";

/**
 * A leitura local: as mesmas respostas que a `api` dá (`GET /os`, `GET /os/{id}`, `/os/{id}/modelos-apr`, o modelo publicado, a equipe),
 * montadas da cópia da equipe mais as ações pendentes na fila. Quando não há sinal, ou quando ainda há ação esperando para subir (o
 * servidor não sabe dela), as telas leem daqui. Os tipos são os de `shared/api`, então a tela não sabe de onde veio.
 */

/** Quem está logado: o que a leitura precisa para dar nome às pessoas. */
export interface PessoaLogada {
  id: string;
  nome: string;
  matricula: string;
}

/** Ainda não há cópia da equipe neste aparelho (nunca houve sinal depois do login): não há o que mostrar. */
export class ErroSemCopia extends Error {
  constructor() {
    super("Ainda não há dados da equipe guardados neste aparelho. Conecte-se uma vez para baixá-los.");
    this.name = "ErroSemCopia";
  }
}

const HORAS_DE_EXECUCAO_ESQUECIDA = 12;
const FUSO = "America/Sao_Paulo";
const formatoDia = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO });
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** A OS que a `api` marca como atrasada: a referência (fim, ou início) é anterior a hoje e ela ainda não foi executada. */
const estaAtrasada = (o: Pick<OsDaCopia, "status" | "data_inicio_prog" | "data_fim_prog">, hoje: string) => (o.status === "liberada" || o.status === "pendente") && (o.data_fim_prog ?? o.data_inicio_prog) < hoje;

const pesoDaPrioridade = (p: string | null) => ({ "muito alto": 4, alto: 3, "médio": 2, medio: 2, baixo: 1 })[(p ?? "").trim().toLowerCase()] ?? 0;

/** `ExecucaoDaOs` e `ExecucaoDaApi` juntas: a tela de detalhe e a de execução leem a mesma resposta. */
export type ExecucaoLocal = ExecucaoDaOs & ExecucaoDaApi;

export type DetalheLocal = Omit<DetalheDaOs, "execucoes"> & { execucoes: ExecucaoLocal[] };

export function criarLeitura(banco: Banco, pessoa: () => PessoaLogada | null, agora: () => Date = () => new Date()) {
  const eu = () => {
    const p = pessoa();
    if (!p) throw new ErroDaApi(401, "nao_autenticado", "Sessão inválida ou expirada");
    return p;
  };

  async function exigirCopia() {
    const situacao = await situacaoDaCopia(banco);
    if (!situacao || situacao.usuarioId !== eu().id) throw new ErroSemCopia();
  }

  const nomesDe = async (): Promise<Map<string, UsuarioDaCopia>> => new Map((await lerUsuarios(banco)).map((u) => [u.id, u]));

  /** A OS como o aparelho a vê (cópia mais ações pendentes), ou `null` se a cópia não a tem. */
  async function estadoDaOs(osId: string, pendentes?: Awaited<ReturnType<typeof eventosPendentes>>): Promise<EstadoDaOs | null> {
    const os = await lerOs(banco, osId);
    if (!os) return null;
    const base: EstadoDaOs = { os, aprs: await lerAprsDaOs(banco, osId), execucoes: await lerExecucoesDaOs(banco, osId) };
    return projetar(base, pendentes ?? (await eventosPendentes(banco, eu().id)));
  }

  function pessoaDe(id: string, usuarios: Map<string, UsuarioDaCopia>) {
    const u = usuarios.get(id);
    if (u) return { nome: u.nome, matricula: u.matricula };
    const logada = eu();
    return id === logada.id ? { nome: logada.nome, matricula: logada.matricula } : { nome: "Colega da equipe", matricula: "" };
  }

  function aprParaApi(a: AprDaCopia, usuarios: Map<string, UsuarioDaCopia>, modelos: Map<string, { codigo: string; versao: number; titulo: string }>): AprDaOs {
    const modelo = modelos.get(a.modelo_apr_id) ?? { codigo: "APR", versao: 0, titulo: "Modelo de APR" };
    return {
      id: a.id,
      os_id: a.os_id,
      resultado: a.resultado,
      observacao_geral: null,
      concluida_em: a.concluida_em,
      preenchida_por: { id: a.preenchida_por, nome: pessoaDe(a.preenchida_por, usuarios).nome },
      modelo,
      participantes: a.participantes.map((p) => ({
        usuario_id: p.usuario_id,
        ...pessoaDe(p.usuario_id, usuarios),
        funcao: p.funcao,
        assinatura_path: p.assinada_em ? (usuarios.get(p.usuario_id)?.assinatura_path ?? null) : null,
        assinada_em: p.assinada_em,
        assinatura_presencial: p.assinatura_presencial,
        recusou_em: p.recusou_em,
        recusa_motivo: p.recusa_motivo ?? null,
      })),
      respostas: [],
      itens_reprovados: [],
      ...(a.aguardando_validacao ? { aguardando_validacao: true } : {}),
      ...(a.itens_respondidos !== undefined ? { itens_respondidos: a.itens_respondidos } : {}),
    };
  }

  function execucaoParaApi(e: ExecucaoDaCopia, usuarios: Map<string, UsuarioDaCopia>): ExecucaoLocal {
    const executor = { id: e.executor_id, ...pessoaDe(e.executor_id, usuarios) };
    const posicao = (lat: number | null, lng: number | null) => (lat !== null && lng !== null ? { latitude: lat, longitude: lng } : null);
    return {
      id: e.id,
      apr_id: e.apr_id,
      executor,
      numero_pessoas: e.numero_pessoas,
      inicio: e.inicio,
      fim: e.fim,
      resultado: e.resultado,
      encerramento_assinado_em: e.encerramento_assinado_em,
      finalizada_por: e.finalizada_por ? { id: e.finalizada_por, ...pessoaDe(e.finalizada_por, usuarios) } : null,
      suspensao_motivo: e.suspensao_motivo,
      suspensao_complemento: e.suspensao_complemento,
      localizacao_inicio: posicao(e.inicio_latitude, e.inicio_longitude),
      localizacao_fim: posicao(e.fim_latitude, e.fim_longitude),
      pausas: e.pausas.map((p) => ({ id: p.id, inicio: p.inicio, fim: p.fim, motivo: p.motivo as ExecucaoDaApi["pausas"][number]["motivo"], complemento: p.complemento, localizacao: posicao(p.latitude, p.longitude) })),
    };
  }

  /** Há quantas horas a execução aberta mais antiga está aberta, só quando passa do limite da `api` (12 h). */
  function horasAbertas(execucoes: ExecucaoDaCopia[]): number | null {
    const abertas = execucoes.filter((e) => e.resultado === null).map((e) => Date.parse(e.inicio));
    if (abertas.length === 0) return null;
    const horas = (agora().getTime() - Math.min(...abertas)) / 3_600_000;
    return horas > HORAS_DE_EXECUCAO_ESQUECIDA ? Math.floor(horas) : null;
  }

  return {
    /** `GET /os` da equipe: um status por vez, com a busca, a ordem e a contagem por status da `api`. */
    async lista(filtro: { status: OsStatus; busca?: string; pagina: number; tamanho: number }): Promise<ListaDeOs> {
      await exigirCopia();
      const pendentes = await eventosPendentes(banco, eu().id);
      const [oss, locais, usuarios, equipe] = await Promise.all([lerTodasAsOs(banco), lerTodosOsLocais(banco), nomesDe(), lerEquipe(banco)]);
      const execucoes = await lerTodasAsExecucoes(banco);
      const locaisPorId = new Map(locais.map((l) => [l.id, l]));
      const hoje = formatoDia.format(agora());

      const busca = semAcento(filtro.busca?.trim() ?? "");
      const visiveis = await Promise.all(
        oss.map(async (o) => {
          const projetada = pendentes.some((e) => osDoEvento(e) === o.id) ? await estadoDaOs(o.id, pendentes) : null;
          const os = projetada?.os ?? o;
          const doOs = projetada?.execucoes ?? execucoes.filter((e) => e.os_id === o.id);
          return { os, execucoes: doOs, local: locaisPorId.get(o.local_instalacao_id) };
        }),
      );
      const combinaComABusca = ({ os, local }: (typeof visiveis)[number]) =>
        !busca || [os.numero_ordem, os.titulo, local?.codigo, os.numero_nota, local?.cliente].some((campo) => campo && semAcento(campo).includes(busca));
      const buscadas = visiveis.filter(combinaComABusca);

      const contagem = Object.fromEntries(ordemDosStatus.map((s) => [s, 0])) as Record<OsStatus, number>;
      for (const v of buscadas) contagem[v.os.status]++;

      const doStatus = buscadas
        .filter((v) => v.os.status === filtro.status)
        .sort(
          (a, b) =>
            pesoDaPrioridade(b.os.prioridade) - pesoDaPrioridade(a.os.prioridade) ||
            (a.os.data_fim_prog ?? a.os.data_inicio_prog).localeCompare(b.os.data_fim_prog ?? b.os.data_inicio_prog) ||
            Number(b.local?.critico ?? false) - Number(a.local?.critico ?? false) ||
            (a.os.numero_ordem ?? "").localeCompare(b.os.numero_ordem ?? "") ||
            a.os.id.localeCompare(b.os.id),
        );
      const itens: OsResumo[] = doStatus.slice((filtro.pagina - 1) * filtro.tamanho, filtro.pagina * filtro.tamanho).map(({ os, execucoes: doOs, local }) => ({
        id: os.id,
        numero_ordem: os.numero_ordem,
        tipo: os.tipo,
        titulo: os.titulo,
        status: os.status,
        equipe_id: os.equipe_id,
        equipe_nome: equipe?.nome ?? "Minha equipe",
        local_instalacao: { id: os.local_instalacao_id, codigo: local?.codigo ?? "—", critico: local?.critico ?? false },
        equipamento: os.equipamento,
        prioridade: os.prioridade,
        data_inicio_prog: os.data_inicio_prog,
        data_fim_prog: os.data_fim_prog,
        pdf_pronto: os.pdf_path !== null,
        atrasada: estaAtrasada(os, hoje),
        responsavel: os.responsavel_id ? { id: os.responsavel_id, nome: pessoaDe(os.responsavel_id, usuarios).nome } : null,
        execucao_aberta_ha_horas: horasAbertas(doOs),
      }));
      return { os: itens, total: doStatus.length, pagina: filtro.pagina, tamanho: filtro.tamanho, contagem_por_status: contagem };
    },

    /** `GET /os/{id}`: a OS, o serviço, as APRs e as execuções (com as pausas), já com o que está pendente na fila. */
    async detalhe(osId: string): Promise<DetalheLocal> {
      await exigirCopia();
      const estado = await estadoDaOs(osId);
      if (!estado) throw new ErroDaApi(404, "os_inexistente", "OS não encontrada");
      const { os, aprs, execucoes } = estado;
      const usuarios = await nomesDe();
      const [local, equipe, atividade] = await Promise.all([lerLocal(banco, os.local_instalacao_id), lerEquipe(banco), os.codigo_atividade ? lerAtividade(banco, os.codigo_atividade) : null]);

      const modelos = new Map<string, { codigo: string; versao: number; titulo: string }>();
      for (const a of aprs) {
        if (modelos.has(a.modelo_apr_id)) continue;
        const m = await lerModelo(banco, a.modelo_apr_id);
        if (m) modelos.set(m.id, { codigo: m.codigo, versao: m.versao, titulo: m.titulo });
      }

      const reservada = os.responsavel_id ? { id: os.responsavel_id, nome: pessoaDe(os.responsavel_id, usuarios).nome, reservada_por_nome: os.reservada_por ? pessoaDe(os.reservada_por, usuarios).nome : null, reservada_em: os.reservada_em } : null;
      return {
        os: {
          id: os.id,
          numero_ordem: os.numero_ordem,
          numero_nota: os.numero_nota,
          tipo: os.tipo,
          tipo_atividade: os.tipo_atividade,
          codigo_atividade: os.codigo_atividade,
          titulo: os.titulo,
          descricao: os.descricao,
          equipamento: os.equipamento,
          plano_manutencao: os.plano_manutencao,
          item_manutencao: os.item_manutencao,
          prioridade: os.prioridade,
          data_inicio_prog: os.data_inicio_prog,
          data_fim_prog: os.data_fim_prog,
          status: os.status,
          status_sap: os.status_sap,
          equipe_id: os.equipe_id,
          local_instalacao: local ?? { id: os.local_instalacao_id, codigo: "—", critico: false },
          equipe: equipe ?? { id: os.equipe_id, nome: "Minha equipe", centro_trabalho: "", supervisor_id: null },
          justificativa_cancelamento: os.justificativa_cancelamento,
          pdf_pronto: os.pdf_path !== null,
          responsavel: reservada,
          devolucao: os.devolvida_em ? { em: os.devolvida_em, por_nome: os.devolvida_por ? pessoaDe(os.devolvida_por, usuarios).nome : null, justificativa: os.justificativa_devolucao, exportada_em: os.devolucao_exportada_em } : null,
          atrasada: estaAtrasada(os, formatoDia.format(agora())),
          execucao_aberta_ha_horas: horasAbertas(execucoes),
          eventos_com_relogio_suspeito: 0,
        },
        servico: atividade ? { codigo: atividade.codigo, descricao: atividade.descricao, materiais: atividade.materiais } : null,
        aprs: [...aprs].sort((a, b) => a.concluida_em.localeCompare(b.concluida_em)).map((a) => aprParaApi(a, usuarios, modelos)),
        execucoes: [...execucoes].sort((a, b) => a.inicio.localeCompare(b.inicio)).map((e) => execucaoParaApi(e, usuarios)),
        checklist_inspecao: os.checklist_inspecao,
      };
    },

    /** `GET /os/{id}/modelos-apr`: os modelos publicados com a orientação, o que cada um achou na OS e o recomendado. */
    async escolhaDoModelo(osId: string): Promise<EscolhaDoModelo> {
      await exigirCopia();
      const os = await lerOs(banco, osId);
      if (!os) throw new ErroDaApi(404, "os_inexistente", "OS não encontrada");
      const achadas = new Map(os.escolha_do_modelo.encontradas.map((e) => [e.codigo, e.palavras]));
      const modelos = await lerModelosPublicados(banco);
      return {
        recomendado: os.escolha_do_modelo.recomendado,
        fonte: os.escolha_do_modelo.fonte,
        motivo: os.escolha_do_modelo.motivo,
        modelos: modelos.map((m) => ({ codigo: m.codigo, versao: m.versao, titulo: m.titulo, descricao: m.orientacao.descricao, exemplos: m.orientacao.exemplos, encontradas: achadas.get(m.codigo) ?? [] })),
      };
    },

    /** `GET /modelos-apr/{codigo}/versoes/publicada`: o modelo completo, sem o que é eliminatório (a cópia já vem sem). */
    async modeloPublicado(codigo: string): Promise<ModeloCompleto> {
      await exigirCopia();
      const m = (await lerModelosPublicados(banco)).find((x) => x.codigo === codigo);
      if (!m) throw new ErroDaApi(404, "modelo_inexistente", "Modelo de APR não encontrado");
      return { id: m.id, codigo: m.codigo, versao: m.versao, titulo: m.titulo, data_documento: m.data_documento, publicado_em: m.publicado_em, riscos: m.riscos, itens: m.itens };
    },

    /** `GET /usuarios?equipe_id=`: a equipe da cópia, com a ausência (quem está ausente não entra na APR). */
    async colegas(equipeId: string): Promise<(Colega & { ausencia?: unknown })[]> {
      await exigirCopia();
      return (await lerUsuarios(banco))
        .filter((u) => u.equipe_id === equipeId)
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map((u) => ({ id: u.id, nome: u.nome, matricula: u.matricula, cargo: u.cargo, perfil: u.perfil, assinatura_path: u.assinatura_path, ausencia: u.ausencia ?? null }));
    },

    /** `GET /me/execucoes-abertas`: as execuções do próprio técnico ainda em andamento, em qualquer OS da cópia. */
    async execucoesAbertas(): Promise<ExecucaoAberta[]> {
      await exigirCopia();
      const pendentes = await eventosPendentes(banco, eu().id);
      const abertas: ExecucaoAberta[] = [];
      // Só as OS que podem ter execução aberta: as que a cópia diz abertas e as que têm registro esperando na fila.
      const candidatas = new Set<string>([...(await lerTodasAsExecucoes(banco)).filter((e) => e.resultado === null).map((e) => e.os_id), ...pendentes.map(osDoEvento).filter((id): id is string => id !== null)]);
      for (const osId of candidatas) {
        const estado = await estadoDaOs(osId, pendentes);
        for (const e of estado?.execucoes ?? []) {
          if (e.resultado === null && e.executor_id === eu().id) abertas.push({ id: e.id, os_id: osId, apr_id: e.apr_id, inicio: e.inicio, numero_ordem: estado!.os.numero_ordem, titulo: estado!.os.titulo });
        }
      }
      return abertas.sort((a, b) => a.inicio.localeCompare(b.inicio));
    },
  };
}

export type LeituraLocal = ReturnType<typeof criarLeitura>;
