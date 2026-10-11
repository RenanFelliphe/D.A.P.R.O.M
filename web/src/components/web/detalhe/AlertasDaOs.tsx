import { Panel } from "@/components/web/Panel";

/** Painel lateral de alertas da OS (estado sem alertas). */
export function AlertasDaOs() {
  return (
    <Panel style={{ gap: 6 }}>
      <h2>Alertas desta OS</h2>
      <p className="muted">Nenhum alerta. Sem conflito de planejamento nem execução duplicada.</p>
    </Panel>
  );
}
