/** Dados da tela "APR bloqueada" (BLOCK_DEFAULT e o bloqueio por interrupção do protótipo). */

export interface ItemReprovado {
  label: string;
  pergunta: string;
  resposta: string;
  comFoto: boolean;
  observacao: string;
}

export type VarianteBloqueio = "apr" | "interrupcao";

export interface Bloqueio {
  variante: VarianteBloqueio;
  cabecalho: string;
  subtitulo: string;
  titulo: string;
  descricao: string;
  itens: ItemReprovado[];
}

export const bloqueios: Record<VarianteBloqueio, Bloqueio> = {
  apr: {
    variante: "apr",
    cabecalho: "APR · Rede Vila Velha",
    subtitulo: "OS 4030877 · APR 03 v4 · 12/10 09:14",
    titulo: "Atividade impedida",
    descricao:
      "Um item eliminatório teve resposta bloqueante. A OS fica pendente e a execução não pode começar. Uma nova APR, de qualquer pessoa da equipe, pode liberá-la.",
    itens: [
      {
        label: "Pergunta 9 · Eliminatório",
        pergunta: "Existe algum impedimento para realizar a atividade?",
        resposta: "Resposta: Sim",
        comFoto: true,
        observacao:
          "Caixa de válvula com água até a borda. É preciso bombeamento e limpeza pela manutenção civil antes da intervenção.",
      },
    ],
  },
  interrupcao: {
    variante: "interrupcao",
    cabecalho: "OS 4031187 · ERP Serra",
    subtitulo: "APR 03 v4 · execução em andamento",
    titulo: "Execução interrompida",
    descricao:
      "A execução para por risco. A OS fica pendente e o supervisor é avisado; para retomar, é preciso uma APR nova.",
    itens: [],
  },
};
