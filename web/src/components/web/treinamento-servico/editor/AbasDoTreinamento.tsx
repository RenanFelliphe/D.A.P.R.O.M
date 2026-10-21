"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { rotas, type TelaDoTreinamento } from "@/lib/rotas";

const ABAS: { tela?: TelaDoTreinamento; rotulo: string; icone: IconName }[] = [
  { rotulo: "Visão geral", icone: "grid" },
  { tela: "explicacao", rotulo: "Explicação", icone: "chat" },
  { tela: "fases", rotulo: "Fases do jogo", icone: "play" },
  { tela: "revisao", rotulo: "Revisão", icone: "check" },
  { tela: "versoes", rotulo: "Versões", icone: "layers" },
  { tela: "problemas", rotulo: "Problemas", icone: "flag" },
];

const decodificar = (caminho: string) => {
  try {
    return decodeURIComponent(caminho);
  } catch {
    return caminho;
  }
};

/**
 * As abas do treinamento do admin, na ordem do trabalho: visão geral, o conteúdo (explicação e fases), a revisão e o histórico.
 * Compara os caminhos decodificados (o código do serviço pode ter barra, `%2F` na URL) e a visão geral só pelo caminho exato.
 */
export function AbasDoTreinamento({ codigo, problemasAbertos, admin = true }: { codigo: string; problemasAbertos: number; /** Os problemas reportados são só do admin: a aba some para o supervisor que cria o treinamento. */ admin?: boolean }) {
  const atual = decodificar(usePathname());
  return (
    <nav className="abas ts-abas" aria-label="Partes do treinamento">
      {ABAS.filter((aba) => admin || aba.tela !== "problemas").map((aba) => {
        const href = rotas.app.treinamentoServico(codigo, aba.tela);
        return (
          <Link key={aba.rotulo} href={href} aria-current={decodificar(href) === atual ? "page" : undefined}>
            <Icon name={aba.icone} size={16} />
            {aba.rotulo}
            {aba.tela === "problemas" && problemasAbertos > 0 && <span className="ts-aba-qtd">{problemasAbertos}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
