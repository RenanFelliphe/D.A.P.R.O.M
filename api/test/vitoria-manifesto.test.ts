import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * Roda `scripts/verificar-manifesto-vitoria.mts` como processo filho (o mesmo script que confere o manifesto antes de
 * cada apresentação), para o teste de sincronismo do manifesto da Vitória entrar no `pnpm test` normal.
 */
describe("Manifesto de destinos da Vitória", () => {
  it("cada destino corresponde a um endereço real de rotas.ts, e toda chave citada nos manuais existe no manifesto", () => {
    const raizDaApi = path.join(import.meta.dirname, "..");
    const script = path.join(raizDaApi, "scripts", "verificar-manifesto-vitoria.mts");
    const saida = execFileSync(process.execPath, ["--import", "tsx", script], { cwd: raizDaApi, encoding: "utf8" });
    assertContem(saida, "destinos do manifesto correspondem a um endereço real de rotas.ts");
    assertContem(saida, "chaves citadas nos manuais existem no manifesto");
  });
});

function assertContem(saida: string, trecho: string) {
  if (!saida.includes(trecho)) throw new Error(`Saída do script não trouxe "${trecho}":\n${saida}`);
}
