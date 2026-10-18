import { z } from "zod";

const booleano = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const esquema = z.object({
  PORT: z.coerce.number().int().default(3333),
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  /** Só para projetos com o segredo JWT legado (HS256); projetos com chaves assimétricas não precisam dele. */
  SUPABASE_JWT_SECRET: z.string().default(""),
  SAP_API_URL: z.string().default(""),
  SAP_API_TOKEN: z.string().default(""),
  SAP_SIMULADO: booleano,
  SAP_LEITURA_INTERVALO_MIN: z.coerce.number().int().positive().default(15),
  RH_SIMULADO: booleano,
  RH_API_URL: z.string().default(""),
  RH_API_TOKEN: z.string().default(""),
  RH_AVISO_TOKEN: z.string().default(""),
  RH_AVISO_URL: z.string().default(""),
  RH_LEITURA_HORA: z.coerce.number().int().min(0).max(23).default(3),
  SMTP_URL: z.string().default(""),
  EMAIL_REMETENTE: z.string().default("synqos@localhost"),
  EMAIL_RESUMO_HORA: z.coerce.number().int().min(0).max(23).default(7),
  PAINEL_URL: z.string().default("http://localhost:3000"),
  VITORIA_LIMITE_POR_CONVERSA: z.coerce.number().int().positive().default(20),
  VITORIA_LIMITE_POR_CONTA_DIA: z.coerce.number().int().positive().default(40),
  VITORIA_LIMITE_GLOBAL_DIA: z.coerce.number().int().positive().default(1000),
  VITORIA_MAX_TOKENS_RESPOSTA: z.coerce.number().int().positive().default(1024),
  TREINAMENTO_IA_LIMITE_TREINAMENTOS: z.coerce.number().int().min(0).default(3),
  TREINAMENTO_IA_LIMITE_RODADAS: z.coerce.number().int().min(0).default(4),
  TREINAMENTO_IA_MAX_TOKENS: z.coerce.number().int().positive().default(16000),
});

/**
 * Módulo de IA: `IA_PROVEDOR` escolhe o fornecedor e cada um tem a sua chave e os seus modelos. Sem a chave do escolhido, a
 * api sobe normalmente e fica "desligada" (vitoria.md, seção 1). Separado do esquema geral para o `local.ts` reaproveitar.
 */
const esquemaIA = z.object({
  IA_PROVEDOR: z.enum(["anthropic", "gemini"]).default("anthropic"),
  ANTHROPIC_API_KEY: z.string().trim().default(""),
  ANTHROPIC_MODELO_VITORIA: z.string().default("claude-haiku-5-5"),
  ANTHROPIC_MODELO_RASCUNHO: z.string().default("claude-opus-5-5"),
  ANTHROPIC_MODELO_DIGITALIZACAO: z.string().default("claude-haiku-5-5"),
  GEMINI_API_KEY: z.string().trim().default(""),
  GEMINI_MODELO_VITORIA: z.string().default("gemini-3.8-flash"),
  GEMINI_MODELO_RASCUNHO: z.string().default("gemini-3.8-flash"),
  GEMINI_MODELO_DIGITALIZACAO: z.string().default("gemini-3.8-flash"),
});

export interface Config {
  porta: number;
  versao: string;
  databaseUrl: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  supabaseJwtSecret: string;
  sapApiUrl: string;
  sapApiToken: string;
  sapSimulado: boolean;
  sapLeituraIntervaloMin: number;
  /** Registro de funcionários (RH): simulado na própria api (`apifuncionarios.md`). */
  rhSimulado: boolean;
  rhApiUrl: string;
  rhApiToken: string;
  /** Token que o registro usa para avisar o SYNQ OS (`POST /rh/avisos`). */
  rhAvisoToken: string;
  /** Para onde o simulador manda os avisos; só o simulador usa. */
  rhAvisoUrl: string;
  /** Hora (de São Paulo) da leitura diária completa do registro. */
  rhLeituraHora: number;
  /** Servidor de e-mail (`smtp://usuario:senha@servidor:587`); vazio, os avisos ficam só no sino. */
  smtpUrl: string;
  emailRemetente: string;
  /** Hora (de São Paulo) a partir da qual sai o resumo diário por e-mail. */
  emailResumoHora: number;
  painelUrl: string;
  /** Módulo de IA genérico (`servicos/ia`): `ligada` é o único ponto de decisão "tem IA ou não" (vitoria.md, seção 1). */
  ia: {
    provedor: "anthropic" | "gemini";
    /** A chave do provedor escolhido (`ANTHROPIC_API_KEY` ou `GEMINI_API_KEY`). */
    apiKey: string;
    ligada: boolean;
    /** Nome real do modelo do provedor escolhido para cada uso lógico (`ProvedorIA`); troca sem mudar código. */
    modelos: { vitoria: string; rascunho: string; digitalizacao: string };
  };
  /** Limites de uso da Vitória (preenchidos já nesta fase; só passam a valer quando a rota dela existir). */
  vitoria: {
    limitePorConversa: number;
    limitePorContaDia: number;
    limiteGlobalDia: number;
    maxTokensResposta: number;
  };
  /**
   * Limites do rascunho de treinamento pela IA (vitoria.md, seção 3.6), separados dos da Vitória: quantos treinamentos
   * podem usar a IA, quantas rodadas cada um tem (pedido no chat, fase regerada ou nova geração) e o tamanho da resposta.
   */
  treinamentoIa: {
    limiteTreinamentos: number;
    limiteRodadas: number;
    maxTokens: number;
  };
}

/** Escolhe a chave e os modelos do provedor de IA indicado em `IA_PROVEDOR` (padrão: a Anthropic). */
export function lerConfigIA(env: NodeJS.ProcessEnv = process.env): Config["ia"] {
  const e = esquemaIA.parse(env);
  if (e.IA_PROVEDOR === "gemini") {
    return {
      provedor: "gemini",
      apiKey: e.GEMINI_API_KEY,
      ligada: Boolean(e.GEMINI_API_KEY),
      modelos: { vitoria: e.GEMINI_MODELO_VITORIA, rascunho: e.GEMINI_MODELO_RASCUNHO, digitalizacao: e.GEMINI_MODELO_DIGITALIZACAO },
    };
  }
  return {
    provedor: "anthropic",
    apiKey: e.ANTHROPIC_API_KEY,
    ligada: Boolean(e.ANTHROPIC_API_KEY),
    modelos: { vitoria: e.ANTHROPIC_MODELO_VITORIA, rascunho: e.ANTHROPIC_MODELO_RASCUNHO, digitalizacao: e.ANTHROPIC_MODELO_DIGITALIZACAO },
  };
}

/** Lê as variáveis de ambiente da `api` (ver a seção Plataforma da especificação); falha na subida se faltar alguma. */
export function lerConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const e = esquema.parse(env);
  return {
    porta: e.PORT,
    versao: process.env.npm_package_version ?? "0.1.0",
    databaseUrl: e.DATABASE_URL,
    // Só a origem: quem copia a URL do painel costuma trazer `/rest/v1` ou barra no fim.
    supabaseUrl: new URL(e.SUPABASE_URL).origin,
    supabaseServiceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY,
    supabaseJwtSecret: e.SUPABASE_JWT_SECRET,
    // Com o simulador ligado, o endereço e o token têm padrão: a própria api responde em /sap-simulado.
    sapApiUrl: e.SAP_API_URL.replace(/\/$/, "") || (e.SAP_SIMULADO ? `http://127.0.0.1:${e.PORT}/sap-simulado` : ""),
    sapApiToken: e.SAP_API_TOKEN || (e.SAP_SIMULADO ? "token-de-desenvolvimento" : ""),
    sapSimulado: e.SAP_SIMULADO,
    sapLeituraIntervaloMin: e.SAP_LEITURA_INTERVALO_MIN,
    // Mesmo esquema do SAP: com o simulador ligado, endereços e tokens têm padrão.
    rhSimulado: e.RH_SIMULADO,
    rhApiUrl: e.RH_API_URL.replace(/\/$/, "") || (e.RH_SIMULADO ? `http://127.0.0.1:${e.PORT}/rh-simulado` : ""),
    rhApiToken: e.RH_API_TOKEN || (e.RH_SIMULADO ? "token-rh-de-desenvolvimento" : ""),
    rhAvisoToken: e.RH_AVISO_TOKEN || (e.RH_SIMULADO ? "token-aviso-rh-de-desenvolvimento" : ""),
    rhAvisoUrl: e.RH_AVISO_URL || (e.RH_SIMULADO ? `http://127.0.0.1:${e.PORT}/rh/avisos` : ""),
    rhLeituraHora: e.RH_LEITURA_HORA,
    smtpUrl: e.SMTP_URL,
    emailRemetente: e.EMAIL_REMETENTE,
    emailResumoHora: e.EMAIL_RESUMO_HORA,
    painelUrl: e.PAINEL_URL.replace(/\/$/, ""),
    ia: lerConfigIA(env),
    vitoria: {
      limitePorConversa: e.VITORIA_LIMITE_POR_CONVERSA,
      limitePorContaDia: e.VITORIA_LIMITE_POR_CONTA_DIA,
      limiteGlobalDia: e.VITORIA_LIMITE_GLOBAL_DIA,
      maxTokensResposta: e.VITORIA_MAX_TOKENS_RESPOSTA,
    },
    treinamentoIa: {
      limiteTreinamentos: e.TREINAMENTO_IA_LIMITE_TREINAMENTOS,
      limiteRodadas: e.TREINAMENTO_IA_LIMITE_RODADAS,
      maxTokens: e.TREINAMENTO_IA_MAX_TOKENS,
    },
  };
}
