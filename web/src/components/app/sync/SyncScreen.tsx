"use client";

import { Colunas } from "@/components/app/AppChrome";
import { ListaFila } from "@/components/app/sync/ListaFila";
import { ResumoSync } from "@/components/app/sync/ResumoSync";
import { SyncCabecalho } from "@/components/app/sync/SyncCabecalho";
import { SyncRodape } from "@/components/app/sync/SyncRodape";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { useSincronizacao } from "@/state/sincronizacao";

/** Fila e sincronização simuladas: arquivos → registros → novidades da equipe. */
export function SyncScreen() {
  const { estado, sincronizar } = useSincronizacao();
  const concluida = estado.situacao === "concluida";

  return (
    <Screen>
      <SyncCabecalho situacao={estado.situacao} />
      <Colunas
        principal={<ListaFila estado={estado} />}
        lateral={
          <>
            <ResumoSync estado={estado} />
            <div className="locked">
              {concluida ? (
                <>
                  <Icon name="check" size={16} style={{ color: "var(--enc)" }} />
                  <span style={{ color: "var(--enc)", fontWeight: 600 }}>
                    Novidades da equipe baixadas: 2 OS novas e 1 mudança de planejamento.
                  </span>
                </>
              ) : (
                <>
                  <Icon name="download" size={16} />
                  <span>Em seguida: baixar OS novas e mudanças de planejamento da equipe.</span>
                </>
              )}
            </div>
            <Notice tone="info" icon="shield">
              Reenviar nunca duplica registros. Se o sinal cair agora, o que já foi confirmado continua salvo e o resto
              tenta de novo sozinho.
            </Notice>
            <SyncRodape situacao={estado.situacao} aoSincronizar={sincronizar} />
          </>
        }
      />
    </Screen>
  );
}
