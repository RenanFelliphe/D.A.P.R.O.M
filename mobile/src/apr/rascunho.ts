import { Directory, File, Paths } from "expo-file-system";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { RascunhoApr } from "@shared/api/apr";
import { apagarArquivosLocais } from "@/campo/arquivos";
import { criarArmazemDeRascunhos, type Disco } from "./armazem";

const pasta = () => new Directory(Paths.document, "rascunhos-apr");
const arquivoDe = (chave: string) => new File(pasta(), `${chave}.json`);

/** O disco do app: um arquivo JSON por rascunho, na pasta de documentos (não apagada pelo sistema como o cache). */
const disco: Disco = {
  async ler(chave) {
    const arquivo = arquivoDe(chave);
    return arquivo.exists ? arquivo.text() : null;
  },
  async gravar(chave, texto) {
    pasta().create({ idempotent: true, intermediates: true });
    const arquivo = arquivoDe(chave);
    arquivo.create({ overwrite: true });
    arquivo.writeSync(texto);
  },
  async apagar(chave) {
    const arquivo = arquivoDe(chave);
    if (arquivo.exists) arquivo.delete();
  },
};

export const armazemDeRascunhos = criarArmazemDeRascunhos(disco);

/** As fotos locais que o rascunho guarda (a miniatura é a cópia comprimida no aparelho). */
export const fotosLocaisDe = (r: RascunhoApr): string[] => Object.values(r.fotos).flatMap((fotos) => fotos.map((f) => f.miniatura).filter((u): u is string => Boolean(u)));

/**
 * O rascunho da APR desta OS para esta pessoa. `rascunho` é `undefined` enquanto o disco não foi lido (primeira renderização) e `null`
 * se não há rascunho. `atualizar` aplica uma função pura de `shared/api/apr`; `descartar` apaga o rascunho e as fotos locais dele.
 */
export function useRascunhoApr(osId: string, usuarioId: string) {
  const rascunho = useSyncExternalStore(
    armazemDeRascunhos.assinar,
    () => armazemDeRascunhos.ler(osId, usuarioId),
    () => undefined,
  );

  useEffect(() => {
    if (usuarioId) void armazemDeRascunhos.carregar(osId, usuarioId);
  }, [osId, usuarioId]);

  const atualizar = useCallback((alterar: (atual: RascunhoApr) => RascunhoApr) => armazemDeRascunhos.atualizar(osId, usuarioId, alterar), [osId, usuarioId]);
  const gravar = useCallback((novo: RascunhoApr) => armazemDeRascunhos.gravar(novo), []);
  const descartar = useCallback(() => {
    const atual = armazemDeRascunhos.ler(osId, usuarioId);
    armazemDeRascunhos.apagar(osId, usuarioId);
    if (atual) apagarArquivosLocais(fotosLocaisDe(atual));
  }, [osId, usuarioId]);

  return { rascunho, atualizar, gravar, descartar };
}
