/**
 * Massa fictícia do Campo de treino: uma equipe, colegas, locais, dois modelos de APR e onze OS em todos os status (inclusive
 * `encerrando` e `aguardando_supervisor`, os dois passos entre o fim da execução e a conclusão), com histórico de APRs
 * assinadas na conta de cada um e de execuções. Tudo é montado em memória para um técnico (`criarEstadoInicial`) e nunca vem do banco.
 * Os tipos seguem as respostas reais da `api` (snake_case); o estado usa os mesmos nomes de campo para a API fictícia
 * (`api-ficticia.ts`) devolvê-los quase como estão.
 */
import type { ItemDoModelo, ModeloCompleto, RiscoDoModelo } from "../lib/apr";
import type { Equipe, OsStatus, Usuario } from "../lib/tipos";
import {
  ASSINATURA_INICIAL_TREINO,
  COLEGAS_TREINO,
  EQUIPE_TREINO,
  MODELO_BLOQUEIO,
  MODELO_GUIADO,
  OS_AGUARDANDO_SUPERVISOR,
  OS_BLOQUEIO,
  OS_CANCELADA,
  OS_CRITICA,
  OS_EM_EXECUCAO_DE_COLEGA,
  OS_ENCERRADA_DE_COLEGA,
  OS_ENCERRADA_PELO_TECNICO,
  OS_ENCERRANDO,
  OS_GUIADA,
  OS_PENDENTE,
  OS_SEM_MODELO,
  idTreino,
} from "./ids";
import type { MotivoDaPausa, MotivoDaSuspensao } from "./motivos";

// ---------------------------------------------------------------------------------------------------------------
// Tipos do estado
// ---------------------------------------------------------------------------------------------------------------

export type UsuarioTreino = Omit<Usuario, "treinamento"> & { treinamento: { estado: string; em: string | null } };

export interface LocalReg {
  id: string;
  codigo: string;
  endereco: string | null;
  plus_code: string | null;
  cliente: string | null;
  critico: boolean;
}

/** O item como o servidor o guarda: com o tipo, a resposta que bloqueia e a evidência, que o técnico não recebe. */
export interface ItemRegDoModelo extends ItemDoModelo {
  resposta_bloqueante: "sim" | "nao" | null;
  tipo: "eliminatorio" | "alerta";
  evidencia: "foto" | "texto" | "pdf";
}

export interface ModeloReg extends Omit<ModeloCompleto, "itens"> {
  itens: ItemRegDoModelo[];
  pae: null;
  arquivado_em: null;
  rascunho: false;
}

export interface OsReg {
  id: string;
  numero_ordem: string | null;
  numero_nota: string | null;
  tipo: "preventiva" | "corretiva";
  tipo_atividade: string | null;
  codigo_atividade: string | null;
  titulo: string;
  descricao: string | null;
  equipamento: string | null;
  local_instalacao_id: string;
  equipe_id: string;
  plano_manutencao: string | null;
  item_manutencao: string | null;
  prioridade: string | null;
  data_inicio_prog: string;
  data_fim_prog: string | null;
  status: OsStatus;
  data_ordem: string | null;
  criado_por_sap: string | null;
  status_sap: string | null;
  solicitante: string | null;
  os_origem_id: string | null;
  origem: "sap" | "planilha" | "apoio";
  /** Id do PDF (fictício) e quando ele fica pronto; `null` enquanto a OS não encerrou. */
  pdf_path: string | null;
  pdf_em: string | null;
  ciencia_por: string | null;
  ciencia_em: string | null;
  exportada_sap_em: string | null;
  cancelada_em: string | null;
  cancelada_por: string | null;
  justificativa_cancelamento: string | null;
}

/**
 * O participante da APR como a `api` o guarda depois da Reunião 3: a APR é registrada sem assinaturas (`assinatura_path` e
 * `assinada_em` nulos) e cada um assina na própria conta; quem recusa sai da APR (`recusou_em` e o motivo).
 */
export interface ParticipanteAprReg {
  usuario_id: string;
  funcao: "responsavel" | "executor";
  assinatura_path: string | null;
  assinada_em: string | null;
  /** A assinatura foi dada no aparelho do responsável (contingência offline); o treino não tem offline, então é sempre `false`. */
  assinatura_presencial: boolean;
  recusou_em: string | null;
  recusa_motivo: string | null;
}

/** Posição (GPS) gravada no início, na pausa, na suspensão, na interrupção e no encerramento; `null` = "sem localização". */
export interface PosicaoReg {
  latitude: number;
  longitude: number;
}

export interface AprReg {
  id: string;
  os_id: string;
  modelo_apr_id: string;
  preenchida_por: string;
  resultado: "aprovada" | "bloqueada";
  observacao_geral: string | null;
  concluida_em: string;
  participantes: ParticipanteAprReg[];
  riscos: string[];
  respostas: { item_id: string; resposta: "sim" | "nao" | "na"; observacao: string | null; respondida_em: string }[];
  /** Fotos e PDFs dos itens reprovados; sem `tipo`, é foto (a massa inicial só tem fotos). */
  evidencias: { id: string; arquivo_id: string; item_id: string; capturada_em: string; latitude: number | null; longitude: number | null; tipo?: "foto" | "pdf"; nome?: string | null }[];
}

export interface FotoReg {
  id: string;
  foto_path: string;
  capturada_em: string;
  latitude: number | null;
  longitude: number | null;
}

/** PDF anexado à execução (laudo, relatório), na forma de `documentos` da `api`. */
export interface DocumentoReg {
  id: string;
  arquivo_path: string;
  nome: string | null;
  capturada_em: string;
}

export interface ExecucaoReg {
  id: string;
  os_id: string;
  apr_id: string;
  executor_id: string;
  numero_pessoas: number;
  inicio: string;
  fim: string | null;
  resultado: "encerrada" | "interrompida" | "suspensa" | "cancelada" | null;
  descricao_atividade: string | null;
  motivo: string | null;
  /** Só na suspensa: por que o serviço não continua hoje (com o complemento de "outro"). */
  suspensao_motivo: MotivoDaSuspensao | null;
  suspensao_complemento: string | null;
  dados_inspecao: unknown;
  /** Quando o responsável assinou o encerramento; nulo na encerrada = a OS está `encerrando` (o tempo já parou). */
  encerramento_assinado_em: string | null;
  localizacao_inicio: PosicaoReg | null;
  /** Onde a pessoa estava ao encerrar, suspender ou interromper. */
  localizacao_fim: PosicaoReg | null;
  pausas: { id: string; inicio: string; fim: string | null; motivo: MotivoDaPausa | null; complemento: string | null; localizacao: PosicaoReg | null }[];
  /** A assinatura do responsável no encerramento (os demais assinaram a APR, no começo). */
  assinaturas: { usuario_id: string; assinatura_path: string; assinada_em: string }[];
  fotos: FotoReg[];
  /** PDFs anexados ao encerramento ou à interrupção; ausente na massa inicial. */
  documentos?: DocumentoReg[];
}

export interface AlertaReg {
  id: string;
  os_id: string;
  tipo: string;
  detalhe: string;
  destinatario_id: string;
  email_enviado_em: string | null;
  lido_em: string | null;
  criado_em: string;
}

export interface ArquivoReg {
  id: string;
  tipo: "foto" | "assinatura" | "pdf";
  /** Tipo de mídia; `bytes` é `null` nos arquivos da massa inicial (a imagem é desenhada na hora a partir do `rotulo`). */
  mime: string;
  bytes: Uint8Array | null;
  rotulo: string;
}

export interface EstadoTreino {
  /** Dia (America/Sao_Paulo) em que a massa foi montada: ao virar o dia ela é refeita, para as OS continuarem "de hoje". */
  dia: string;
  criadoEm: string;
  equipe: Equipe;
  usuarios: UsuarioTreino[];
  locais: LocalReg[];
  modelos: ModeloReg[];
  os: OsReg[];
  aprs: AprReg[];
  execucoes: ExecucaoReg[];
  alertas: AlertaReg[];
  arquivos: Map<string, ArquivoReg>;
  /** Ids de eventos já aplicados: reenviar o mesmo id só confirma (idempotência). */
  eventos: Set<string>;
  proximoAlerta: number;
}

// ---------------------------------------------------------------------------------------------------------------
// Datas (America/Sao_Paulo, sem horário de verão desde 2019: UTC-3)
// ---------------------------------------------------------------------------------------------------------------

const fmtDia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });

/** `AAAA-MM-DD` do instante em America/Sao_Paulo. */
export const diaDe = (instante: Date | string) => fmtDia.format(typeof instante === "string" ? new Date(instante) : instante);

/** `AAAA-MM-DD` do dia de `agora` deslocado em `dias`. */
export const diaMais = (agora: Date, dias: number) => diaDe(new Date(agora.getTime() + dias * 86_400_000));

/** Instante (ISO) de `hh:mm` no dia de `agora` deslocado em `dias` (negativo = passado). */
export const horario = (agora: Date, dias: number, hh: number, mm = 0) =>
  new Date(`${diaMais(agora, dias)}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00-03:00`).toISOString();

const minutosAntes = (agora: Date, min: number) => new Date(agora.getTime() - min * 60_000).toISOString();

// ---------------------------------------------------------------------------------------------------------------
// Modelos de APR
// ---------------------------------------------------------------------------------------------------------------

interface ItemSpec {
  n: number;
  secao: "verificacao" | "medida_preventiva";
  /** Número (1, 2, ...) do risco dentro do modelo; só nas medidas preventivas. */
  risco?: number;
  texto: string;
  tipo: "eliminatorio" | "alerta";
  evidencia: "foto" | "texto";
  na: boolean;
}

function montarModelo(
  indice: number,
  base: { codigo: string; versao: number; titulo: string; data: string },
  riscosSpec: [string, string][],
  itensSpec: ItemSpec[],
  deslocamento: number,
  agora: Date,
): ModeloReg {
  const riscos: RiscoDoModelo[] = riscosSpec.map(([classificacao, nome], i) => ({ id: idTreino("d", deslocamento + i + 1), classificacao, nome, ordem: i + 1 }));
  const itens: ItemRegDoModelo[] = itensSpec.map((s) => ({
    id: idTreino("a", s.n),
    secao: s.secao,
    risco_id: s.risco ? riscos[s.risco - 1]!.id : null,
    ordem: s.n - (deslocamento > 0 ? 100 : 0),
    texto: s.texto,
    // Em todos os itens a resposta que bloqueia (eliminatório) ou gera alerta é "não".
    resposta_bloqueante: "nao",
    tipo: s.tipo,
    evidencia: s.evidencia,
    permite_na: s.na,
  }));
  return {
    id: idTreino("b", indice),
    codigo: base.codigo,
    versao: base.versao,
    titulo: base.titulo,
    data_documento: base.data,
    publicado_em: horario(agora, -400, 9),
    pae: null,
    arquivado_em: null,
    rascunho: false,
    riscos,
    itens,
  };
}

const ver = (n: number, texto: string, tipo: ItemSpec["tipo"], evidencia: ItemSpec["evidencia"], na = false): ItemSpec => ({ n, secao: "verificacao", texto, tipo, evidencia, na });
const med = (n: number, risco: number, texto: string, na = true): ItemSpec => ({ n, secao: "medida_preventiva", risco, texto, tipo: "alerta", evidencia: "texto", na });

function criarModelos(agora: Date): ModeloReg[] {
  const guiado = montarModelo(
    1,
    { codigo: MODELO_GUIADO.codigo, versao: MODELO_GUIADO.versao, titulo: MODELO_GUIADO.titulo, data: "2025-03-10" },
    [
      ["Elétrico", "Choque elétrico e arco elétrico"],
      ["Mecânico", "Queda de materiais e ferramentas"],
      ["Ambiental", "Calor e exposição solar"],
    ],
    [
      ver(1, "O local de trabalho foi sinalizado e isolado antes do início?", "alerta", "texto"),
      ver(2, "Todos os participantes conhecem o plano de emergência (PAE) da instalação?", "alerta", "texto"),
      ver(3, MODELO_GUIADO.itemEliminatorioTexto, "eliminatorio", "foto"),
      ver(4, "As condições do tempo permitem o serviço com segurança?", "alerta", "texto", true),
      ver(5, "O equipamento foi desenergizado, bloqueado e etiquetado (LOTO)?", "eliminatorio", "texto"),
      med(6, 1, "A ausência de tensão foi confirmada com detector previamente testado?", false),
      med(7, 1, "As luvas isolantes foram inspecionadas e estão dentro da validade do teste?"),
      med(8, 2, "As ferramentas estão amarradas ou protegidas contra queda?"),
      med(9, 3, "Foram programadas pausas e hidratação durante o serviço?"),
    ],
    0,
    agora,
  );
  const altura = montarModelo(
    2,
    { codigo: MODELO_BLOQUEIO.codigo, versao: MODELO_BLOQUEIO.versao, titulo: MODELO_BLOQUEIO.titulo, data: "2025-05-20" },
    [
      ["Queda", "Queda de altura"],
      ["Elétrico", "Proximidade de rede energizada"],
      ["Trânsito", "Atropelamento e trânsito viário"],
    ],
    [
      ver(101, "Os trabalhadores têm treinamento de NR-35 válido?", "eliminatorio", "texto"),
      ver(102, MODELO_BLOQUEIO.itemEliminatorioTexto, "eliminatorio", "foto"),
      ver(103, "A área abaixo do trabalho foi isolada e sinalizada?", "alerta", "texto"),
      ver(104, "A distância de segurança da rede energizada foi verificada?", "eliminatorio", "foto"),
      ver(105, "As condições do tempo permitem o trabalho em altura?", "alerta", "texto", true),
      med(106, 1, "O ponto de ancoragem foi verificado e a linha de vida instalada?", false),
      med(107, 1, "A escada ou plataforma está firme e travada?"),
      med(108, 2, "A rede foi desligada e aterrada, ou a isolação foi providenciada?"),
      med(109, 3, "Cones e sinalização viária foram colocados?"),
    ],
    100,
    agora,
  );
  return [guiado, altura];
}

// ---------------------------------------------------------------------------------------------------------------
// Pessoas, locais e OS
// ---------------------------------------------------------------------------------------------------------------

const idAssinatura = (n: number) => idTreino("5", n);

/** Pessoas da Equipe Treino: o técnico real (com a assinatura fictícia já cadastrada) e os colegas. */
function criarUsuarios(real: Usuario): UsuarioTreino[] {
  const treinamento = { estado: "nao_iniciado", em: null as string | null };
  const colega = (c: { id: string; nome: string; matricula: string; cargo: string }, assinatura: string | null): UsuarioTreino => ({
    id: c.id,
    nome: c.nome,
    matricula: c.matricula,
    cargo: c.cargo,
    registro_profissional: null,
    perfil: "tecnico",
    equipe_id: EQUIPE_TREINO.id,
    ativo: true,
    senha_provisoria: false,
    assinatura_path: assinatura,
    assinatura_em: assinatura ? "2025-02-03T12:00:00.000Z" : null,
    treinamento,
  });
  const eu: UsuarioTreino = {
    id: real.id,
    nome: real.nome,
    matricula: real.matricula,
    email: real.email,
    cargo: real.cargo ?? "Técnico de Manutenção",
    registro_profissional: real.registro_profissional,
    perfil: "tecnico",
    equipe_id: EQUIPE_TREINO.id,
    ativo: true,
    senha_provisoria: false,
    assinatura_path: ASSINATURA_INICIAL_TREINO,
    assinatura_em: "2025-02-03T12:00:00.000Z",
    treinamento,
  };
  return [
    eu,
    colega(COLEGAS_TREINO.carlos, idAssinatura(11)),
    colega(COLEGAS_TREINO.joana, idAssinatura(12)),
    colega(COLEGAS_TREINO.paulo, idAssinatura(13)),
    colega(COLEGAS_TREINO.marcos, idAssinatura(14)),
    colega(COLEGAS_TREINO.debora, null),
  ];
}

const LOCAIS: LocalReg[] = [
  { id: idTreino("c", 1), codigo: "SE-TRN-001", endereco: "Av. Treino Norte, 1000 - Distrito Industrial", plus_code: "58Q7+2M Cidade Treino", cliente: "Companhia Elétrica de Treino", critico: false },
  { id: idTreino("c", 2), codigo: "SE-TRN-002", endereco: "Rua da Saúde, 250 - Centro", plus_code: "58Q8+9F Cidade Treino", cliente: "Hospital Regional de Treino", critico: true },
  { id: idTreino("c", 3), codigo: "LD-TRN-013", endereco: "Estrada Municipal TRN-07, km 4", plus_code: "58P9+W3 Cidade Treino", cliente: "Companhia Elétrica de Treino", critico: false },
  { id: idTreino("c", 4), codigo: "RL-TRN-007", endereco: "Rua das Palmeiras, 80 - Jardim Treino", plus_code: "58R2+4H Cidade Treino", cliente: "Companhia Elétrica de Treino", critico: false },
  { id: idTreino("c", 5), codigo: "PR-TRN-020", endereco: "Praça Central, s/n", plus_code: "58Q6+7C Cidade Treino", cliente: "Prefeitura de Treino", critico: false },
];

interface OsSpec extends Partial<OsReg> {
  id: string;
  numero: string;
  tipo: OsReg["tipo"];
  titulo: string;
  local: number;
  inicio: number;
  fim: number | null;
}

function criarOs(agora: Date): OsReg[] {
  const specs: OsSpec[] = [
    {
      id: OS_GUIADA,
      numero: "4900101",
      tipo: "preventiva",
      titulo: "Inspeção termográfica do quadro de média tensão",
      local: 1,
      inicio: 0,
      fim: 2,
      equipamento: "QMT-01 - Quadro de média tensão",
      tipo_atividade: "Inspeção termográfica",
      codigo_atividade: "PREV-TERMO-MT",
      plano_manutencao: "PM-TRN-12M",
      item_manutencao: "IM-0001",
      prioridade: "Alto",
      descricao:
        "1. Confirmar com o operador a liberação do quadro e registrar a hora.\n2. Abrir as portas com o quadro em carga normal e fazer a termografia dos barramentos, disjuntores e terminais.\n3. Registrar pontos acima de 15 °C sobre a referência e fotografar a imagem térmica.\n4. Fechar o quadro, recolocar a sinalização e informar o operador.",
      status_sap: "LIB",
    },
    {
      id: OS_BLOQUEIO,
      numero: "4900102",
      tipo: "corretiva",
      titulo: "Substituição de isolador de pino trincado - alimentador 07",
      local: 3,
      inicio: 0,
      fim: 1,
      equipamento: "Poste P-114 - Cruzeta",
      tipo_atividade: "Manutenção em rede aérea",
      codigo_atividade: "COR-REDE-ALT",
      prioridade: "Alto",
      descricao:
        "Isolador de pino da fase B trincado, apontado pela inspeção de rotina. Trabalho em altura em poste de concreto, com rede de 13,8 kV na vizinhança: exige desligamento programado ou isolação da rede, cinto paraquedista e talabarte inspecionados.",
      solicitante: "Centro de Operação da Distribuição",
      status_sap: "LIB",
    },
    {
      id: OS_CRITICA,
      numero: "4900103",
      tipo: "preventiva",
      titulo: "Manutenção preventiva do transformador 69/13,8 kV",
      local: 2,
      inicio: -3,
      fim: -1,
      equipamento: "TR-02 - Transformador de potência",
      tipo_atividade: "Manutenção preventiva de transformador",
      codigo_atividade: "PREV-TRAFO",
      plano_manutencao: "PM-TRN-06M",
      item_manutencao: "IM-0007",
      prioridade: "Muito alto",
      descricao: "Local crítico (atende hospital): combinar a janela de desligamento com o centro de operação antes de qualquer intervenção. Verificar nível e temperatura do óleo, buchas e silica gel.",
      status_sap: "LIB",
    },
    {
      id: OS_PENDENTE,
      numero: "4900104",
      tipo: "corretiva",
      titulo: "Reaperto de conexões e troca de elo fusível - religador RL-07",
      local: 4,
      inicio: -1,
      fim: 1,
      equipamento: "RL-07 - Religador",
      tipo_atividade: "Manutenção em rede aérea",
      codigo_atividade: "COR-REDE-ALT",
      prioridade: "Alto",
      descricao: "A primeira APR foi bloqueada (talabarte com costura rompida). A OS volta à fila como pendente: refaça a APR depois de trocar o equipamento.",
      status_sap: "LIB",
    },
    {
      id: OS_EM_EXECUCAO_DE_COLEGA,
      numero: "4900105",
      tipo: "preventiva",
      titulo: "Limpeza e inspeção de chaves seccionadoras",
      local: 1,
      inicio: 0,
      fim: 1,
      equipamento: "CH-12 - Chave seccionadora",
      tipo_atividade: "Manutenção preventiva de chaves",
      codigo_atividade: "PREV-CHAVE",
      plano_manutencao: "PM-TRN-12M",
      item_manutencao: "IM-0003",
      prioridade: "Médio",
      descricao: "Limpeza dos contatos, lubrificação e teste de abertura e fechamento.",
      status_sap: "LIB",
    },
    {
      id: OS_ENCERRADA_PELO_TECNICO,
      numero: "4900106",
      tipo: "preventiva",
      titulo: "Inspeção visual de para-raios",
      local: 3,
      inicio: -2,
      fim: -1,
      equipamento: "PR-01 - Para-raios",
      tipo_atividade: "Inspeção visual",
      codigo_atividade: "PREV-VISUAL",
      plano_manutencao: "PM-TRN-12M",
      item_manutencao: "IM-0011",
      prioridade: "Baixo",
      descricao: "Inspeção visual dos para-raios do alimentador: porcelana, conexões e contador de descargas.",
      status_sap: "ENC",
    },
    {
      id: OS_ENCERRADA_DE_COLEGA,
      numero: "4900107",
      tipo: "corretiva",
      titulo: "Troca de lâmpadas de LED na iluminação da praça",
      local: 5,
      inicio: -4,
      fim: -3,
      equipamento: "Luminárias L-01 a L-08",
      tipo_atividade: "Iluminação pública",
      codigo_atividade: "COR-ILUM",
      prioridade: "Baixo",
      descricao: "Oito luminárias apagadas na praça central.",
      status_sap: "ENC",
    },
    {
      id: OS_CANCELADA,
      numero: "4900108",
      tipo: "corretiva",
      titulo: "Poda de árvore próxima à rede - alimentador 07",
      local: 3,
      inicio: -2,
      fim: 0,
      equipamento: null,
      tipo_atividade: "Poda",
      codigo_atividade: "COR-PODA",
      prioridade: "Médio",
      descricao: "Ordem aberta em duplicidade.",
      status_sap: "CANC",
      status: "cancelada",
      cancelada_em: horario(agora, -1, 10, 30),
      cancelada_por: "SAP",
      justificativa_cancelamento: "Cancelada no SAP por duplicidade com a OS 4900102.",
    },
    {
      id: OS_SEM_MODELO,
      numero: "4900109",
      tipo: "corretiva",
      titulo: "Substituição de lâmpadas da iluminação externa da subestação",
      local: 1,
      inicio: 1,
      fim: 3,
      equipamento: "Iluminação externa",
      tipo_atividade: "Iluminação",
      codigo_atividade: null,
      prioridade: "Baixo",
      descricao: "Lâmpadas queimadas no pátio e na entrada da subestação. Trocar pelas de LED do almoxarifado e testar o fotocontrole.",
      status_sap: "LIB",
    },
    {
      id: OS_ENCERRANDO,
      numero: "4900110",
      tipo: "corretiva",
      titulo: "Reaperto de conexões no painel de comando do religador RL-03",
      local: 4,
      inicio: 0,
      fim: 1,
      equipamento: "RL-03 - Painel de comando",
      tipo_atividade: "Manutenção em rede aérea",
      codigo_atividade: "COR-REDE-ALT",
      prioridade: "Médio",
      descricao:
        "O tempo desta execução já parou no “Encerrar OS”. Falta a parte final: descrever o que foi feito (opcional), anexar fotos (opcional) e assinar o encerramento. Enquanto isso a OS fica “Encerrando”.",
      status_sap: "LIB",
      status: "encerrando",
    },
    {
      id: OS_AGUARDANDO_SUPERVISOR,
      numero: "4900111",
      tipo: "corretiva",
      titulo: "Troca de lâmpadas e do relé fotoelétrico - iluminação da praça",
      local: 5,
      inicio: -1,
      fim: 0,
      equipamento: "Luminárias L-09 a L-12",
      tipo_atividade: "Iluminação pública",
      codigo_atividade: "COR-ILUM",
      prioridade: "Baixo",
      descricao: "Serviço concluído por um colega e já assinado por ele. Falta a assinatura final do supervisor, depois de ler o relatório da execução; só então o PDF da OS é gerado.",
      status_sap: "LIB",
      status: "aguardando_supervisor",
    },
  ];

  return specs.map((s, i) => ({
    id: s.id,
    numero_ordem: s.numero,
    numero_nota: `1001${String(200 + i)}`,
    tipo: s.tipo,
    tipo_atividade: s.tipo_atividade ?? null,
    codigo_atividade: s.codigo_atividade ?? null,
    titulo: s.titulo,
    descricao: s.descricao ?? null,
    equipamento: s.equipamento ?? null,
    local_instalacao_id: LOCAIS[s.local - 1]!.id,
    equipe_id: EQUIPE_TREINO.id,
    plano_manutencao: s.plano_manutencao ?? null,
    item_manutencao: s.item_manutencao ?? null,
    prioridade: s.prioridade ?? null,
    data_inicio_prog: diaMais(agora, s.inicio),
    data_fim_prog: s.fim === null ? null : diaMais(agora, s.fim),
    status: s.status ?? "liberada",
    data_ordem: diaMais(agora, s.inicio - 5),
    criado_por_sap: "SAP.TREINO",
    status_sap: s.status_sap ?? "LIB",
    solicitante: s.solicitante ?? null,
    os_origem_id: null,
    origem: "sap",
    pdf_path: null,
    pdf_em: null,
    ciencia_por: null,
    ciencia_em: null,
    exportada_sap_em: null,
    cancelada_em: s.cancelada_em ?? null,
    cancelada_por: s.cancelada_por ?? null,
    justificativa_cancelamento: s.justificativa_cancelamento ?? null,
  }));
}

// ---------------------------------------------------------------------------------------------------------------
// Histórico: APRs, execuções, alertas e arquivos
// ---------------------------------------------------------------------------------------------------------------

/** Uma pergunta do checklist de inspeção do plano da OS preventiva (`GET /os/{id}` devolve `checklist_inspecao`). */
export interface PerguntaDeInspecaoReg {
  id: string;
  texto: string;
}

/** Checklist por plano e item de manutenção (a chave da `api`): só a inspeção termográfica da OS guiada tem um, para o treino mostrar o encerramento com checklist. */
const CHECKLISTS_DE_INSPECAO: Record<string, PerguntaDeInspecaoReg[]> = {
  "PM-TRN-12M\u0000IM-0001": [
    { id: idTreino("2", 1), texto: "Os pontos acima de 15 °C sobre a referência foram registrados e fotografados?" },
    { id: idTreino("2", 2), texto: "O quadro foi fechado e a sinalização foi recolocada?" },
    { id: idTreino("2", 3), texto: "O operador foi informado do fim do serviço?" },
  ],
};

/** O checklist de inspeção da OS preventiva (pelo plano e item dela); vazio quando a OS não tem. */
export const checklistDaOs = (o: Pick<OsReg, "tipo" | "plano_manutencao" | "item_manutencao">): PerguntaDeInspecaoReg[] =>
  o.tipo === "preventiva" && o.plano_manutencao ? (CHECKLISTS_DE_INSPECAO[`${o.plano_manutencao.trim()}\u0000${o.item_manutencao?.trim() ?? ""}`] ?? []) : [];

/** Itens que uma APR com estes riscos marcados responde: a verificação mais as medidas dos riscos marcados. */
export const itensDaApr = (modelo: ModeloReg, riscos: string[]) => modelo.itens.filter((i) => i.secao === "verificacao" || (i.risco_id !== null && riscos.includes(i.risco_id)));

function aprDeHistorico(
  modelo: ModeloReg,
  d: {
    id: string;
    osId: string;
    por: UsuarioTreino;
    participantes: { u: UsuarioTreino; funcao: "responsavel" | "executor" }[];
    riscosMarcados: number[];
    concluidaEm: string;
    reprovados?: { itemId: string; observacao: string; foto?: string }[];
    observacaoGeral?: string;
    /**
     * Quem já assinou a APR (cada um na própria conta, uns minutos depois do registro). Padrão: todos os participantes da
     * APR aprovada; a bloqueada não é assinada, como na `api`.
     */
    assinadas?: string[];
  },
): AprReg {
  const riscos = d.riscosMarcados.map((n) => modelo.riscos[n - 1]!.id);
  const reprov = new Map((d.reprovados ?? []).map((r) => [r.itemId, r]));
  const evidencias: AprReg["evidencias"] = [];
  const respostas = itensDaApr(modelo, riscos).map((item) => {
    const r = reprov.get(item.id);
    if (r?.foto) evidencias.push({ id: idTreino("6", 500 + evidencias.length), arquivo_id: r.foto, item_id: item.id, capturada_em: d.concluidaEm, latitude: -23.55, longitude: -46.63 });
    return { item_id: item.id, resposta: (r ? "nao" : "sim") as "sim" | "nao", observacao: r?.observacao ?? null, respondida_em: d.concluidaEm };
  });
  const aprovada = reprov.size === 0;
  const assinadas = new Set(aprovada ? (d.assinadas ?? d.participantes.map((p) => p.u.id)) : []);
  return {
    id: d.id,
    os_id: d.osId,
    modelo_apr_id: modelo.id,
    preenchida_por: d.por.id,
    resultado: aprovada ? "aprovada" : "bloqueada",
    observacao_geral: d.observacaoGeral ?? null,
    concluida_em: d.concluidaEm,
    participantes: d.participantes.map((p, i) => {
      const assinou = assinadas.has(p.u.id);
      return {
        usuario_id: p.u.id,
        funcao: p.funcao,
        assinatura_path: assinou ? p.u.assinatura_path! : null,
        assinada_em: assinou ? new Date(new Date(d.concluidaEm).getTime() + (i + 1) * 90_000).toISOString() : null,
        assinatura_presencial: false,
        recusou_em: null,
        recusa_motivo: null,
      };
    }),
    riscos,
    respostas,
    evidencias,
  };
}

function registrarArquivos(estado: EstadoTreino) {
  const nova = (id: string, tipo: ArquivoReg["tipo"], rotulo: string) => estado.arquivos.set(id, { id, tipo, mime: "image/svg+xml", bytes: null, rotulo });
  for (const u of estado.usuarios) if (u.assinatura_path) nova(u.assinatura_path, "assinatura", u.nome);
  nova(idTreino("6", 1), "foto", "Talabarte com costura rompida");
  nova(idTreino("6", 2), "foto", "Para-raios inspecionado");
  nova(idTreino("6", 3), "foto", "Contador de descargas");
  nova(idTreino("6", 4), "foto", "Luminárias trocadas");
  nova(idTreino("6", 5), "foto", "Chave seccionadora após a limpeza");
}

/** Monta a massa inicial do técnico `real`, com os horários relativos a `agora`. */
export function criarEstadoInicial(real: Usuario, agora: Date = new Date()): EstadoTreino {
  const usuarios = criarUsuarios(real);
  const eu = usuarios[0]!;
  const [carlos, joana, paulo, marcos] = [usuarios[1]!, usuarios[2]!, usuarios[3]!, usuarios[4]!];
  const modelos = criarModelos(agora);
  const [modeloA, modeloB] = [modelos[0]!, modelos[1]!];
  const os = criarOs(agora);

  const estado: EstadoTreino = {
    dia: diaDe(agora),
    criadoEm: agora.toISOString(),
    equipe: { id: EQUIPE_TREINO.id, nome: EQUIPE_TREINO.nome, centro_trabalho: EQUIPE_TREINO.centro_trabalho, supervisor_id: marcos.id },
    usuarios,
    locais: LOCAIS.map((l) => ({ ...l })),
    modelos,
    os,
    aprs: [],
    execucoes: [],
    alertas: [],
    arquivos: new Map(),
    eventos: new Set(),
    proximoAlerta: 1,
  };
  registrarArquivos(estado);

  const osPor = (id: string) => os.find((o) => o.id === id)!;
  /** A assinatura final do supervisor (a "ciência" de antes): conclui a OS e só então o PDF é gerado. */
  const concluir = (id: string, quando: string) => {
    const o = osPor(id);
    o.status = "encerrada";
    o.ciencia_por = marcos.id;
    o.ciencia_em = quando;
    o.pdf_path = idTreino("7", Number(o.numero_ordem!.slice(-3)));
    o.pdf_em = new Date(new Date(quando).getTime() + 2 * 60_000).toISOString();
  };
  /** Hoje, no máximo `min` minutos atrás, mas nunca antes do começo do dia: a APR só vale no dia em que foi registrada. */
  const hojeAte = (min: number) => new Date(Math.max(agora.getTime() - min * 60_000, new Date(horario(agora, 0, 0, 1)).getTime())).toISOString();
  const depois = (instante: string, min: number) => new Date(new Date(instante).getTime() + min * 60_000).toISOString();
  const posicao = (latitude: number, longitude: number): PosicaoReg => ({ latitude, longitude });

  // OS pendente: a primeira APR foi bloqueada (talabarte), com foto e o alerta ao supervisor.
  const aprPendente = aprDeHistorico(modeloB, {
    id: idTreino("9", 4),
    osId: OS_PENDENTE,
    por: carlos,
    participantes: [
      { u: carlos, funcao: "responsavel" },
      { u: paulo, funcao: "executor" },
    ],
    riscosMarcados: [1, 2],
    concluidaEm: horario(agora, -1, 14, 5),
    reprovados: [{ itemId: MODELO_BLOQUEIO.itemEliminatorioId, observacao: "Talabarte com costura rompida; vai para descarte e será trocado antes de qualquer subida.", foto: idTreino("6", 1) }],
    observacaoGeral: "Serviço não iniciado. Aguardando talabarte novo do almoxarifado.",
  });
  estado.aprs.push(aprPendente);
  estado.alertas.push({
    id: idTreino("4", estado.proximoAlerta++),
    os_id: OS_PENDENTE,
    tipo: "bloqueio",
    detalhe: `APR bloqueada (1 item(ns) reprovado(s)): ${MODELO_BLOQUEIO.itemEliminatorioTexto} — Talabarte com costura rompida.`,
    destinatario_id: marcos.id,
    email_enviado_em: horario(agora, -1, 14, 6),
    lido_em: horario(agora, -1, 14, 30),
    criado_em: horario(agora, -1, 14, 5),
  });

  // OS em execução por um colega (hoje): APR aprovada e execução aberta.
  const aprEmExecucao = aprDeHistorico(modeloA, {
    id: idTreino("9", 5),
    osId: OS_EM_EXECUCAO_DE_COLEGA,
    por: paulo,
    participantes: [
      { u: paulo, funcao: "responsavel" },
      { u: joana, funcao: "executor" },
    ],
    riscosMarcados: [1],
    concluidaEm: minutosAntes(agora, 130),
  });
  estado.aprs.push(aprEmExecucao);
  estado.execucoes.push({
    id: idTreino("8", 5),
    os_id: OS_EM_EXECUCAO_DE_COLEGA,
    apr_id: aprEmExecucao.id,
    executor_id: paulo.id,
    numero_pessoas: 2,
    inicio: minutosAntes(agora, 95),
    fim: null,
    resultado: null,
    descricao_atividade: null,
    motivo: null,
    suspensao_motivo: null,
    suspensao_complemento: null,
    dados_inspecao: null,
    encerramento_assinado_em: null,
    localizacao_inicio: posicao(-23.5489, -46.6388),
    localizacao_fim: null,
    pausas: [],
    assinaturas: [],
    fotos: [],
  });
  osPor(OS_EM_EXECUCAO_DE_COLEGA).status = "em_execucao";

  // APR de hoje que espera a assinatura de quem treina: a Joana a registrou, ela e o Carlos já assinaram e falta o técnico.
  // É o que a faixa "APR aguardando a sua assinatura" da lista e `GET /me/aprs-para-assinar` mostram.
  estado.aprs.push(
    aprDeHistorico(modeloA, {
      id: idTreino("9", 8),
      osId: OS_CRITICA,
      por: joana,
      participantes: [
        { u: joana, funcao: "responsavel" },
        { u: carlos, funcao: "executor" },
        { u: eu, funcao: "executor" },
      ],
      riscosMarcados: [1, 2],
      concluidaEm: hojeAte(20),
      assinadas: [joana.id, carlos.id],
    }),
  );

  // OS encerrada ontem pelo próprio técnico (aparece no histórico do perfil).
  const aprEncerrada = aprDeHistorico(modeloA, {
    id: idTreino("9", 6),
    osId: OS_ENCERRADA_PELO_TECNICO,
    por: eu,
    participantes: [
      { u: eu, funcao: "responsavel" },
      { u: carlos, funcao: "executor" },
    ],
    riscosMarcados: [1, 3],
    concluidaEm: horario(agora, -1, 8, 10),
  });
  estado.aprs.push(aprEncerrada);
  estado.execucoes.push({
    id: idTreino("8", 6),
    os_id: OS_ENCERRADA_PELO_TECNICO,
    apr_id: aprEncerrada.id,
    executor_id: eu.id,
    numero_pessoas: 2,
    inicio: horario(agora, -1, 8, 40),
    fim: horario(agora, -1, 15, 20),
    resultado: "encerrada",
    descricao_atividade: "Inspeção visual dos três para-raios do alimentador 07. Porcelana íntegra, conexões firmes e contadores de descarga sem alteração.",
    motivo: null,
    suspensao_motivo: null,
    suspensao_complemento: null,
    dados_inspecao: null,
    encerramento_assinado_em: horario(agora, -1, 15, 34),
    localizacao_inicio: posicao(-23.5505, -46.6333),
    localizacao_fim: posicao(-23.5507, -46.6331),
    pausas: [
      {
        id: idTreino("7", 6),
        inicio: horario(agora, -1, 11, 50),
        fim: horario(agora, -1, 12, 50),
        motivo: "almoco",
        complemento: null,
        localizacao: posicao(-23.5506, -46.6332),
      },
    ],
    // No fim assina só o responsável; o Carlos assinou a APR, no começo.
    assinaturas: [{ usuario_id: eu.id, assinatura_path: eu.assinatura_path!, assinada_em: horario(agora, -1, 15, 34) }],
    fotos: [
      { id: idTreino("6", 12), foto_path: idTreino("6", 2), capturada_em: horario(agora, -1, 10, 15), latitude: -23.55, longitude: -46.63 },
      { id: idTreino("6", 13), foto_path: idTreino("6", 3), capturada_em: horario(agora, -1, 14, 40), latitude: null, longitude: null },
    ],
  });
  concluir(OS_ENCERRADA_PELO_TECNICO, horario(agora, -1, 17, 40));

  // OS encerrada há alguns dias por um colega.
  const aprColega = aprDeHistorico(modeloA, {
    id: idTreino("9", 7),
    osId: OS_ENCERRADA_DE_COLEGA,
    por: carlos,
    participantes: [
      { u: carlos, funcao: "responsavel" },
      { u: joana, funcao: "executor" },
    ],
    riscosMarcados: [2],
    concluidaEm: horario(agora, -3, 7, 50),
  });
  estado.aprs.push(aprColega);
  estado.execucoes.push({
    id: idTreino("8", 7),
    os_id: OS_ENCERRADA_DE_COLEGA,
    apr_id: aprColega.id,
    executor_id: carlos.id,
    numero_pessoas: 2,
    inicio: horario(agora, -3, 8, 15),
    fim: horario(agora, -3, 10, 45),
    resultado: "encerrada",
    descricao_atividade: "Substituídas as oito luminárias queimadas por modelos de LED de 60 W; teste de acendimento com o fotocélula.",
    motivo: null,
    suspensao_motivo: null,
    suspensao_complemento: null,
    dados_inspecao: null,
    encerramento_assinado_em: horario(agora, -3, 10, 58),
    // Sem GPS no começo (local coberto): fica registrado "sem localização" e o serviço não é bloqueado.
    localizacao_inicio: null,
    localizacao_fim: posicao(-23.5431, -46.6291),
    pausas: [
      {
        id: idTreino("7", 7),
        inicio: horario(agora, -3, 9, 20),
        fim: horario(agora, -3, 9, 45),
        motivo: "aguardando",
        complemento: "Peça do almoxarifado (relé fotoelétrico)",
        localizacao: posicao(-23.5432, -46.629),
      },
    ],
    assinaturas: [{ usuario_id: carlos.id, assinatura_path: carlos.assinatura_path!, assinada_em: horario(agora, -3, 10, 58) }],
    fotos: [{ id: idTreino("6", 14), foto_path: idTreino("6", 4), capturada_em: horario(agora, -3, 10, 30), latitude: null, longitude: null }],
  });
  concluir(OS_ENCERRADA_DE_COLEGA, horario(agora, -3, 14, 10));

  // Execução do técnico que já terminou (o tempo parou no "Encerrar OS"): a OS está `encerrando` até ele preencher e assinar.
  const aprEncerrando = aprDeHistorico(modeloB, {
    id: idTreino("9", 9),
    osId: OS_ENCERRANDO,
    por: eu,
    participantes: [
      { u: eu, funcao: "responsavel" },
      { u: paulo, funcao: "executor" },
    ],
    riscosMarcados: [1, 3],
    concluidaEm: hojeAte(190),
  });
  estado.aprs.push(aprEncerrando);
  estado.execucoes.push({
    id: idTreino("8", 9),
    os_id: OS_ENCERRANDO,
    apr_id: aprEncerrando.id,
    executor_id: eu.id,
    numero_pessoas: 2,
    inicio: hojeAte(170),
    fim: hojeAte(12),
    resultado: "encerrada",
    descricao_atividade: null,
    motivo: null,
    suspensao_motivo: null,
    suspensao_complemento: null,
    dados_inspecao: null,
    encerramento_assinado_em: null,
    localizacao_inicio: posicao(-23.5629, -46.6544),
    localizacao_fim: posicao(-23.5631, -46.6542),
    pausas: [],
    assinaturas: [],
    fotos: [],
  });

  // OS de um colega já assinada por ele: espera o supervisor ler o relatório e assinar por último.
  const aprAguardando = aprDeHistorico(modeloA, {
    id: idTreino("9", 10),
    osId: OS_AGUARDANDO_SUPERVISOR,
    por: carlos,
    participantes: [
      { u: carlos, funcao: "responsavel" },
      { u: joana, funcao: "executor" },
    ],
    riscosMarcados: [2],
    concluidaEm: horario(agora, -1, 9, 0),
  });
  estado.aprs.push(aprAguardando);
  const encerramentoDoColega = horario(agora, -1, 16, 12);
  estado.execucoes.push({
    id: idTreino("8", 10),
    os_id: OS_AGUARDANDO_SUPERVISOR,
    apr_id: aprAguardando.id,
    executor_id: carlos.id,
    numero_pessoas: 2,
    inicio: horario(agora, -1, 9, 30),
    fim: horario(agora, -1, 15, 55),
    resultado: "encerrada",
    descricao_atividade: "Trocadas quatro lâmpadas e o relé fotoelétrico; teste de acendimento ao anoitecer sem ocorrências.",
    motivo: null,
    suspensao_motivo: null,
    suspensao_complemento: null,
    dados_inspecao: null,
    encerramento_assinado_em: encerramentoDoColega,
    localizacao_inicio: posicao(-23.5433, -46.6288),
    localizacao_fim: posicao(-23.5434, -46.6287),
    pausas: [],
    assinaturas: [{ usuario_id: carlos.id, assinatura_path: carlos.assinatura_path!, assinada_em: encerramentoDoColega }],
    fotos: [],
  });
  estado.alertas.push({
    id: idTreino("4", estado.proximoAlerta++),
    os_id: OS_AGUARDANDO_SUPERVISOR,
    tipo: "os_para_assinar",
    detalhe: `OS 4900111 encerrada por ${carlos.nome}: leia o relatório da execução e assine para concluir a OS.`,
    destinatario_id: marcos.id,
    email_enviado_em: depois(encerramentoDoColega, 1),
    lido_em: null,
    criado_em: encerramentoDoColega,
  });

  osPor(OS_PENDENTE).status = "pendente";
  return estado;
}

/**
 * Status da OS derivado das APRs e execuções, na mesma ordem das regras da `api` (`dominio/status-os.ts`): cancelada e
 * devolvida ficam; havendo execução encerrada (o clique em "Encerrar OS", que para o tempo), `encerrando` até o responsável
 * assinar o encerramento, `aguardando_supervisor` até o supervisor dar a assinatura final e só então `encerrada` (concluída);
 * em execução se há uma aberta; pendente se há APR bloqueada ou execução interrompida/suspensa; senão liberada. A execução
 * cancelada por engano não conta.
 */
export function statusDerivado(estado: EstadoTreino, o: OsReg): OsStatus {
  if (o.status === "cancelada" || o.status === "devolvida") return o.status;
  const execs = estado.execucoes.filter((e) => e.os_id === o.id && e.resultado !== "cancelada");
  const encerrada = execs.find((e) => e.resultado === "encerrada");
  if (encerrada) return encerrada.encerramento_assinado_em === null ? "encerrando" : o.ciencia_em ? "encerrada" : "aguardando_supervisor";
  if (execs.some((e) => e.resultado === null)) return "em_execucao";
  if (execs.some((e) => e.resultado === "interrompida" || e.resultado === "suspensa")) return "pendente";
  return estado.aprs.some((a) => a.os_id === o.id && a.resultado === "bloqueada") ? "pendente" : "liberada";
}

// ---------------------------------------------------------------------------------------------------------------
// Os personagens fictícios agem sozinhos
// ---------------------------------------------------------------------------------------------------------------

/** Depois de quanto tempo, a contar do registro da APR, o primeiro colega fictício a assina (cada colega seguinte, `ENTRE_COLEGAS_MS` depois). */
const COLEGA_ASSINA_APOS_MS = 4_000;
const ENTRE_COLEGAS_MS = 3_000;
/** Depois de quanto tempo da assinatura do encerramento o supervisor fictício dá a assinatura final. */
const SUPERVISOR_ASSINA_APOS_MS = 45_000;
/** O PDF fica pronto uns segundos depois da assinatura final, como a tarefa em segundo plano da `api`. */
const PDF_PRONTO_APOS_MS = 3_000;

/**
 * Faz os colegas fictícios agirem no tempo que passou, a cada chamada da API fictícia (o treino não tem outras contas):
 * - cada colega com assinatura no perfil que é participante de uma APR de hoje, ainda não usada, assina a própria parte alguns
 *   segundos depois do registro, na ordem da lista; quem treina assina a dele pela tela (`apr_assinada`), e a tela de
 *   assinaturas vê "pendente" virar "assinou" sozinha;
 * - o supervisor fictício dá a assinatura final (a "ciência") na OS que o técnico encerrou e assinou, `SUPERVISOR_ASSINA_APOS_MS`
 *   depois: a OS passa a `encerrada` e o PDF é gerado. As OS dos colegas ficam esperando, para o treino mostrar o estado.
 * Os instantes gravados são os do momento em que a pessoa "agiu" (não o da leitura), então o histórico fica coerente.
 */
export function avancarFicticios(e: EstadoTreino, usuarioId: string, agora: Date): void {
  const agoraMs = agora.getTime();
  for (const a of e.aprs) {
    if (a.resultado !== "aprovada" || diaDe(a.concluida_em) !== diaDe(agora)) continue;
    if (e.execucoes.some((x) => x.apr_id === a.id && x.resultado !== "cancelada")) continue;
    let ordem = 0;
    for (const p of a.participantes) {
      if (p.usuario_id === usuarioId || p.assinada_em || p.recusou_em) continue;
      const assinatura = e.usuarios.find((u) => u.id === p.usuario_id)?.assinatura_path;
      if (!assinatura) continue;
      const quando = new Date(a.concluida_em).getTime() + COLEGA_ASSINA_APOS_MS + ordem++ * ENTRE_COLEGAS_MS;
      if (quando > agoraMs) continue;
      p.assinatura_path = assinatura;
      p.assinada_em = new Date(quando).toISOString();
    }
  }

  for (const o of e.os) {
    if (o.status !== "aguardando_supervisor" || o.ciencia_em) continue;
    const x = e.execucoes.find((y) => y.os_id === o.id && y.resultado === "encerrada" && y.executor_id === usuarioId && y.encerramento_assinado_em);
    if (!x) continue;
    const quando = new Date(x.encerramento_assinado_em!).getTime() + SUPERVISOR_ASSINA_APOS_MS;
    if (quando > agoraMs) continue;
    o.ciencia_por = e.equipe.supervisor_id;
    o.ciencia_em = new Date(quando).toISOString();
    o.status = statusDerivado(e, o);
    o.pdf_path = idTreino("7", Number(o.numero_ordem?.slice(-3) ?? "0") || 1);
    o.pdf_em = new Date(quando + PDF_PRONTO_APOS_MS).toISOString();
  }
}
