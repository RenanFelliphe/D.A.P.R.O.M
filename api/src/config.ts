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
  SUPABASE_JWT_SECRET: z.string().min(1),
  SAP_API_URL: z.string().default(""),
  SAP_API_TOKEN: z.string().default(""),
  SAP_SIMULADO: booleano,
  SAP_LEITURA_INTERVALO_MIN: z.coerce.number().int().positive().default(15),
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
    supabaseUrl: e.SUPABASE_URL.replace(/\/$/, ""),
    supabaseServiceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY,
    supabaseJwtSecret: e.SUPABASE_JWT_SECRET,
    sapApiUrl: e.SAP_API_URL.replace(/\/$/, ""),
    sapApiToken: e.SAP_API_TOKEN,
    sapSimulado: e.SAP_SIMULADO,
    sapLeituraIntervaloMin: e.SAP_LEITURA_INTERVALO_MIN,
    smtpUrl: e.SMTP_URL,
    emailRemetente: e.EMAIL_REMETENTE,
    painelUrl: e.PAINEL_URL.replace(/\/$/, ""),
  };
}
