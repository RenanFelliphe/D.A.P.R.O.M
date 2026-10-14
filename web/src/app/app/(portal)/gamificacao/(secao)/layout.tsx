import type { ReactNode } from "react";
import { Screen } from "@/components/ui/Screen";
import { AbasSecao } from "@/components/web/AbasSecao";
import { abasDaGamificacao } from "@/components/web/gamificacao/secao";
import { usuarioAtual } from "@/lib/api";

/**
 * Seção Gamificação, a mesma para todos os perfis: o título e as abas Minha pontuação (de quem joga), Ranking, Conquistas,
 * Patentes e Como pontuar. Só o admin edita os pontos, as patentes e as conquistas, ali mesmo; o admin não joga.
 */
export default async function SecaoGamificacaoLayout({ children }: { children: ReactNode }) {
  const { usuario } = await usuarioAtual();
  return (
    <Screen>
      <h1>Gamificação</h1>
      <AbasSecao rotulo="Seções da gamificação" abas={abasDaGamificacao(usuario)} />
      {children}
    </Screen>
  );
}
