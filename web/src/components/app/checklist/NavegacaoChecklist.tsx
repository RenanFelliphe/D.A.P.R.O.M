import { Button } from "@/components/ui/Button";

interface NavegacaoChecklistProps {
  /** Índice (base 0) da pergunta atual. */
  indice: number;
  total: number;
  /** Só avança depois de responder (e de ter evidência, se reprovada). */
  podeAvancar: boolean;
  aoVoltar: () => void;
  aoAvancar: () => void;
}

/** Botões Anterior / Próxima (na última pergunta: "Revisar e concluir"). */
export function NavegacaoChecklist({ indice, total, podeAvancar, aoVoltar, aoAvancar }: NavegacaoChecklistProps) {
  return (
    <div className="nav2" style={{ maxWidth: 560 }}>
      <Button variant="line" disabled={indice === 0} onClick={aoVoltar}>
        Anterior
      </Button>
      <Button variant="p" id="ck-next" disabled={!podeAvancar} onClick={aoAvancar}>
        {indice === total - 1 ? "Revisar e concluir" : "Próxima"}
      </Button>
    </div>
  );
}
