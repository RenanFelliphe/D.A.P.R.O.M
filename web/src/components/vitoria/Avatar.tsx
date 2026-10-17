import Image from "next/image";
import expressoes from "../../../public/vitoria/expressoes.json";
import type { ExpressaoVitoria } from "@/lib/treinamento-servico";

type MapaDeExpressoes = Record<string, { arquivo: string; uso: string }>;

/** As expressões dos treinamentos, mais "icone" (só o botão flutuante e o cabeçalho do chat da Vitória). */
export type ExpressaoDoAvatar = ExpressaoVitoria | "icone";

/**
 * A Vitória (avatar provisório, `vitoria/README.md`): resolve sempre pelo `expressoes.json`, nunca pelo nome do
 * arquivo, para o desenho definitivo poder substituir os SVGs sem mexer no código. Componente compartilhado — a mesma
 * personagem nos treinamentos de serviço (`components/web/treinamento-servico/AvatarVitoria.tsx`, que reexporta este) e
 * no assistente de ajuda (`components/vitoria/`).
 */
export function Avatar({ expressao, tamanho = 64, className }: { expressao: ExpressaoDoAvatar; tamanho?: number; className?: string }) {
  const entrada = (expressoes as MapaDeExpressoes)[expressao] ?? (expressoes as MapaDeExpressoes).padrao!;
  return <Image src={`/vitoria/${entrada.arquivo}`} alt="Vitória" width={tamanho} height={tamanho} className={className} unoptimized />;
}
