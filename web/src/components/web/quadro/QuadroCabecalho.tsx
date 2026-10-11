import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { rotas } from "@/lib/telas";

/** Título do quadro com as ações de nova OS manual e importação do SAP. */
export function QuadroCabecalho() {
  return (
    <div className="row between wrap" style={{ alignItems: "flex-end" }}>
      <div className="stack" style={{ gap: 2 }}>
        <h1>Quadro de OS</h1>
        <span className="muted" style={{ fontSize: 14 }}>
          Serviços Especiais · outubro de 2026 · atualizado às 12:41
        </span>
      </div>
      <div className="row g8">
        <Button variant="line" sm aviso="Abriria o formulário de OS manual (inclui cadastrar o local).">
          <Icon name="plus" size={16} />
          Nova OS manual
        </Button>
        <LinkButton variant="p" sm href={rotas.web.importacao}>
          <Icon name="upload" size={16} />
          Importar planilha do SAP
        </LinkButton>
      </div>
    </div>
  );
}
