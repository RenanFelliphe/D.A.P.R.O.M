/** Checklist da APR 03 (Operação e manutenção) usado nas telas de demonstração. */

export type Resposta = "sim" | "nao";

export interface PerguntaApr {
  texto: string;
  secao: string;
  /** Eliminatória bloqueia a OS; alerta só registra. */
  tipo: "elim" | "alerta";
  /** Resposta que reprova (eliminatória) ou gera alerta; null = medida preventiva. */
  critica: Resposta | null;
  /** Resposta esperada quando está tudo certo. */
  ok: Resposta;
  /** Resposta usada no fluxo de demonstração, quando difere de `ok`. */
  demo?: Resposta;
  /** "texto": a evidência é uma justificativa e a foto é opcional. */
  evidencia?: "texto";
  dica: string;
}

export const perguntasApr03: PerguntaApr[] = [
  { texto: "Todos os participantes estão em boas condições físicas e psicológicas?", secao: "Verificação · Equipe", tipo: "elim", critica: "nao", ok: "sim", evidencia: "texto", dica: "Considere cansaço, medicação e estado emocional. Cada pessoa tem direito de recusa." },
  { texto: "Todos usam EPI completo e em bom estado?", secao: "Verificação · Equipe", tipo: "elim", critica: "nao", ok: "sim", dica: "Capacete, luvas, botina, óculos e colete." },
  { texto: "A atividade será feita em dupla, com responsável definido?", secao: "Verificação · Equipe", tipo: "elim", critica: "nao", ok: "sim", dica: "Ninguém trabalha sozinho." },
  { texto: "Os participantes estão sem adornos (anéis, correntes, relógio)?", secao: "Verificação · Equipe", tipo: "elim", critica: "nao", ok: "sim", dica: "" },
  { texto: "Há necessidade de iluminação auxiliar?", secao: "Verificação · Ambiente", tipo: "alerta", critica: "sim", ok: "nao", demo: "sim", dica: "Se sim, fica registrado como alerta e não bloqueia." },
  { texto: "A equipe sabe onde fica o atendimento médico mais próximo?", secao: "Verificação · Emergência", tipo: "elim", critica: "nao", ok: "sim", dica: "" },
  { texto: "A equipe está apta a realizar um resgate de emergência no local?", secao: "Verificação · Emergência", tipo: "elim", critica: "nao", ok: "sim", dica: "Considere tripé, cordas e o treinamento dos participantes presentes." },
  { texto: "Os equipamentos elétricos são adequados para atmosfera com gás?", secao: "Verificação · Ambiente", tipo: "elim", critica: "nao", ok: "sim", dica: "Celulares e lanternas comuns podem gerar fagulha." },
  { texto: "Existe algum impedimento para realizar a atividade?", secao: "Verificação · Impedimentos", tipo: "elim", critica: "sim", ok: "nao", dica: "Exemplo: caixa de válvula alagada, acesso negado, risco no local." },
  { texto: "Sinalizar e isolar a área de trabalho", secao: "Medida preventiva", tipo: "alerta", critica: null, ok: "sim", dica: "" },
  { texto: "Usar detector de gás calibrado durante toda a atividade", secao: "Medida preventiva", tipo: "alerta", critica: null, ok: "sim", dica: "" },
  { texto: "Extintor disponível e dentro da validade", secao: "Medida preventiva", tipo: "alerta", critica: null, ok: "sim", dica: "" },
  { texto: "Veículo posicionado fora da zona de risco", secao: "Medida preventiva", tipo: "alerta", critica: null, ok: "sim", dica: "" },
  { texto: "Ferramentas antifaiscantes disponíveis", secao: "Medida preventiva", tipo: "alerta", critica: null, ok: "sim", dica: "" },
  { texto: "Celulares desligados ou fora da área classificada", secao: "Medida preventiva", tipo: "alerta", critica: null, ok: "sim", dica: "" },
  { texto: "Condições climáticas permitem a atividade", secao: "Medida preventiva", tipo: "alerta", critica: null, ok: "sim", dica: "" },
  { texto: "Plano de emergência do cliente conhecido pela equipe", secao: "Medida preventiva", tipo: "alerta", critica: null, ok: "sim", dica: "" },
  { texto: "Contatos de emergência conferidos", secao: "Medida preventiva", tipo: "alerta", critica: null, ok: "sim", dica: "" },
];

/** Resposta do fluxo de demonstração para uma pergunta. */
export function respostaDemo(pergunta: PerguntaApr): Resposta {
  return pergunta.demo ?? pergunta.ok;
}
