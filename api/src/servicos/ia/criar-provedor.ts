import type { Config } from "../../config";
import { ProvedorIAAnthropic } from "./provedor-anthropic";
import { ProvedorIAGemini } from "./provedor-gemini";
import { ProvedorIAIndisponivel } from "./provedor-indisponivel";
import type { ProvedorIA } from "./tipos";

/**
 * O único lugar que decide qual provedor de IA a `api` usa (`IA_PROVEDOR`): sem a chave do provedor escolhido, fica o
 * `ProvedorIAIndisponivel`. Trocar de fornecedor é mudar variáveis de ambiente; quem chama só enxerga `ProvedorIA`.
 */
export function criarProvedorIA(ia: Config["ia"], maxTokensPadrao: number): ProvedorIA {
  if (!ia.ligada) return new ProvedorIAIndisponivel();
  return ia.provedor === "gemini"
    ? new ProvedorIAGemini(ia.apiKey, ia.modelos, maxTokensPadrao)
    : new ProvedorIAAnthropic(ia.apiKey, ia.modelos, maxTokensPadrao);
}
