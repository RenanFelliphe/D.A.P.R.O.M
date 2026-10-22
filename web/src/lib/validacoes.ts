import type { IconName } from "@/components/ui/Icon";
import { rotas } from "@/lib/rotas";
import { TIPOS_DE_VALIDACAO, type ItemDeValidacao, type TipoDeValidacao } from "../../../shared/api/validacoes";

/** O contrato da fila (`GET /me/validacoes`) mora em `shared/api/validacoes.ts`: o app usa o mesmo. */
export * from "../../../shared/api/validacoes";

export const iconeDoTipo: Record<TipoDeValidacao, IconName> = {
  os_ciencia: "file",
  treinamento: "layers",
  sugestao_material: "box",
  conferencia: "checks",
  ausencia: "cal",
};

/** Para onde cada item leva: a tela onde a pessoa decide ou assina (a fila não decide nada por conta própria). */
export function enderecoDaValidacao(item: ItemDeValidacao): string {
  switch (item.tipo) {
    case "os_ciencia":
      return rotas.app.os(item.id);
    case "treinamento":
      return rotas.app.treinamentoServico(item.id, "validar");
    case "sugestao_material":
      return rotas.app.sugestaoDeMateriais(item.atividade_codigo ?? "", item.id);
    case "conferencia":
      return rotas.app.conferencia(item.os_id ?? "", item.id);
    case "ausencia":
      return `${rotas.app.equipe(item.equipe_id ?? "")}#ausencias`;
  }
}

/** O filtro da página (`?tipo=`): só vale um dos tipos conhecidos. */
export function tipoDaConsulta(valor: string | string[] | undefined): TipoDeValidacao | null {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return TIPOS_DE_VALIDACAO.find((t) => t === v) ?? null;
}
