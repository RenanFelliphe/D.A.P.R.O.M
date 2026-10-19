/**
 * Os sons do jogo dos treinamentos de serviço, sintetizados na hora (Web Audio): nenhum arquivo para baixar, o que importa
 * para quem treina com a conexão do campo. São curtos e baixos; a pessoa desliga no alto-falante da janela do jogo, e a
 * escolha fica guardada no aparelho. Sem Web Audio (ou com o navegador bloqueando), o jogo segue mudo, sem erro.
 */

export type SomDoJogo = "toque" | "pagina" | "acerto" | "erro" | "sequencia" | "contagem" | "valendo" | "estrela" | "vitoria";

const CHAVE = "synq-treinamento-som";

let contexto: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!contexto) {
    const Construtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Construtor) return null;
    contexto = new Construtor();
  }
  // O navegador só libera o áudio depois de um toque; todo som do jogo nasce de um, então basta retomar aqui.
  if (contexto.state === "suspended") void contexto.resume();
  return contexto;
}

interface Nota {
  freq: number;
  /** Segundos depois do começo do som. */
  em?: number;
  dur: number;
  tipo?: OscillatorType;
  volume?: number;
  /** Desliza a altura até esta frequência (o "buzz" do erro, o "zip" da página). */
  ate?: number;
}

function tocarNotas(c: AudioContext, notas: Nota[]) {
  const agora = c.currentTime;
  for (const n of notas) {
    const inicio = agora + (n.em ?? 0);
    const osc = c.createOscillator();
    const ganho = c.createGain();
    osc.type = n.tipo ?? "sine";
    osc.frequency.setValueAtTime(n.freq, inicio);
    if (n.ate) osc.frequency.exponentialRampToValueAtTime(n.ate, inicio + n.dur);
    ganho.gain.setValueAtTime(0.0001, inicio);
    ganho.gain.exponentialRampToValueAtTime(n.volume ?? 0.07, inicio + 0.012);
    ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + n.dur);
    osc.connect(ganho).connect(c.destination);
    osc.start(inicio);
    osc.stop(inicio + n.dur + 0.03);
  }
}

// Notas: dó 523, mi 659, sol 784, dó agudo 1047.
const SONS: Record<SomDoJogo, Nota[]> = {
  toque: [{ freq: 740, dur: 0.06, volume: 0.035 }],
  pagina: [{ freq: 420, ate: 640, dur: 0.09, volume: 0.03 }],
  acerto: [
    { freq: 659, dur: 0.12, tipo: "triangle", volume: 0.09 },
    { freq: 988, em: 0.09, dur: 0.22, tipo: "triangle", volume: 0.09 },
  ],
  erro: [
    { freq: 220, ate: 150, dur: 0.28, tipo: "sawtooth", volume: 0.035 },
    { freq: 196, ate: 130, em: 0.12, dur: 0.28, tipo: "triangle", volume: 0.05 },
  ],
  sequencia: [
    { freq: 659, dur: 0.1, tipo: "triangle", volume: 0.08 },
    { freq: 784, em: 0.08, dur: 0.1, tipo: "triangle", volume: 0.08 },
    { freq: 1047, em: 0.16, dur: 0.26, tipo: "triangle", volume: 0.09 },
  ],
  contagem: [{ freq: 523, dur: 0.14, tipo: "square", volume: 0.035 }],
  valendo: [
    { freq: 784, dur: 0.12, tipo: "square", volume: 0.04 },
    { freq: 1047, em: 0.1, dur: 0.3, tipo: "square", volume: 0.045 },
  ],
  estrela: [{ freq: 1175, dur: 0.16, tipo: "triangle", volume: 0.07 }],
  vitoria: [
    { freq: 523, dur: 0.14, tipo: "triangle", volume: 0.08 },
    { freq: 659, em: 0.13, dur: 0.14, tipo: "triangle", volume: 0.08 },
    { freq: 784, em: 0.26, dur: 0.14, tipo: "triangle", volume: 0.08 },
    { freq: 1047, em: 0.39, dur: 0.42, tipo: "triangle", volume: 0.09 },
  ],
};

export function tocarSom(som: SomDoJogo) {
  try {
    const c = audio();
    if (c) tocarNotas(c, SONS[som]);
  } catch {
    // Sem som, o jogo continua igual.
  }
}

/** Um toque curto no celular junto do som (acerto: um; erro: dois). Onde não há vibração, não faz nada. */
export function vibrar(padrao: number | number[]) {
  try {
    navigator.vibrate?.(padrao);
  } catch {
    // Sem vibração.
  }
}

/** O som começa ligado; desligado uma vez, fica desligado neste aparelho. */
export function somLigadoSalvo(): boolean {
  try {
    return window.localStorage.getItem(CHAVE) !== "0";
  } catch {
    return true;
  }
}

export function guardarSomLigado(ligado: boolean) {
  try {
    window.localStorage.setItem(CHAVE, ligado ? "1" : "0");
  } catch {
    // Sem armazenamento, vale só para esta janela.
  }
}
