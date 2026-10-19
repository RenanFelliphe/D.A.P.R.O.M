/**
 * O desenho da assinatura como contas simples (sem React Native, para testar): os traços são listas de pontos no espaço do
 * desenho (600 × 180, o mesmo tamanho da web) e o caminho do SVG sai deles.
 */

export interface Ponto {
  x: number;
  y: number;
}

/** O tamanho do desenho, igual ao `<canvas>` da web; é também o tamanho do PNG que sobe. */
export const LARGURA_DO_DESENHO = 600;
export const ALTURA_DO_DESENHO = 180;

/** Leva um toque (em dp, dentro da caixa) para o espaço do desenho, sem deixá-lo sair da caixa. */
export function pontoDoToque(x: number, y: number, larguraDaCaixa: number, alturaDaCaixa: number): Ponto {
  const largura = larguraDaCaixa > 0 ? larguraDaCaixa : LARGURA_DO_DESENHO;
  const altura = alturaDaCaixa > 0 ? alturaDaCaixa : ALTURA_DO_DESENHO;
  const limitar = (v: number, max: number) => Math.min(Math.max(v, 0), max);
  return { x: limitar((x / largura) * LARGURA_DO_DESENHO, LARGURA_DO_DESENHO), y: limitar((y / altura) * ALTURA_DO_DESENHO, ALTURA_DO_DESENHO) };
}

const arredondar = (n: number) => Math.round(n * 10) / 10;

/**
 * O caminho SVG de um traço: curvas que passam pelos pontos médios, para o desenho não ficar quebrado. Um toque sem arrasto vira um
 * pontinho (uma linha de comprimento quase zero com ponta redonda), como na web.
 */
export function caminhoDoTraco(pontos: readonly Ponto[]): string {
  const primeiro = pontos[0];
  if (!primeiro) return "";
  if (pontos.length === 1) return `M ${arredondar(primeiro.x)} ${arredondar(primeiro.y)} l 0.01 0.01`;
  let d = `M ${arredondar(primeiro.x)} ${arredondar(primeiro.y)}`;
  for (let i = 1; i < pontos.length - 1; i++) {
    const atual = pontos[i]!;
    const proximo = pontos[i + 1]!;
    d += ` Q ${arredondar(atual.x)} ${arredondar(atual.y)} ${arredondar((atual.x + proximo.x) / 2)} ${arredondar((atual.y + proximo.y) / 2)}`;
  }
  const ultimo = pontos[pontos.length - 1]!;
  return `${d} L ${arredondar(ultimo.x)} ${arredondar(ultimo.y)}`;
}

/** Há algo desenhado? Um toque solto já conta, como na web. */
export const temTraco = (tracos: readonly (readonly Ponto[])[]) => tracos.some((t) => t.length > 0);

/**
 * O que o dedo desenhou até agora. Os toques chegam por um `PanResponder`, que vive fora do ciclo de renderização: este controle guarda
 * os traços e a medida da caixa, e avisa a tela a cada mudança (`aoMudar` recebe uma lista nova, para a tela se redesenhar).
 */
export class ControleDoDesenho {
  private tracos: Ponto[][] = [];
  private largura = 0;
  private altura = 0;
  private bloqueado = false;

  constructor(private readonly aoMudar: (tracos: Ponto[][]) => void) {}

  /** A medida da caixa na tela, em dp (o `onLayout`). */
  medir(largura: number, altura: number) {
    this.largura = largura;
    this.altura = altura;
  }

  /** Enquanto o PNG é gerado e enviado, o desenho não muda. */
  travar(travado: boolean) {
    this.bloqueado = travado;
  }

  get travado() {
    return this.bloqueado;
  }

  /** O dedo tocou a caixa: começa um traço novo. */
  comecar(x: number, y: number) {
    if (this.travado) return;
    this.tracos = [...this.tracos, [pontoDoToque(x, y, this.largura, this.altura)]];
    this.aoMudar(this.tracos);
  }

  /** O dedo se moveu: acrescenta o ponto ao traço de agora. */
  mover(x: number, y: number) {
    const ultimo = this.tracos[this.tracos.length - 1];
    if (this.travado || !ultimo) return;
    this.tracos = [...this.tracos.slice(0, -1), [...ultimo, pontoDoToque(x, y, this.largura, this.altura)]];
    this.aoMudar(this.tracos);
  }

  limpar() {
    this.tracos = [];
    this.aoMudar(this.tracos);
  }

  get temTraco() {
    return temTraco(this.tracos);
  }
}
