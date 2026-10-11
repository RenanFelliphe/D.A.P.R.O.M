import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/web/Panel";

/** Atalho para criar uma OS que ainda não está no SAP. */
export function OsManual() {
  return (
    <Panel style={{ gap: 10 }}>
      <h2>OS fora do SAP</h2>
      <p className="muted">
        Para uma corretiva urgente que ainda não está no SAP, crie a OS manualmente. Ela entra no quadro e no celular da
        equipe na próxima sincronização.
      </p>
      <Button variant="line" sm aviso="Abriria o formulário de OS manual.">
        <Icon name="plus" size={16} />
        Nova OS manual
      </Button>
    </Panel>
  );
}
