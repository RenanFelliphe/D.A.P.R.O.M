import { Assinatura } from "@/components/ui/Assinatura";
import { Button } from "@/components/ui/Button";

/** Rubrica cadastrada do técnico, com opção de refazer. */
export function MinhaAssinatura() {
  return (
    <div className="stack g8">
      <h2 style={{ fontSize: 16, fontWeight: 600 }}>Minha assinatura</h2>
      <div className="card stack g8">
        <div className="sig-box" style={{ height: 72 }}>
          <Assinatura pessoa="carlos" />
        </div>
        <div className="row between g12">
          <span className="small">Rubrica cadastrada em 02/10/2026. Você a confirma a cada assinatura.</span>
          <Button variant="line" sm aviso="Abriria a tela para desenhar a assinatura de novo.">
            Refazer
          </Button>
        </div>
      </div>
    </div>
  );
}
