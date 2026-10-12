import { Screen } from "@/components/ui/Screen";

/** Estado de carregamento de uma página enquanto o servidor busca os dados na `api`. */
export function Carregando() {
  return (
    <Screen>
      <p className="muted" role="status" aria-live="polite">
        Carregando…
      </p>
    </Screen>
  );
}
