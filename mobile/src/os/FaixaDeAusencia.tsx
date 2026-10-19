import { useSessao } from "@/sessao/SessaoProvider";
import { Aviso } from "@/ui/Aviso";

/** O ausente só visualiza o sistema: a faixa "Ausente até DD/MM/AAAA" explica por que as ações de campo não aparecem. */
export function FaixaDeAusencia() {
  const { eu } = useSessao();
  if (!eu?.ausencia) return null;
  return (
    <Aviso tom="al" icone="lock-closed-outline" titulo={`${eu.ausencia.rotulo}.`}>
      Você só visualiza o sistema: não dá para aplicar APR nem iniciar a execução.
    </Aviso>
  );
}
