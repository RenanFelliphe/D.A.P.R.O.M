/** Dados da tela "Nova APR" do app (etapa 1: participantes). */

export const etapasApr = ["1 · Participantes", "2 · Checklist", "3 · Assinaturas"];

export interface ParticipanteApr {
  matricula: string;
  iniciais: string;
  /** Variação de cor do avatar (.av2, .av3). */
  avatar?: "av2" | "av3";
  nome: string;
  /** Texto abaixo do nome, depois de "mat. ". */
  detalhe: string;
  marcado: boolean;
  /** Quem está logado: nome acompanhado de "(você)" e linha que cresce. */
  voce?: boolean;
  papel?: { rotulo: string; tone: "dark" | "neu" };
  /** Nome em tom mais claro (pessoa que está em outra OS). */
  esmaecido?: boolean;
}

export const participantesApr: ParticipanteApr[] = [
  {
    matricula: "10482",
    iniciais: "CM",
    nome: "Carlos Menezes (você)",
    detalhe: "10482",
    marcado: true,
    voce: true,
    papel: { rotulo: "Responsável", tone: "dark" },
  },
  {
    matricula: "12077",
    iniciais: "DR",
    avatar: "av2",
    nome: "Diego Rocha",
    detalhe: "12077",
    marcado: true,
    papel: { rotulo: "Executor", tone: "neu" },
  },
  {
    matricula: "11350",
    iniciais: "FL",
    avatar: "av3",
    nome: "Fernanda Lopes",
    detalhe: "11350 · em outra OS",
    marcado: false,
    esmaecido: true,
  },
];
