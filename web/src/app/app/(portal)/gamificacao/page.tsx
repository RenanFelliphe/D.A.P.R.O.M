import { redirect } from "next/navigation";
import { jogaNaGamificacao } from "@/components/web/gamificacao/secao";
import { usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";

/** `/app/gamificacao` sozinho abre "Minha pontuação"; o admin, que não joga, vai para o Ranking. */
export default async function GamificacaoPage() {
  const { usuario } = await usuarioAtual();
  redirect(jogaNaGamificacao(usuario) ? rotas.app.gamificacaoMinha : rotas.app.gamificacaoRanking);
}
