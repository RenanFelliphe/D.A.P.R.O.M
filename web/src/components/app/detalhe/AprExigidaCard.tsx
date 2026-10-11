import { Icon } from "@/components/ui/Icon";
import type { ModeloResumo } from "@/lib/apr";
import { dataHora } from "@/lib/formatar";
import type { AprDaOs } from "@/lib/os-app";
import type { OsStatus } from "@/lib/tipos";

interface AprExigidaCardProps {
  /** Versão publicada mais recente do modelo da atividade da OS. */
  modelo: ModeloResumo | null;
  /** Código do modelo que a atividade da OS indica (`null` = atividade sem modelo mapeado). */
  codigoDoModelo: string | null;
  aprs: AprDaOs[];
  status: OsStatus;
}

/** Card que explica a APR exigida antes de executar a OS: o modelo e a versão que vão valer. */
export function AprExigidaCard({ modelo, codigoDoModelo, aprs, status }: AprExigidaCardProps) {
  const bloqueadas = aprs.filter((a) => a.resultado === "bloqueada");
  const ultima = bloqueadas[bloqueadas.length - 1];
  return (
    <div className="card stack g6">
      <div className="row g8">
        <Icon name="clip" size={18} style={{ color: "var(--brand)" }} />
        <h2 style={{ fontSize: 15, fontWeight: 600 }}>APR exigida antes de executar</h2>
      </div>
      {modelo ? (
        <>
          <div style={{ fontSize: 14 }}>
            {modelo.codigo} — {modelo.titulo} · versão {modelo.versao}
          </div>
          <div className="muted">
            Esta OS tem uma APR própria: ela não vale para outras OS do mesmo local. O modelo vem do tipo de atividade da OS.
          </div>
        </>
      ) : (
        <div className="muted">
          {codigoDoModelo
            ? `O modelo ${codigoDoModelo} da atividade desta OS ainda não tem versão publicada: você escolhe o modelo ao iniciar a APR.`
            : "A atividade desta OS ainda não está ligada a um modelo de APR: você escolhe o modelo ao iniciar a APR."}
        </div>
      )}
      {status === "pendente" && ultima && (
        <div className="muted">
          {bloqueadas.length === 1 ? "Há 1 APR anterior negativa" : `Há ${bloqueadas.length} APR anteriores negativas`} (última em{" "}
          {dataHora(ultima.concluida_em)}): qualquer pessoa da equipe pode fazer a nova.
        </div>
      )}
    </div>
  );
}
