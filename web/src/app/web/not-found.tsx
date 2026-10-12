import { NaoEncontrado } from "@/components/erro/NaoEncontrado";
import { rotas } from "@/lib/rotas";

export default function NaoEncontradoNoPainel() {
  return <NaoEncontrado inicio={rotas.web.quadro} rotuloInicio="Ir para o quadro de OS" />;
}
