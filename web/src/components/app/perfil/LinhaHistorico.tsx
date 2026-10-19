import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { data, duracao } from "@/lib/formatar";
import { urlDoPdf } from "@/lib/rotas";
import type { ExecucaoDoHistorico } from "../../../../../shared/api/os-app";

/** Linha de `GET /me/historico`, em `shared/api/os-app.ts` (o app `mobile` usa o mesmo tipo). */
export type { ExecucaoDoHistorico };

/** Linha do histórico de OS encerradas pelo técnico, com o link do PDF (a `api` o gera na hora se ainda estiver pendente). */
export function LinhaHistorico({ execucao }: { execucao: ExecucaoDoHistorico }) {
  return (
    <div className="list-row" style={{ minHeight: 64 }}>
      <span className="stack" style={{ flex: 1, lineHeight: 1.3 }}>
        <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
          OS {execucao.numero_ordem ?? "—"}
        </span>
        <span style={{ fontSize: 14 }}>{execucao.titulo}</span>
        <span className="small">
          {execucao.local_codigo} · {data(execucao.fim)} · {duracao(execucao.tempo_liquido_min)} líquidos
        </span>
      </span>
      <Badge tone="enc">Encerrada</Badge>
      <a className="btn btn-line btn-sm" href={urlDoPdf(execucao.os_id)} target="_blank" rel="noreferrer">
        <Icon name="file" size={16} />
        {execucao.pdf_pronto ? "PDF" : "PDF (gerando)"}
      </a>
    </div>
  );
}
