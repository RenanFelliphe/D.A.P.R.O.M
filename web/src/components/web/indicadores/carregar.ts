import "server-only";

import { listarEquipes } from "@/data/quadro";
import { usuarioAtual } from "@/lib/api";
import { consultaDoFiltro, lerFiltroDoPainel, rotuloDoAnterior } from "./filtro";

/**
 * O que toda página de dashboard precisa antes dos dados dela: quem está vendo, o filtro da URL (já validado), a consulta
 * para a `api` e para os links entre dashboards, e as equipes do seletor (o supervisor não escolhe: fica com o nome da dele).
 */
export async function prepararDashboard(searchParams: Promise<Record<string, string | string[] | undefined>>) {
  const [{ usuario, equipe }, sp] = await Promise.all([usuarioAtual(), searchParams]);
  const filtro = lerFiltroDoPainel(sp, usuario.perfil);
  const ehSupervisor = usuario.perfil === "supervisor";
  const equipes = ehSupervisor ? null : await listarEquipes();
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
    nomeDaEquipe: ehSupervisor ? (equipe?.nome ?? "sem equipe") : undefined,
    rotuloAnterior: rotuloDoAnterior(filtro.periodo),
  };
}
