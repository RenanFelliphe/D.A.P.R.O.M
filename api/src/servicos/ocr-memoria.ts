import type { FolhaLidaPorOcr, MotorOcr } from "./ocr";

/**
 * Só para testes automatizados e para o modo local sem o Tesseract: devolve, folha a folha, as linhas que o teste programou
 * (`folhas[0]` para a primeira chamada, e assim por diante), com posições inventadas de cima para baixo.
 */
export class OcrEmMemoria implements MotorOcr {
  folhas: string[][] = [];
  falhar = false;
  chamadas = 0;
  confianca = 95;

  async lerFolha(_imagem: Uint8Array, numero: number, largura: number, altura: number): Promise<FolhaLidaPorOcr> {
    this.chamadas++;
    if (this.falhar) throw new Error("OCR em memória: falha simulada");
    const linhas = this.folhas[numero - 1] ?? [];
    const passo = 40;
    return {
      numero,
      linhas,
      posicoes: linhas.map((texto, i) => ({ texto, y: altura - 100 - i * passo, altura: 30 })),
      largura,
      altura,
      confianca: linhas.length ? this.confianca : 0,
    };
  }

  async encerrar(): Promise<void> {}
}
