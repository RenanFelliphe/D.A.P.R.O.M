import type { Config } from "../config";
import { ErroApi } from "../http/erros";
import type { IAIndisponivel } from "../servicos/ia";

const MINUTO_MS = 60_000;

/** Quando a cota diária do Gemini renova: meia-noite do Pacífico (4h de Brasília no horário de verão americano, 5h fora dele). */
export function proximaRenovacaoDoGemini(agora: Date): Date {
  const formatar = (opcoes: Intl.DateTimeFormatOptions) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Los_Angeles", hourCycle: "h23", ...opcoes }).format(agora));
  const minutosAteMeiaNoite = (24 - formatar({ hour: "2-digit" })) * 60 - formatar({ minute: "2-digit" });
  return new Date(agora.getTime() + minutosAteMeiaNoite * MINUTO_MS);
}

const horaBr = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(d);

/**
 * A falha da IA traduzida para o admin, com um código por origem (para a tela mostrar o título certo) e uma mensagem que
 * diz de quem é o problema e quando tentar de novo. `complemento` fecha a frase com o que fazer na tela de quem chamou.
 */
export function erroDaIAParaAdmin(erro: IAIndisponivel, ia: Config["ia"], agora: Date, complemento: string): ErroApi {
  const gemini = ia.provedor === "gemini";
  const fornecedor = gemini ? "Gemini (Google)" : "Claude (Anthropic)";
  const variavelDaChave = gemini ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY";
  const espera = erro.esperarSegundos;
  switch (erro.motivo) {
    case "cota":
      return new ErroApi(
        429,
        "ia_sem_cota",
        gemini
          ? `A cota diária gratuita do ${fornecedor} acabou. Ela renova às ${horaBr(proximaRenovacaoDoGemini(agora))} (horário de Brasília). ${complemento}`
          : `O crédito pré-pago da conta na Anthropic (Claude) acabou: recarregue no console da Anthropic. ${complemento}`,
      );
    case "limite_por_minuto":
      return new ErroApi(
        429,
        "ia_limite_por_minuto",
        `O ${fornecedor} recusou por excesso de pedidos em pouco tempo (limite por minuto, não a cota do dia). Tente de novo ${espera ? `daqui a ${espera} s` : "em 1 minuto"}. ${complemento}`,
      );
    case "sobrecarga":
      return new ErroApi(503, "ia_sobrecarregada", `O servidor do ${fornecedor} está lotado agora; não é um problema do SYNQ OS. Tente de novo em alguns minutos. ${complemento}`);
    case "chave":
      return new ErroApi(503, "ia_chave_recusada", `A chave da IA está ausente ou foi recusada pelo ${fornecedor}: confira a ${variavelDaChave} na configuração da api. ${complemento}`);
    case "rede":
      return new ErroApi(503, "ia_inacessivel", `O servidor do SYNQ OS não conseguiu falar com o ${fornecedor} (rede fora do ar ou tempo esgotado). Tente de novo em instantes. ${complemento}`);
    default:
      return new ErroApi(502, "ia_falhou", `O ${fornecedor} recusou o pedido (${erro.message.slice(0, 160)}). ${complemento}`);
  }
}
