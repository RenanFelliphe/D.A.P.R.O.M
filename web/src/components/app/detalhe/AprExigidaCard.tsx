import { Icon } from "@/components/ui/Icon";
import { dataHora } from "@/lib/formatar";
import type { AprDaOs } from "@/lib/os-app";
import type { OsStatus } from "@/lib/tipos";

interface AprExigidaCardProps {
  aprs: AprDaOs[];
  status: OsStatus;
}

/** Card que explica a APR exigida antes de executar a OS: o técnico escolhe o modelo ao iniciar, com a recomendação do sistema. */
export function AprExigidaCard({ aprs, status }: AprExigidaCardProps) {
  const bloqueadas = aprs.filter((a) => a.resultado === "bloqueada");
  const ultima = bloqueadas[bloqueadas.length - 1];
  return (
    <div className="card stack g6" data-treino="os-apr-exigida">
      <div className="row g8">
        <Icon name="clip" size={18} style={{ color: "var(--brand)" }} />
        <h2 style={{ fontSize: 15, fontWeight: 600 }}>APR exigida antes de executar</h2>
      </div>
      <div className="muted">
        Você escolhe o modelo ao iniciar a APR, entre os publicados; o sistema recomenda um pelo que a OS descreve. Esta OS tem uma APR
        própria: ela não vale para outras OS do mesmo local.
      </div>
      {status === "pendente" && ultima && (
        <div className="muted">
          {bloqueadas.length === 1 ? "Há 1 APR anterior negativa" : `Há ${bloqueadas.length} APR anteriores negativas`} (última em{" "}
          {dataHora(ultima.concluida_em)}): qualquer pessoa da equipe pode fazer a nova.
        </div>
      )}
    </div>
  );
}
