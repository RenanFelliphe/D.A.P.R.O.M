import { Badge } from "@/components/ui/Badge";
import type { OsHistorico } from "@/data/perfil";

const situacoes = {
  encerrada: { tone: "enc", rotulo: "Encerrada" },
  execucao: { tone: "exe", rotulo: "Em execução" },
} as const;

/** Linha do histórico de OS do técnico. */
export function LinhaHistorico({ os }: { os: OsHistorico }) {
  const situacao = situacoes[os.situacao];
  return (
    <div className="list-row" style={{ minHeight: 64 }}>
      <span className="stack" style={{ flex: 1, lineHeight: 1.3 }}>
        <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
          {os.numero}
        </span>
        <span style={{ fontSize: 14 }}>{os.descricao}</span>
        <span className="small">{os.detalhe}</span>
      </span>
      <Badge tone={situacao.tone}>{situacao.rotulo}</Badge>
    </div>
  );
}
