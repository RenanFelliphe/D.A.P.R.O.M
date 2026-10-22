import type { ReactNode } from "react";
import { Screen } from "@/components/ui/Screen";
import { AbasSecao } from "@/components/web/AbasSecao";
import { abasDasConfiguracoes } from "@/components/web/configuracoes/secao";
import { usuarioAtual } from "@/lib/api";

/**
 * Seção Configurações, a mesma para todos os perfis liberados: o título e as abas Minha conta (assinatura, e-mails, senha e privacidade
 * no ranking) e, só para o admin, Sistema (cidade padrão da previsão do tempo, horários das rotinas e controle da IA).
 */
export default async function SecaoConfiguracoesLayout({ children }: { children: ReactNode }) {
  const { usuario } = await usuarioAtual();
  const abas = abasDasConfiguracoes(usuario);
  return (
    <Screen>
      <h1>Configurações</h1>
      {abas.length > 1 && <AbasSecao rotulo="Seções das configurações" abas={abas} />}
      {children}
    </Screen>
  );
}
