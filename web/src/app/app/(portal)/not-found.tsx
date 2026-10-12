import { NaoEncontrado } from "@/components/erro/NaoEncontrado";
import { rotas } from "@/lib/rotas";

export default function NaoEncontradoNoPortal() {
  return <NaoEncontrado inicio={rotas.app.lista} rotuloInicio="Ir para a lista de OS" />;
}
