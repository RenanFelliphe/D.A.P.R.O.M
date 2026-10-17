/**
 * Popula o banco configurado em `.env`/`.env.local` com dados FICTÍCIOS de demonstração (usuários, equipes, locais e OS
 * em todos os estados do fluxo, com APRs, execuções, alertas e PDFs). Usa as mesmas regras da `api`, então os PDFs e os
 * alertas aparecem sozinhos quando a `api` está rodando (ela executa as tarefas). Não duplica: se já houver dados de
 * demonstração, não faz nada.
 *
 *   pnpm demo:popular
 *
 * Rode com a `api` já iniciada ao menos uma vez (migrações e modelos de APR). Nunca use com dados reais.
 */
import { lerConfig } from "../src/config";
import { conectar } from "../src/db/conexao";
import { popularDemo } from "../src/db/seed/demo";
import { ArmazenamentoSupabase } from "../src/servicos/armazenamento";
import { AuthSupabase } from "../src/servicos/auth";
import { EmailEmMemoria } from "../src/servicos/email";
import { ProvedorIAAnthropic, ProvedorIAIndisponivel } from "../src/servicos/ia";
import { ClienteRhHttp } from "../src/servicos/rh-http";
import { ClienteSapHttp } from "../src/servicos/sap-http";

const config = lerConfig();
const { pool, db } = conectar(config.databaseUrl);
try {
  const resultado = await popularDemo({
    db,
    config,
    auth: new AuthSupabase(config.supabaseUrl, config.supabaseServiceRoleKey),
    armazenamento: new ArmazenamentoSupabase(config.supabaseUrl, config.supabaseServiceRoleKey),
    email: new EmailEmMemoria(),
    sap: new ClienteSapHttp(config.sapApiUrl, config.sapApiToken),
    rh: new ClienteRhHttp(config.rhApiUrl, config.rhApiToken),
    ia: config.ia.ligada
      ? new ProvedorIAAnthropic(config.ia.anthropicApiKey, config.ia.modelos, config.vitoria.maxTokensResposta)
      : new ProvedorIAIndisponivel(),
    agora: () => new Date(),
  });
  if (resultado.jaPopulado) {
    console.log("O banco já tem dados de demonstração (OS 5100xxx); nada foi alterado.");
  } else {
    console.log("Dados de demonstração criados:", resultado.contagem);
    if (resultado.usuariosCriados.length > 0) {
      console.log("\nUsuários novos (senha inicial provisória: a pessoa define a dela no primeiro acesso):");
      for (const u of resultado.usuariosCriados) console.log(`  ${u.email.padEnd(36)} ${u.perfil.padEnd(10)} ${u.senha}`);
    }
  }
} finally {
  await pool.end();
}
