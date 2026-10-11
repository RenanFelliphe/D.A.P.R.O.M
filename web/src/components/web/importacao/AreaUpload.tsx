import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/** Área de arrastar a planilha .xlsx exportada do SAP. */
export function AreaUpload() {
  return (
    <div className="drop">
      <span className="ic">
        <Icon name="cloudup" size={24} />
      </span>
      <strong style={{ fontSize: 15 }}>Arraste a planilha .xlsx exportada do SAP</strong>
      <Button variant="p" sm aviso="Abriria o seletor de arquivos.">
        Selecionar arquivo
      </Button>
      <span className="small">A importação nunca reabre OS encerradas nem altera o que foi feito em campo.</span>
    </div>
  );
}
