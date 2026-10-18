/**
 * Os motivos obrigatórios da pausa e da suspensão (Reunião 3, itens 6 e 7). Os valores são os que a `api` aceita em
 * `pausa_iniciada` e `execucao_suspensa`; o complemento é obrigatório nos motivos que o pedem (`aguardando` e `outro`).
 */

export interface OpcaoDeMotivo {
  valor: string;
  rotulo: string;
  /** O campo de texto que o motivo abre: obrigatório (aguardando, outro), ou opcional (lesão e enfermidade: "o que aconteceu", que vai no aviso ao supervisor). */
  complemento?: { rotulo: string; dica: string; faltou: string; opcional?: boolean };
  /** Lesão e enfermidade avisam o supervisor na hora (sino e e-mail) e constam no relatório. */
  avisaSupervisor?: boolean;
}

/** Lesão e enfermidade: avisam o supervisor na hora, e o relato do que aconteceu é opcional. */
const aconteceu = { rotulo: "O que aconteceu (opcional)", dica: "Se quiser, conte o que aconteceu: o texto vai no aviso ao supervisor", faltou: "", opcional: true };

const outro: OpcaoDeMotivo = {
  valor: "outro",
  rotulo: "Outro",
  complemento: { rotulo: "Descrição", dica: "Descreva o motivo", faltou: "Descreva o motivo: ao escolher “Outro”, a descrição é obrigatória." },
};

export const MOTIVOS_DA_PAUSA: OpcaoDeMotivo[] = [
  { valor: "almoco", rotulo: "Almoço" },
  {
    valor: "aguardando",
    rotulo: "Aguardando",
    complemento: { rotulo: "O que ou quem", dica: "Ex.: peça, cliente, outra equipe", faltou: "Diga o que ou quem você está aguardando." },
  },
  { valor: "descanso", rotulo: "Descanso" },
  { valor: "clima", rotulo: "Condição climática" },
  { valor: "enfermidade", rotulo: "Enfermidade", avisaSupervisor: true, complemento: aconteceu },
  { valor: "lesao", rotulo: "Lesão", avisaSupervisor: true, complemento: aconteceu },
  outro,
];

export const MOTIVOS_DA_SUSPENSAO: OpcaoDeMotivo[] = [
  { valor: "enfermidade", rotulo: "Enfermidade", avisaSupervisor: true, complemento: aconteceu },
  { valor: "lesao", rotulo: "Lesão", avisaSupervisor: true, complemento: aconteceu },
  { valor: "fim_expediente", rotulo: "Fim de expediente" },
  { valor: "clima", rotulo: "Condição climática" },
  { valor: "falta_material", rotulo: "Falta de material ou equipamento" },
  outro,
];

/** O rótulo de um motivo já gravado ("clima" → "Condição climática"); o valor desconhecido volta como veio. */
export function rotuloDoMotivo(valor: string | null | undefined): string {
  if (!valor) return "Sem motivo";
  return [...MOTIVOS_DA_PAUSA, ...MOTIVOS_DA_SUSPENSAO].find((o) => o.valor === valor)?.rotulo ?? valor;
}
