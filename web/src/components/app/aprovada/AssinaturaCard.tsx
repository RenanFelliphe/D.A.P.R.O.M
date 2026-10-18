import { Icon } from "@/components/ui/Icon";
import { ImagemArquivo } from "@/components/ui/ImagemArquivo";
import { cx } from "@/lib/cx";
import { dataHora, hora } from "@/lib/formatar";

export interface LinhaDeAssinatura {
  usuarioId: string;
  nome: string;
  funcao: "responsavel" | "executor";
  /** Id do arquivo da assinatura copiada do perfil para a APR; `null` = ainda não assinou. */
  assinaturaPath: string | null;
  /** Quando assinou; `null` = pendente. */
  assinadaEm: string | null;
  /** Assinou no aparelho do responsável (contingência offline). */
  presencial?: boolean;
  /** O direito de recusa: quando saiu da APR e por quê. */
  recusouEm?: string | null;
  recusaMotivo?: string | null;
  eu: boolean;
}

/**
 * O estado da assinatura de um participante da APR: assinou (com a hora e a imagem), está pendente (aguardando a pessoa assinar
 * na própria conta) ou recusou (com o motivo). Só mostra: quem assina é cada um, na própria conta.
 */
export function AssinaturaCard({ linha }: { linha: LinhaDeAssinatura }) {
  const recusou = Boolean(linha.recusouEm);
  const assinou = !recusou && linha.assinadaEm !== null;
  return (
    <div className="card stack g6" data-estado={recusou ? "recusou" : assinou ? "assinou" : "pendente"}>
      <div className="row between wrap g8">
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {linha.nome}
          {linha.eu ? " (você)" : ""} <span style={{ fontWeight: 400, color: "var(--ink3)" }}>· {linha.funcao === "responsavel" ? "Responsável" : "Executor"}</span>
        </span>
        {assinou ? (
          <span className="ans-ok" style={{ fontSize: 12.5 }}>
            <Icon name="check" size={13} />
            Assinou às {hora(linha.assinadaEm!)}
            {linha.presencial ? " · no aparelho do responsável" : ""}
          </span>
        ) : recusou ? (
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--blq)" }}>
            <Icon name="x" size={13} /> Recusou a APR
          </span>
        ) : (
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink3)" }}>
            <Icon name="clock" size={13} /> Aguardando a assinatura
          </span>
        )}
      </div>
      {assinou && linha.assinaturaPath && (
        <div className={cx("sig-box")}>
          <ImagemArquivo id={linha.assinaturaPath} alt={`Assinatura de ${linha.nome}`} style={{ height: 56, maxWidth: "100%", objectFit: "contain" }} />
        </div>
      )}
      {recusou && (
        <p className="small">
          Saiu da APR em {dataHora(linha.recusouEm!)}: <strong>{linha.recusaMotivo ?? "sem motivo registrado"}</strong>
        </p>
      )}
      {!assinou && !recusou && (
        <p className="small">{linha.eu ? "Falta a sua assinatura: use “Assinar a APR” ou recuse, se não concorda." : `${linha.nome.split(" ")[0]} assina na própria conta e esta tela se atualiza sozinha.`}</p>
      )}
    </div>
  );
}
