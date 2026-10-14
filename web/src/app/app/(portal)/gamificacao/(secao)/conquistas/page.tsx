import type { Metadata } from "next";
import { GaleriaConquistas } from "@/components/web/gamificacao/GaleriaConquistas";
import { editaGamificacao, jogaNaGamificacao } from "@/components/web/gamificacao/secao";
import { lerConquistas } from "@/data/gamificacao";
import { usuarioAtual } from "@/lib/api";

export const metadata: Metadata = { title: "Conquistas" };

/**
 * Conquistas: a galeria de pessoa e de equipe, com as obtidas coloridas (com a data), as que faltam em cinza (com o progresso),
 * a raridade e os pontos. O admin cria, edita, troca a imagem, desativa e exclui, numa janela.
 */
export default async function ConquistasPage() {
  const [{ usuario }, lista] = await Promise.all([usuarioAtual(), lerConquistas()]);
  return <GaleriaConquistas lista={lista} podeEditar={editaGamificacao(usuario)} jogador={jogaNaGamificacao(usuario)} />;
}
