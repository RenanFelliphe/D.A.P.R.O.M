import type { NomeDeIcone } from "./Icone";
import { Vazio } from "./Estados";
import { Tela } from "./Tela";

/** A tela de uma aba que ainda não foi feita: diz o que vem aqui e que o caminho pela web continua valendo. */
export function TelaEmBreve({ icone, titulo, texto }: { icone: NomeDeIcone; titulo: string; texto: string }) {
  return (
    <Tela bordas={[]} centralizada>
      <Vazio icone={icone} titulo={titulo} texto={texto} />
    </Tela>
  );
}
