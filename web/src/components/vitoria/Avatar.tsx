import Image from "next/image";

/**
 * A foto de perfil da Vitória: sempre o mesmo rosto (`public/vitoria/icone.webp`, gerado por `scripts/gerar-vitoria.mjs`),
 * no botão flutuante, no cabeçalho, ao lado das mensagens e nos treinamentos. As outras expressões não são fotos: são as
 * figurinhas de `Figurinha`, que aparecem de vez em quando (`docs/ia-e-vitoria.md`, seção 4.13). Componente compartilhado: a mesma
 * personagem nos treinamentos de serviço (`components/web/treinamento-servico/AvatarVitoria.tsx`, que reexporta este) e no
 * assistente de ajuda (`components/vitoria/`).
 */
export function Avatar({ tamanho = 64, className }: { tamanho?: number; className?: string }) {
  return <Image src="/vitoria/icone.webp" alt="Vitória" width={tamanho} height={tamanho} className={className} unoptimized />;
}
