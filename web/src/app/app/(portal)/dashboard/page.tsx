import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import { ehAdmin } from "@/lib/tipos";

/**
 * `/app/dashboard` sozinho abre a primeira aba da seção, com o mês e a equipe pedidos (links antigos): "Meus resultados" para
 * quem executa OS (técnico e supervisor) e OS para o admin, que não executa.
 */
export default async function SecaoIndicadoresPage({ searchParams }: PageProps<"/app/dashboard">) {
  const [{ usuario }, parametros] = await Promise.all([usuarioAtual(), searchParams]);
  const consulta = new URLSearchParams();
  for (const [chave, valor] of Object.entries(parametros)) {
    for (const v of Array.isArray(valor) ? valor : valor === undefined ? [] : [valor]) consulta.append(chave, v);
  }
  const inicio = ehAdmin(usuario) ? rotas.app.dashboardOs : rotas.app.dashboardMeus;
  const texto = consulta.toString();
  redirect(texto ? `${inicio}?${texto}` : inicio);
}
