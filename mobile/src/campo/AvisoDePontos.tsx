import { textoDosPontosGanhos, type RespostaComPontos } from "@shared/api/gamificacao";
import { Aviso } from "@/ui/Aviso";

/** O "+N pontos" que a `api` devolve no evento, com o que gerou. Nada quando o evento não pontuou. */
export function AvisoDePontos({ resposta }: { resposta: RespostaComPontos | null | undefined }) {
  const texto = textoDosPontosGanhos(resposta);
  if (!texto) return null;
  return <Aviso tom="ok" icone="trophy-outline">{texto}</Aviso>;
}
