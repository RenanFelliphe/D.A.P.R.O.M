import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Screen } from "@/components/ui/Screen";
import { CabecalhoUsuarios } from "@/components/web/usuarios/CabecalhoUsuarios";
import { ListaEquipes } from "@/components/web/usuarios/ListaEquipes";
import { ListaPerfis } from "@/components/web/usuarios/ListaPerfis";
import { TabelaUsuarios } from "@/components/web/usuarios/TabelaUsuarios";
import type { EquipeComTecnicos } from "@/data/usuarios";
import { api, usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import type { Equipe, Paginacao, Usuario } from "@/lib/tipos";

export const metadata: Metadata = { title: "Equipes e usuários" };

const um = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);
const TAMANHO = 50;

/** Equipes e usuários: só o administrador. Os demais perfis voltam ao quadro (a `api` também recusaria as gravações). */
export default async function UsuariosPage({ searchParams }: PageProps<"/web/usuarios">) {
  const { usuario } = await usuarioAtual();
  if (usuario.perfil !== "admin") redirect(rotas.web.quadro);

  const params = await searchParams;
  const filtros = { equipe_id: um(params.equipe_id) || undefined, perfil: um(params.perfil) || undefined, ativo: um(params.ativo) || undefined };
  const pagina = Math.max(1, Number.parseInt(um(params.pagina) ?? "1", 10) || 1);

  const [lista, equipesApi, supervisores] = await Promise.all([
    api<{ usuarios: Usuario[] } & Paginacao>("/usuarios", { consulta: { ...filtros, pagina, tamanho: TAMANHO } }),
    api<{ equipes: Equipe[] }>("/equipes", { consulta: { tamanho: 200 } }),
    api<{ usuarios: Usuario[] }>("/usuarios", { consulta: { perfil: "supervisor", ativo: true, tamanho: 200 } }),
  ]);
  // quantos técnicos ativos cada equipe tem (`total` de uma página de tamanho 1)
  const equipes: EquipeComTecnicos[] = await Promise.all(
    equipesApi.equipes.map(async (e) => ({
      ...e,
      tecnicos: (await api<Paginacao>("/usuarios", { consulta: { equipe_id: e.id, perfil: "tecnico", ativo: true, tamanho: 1 } })).total,
    })),
  );
  const opcoesDeEquipe = equipesApi.equipes.map((e) => ({ id: e.id, nome: e.nome }));

  return (
    <Screen>
      <CabecalhoUsuarios equipes={opcoesDeEquipe} />
      <TabelaUsuarios usuarios={lista.usuarios} equipes={opcoesDeEquipe} filtros={filtros} pagina={lista.pagina} tamanho={lista.tamanho} total={lista.total} />
      <div className="two eq">
        <ListaEquipes equipes={equipes} supervisores={supervisores.usuarios.map((s) => ({ id: s.id, nome: s.nome }))} />
        <ListaPerfis />
      </div>
    </Screen>
  );
}
