import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Screen } from "@/components/ui/Screen";
import { CabecalhoUsuarios } from "@/components/web/usuarios/CabecalhoUsuarios";
import { ListaEquipes } from "@/components/web/usuarios/ListaEquipes";
import { TabelaUsuarios } from "@/components/web/usuarios/TabelaUsuarios";
import type { EquipeComTecnicos } from "@/data/usuarios";
import { api, usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import { ehAdmin, ehSupervisor, type Equipe, type Paginacao, type Usuario } from "@/lib/tipos";

export const metadata: Metadata = { title: "Minha equipe" };

const um = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);
const TAMANHO = 50;

/**
 * Minha equipe: só o supervisor. Lista os técnicos das equipes que ele supervisiona (inclusive os pendentes de liberação e os
 * recusados, com o motivo) e cadastra novos técnicos, que nascem pendentes. O admin usa "Equipes e usuários"; o técnico comum, o campo.
 * Filtros e paginação são da `api` (`minha_supervisao=true`), que já entrega só o escopo dele.
 */
export default async function MinhaEquipePage({ searchParams }: PageProps<"/web/minha-equipe">) {
  const { usuario } = await usuarioAtual();
  if (ehAdmin(usuario)) redirect(rotas.web.usuarios);
  if (!ehSupervisor(usuario)) redirect(rotas.app.lista);

  const params = await searchParams;
  const filtros = { equipe_id: um(params.equipe_id) || undefined, liberacao: um(params.liberacao) || undefined, busca: um(params.busca)?.trim() || undefined };
  const pagina = Math.max(1, Number.parseInt(um(params.pagina) ?? "1", 10) || 1);

  const minhas = new Set(usuario.equipes_supervisionadas?.map((e) => e.id));
  const daSupervisao = { minha_supervisao: true, perfil: "tecnico" } as const;
  const [lista, pendentes, equipesApi] = await Promise.all([
    api<{ usuarios: Usuario[] } & Paginacao>("/usuarios", { consulta: { ...daSupervisao, ...filtros, pagina, tamanho: TAMANHO } }),
    api<Paginacao>("/usuarios", { consulta: { ...daSupervisao, liberacao: "pendente", tamanho: 1 } }),
    api<{ equipes: Equipe[] }>("/equipes", { consulta: { tamanho: 200 } }),
  ]);
  const equipesDele = equipesApi.equipes.filter((e) => minhas.has(e.id));
  const opcoesDeEquipe = equipesDele.map((e) => ({ id: e.id, nome: e.nome }));

  // Quantos técnicos liberados cada equipe tem (`total` de uma página de tamanho 1).
  const equipes: EquipeComTecnicos[] = await Promise.all(
    equipesDele.map(async (e) => ({
      ...e,
      tecnicos: (await api<Paginacao>("/usuarios", { consulta: { ...daSupervisao, equipe_id: e.id, liberacao: "liberado", tamanho: 1 } })).total,
    })),
  );

  return (
    <Screen>
      <CabecalhoUsuarios equipes={opcoesDeEquipe} modo="supervisor" />
      {pendentes.total > 0 && (
        <p className="small" role="status">
          {`${pendentes.total} ${pendentes.total === 1 ? "cadastro aguarda" : "cadastros aguardam"} a liberação de um administrador.`}
        </p>
      )}
      <TabelaUsuarios usuarios={lista.usuarios} equipes={opcoesDeEquipe} filtros={filtros} pagina={lista.pagina} tamanho={lista.tamanho} total={lista.total} modo="supervisor" caminho={rotas.web.minhaEquipe} meuId={usuario.id} />
      <ListaEquipes equipes={equipes} supervisores={[{ id: usuario.id, nome: usuario.nome }]} somenteLeitura caminhoUsuarios={rotas.web.minhaEquipe} />
    </Screen>
  );
}
