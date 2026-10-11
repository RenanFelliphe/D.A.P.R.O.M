import { PainelAcoes } from "@/components/app/AppChrome";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

interface AtalhosChecklistProps {
  aoIrParaPergunta9: () => void;
  aoResponderResto: () => void;
}

/** Lateral: aviso de rascunho e atalhos de demonstração. */
export function AtalhosChecklist({ aoIrParaPergunta9, aoResponderResto }: AtalhosChecklistProps) {
  return (
    <PainelAcoes>
      <div className="row g8 small" style={{ alignItems: "flex-start" }}>
        <Icon name="save" size={16} style={{ marginTop: 2 }} />
        Rascunho salvo no aparelho. Se o app fechar, você continua daqui.
      </div>
      <div className="stack g8">
        <Button variant="line" sm block onClick={aoIrParaPergunta9}>
          Atalho: ir à pergunta 9
        </Button>
        <Button variant="line" sm block onClick={aoResponderResto}>
          Atalho: responder o resto
        </Button>
      </div>
    </PainelAcoes>
  );
}
