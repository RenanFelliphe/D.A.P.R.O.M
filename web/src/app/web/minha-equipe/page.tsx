import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Screen } from "@/components/ui/Screen";
import { CabecalhoUsuarios } from "@/components/web/usuarios/CabecalhoUsuarios";
import { ListaEquipes } from "@/components/web/usuarios/ListaEquipes";
import { TabelaUsuarios } from "@/components/web/usuarios/TabelaUsuarios";
import type { EquipeComTecnicos } from "@/data/usuarios";
import { api, usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import { ehAdmin, ehSupervisor, type Equipe, type Usuario } from "@/lib/tipos";

export const metadata: Metadata = { title: "Minha equipe" };

const um = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);
const TAMANHO = 50;
const semAcento = (texto: string) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Minha equipe: só o supervisor. Lista os técnicos das equipes que ele supervisiona (inclusive os pendentes de liberação e os
 * recusados, com o motivo) e cadastra novos técnicos, que nascem pendentes. O admin usa "Equipes e usuários"; o técnico comum, o campo.
 * A `api` já entrega só o escopo dele; filtros e paginação rodam aqui porque a lista de uma equipe é curta.
 */
export default async function MinhaEquipePage({ searchParams }: PageProps<"/web/minha-equipe">) {
  const { usuario } = await usuarioAtual();
  if (ehAdmin(usuario)) redirect(rotas.web.usuarios);
  if (!ehSupervisor(usuario)) redirect(rotas.app.lista);

  const params = await searchParams;
  const filtros = { equipe_id: um(params.equipe_id) || undefined, liberacao: um(params.liberacao) || undefined, busca: um(params.busca)?.trim() || undefined };
  const pagina = Math.max(1, Number.parseInt(um(params.pagina) ?? "1", 10) || 1);

  const minhas = new Set(usuario.equipes_supervisionadas?.map((e) => e.id));
  // Sem filtro a `api` devolve só os colegas liberados; pendentes e recusados vêm de consultas próprias e as três se juntam aqui.
  const [liberados, pendentesApi, recusadosApi, equipesApi] = await Promise.all([
    api<{ usuarios: Usuario[] }>("/usuarios", { consulta: { tamanho: 200 } }),
    api<{ usuarios: Usuario[] }>("/usuarios", { consulta: { liberacao: "pendente", tamanho: 200 } }),
    api<{ usuarios: Usuario[] }>("/usuarios", { consulta: { liberacao: "recusado", tamanho: 200 } }),
    api<{ equipes: Equipe[] }>("/equipes", { consulta: { tamanho: 200 } }),
  ]);
  const equipesDele = equipesApi.equipes.filter((e) => minhas.has(e.id));
  const opcoesDeEquipe = equipesDele.map((e) => ({ id: e.id, nome: e.nome }));

  // Só técnicos das equipes dele (a própria pessoa fica de fora: não é cadastro dela para gerir).
  const todos = [...liberados.usuarios, ...pendentesApi.usuarios, ...recusadosApi.usuarios];
  const tecnicos = todos.filter((u) => u.perfil === "tecnico" && u.id !== usuario.id && u.equipe_id !== null && minhas.has(u.equipe_id));
  const termo = filtros.busca ? semAcento(filtros.busca) : null;
  const filtrados = tecnicos.filter(
    (u) =>
      (!filtros.equipe_id || u.equipe_id === filtros.equipe_id) &&
      (!filtros.liberacao || (u.liberacao ?? "liberado") === filtros.liberacao) &&
      (!termo || semAcento([u.nome, u.matricula, u.cargo ?? ""].join(" ")).includes(termo)),
  );
  const visiveis = filtrados.slice((pagina - 1) * TAMANHO, pagina * TAMANHO);

  const equipes: EquipeComTecnicos[] = equipesDele.map((e) => ({
    ...e,
    tecnicos: tecnicos.filter((u) => u.equipe_id === e.id && u.ativo && (u.liberacao ?? "liberado") === "liberado").length,
  }));
  const pendentes = tecnicos.filter((u) => u.liberacao === "pendente").length;

  return (
    <Screen>
      <CabecalhoUsuarios equipes={opcoesDeEquipe} modo="supervisor" />
      {pendentes > 0 && (
        <p className="small" role="status">
          {`${pendentes} ${pendentes === 1 ? "cadastro aguarda" : "cadastros aguardam"} a liberação de um administrador.`}
        </p>
      )}
      <TabelaUsuarios usuarios={visiveis} equipes={opcoesDeEquipe} filtros={filtros} pagina={pagina} tamanho={TAMANHO} total={filtrados.length} modo="supervisor" caminho={rotas.web.minhaEquipe} meuId={usuario.id} />
      <ListaEquipes equipes={equipes} supervisores={[{ id: usuario.id, nome: usuario.nome }]} somenteLeitura caminhoUsuarios={rotas.web.minhaEquipe} />
    </Screen>
  );
}
