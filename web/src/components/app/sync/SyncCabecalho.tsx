import { CabecalhoPagina } from "@/components/app/AppChrome";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import type { SituacaoSync } from "@/state/sincronizacao";

const rotuloSelo: Record<SituacaoSync, string> = {
  parada: "Com sinal",
  enviando: "Enviando",
  concluida: "Sincronizado 12:41",
};

/** Cabeçalho da sincronização: situação do sinal e do envio. */
export function SyncCabecalho({ situacao }: { situacao: SituacaoSync }) {
  const concluida = situacao === "concluida";
  return (
    <CabecalhoPagina
      acoes={
        <Badge style={{ background: "#1F3A2B", color: "#8FE0AE", height: 36, padding: "0 14px", fontSize: 13 }}>
          <Icon name={concluida ? "check" : "refresh"} size={16} className={situacao === "enviando" ? "spin" : undefined} />
          <span>{rotuloSelo[situacao]}</span>
        </Badge>
      }
    >
      <h1>Sincronização</h1>
      <span className="muted">
        {concluida ? "Tudo enviado · OS 4031187 já aparece no painel" : "Sinal recuperado às 12:38"}
      </span>
    </CabecalhoPagina>
  );
}
