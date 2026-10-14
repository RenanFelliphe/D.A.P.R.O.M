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
  EMAIL_REMETENTE: z.string().default("daprom@localhost"),
  PAINEL_URL: z.string().default("http://localhost:3000"),
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
  /** Token que o registro usa para avisar o DAPROM (`POST /rh/avisos`). */
  rhAvisoToken: string;
  /** Para onde o simulador manda os avisos; só o simulador usa. */
  rhAvisoUrl: string;
  /** Hora (de São Paulo) da leitura diária completa do registro. */
  rhLeituraHora: number;
  smtpUrl: string;
  emailRemetente: string;
  painelUrl: string;
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
    painelUrl: e.PAINEL_URL.replace(/\/$/, ""),
  };
}
