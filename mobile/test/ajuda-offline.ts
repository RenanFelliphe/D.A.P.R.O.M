import { DatabaseSync } from "node:sqlite";
import { criarBanco, type Banco, type Parametro, type Primitivas } from "../src/offline/banco";
import { migrar } from "../src/offline/esquema";
import type { AprDaCopia, ExecucaoDaCopia, ModeloDaCopia, OsDaCopia, SnapshotDaApi, UsuarioDaCopia } from "../src/offline/tipos";

/** Um SQLite de verdade (o `node:sqlite`, em memória) sob a mesma interface que o app usa sobre o `expo-sqlite`. */
export async function novoBancoDeTeste(): Promise<Banco> {
  const sqlite = new DatabaseSync(":memory:");
  const primitivas: Primitivas = {
    exec: async (sql) => void sqlite.exec(sql),
    run: async (sql, parametros: Parametro[]) => void sqlite.prepare(sql).run(...parametros),
    all: async <T>(sql: string, parametros: Parametro[]) => sqlite.prepare(sql).all(...parametros) as T[],
  };
  const banco = criarBanco(primitivas);
  await migrar(banco);
  return banco;
}

export const EQUIPE = "eeeeeeee-0000-4000-8000-000000000001";
export const EU = "00000000-0000-4000-8000-0000000000a1";
export const COLEGA = "00000000-0000-4000-8000-0000000000a2";
export const LOCAL = "11111111-0000-4000-8000-000000000001";
export const MODELO = "22222222-0000-4000-8000-000000000001";

export const uuidDe = (n: number) => `33333333-0000-4000-8000-${String(n).padStart(12, "0")}`;

export function osDe(n: number, extra: Partial<OsDaCopia> = {}): OsDaCopia {
  return {
    id: uuidDe(n),
    numero_ordem: String(4000000 + n),
    numero_nota: null,
    tipo: "corretiva",
    tipo_atividade: null,
    codigo_atividade: null,
    titulo: `OS de teste ${n}`,
    descricao: null,
    equipamento: null,
    local_instalacao_id: LOCAL,
    equipe_id: EQUIPE,
    plano_manutencao: null,
    item_manutencao: null,
    prioridade: "Médio",
    data_inicio_prog: "2026-10-19",
    data_fim_prog: null,
    status: "liberada",
    status_sap: null,
    pdf_path: null,
    ciencia_em: null,
    justificativa_cancelamento: null,
    responsavel_id: null,
    reservada_por: null,
    reservada_em: null,
    devolvida_em: null,
    devolvida_por: null,
    justificativa_devolucao: null,
    devolucao_exportada_em: null,
    escolha_do_modelo: { recomendado: "APR 01", encontradas: [{ codigo: "APR 01", palavras: ["válvula"] }] },
    checklist_inspecao: [],
    ...extra,
  };
}

export const modeloDeTeste: ModeloDaCopia = {
  id: MODELO,
  codigo: "APR 01",
  versao: 4,
  titulo: "OPERAÇÃO",
  data_documento: null,
  publicado_em: "2026-10-01T00:00:00.000Z",
  arquivado_em: null,
  orientacao: { descricao: "Operação das estações", exemplos: ["Pré-operação"] },
  riscos: [{ id: "44444444-0000-4000-8000-000000000001", classificacao: "Veicular", nome: "Condições do veículo", ordem: 1 }],
  itens: [{ id: "55555555-0000-4000-8000-000000000001", secao: "verificacao", risco_id: null, ordem: 1, texto: "A equipe foi informada?", permite_na: false }],
};

export const usuariosDeTeste: UsuarioDaCopia[] = [
  { id: EU, nome: "Tiago Técnico", matricula: "tec1", cargo: "Técnico", perfil: "tecnico", equipe_id: EQUIPE, assinatura_path: "ass-eu" },
  { id: COLEGA, nome: "Taís Técnica", matricula: "tec2", cargo: "Técnica", perfil: "tecnico", equipe_id: EQUIPE, assinatura_path: "ass-colega", ausencia: null },
];

export function snapshotDe(os: OsDaCopia[], extra: Partial<SnapshotDaApi> = {}): SnapshotDaApi {
  return {
    os,
    aprs: [],
    execucoes: [],
    locais: [{ id: LOCAL, codigo: "VILA VELHA/REDE", endereco: null, plus_code: null, cliente: "Cliente X", critico: false }],
    atividades: [],
    modelos_apr: [modeloDeTeste],
    equipe: { id: EQUIPE, nome: "Serviços Especiais", centro_trabalho: "SERV_ESP", supervisor_id: null },
    usuarios: usuariosDeTeste,
    cursor: "2026-10-19T12:00:00.000Z",
    ...extra,
  };
}

export function aprDe(osId: string, id: string, extra: Partial<AprDaCopia> = {}): AprDaCopia {
  return {
    id,
    os_id: osId,
    modelo_apr_id: MODELO,
    preenchida_por: EU,
    resultado: "aprovada",
    concluida_em: "2026-10-19T12:00:00.000Z",
    participantes: [
      { usuario_id: EU, funcao: "responsavel", assinada_em: null, assinatura_presencial: false, recusou_em: null },
      { usuario_id: COLEGA, funcao: "executor", assinada_em: null, assinatura_presencial: false, recusou_em: null },
    ],
    ...extra,
  };
}

export function execucaoDe(osId: string, id: string, aprId: string, extra: Partial<ExecucaoDaCopia> = {}): ExecucaoDaCopia {
  return {
    id,
    os_id: osId,
    apr_id: aprId,
    executor_id: EU,
    numero_pessoas: 2,
    inicio: "2026-10-19T12:30:00.000Z",
    fim: null,
    resultado: null,
    motivo: null,
    suspensao_motivo: null,
    suspensao_complemento: null,
    encerramento_assinado_em: null,
    inicio_latitude: null,
    inicio_longitude: null,
    fim_latitude: null,
    fim_longitude: null,
    pausas: [],
    ...extra,
  };
}
