import type { Metadata } from "next";
import { CartaoRegistro, type SincronizacaoDoRegistro } from "@/components/web/usuarios/CartaoRegistro";
import { PerfilEquipe } from "@/components/perfil/PerfilEquipe";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { CabecalhoUsuarios } from "@/components/web/usuarios/CabecalhoUsuarios";
import { ListaEquipes } from "@/components/web/usuarios/ListaEquipes";
import { PainelPendentes } from "@/components/web/usuarios/PainelPendentes";
import { ListaPerfis } from "@/components/web/usuarios/ListaPerfis";
import { TabelaUsuarios } from "@/components/web/usuarios/TabelaUsuarios";
import type { EquipeComTecnicos } from "@/data/usuarios";
import { api, usuarioAtual } from "@/lib/api";
import { ehAdmin, ehSupervisor, type Equipe, type Paginacao, type Usuario } from "@/lib/tipos";

export const metadata: Metadata = { title: "Equipes e usuários" };

const um = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);
const TAMANHO = 50;

type Consulta = Record<string, string | string[] | undefined>;

/**
 * Equipes e usuários: um endereço só para os três perfis, com a estrutura de cada um.
 * - Admin: todas as equipes e pessoas, com os pendentes de liberação em destaque.
 * - Supervisor ("Minha equipe"): os técnicos das equipes que ele supervisiona, e cadastra técnicos novos, que nascem pendentes.
 * - Técnico ("Minha equipe"): só consulta a própria equipe (supervisor, colegas e a situação das OS); nada se altera aqui.
 */
export default async function UsuariosPage({ searchParams }: PageProps<"/app/usuarios">) {
  const { usuario, equipe } = await usuarioAtual();
  if (ehAdmin(usuario)) return <VisaoDoAdmin params={await searchParams} />;
  if (ehSupervisor(usuario)) return <VisaoDoSupervisor params={await searchParams} usuario={usuario} />;
  return <VisaoDoTecnico equipeId={equipe?.id ?? null} />;
}

/** Minha equipe, só para consulta: o perfil da própria equipe (a `api` entrega só colegas ativos e nada de desempenho por pessoa). */
function VisaoDoTecnico({ equipeId }: { equipeId: string | null }) {
  if (!equipeId) {
    return (
      <Screen>
        <h1>Minha equipe</h1>
        <Notice tone="info" icon="info">
          Você ainda não está em nenhuma equipe. Procure o seu supervisor.
        </Notice>
      </Screen>
    );
  }
  return <PerfilEquipe equipeId={equipeId} propria />;
}

async function VisaoDoAdmin({ params }: { params: Consulta }) {
  const filtros = { equipe_id: um(params.equipe_id) || undefined, perfil: um(params.perfil) || undefined, ativo: um(params.ativo) || undefined, liberacao: um(params.liberacao) || undefined, busca: um(params.busca)?.trim() || undefined };
  const pagina = Math.max(1, Number.parseInt(um(params.pagina) ?? "1", 10) || 1);

  const [lista, equipesApi, supervisores, pendentes, registro] = await Promise.all([
    api<{ usuarios: Usuario[] } & Paginacao>("/usuarios", { consulta: { ...filtros, pagina, tamanho: TAMANHO } }),
    api<{ equipes: Equipe[] }>("/equipes", { consulta: { tamanho: 200 } }),
    api<{ usuarios: Usuario[] }>("/usuarios", { consulta: { ativo: true, tamanho: 200 } }),
    // Cadastros de supervisores que esperam a liberação: destaque no topo (some quando o filtro já é só de pendentes).
    filtros.liberacao === "pendente" ? null : api<{ usuarios: Usuario[] } & Paginacao>("/usuarios", { consulta: { liberacao: "pendente", tamanho: 20 } }),
    // A última leitura do registro de funcionários; sem ela a tela segue (o cartão só não aparece).
    api<SincronizacaoDoRegistro>("/rh/sincronizacao").catch(() => null),
  ]);
  const nomes = new Map([...supervisores.usuarios, ...(pendentes?.usuarios ?? [])].map((u) => [u.id, u.nome]));
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
      {pendentes && <PainelPendentes pendentes={pendentes.usuarios} total={pendentes.total} equipes={opcoesDeEquipe} nomes={nomes} />}
      {registro && <CartaoRegistro inicial={registro} />}
      <TabelaUsuarios usuarios={lista.usuarios} equipes={opcoesDeEquipe} filtros={filtros} pagina={lista.pagina} tamanho={lista.tamanho} total={lista.total} />
      <div className="two eq">
        <ListaEquipes equipes={equipes} supervisores={supervisores.usuarios.map((s) => ({ id: s.id, nome: s.nome }))} />
        <ListaPerfis />
      </div>
    </Screen>
  );
}

/**
 * Minha equipe: lista os técnicos das equipes que o supervisor supervisiona (inclusive os pendentes de liberação e os
 * recusados, com o motivo). Filtros e paginação são da `api` (`minha_supervisao=true`), que já entrega só o escopo dele.
 */
async function VisaoDoSupervisor({ params, usuario }: { params: Consulta; usuario: Usuario }) {
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
      <TabelaUsuarios usuarios={lista.usuarios} equipes={opcoesDeEquipe} filtros={filtros} pagina={lista.pagina} tamanho={lista.tamanho} total={lista.total} modo="supervisor" meuId={usuario.id} />
      <ListaEquipes equipes={equipes} supervisores={[{ id: usuario.id, nome: usuario.nome }]} somenteLeitura />
    </Screen>
  );
}
