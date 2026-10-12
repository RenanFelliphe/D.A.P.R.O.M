import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";

interface EmBreveProps {
  titulo: string;
  descricao: string;
}

/** Página ainda sem conteúdo: título, o que ela vai oferecer e o aviso de que está em desenvolvimento. */
export function EmBreve({ titulo, descricao }: EmBreveProps) {
  return (
    <Screen>
      <div className="stack g4">
        <h1>{titulo}</h1>
        <span className="muted">{descricao}</span>
      </div>
      <Notice tone="info" icon="clock">
        <strong>Em breve!</strong> Esta página está em desenvolvimento.
      </Notice>
    </Screen>
  );
}
