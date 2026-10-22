/**
 * A previsão do tempo (`docs/operacao-de-campo.md`, seção 4.7): o formato que a `api` devolve em `GET /clima` e o que a web e o app
 * guardam junto da APR e do encerramento da execução. A `api` consulta o provedor, classifica o risco e escreve as frases, para a
 * web e o app mostrarem exatamente a mesma coisa; aqui ficam só os tipos e o que as telas decidem sozinhas.
 */

/** Sem risco, atenção (dá para trabalhar com cuidado) e extremo (o serviço externo não deve começar). */
export const NIVEIS_DE_RISCO = ["sem_risco", "atencao", "extremo"] as const;
export type NivelDeRisco = (typeof NIVEIS_DE_RISCO)[number];

/** Por que o nível subiu; a `api` junta as causas da janela da mais grave para a menos grave. */
export const CAUSAS_DE_RISCO = ["trovoada", "vento", "chuva_forte", "chuva", "calor", "uv"] as const;
export type CausaDeRisco = (typeof CAUSAS_DE_RISCO)[number];

/** `expediente`: o que resta do expediente de hoje (quadro de OS). `proximas_horas`: as próximas 4 horas (APR e encerramento). */
export type JanelaDoClima = "expediente" | "proximas_horas";

/** De onde veio a posição da consulta: o GPS do aparelho ou a cidade padrão que o admin configurou. */
export type OrigemDoLocal = "aparelho" | "padrao";

export interface HoraDoClima {
  /** Hora local de São Paulo, `AAAA-MM-DDTHH:00`. */
  hora: string;
  temperatura: number;
  sensacao: number;
  /** Chance de chuva, de 0 a 100. */
  chance_chuva: number;
  chuva_mm: number;
  rajada_kmh: number;
  indice_uv: number;
  trovoada: boolean;
  /** "Céu limpo", "Chuva fraca", "Trovoada"… */
  condicao: string;
  /** O ícone que a tela desenha (`sol`, `nuvem-sol`, `nuvem`, `chuva`, `trovoada`, `nevoeiro`). */
  icone: IconeDoClima;
  nivel: NivelDeRisco;
}

export type IconeDoClima = "sol" | "nuvem-sol" | "nuvem" | "chuva" | "trovoada" | "nevoeiro";

export interface LocalDoClima {
  nome: string;
  latitude: number;
  longitude: number;
  origem: OrigemDoLocal;
}

/** A previsão de uma janela: o nível mais alto das horas, o que dizer sobre ele e as horas, para a tela desenhar. */
export interface PrevisaoDoTempo {
  /** `false` quando o provedor não respondeu: não há nível, e nada é avisado nem bloqueado (as telas dizem "Previsão indisponível"). */
  disponivel: boolean;
  local: LocalDoClima;
  janela: JanelaDoClima;
  nivel: NivelDeRisco | null;
  /** A frase curta, ex.: "Chuva forte prevista das 14h às 17h". */
  titulo: string;
  /** O que fazer, ex.: "Prefira os serviços externos pela manhã e leve capa e bota de PVC". */
  orientacao: string;
  causas: CausaDeRisco[];
  horas: HoraDoClima[];
  consultada_em: string;
  fonte: string;
}

/** A cópia da previsão que a APR e o encerramento guardam: o que a pessoa viu na hora (a previsão muda, o relatório não). */
export interface ClimaRegistrado {
  nivel: NivelDeRisco;
  titulo: string;
  orientacao: string;
  causas: CausaDeRisco[];
  horas: HoraDoClima[];
  local: LocalDoClima;
  consultada_em: string;
  /** Só na APR: a pessoa respondeu que o clima está favorável apesar do aviso e confirmou. */
  confirmou_apesar_do_aviso?: boolean;
}

/** Os limites da classificação (`api/src/dominio/clima.ts`); aqui para a documentação e as telas dizerem a mesma coisa. */
export const LIMITES_DO_CLIMA = {
  extremo: { rajadaKmh: 60, chuvaMmPorHora: 10 },
  atencao: { rajadaKmh: 40, chuvaMmPorHora: 2.5, chanceDeChuva: 60, sensacaoC: 35, indiceUv: 8 },
} as const;

/** A previsão que a tela pode mostrar como alerta (há um nível e ele não é "sem risco"). */
export const temRisco = (p: Pick<PrevisaoDoTempo, "nivel"> | Pick<ClimaRegistrado, "nivel"> | null | undefined) => p?.nivel === "atencao" || p?.nivel === "extremo";

export const ROTULO_DO_NIVEL: Record<NivelDeRisco, string> = {
  sem_risco: "Sem risco climático",
  atencao: "Atenção ao clima",
  extremo: "Risco climático extremo",
};

/**
 * O que a tela faz quando a pessoa responde que o clima está favorável (a resposta "Sim" da pergunta de clima da APR):
 * - `nada`: sem previsão, ou sem risco; segue direto;
 * - `confirmar`: atenção, abre a janela com as condições e a orientação, e a pessoa pode seguir;
 * - `confirmar_com_foto`: extremo, a mesma janela e, para seguir, uma foto do local (o céu, o tempo no ponto do serviço).
 * A previsão é regional e é só uma probabilidade, por isso nenhum nível impede a pessoa de seguir: o extremo só exige a foto
 * (e avisa o supervisor na hora, no servidor).
 */
export type ExigenciaDoClima = "nada" | "confirmar" | "confirmar_com_foto";

export function exigenciaDoClima(previsao: Pick<PrevisaoDoTempo, "disponivel" | "nivel"> | null | undefined): ExigenciaDoClima {
  if (!previsao?.disponivel) return "nada";
  if (previsao.nivel === "extremo") return "confirmar_com_foto";
  if (previsao.nivel === "atencao") return "confirmar";
  return "nada";
}

/** A previsão vira a cópia que fica guardada; sem previsão (ou com o provedor fora do ar) não há o que guardar. */
export function registrarClima(previsao: PrevisaoDoTempo | null | undefined, confirmouApesarDoAviso?: boolean): ClimaRegistrado | null {
  if (!previsao?.disponivel || !previsao.nivel) return null;
  return {
    nivel: previsao.nivel,
    titulo: previsao.titulo,
    orientacao: previsao.orientacao,
    causas: previsao.causas,
    horas: previsao.horas,
    local: previsao.local,
    consultada_em: previsao.consultada_em,
    ...(confirmouApesarDoAviso === undefined ? {} : { confirmou_apesar_do_aviso: confirmouApesarDoAviso }),
  };
}

/** A pergunta de clima que os modelos de APR já trazem ("As condições climáticas estão favoráveis? (Chuva, …)"): a carga inicial a marca para mostrar a previsão. */
export const ehPerguntaDeClima = (texto: string) => /^as condi[cç][õo]es clim[aá]ticas est[aã]o favor[aá]veis/i.test(texto.trim());
