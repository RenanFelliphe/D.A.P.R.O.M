import "server-only";

import { listarEquipes } from "@/data/quadro";
import { usuarioAtual } from "@/lib/api";
import { ehAdmin, ehSupervisor as supervisa, nomesDasEquipesDoSupervisor } from "@/lib/tipos";
import { consultaDoFiltro, lerFiltroDoPainel, rotuloDoAnterior } from "./filtro";

/**
 * O que toda página de dashboard precisa antes dos dados dela: quem está vendo, o filtro da URL (já validado), a consulta
 * para a `api` e para os links entre dashboards, e, as equipes do seletor (só o admin escolhe; os demais ficam com o nome da própria equipe).
 */
export async function prepararDashboard(searchParams: Promise<Record<string, string | string[] | undefined>>) {
  const [{ usuario, equipe }, sp] = await Promise.all([usuarioAtual(), searchParams]);
  const filtro = lerFiltroDoPainel(sp, usuario);
  const equipes = ehAdmin(usuario) ? await listarEquipes() : null;
  const consulta = consultaDoFiltro(filtro);
  const parametros = new URLSearchParams();
  for (const [chave, valor] of Object.entries(consulta)) if (valor) parametros.set(chave, valor);
  return {
    usuario,
    filtro,
    consulta,
    /** `periodo=…&equipe_id=…`, para os links que levam o filtro junto. */
    consultaDaUrl: parametros.toString(),
    equipes,
    nomeDaEquipe: ehAdmin(usuario) ? undefined : (supervisa(usuario) ? nomesDasEquipesDoSupervisor(usuario) : equipe?.nome) || "sem equipe",
    /** Admin e supervisor veem também o que é por pessoa e as pendências de gestão; o técnico, só o da equipe. */
    acompanha: ehAdmin(usuario) || supervisa(usuario),
    rotuloAnterior: rotuloDoAnterior(filtro.periodo),
  };
}
