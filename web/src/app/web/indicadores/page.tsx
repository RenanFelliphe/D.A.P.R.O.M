import { redirect } from "next/navigation";
import { rotas } from "@/lib/rotas";

/** `/web/indicadores` sozinho abre a primeira aba da seção, o Dashboard, com o mês e a equipe pedidos (links antigos). */
export default async function SecaoIndicadoresPage({ searchParams }: PageProps<"/web/indicadores">) {
  const consulta = new URLSearchParams();
  for (const [chave, valor] of Object.entries(await searchParams)) {
    for (const v of Array.isArray(valor) ? valor : valor === undefined ? [] : [valor]) consulta.append(chave, v);
  }
  const texto = consulta.toString();
  redirect(texto ? `${rotas.web.indicadores}?${texto}` : rotas.web.indicadores);
}
