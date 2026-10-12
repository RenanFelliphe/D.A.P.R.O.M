import { Icon } from "@/components/ui/Icon";

/** Selo "TREINO" da barra do topo: cor própria (violeta), para nunca ser confundido com o sistema real. */
export function SeloTreino() {
  return (
    <span className="tr-selo" title="Você está no Campo de treino: os dados são fictícios">
      <Icon name="shield" size={16} />
      <span className="sr">Modo </span>TREINO
    </span>
  );
}
