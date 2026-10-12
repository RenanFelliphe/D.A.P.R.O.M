import { AbasSecao } from "@/components/web/AbasSecao";
import { abasDoPerfil } from "@/components/web/os/secao";
import { usuarioAtual } from "@/lib/api";

/**
 * Título e abas da seção Ordem de Serviço (Quadro e Importação). Quem só vê o Quadro (supervisor) fica sem a barra de abas.
 * Aparece no quadro e na importação, para admin e supervisor; o técnico comum vê o quadro com o título "OS da equipe".
 */
export async function CabecalhoSecaoOs() {
  const { usuario } = await usuarioAtual();
  const abas = abasDoPerfil(usuario);
  return (
    <>
      <h1>Ordem de Serviço</h1>
      {abas.length > 1 && <AbasSecao rotulo="Seções de Ordem de Serviço" abas={abas} />}
    </>
  );
}
