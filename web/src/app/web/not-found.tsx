import { NaoEncontrado } from "@/components/erro/NaoEncontrado";
import { rotas } from "@/lib/rotas";

export default function NaoEncontradoNoPainel() {
  return <NaoEncontrado inicio={rotas.app.lista} rotuloInicio="Ir para o quadro de OS" />;
}
