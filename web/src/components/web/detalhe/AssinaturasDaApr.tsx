import type { AprDaOs, ParticipanteApr } from "@/data/detalhe";
import { ImagemArquivo } from "@/components/ui/ImagemArquivo";
import { dataHora, hora } from "@/lib/formatar";

/**
 * A situação da assinatura de um participante na APR: quem assinou (com a hora; "presencial" quando foi no aparelho do
 * responsável, no modo offline), quem recusou (direito de recusa, com o motivo) e quem ainda não assinou. A APR bloqueada não
 * é assinada, então não mostra pendência.
 */
export function SituacaoDaAssinatura({ participante: p, aprovada }: { participante: ParticipanteApr; aprovada: boolean }) {
  if (p.recusou_em) {
    return (
      <span className="small" style={{ color: "var(--blq)", fontWeight: 500 }}>
        Recusou a APR em {hora(p.recusou_em)}
        {p.recusa_motivo ? `: “${p.recusa_motivo}”` : ""}
      </span>
    );
  }
  if (p.assinada_em) {
    return (
      <span className="small" style={{ color: "var(--enc)" }}>
        Assinou às {hora(p.assinada_em)}
        {p.assinatura_presencial ? " (presencial)" : ""}
      </span>
    );
  }
  return aprovada ? <span className="small">Ainda não assinou</span> : null;
}

/**
 * As assinaturas da APR para o relatório da execução: uma linha por participante, com a imagem da assinatura, a hora, se foi
 * presencial e, para quem recusou, o motivo. Cobre o caso de o modelo não ter a coluna Assinatura (o PDF da OS só reproduz a folha).
 */
export function AssinaturasDaApr({ apr }: { apr: AprDaOs }) {
  return (
    <div className="stack g8">
      <div className="small" style={{ color: "var(--ink4)" }}>
        APR {apr.modelo.codigo} · {dataHora(apr.concluida_em)}
      </div>
      <div className="row g12 wrap">
        {apr.participantes.map((p) => (
          <div key={p.usuario_id} className="stack g4" style={{ maxWidth: 260, minWidth: 0, flex: "1 1 160px" }}>
            <div className="sig-box" style={{ background: "#fff" }}>
              {p.assinatura_path ? (
                <ImagemArquivo id={p.assinatura_path} alt={`Assinatura de ${p.nome} na APR`} style={{ width: "100%", height: 56, objectFit: "contain" }} />
              ) : (
                <span className="small" style={{ display: "block", textAlign: "center", padding: "18px 0" }}>
                  {p.recusou_em ? "recusou" : "sem assinatura"}
                </span>
              )}
            </div>
            <div className="small">
              {p.nome} · mat. {p.matricula}
            </div>
            <SituacaoDaAssinatura participante={p} aprovada />
          </div>
        ))}
      </div>
    </div>
  );
}
