import type { RegraCodigo } from "../db/schema";

/**
 * O catálogo das tarefas que pontuam (seção 2.1 do `gameficacao.md`). O banco guarda só o que o admin muda (`pontos` e
 * `ativa`, em `regra_pontuacao`); o nome, a descrição e as explicações de quem ganha, quando conta e qual é o limite são fixos
 * aqui, porque as regras em si estão no código (`pontuacao.ts`).
 */
export interface DescricaoDaRegra {
  nome: string;
  /** Uma frase: o que a tarefa premia. */
  descricao: string;
  /** O valor da carga inicial. */
  pontos: number;
  grupo: GrupoDeRegras;
  quem: string;
  quando: string;
  limite: string;
}

export const GRUPOS_DE_REGRAS = ["Principais", "Bônus da OS", "Boas-vindas", "Supervisor", "Conquistas"] as const;
export type GrupoDeRegras = (typeof GRUPOS_DE_REGRAS)[number];

export const REGRAS: Record<RegraCodigo, DescricaoDaRegra> = {
  apr_completa: {
    nome: "APR completa",
    descricao: "Preencher e registrar a APR da OS.",
    pontos: 10,
    grupo: "Principais",
    quem: "Todos os participantes da APR.",
    quando: "APR aprovada: quando ela chega com as assinaturas. APR bloqueada: quando chega a evidência dos itens reprovados (sem a evidência, não pontua).",
    limite: "Uma por pessoa, por OS.",
  },
  execucao_concluida: {
    nome: "Execução concluída",
    descricao: "Concluir o serviço da OS, encerrado ou interrompido por risco.",
    pontos: 10,
    grupo: "Principais",
    quem: "Todos os participantes da APR que amparou a execução.",
    quando: "OS encerrada com as assinaturas de todos, ou execução interrompida por risco.",
    limite: "Uma por pessoa, por OS.",
  },
  responsavel_apr: {
    nome: "Responsável pela APR",
    descricao: "Liderar a APR: quem a lidera responde por ela.",
    pontos: 5,
    grupo: "Bônus da OS",
    quem: "O participante responsável pela APR.",
    quando: "Junto com a APR completa, aprovada ou bloqueada.",
    limite: "Uma por pessoa, por OS.",
  },
  preventiva_concluida: {
    nome: "Preventiva concluída",
    descricao: "Concluir uma OS preventiva: a preventiva vale o dobro da corretiva.",
    pontos: 10,
    grupo: "Bônus da OS",
    quem: "Todos os participantes da APR que amparou a execução, na OS preventiva, inclusive quem interrompeu por risco.",
    quando: "Junto com a execução concluída (encerrada ou interrompida), quando a OS é preventiva. Se o administrador mudar o valor da execução concluída, convém mudar este para manter o dobro.",
    limite: "Uma por pessoa, por OS.",
  },
  preventiva_em_dia: {
    nome: "Preventiva em dia",
    descricao: "Encerrar a preventiva dentro do prazo, ou com atraso justificado.",
    pontos: 5,
    grupo: "Bônus da OS",
    quem: "Quem concluiu a execução na OS, inclusive quem interrompeu por risco.",
    quando:
      "Quando a preventiva é encerrada até a data limite (o fim programado ou, sem ele, o início), ou depois dela com atraso justificado: a OS ficou pendente antes da data ou foi reprogramada.",
    limite: "Uma por pessoa, por OS.",
  },
  local_critico: {
    nome: "Local crítico",
    descricao: "Trabalhar num local que a gerência prioriza.",
    pontos: 5,
    grupo: "Bônus da OS",
    quem: "Quem concluiu a execução na OS.",
    quando: "Junto com a execução concluída (encerrada ou interrompida), quando o local da OS é crítico.",
    limite: "Uma por pessoa, por OS.",
  },
  resgate: {
    nome: "Resgate",
    descricao: "Retomar uma OS que ficou pendente por APR bloqueada ou por interrupção de outras pessoas.",
    pontos: 5,
    grupo: "Bônus da OS",
    quem: "Quem concluiu a execução de uma OS pendente por APR bloqueada ou execução interrompida de outras pessoas.",
    quando: "Junto com a execução concluída. Quem participou de alguma tentativa anterior da OS não ganha; a suspensão no fim do expediente não conta como pendência.",
    limite: "Uma por pessoa, por OS.",
  },
  apoio: {
    nome: "Apoio a outra equipe",
    descricao: "Ajudar quem precisou, concluindo uma OS de apoio.",
    pontos: 5,
    grupo: "Bônus da OS",
    quem: "Quem concluiu a execução de uma OS de apoio.",
    quando: "Junto com a execução concluída.",
    limite: "Uma por pessoa, por OS.",
  },
  tecnico_novo: {
    nome: "Técnico novo acompanhado",
    descricao: "Levar para campo quem está chegando.",
    pontos: 5,
    grupo: "Bônus da OS",
    quem: "O responsável pela APR.",
    quando: "Junto com a APR completa, quando outro participante tem a conta há menos de 60 dias.",
    limite: "Uma por OS.",
  },
  assinatura_cadastrada: {
    nome: "Assinatura cadastrada",
    descricao: "Cadastrar a assinatura no perfil.",
    pontos: 5,
    grupo: "Boas-vindas",
    quem: "O técnico.",
    quando: "Ao cadastrar a assinatura no perfil.",
    limite: "Uma por conta.",
  },
  treinamento_concluido: {
    nome: "Campo de treino concluído",
    descricao: "Concluir o Campo de treino.",
    pontos: 10,
    grupo: "Boas-vindas",
    quem: "O técnico.",
    quando: "Quando o treino passa a concluído.",
    limite: "Uma por conta.",
  },
  ciencia_no_prazo: {
    nome: "Ciência no prazo",
    descricao: "Dar a ciência da OS encerrada em até 72 horas.",
    pontos: 3,
    grupo: "Supervisor",
    quem: "O supervisor que deu a ciência.",
    quando: "Até 72 horas depois do encerramento da OS (cobre o fim de semana).",
    limite: "Uma por OS.",
  },
  intervalo_definido: {
    nome: "Intervalo de preventiva definido",
    descricao: "Definir o intervalo de um plano de preventiva que estava sem.",
    pontos: 3,
    grupo: "Supervisor",
    quem: "O supervisor que definiu o intervalo.",
    quando: "Ao definir o intervalo de um plano que estava sem.",
    limite: "Uma por plano.",
  },
  conquista_obtida: {
    nome: "Conquista obtida",
    descricao: "Ganhar um troféu. O valor vem de cada conquista.",
    pontos: 0,
    grupo: "Conquistas",
    quem: "A pessoa que obteve a conquista.",
    quando: "Quando a conquista é concedida. Só as conquistas de pessoa dão pontos; as de equipe, não.",
    limite: "Uma por conquista.",
  },
};

/** A ordem em que as tarefas aparecem (a da tabela da seção 2.1). */
export const ORDEM_DAS_REGRAS: RegraCodigo[] = [
  "apr_completa",
  "execucao_concluida",
  "responsavel_apr",
  "preventiva_concluida",
  "preventiva_em_dia",
  "local_critico",
  "resgate",
  "apoio",
  "tecnico_novo",
  "assinatura_cadastrada",
  "treinamento_concluido",
  "ciencia_no_prazo",
  "intervalo_definido",
  "conquista_obtida",
];

/** O que não pontua, e por quê (seção 2.2): a página "Como pontuar" mostra a lista inteira. */
export const NAO_PONTUAM: { o_que: string; por_que: string }[] = [
  { o_que: "Sincronização offline → online", por_que: "Pontuaria desligar o sinal de propósito, e o sistema é online primeiro. O que foi feito offline pontua normalmente quando chega." },
  { o_que: "Iniciar a execução", por_que: "Premiaria começar sem terminar." },
  { o_que: "Pausa, suspensão (fim do expediente) e cancelamento por engano", por_que: "A OS continua; os pontos vêm quando a execução é concluída." },
  { o_que: "Evidência a mais (fotos e PDFs além do exigido), observação e descrição longas", por_que: "Inflariam anexos e textos de enchimento." },
  { o_que: "Bônus por bloqueio ou interrupção", por_que: "Faria bloquear para não trabalhar." },
  { o_que: "Ler o alerta de bloqueio e tratar a OS pendente (supervisor)", por_que: "Dependeriam do número de bloqueios da equipe." },
  { o_que: "Reprogramar e abrir OS de apoio (supervisor)", por_que: "São decisões de planejamento; pontuar empurraria a decisão. Reprogramar ainda torna o atraso justificado." },
  { o_que: "Ciência depois de 72 horas", por_que: "O ponto é pela ciência em dia." },
  { o_que: "Entrar no sistema todo dia", por_que: "Não é trabalho." },
  { o_que: "Checklist de inspeção da preventiva", por_que: "Ele é obrigatório para encerrar a OS, então um bônus pontuaria o encerramento duas vezes. O incentivo às preventivas está na tarefa \"Preventiva concluída\"." },
  { o_que: "Ações do administrador", por_que: "O administrador não joga: não pontua e não aparece no ranking." },
];

/** As regras do jogo (seção 1), em linguagem simples, para a página "Como pontuar". */
export const REGRAS_DO_JOGO: string[] = [
  "A segurança não custa pontos. APR bloqueada vale o mesmo que aprovada, e execução interrompida por risco vale o mesmo que encerrada, com os mesmos bônus.",
  "O técnico continua sem saber o que é eliminatório: nenhuma regra nem conquista olha a resposta de um item da APR.",
  "Só o servidor calcula os pontos, a partir do que foi registrado. Reenviar um registro não pontua de novo.",
  "Quem quiser fica anônimo no ranking: os pontos continuam valendo para a pessoa e para a equipe.",
  "Quem trabalha mais ganha mais: a pontuação soma tarefas, e quem tem mais OS recebe mais pontos.",
  "O administrador não joga: não pontua e não aparece no ranking.",
];
