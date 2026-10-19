import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/vitoria/Avatar";
import type { TreinamentoResumo } from "@/lib/treinamento-servico";

/**
 * O cartãozinho da Vitória no cartão do serviço: só aparece quando o serviço tem treinamento publicado. Para quem treina,
 * diz o que é e se já concluiu; para o admin, a versão no ar. O botão de jogar (ou de abrir no editor) fica no rodapé do
 * cartão, ao lado de "Ver materiais".
 */
export function TreinamentoNoCartao({ treinamento, admin }: { treinamento: TreinamentoResumo; admin: boolean }) {
  const fases = `${treinamento.total_fases} ${treinamento.total_fases === 1 ? "fase" : "fases"}`;
  return (
    <div className="ts-aba-cartao">
      <Avatar tamanho={40} />
      <div className="ts-aba-cartao-texto">
        <strong>{admin ? `Treinamento no ar · versão ${treinamento.versao}` : "Treinamento com a Vitória"}</strong>
        <span className="small">Explicação e jogo de {fases}</span>
      </div>
      {!admin &&
        (treinamento.concluido ? (
          <Badge tone="enc">
            <Icon name="check" size={13} />
            {treinamento.fases_certas}/{treinamento.total_fases}
          </Badge>
        ) : (
          <Badge tone="brand">Novo</Badge>
        ))}
    </div>
  );
}
