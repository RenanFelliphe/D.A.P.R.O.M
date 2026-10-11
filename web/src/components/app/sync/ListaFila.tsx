import { Icon, type IconName } from "@/components/ui/Icon";
import { registrosFila, totalArquivos } from "@/data/sincronizacao";
import type { EstadoSync } from "@/state/sincronizacao";

type SituacaoRegistro = "ok" | "enviando" | "fila";

const apresentacao: Record<SituacaoRegistro, { icone: IconName; texto: string }> = {
  ok: { icone: "check", texto: "Confirmado" },
  enviando: { icone: "cloudup", texto: "Enviando…" },
  fila: { icone: "clock", texto: "Na fila" },
};

/** Registros só começam a subir depois que todos os arquivos foram enviados; sobe um por vez. */
function situacaoDoRegistro(estado: EstadoSync, indice: number): SituacaoRegistro {
  if (estado.situacao === "concluida" || indice < estado.registros) return "ok";
  if (estado.situacao === "enviando" && estado.arquivos >= totalArquivos && indice === estado.registros) {
    return "enviando";
  }
  return "fila";
}

/** Registros guardados no aparelho; o atributo data-s é lido pelo CSS. */
export function ListaFila({ estado }: { estado: EstadoSync }) {
  return (
    <div className="stack g8">
      <h2 className="lbl" style={{ fontSize: 13 }}>
        Registros no aparelho
      </h2>
      <div className="list-box">
        {registrosFila.map((registro, i) => {
          const situacao = situacaoDoRegistro(estado, i);
          const { icone, texto } = apresentacao[situacao];
          return (
            <div key={registro.titulo} className="sync-row" data-s={situacao}>
              <span className="sync-ic">
                <Icon name={icone} size={16} />
              </span>
              <span className="stack" style={{ flex: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{registro.titulo}</span>
                <span className="small">{registro.detalhe}</span>
              </span>
              <span className="st">{texto}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
