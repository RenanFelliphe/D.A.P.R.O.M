import { AbasSecao } from "@/components/web/AbasSecao";
import { abasDoPerfil } from "@/components/web/os/secao";
import { usuarioAtual } from "@/lib/api";
import { ehAdmin, ehSupervisor } from "@/lib/tipos";

/**
 * Título e abas da seção Ordem de Serviço (Quadro, Importação e Mapa de Calor, conforme o perfil: `abasDoPerfil`), a
 * mesma para todos: admin e supervisor veem "Ordem de Serviço", o técnico comum, "OS da equipe".
 */
export async function CabecalhoSecaoOs() {
  const { usuario } = await usuarioAtual();
  const gestao = ehAdmin(usuario) || ehSupervisor(usuario);
  const abas = abasDoPerfil(usuario);
  return (
    <>
      <h1>{gestao ? "Ordem de Serviço" : "OS da equipe"}</h1>
      {abas.length > 1 && <AbasSecao rotulo="Seções de Ordem de Serviço" abas={abas} />}
    </>
  );
}
