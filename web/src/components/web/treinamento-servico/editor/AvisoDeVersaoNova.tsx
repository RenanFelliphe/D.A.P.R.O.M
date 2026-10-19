import { Notice } from "@/components/ui/Notice";
import type { RascunhoDoEditor } from "@/lib/treinamento-servico";

/**
 * Editar um treinamento já publicado cria a versão seguinte como rascunho, a partir da publicada (seção 3.9.6 do
 * `vitoria.md`): o aviso deixa claro que os técnicos continuam vendo a versão anterior até esta ser publicada.
 */
export function AvisoDeVersaoNova({ rascunho }: { rascunho: Pick<RascunhoDoEditor, "tem_publicada" | "versao"> }) {
  if (!rascunho.tem_publicada) return null;
  return (
    <Notice tone="info" icon="info">
      Você está editando a <strong>versão {rascunho.versao}</strong>, um rascunho. Os técnicos continuam jogando a versão publicada até você publicar esta.
    </Notice>
  );
}
