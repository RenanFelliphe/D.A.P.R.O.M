import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Screen } from "@/components/ui/Screen";
import { ListaPerguntasSemResposta, type PerguntaSemResposta } from "@/components/vitoria/ListaPerguntasSemResposta";
import { api, usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import { ehAdmin, type Paginacao } from "@/lib/tipos";

export const metadata: Metadata = { title: "Perguntas sem resposta da Vitória" };

const um = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);
const TAMANHO = 50;

/**
 * Perguntas que a Vitória não soube responder (`vitoria.md`, seção 2.7): só o admin, para melhorar o manual. Fica em
 * `/app` (como Usuários e Gamificação), não em `/web`, porque não é uma tela de campo nem de gestão de OS.
 */
export default async function VitoriaSemRespostaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { usuario } = await usuarioAtual();
  if (!ehAdmin(usuario)) redirect(rotas.app.lista);

  const params = await searchParams;
  const tratadaBruta = um(params.tratada);
  const tratada = tratadaBruta === "true" ? true : tratadaBruta === "false" ? false : undefined;
  const pagina = Math.max(1, Number.parseInt(um(params.pagina) ?? "1", 10) || 1);

  const lista = await api<{ perguntas: PerguntaSemResposta[] } & Paginacao>("/vitoria/sem-resposta", { consulta: { tratada, pagina, tamanho: TAMANHO } });

  return (
    <Screen>
      <div className="stack g4">
        <h1>Perguntas sem resposta da Vitória</h1>
        <span className="muted">
          O que ela não soube responder pelo manual, sem identificar quem perguntou: só o texto, a tela, o perfil e a data. Depois de melhorar o manual, marque
          a pergunta como tratada.
        </span>
      </div>
      <ListaPerguntasSemResposta perguntas={lista.perguntas} tratada={tratada} pagina={lista.pagina} tamanho={lista.tamanho} total={lista.total} />
    </Screen>
  );
}
