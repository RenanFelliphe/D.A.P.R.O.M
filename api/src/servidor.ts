import { serve } from "@hono/node-server";
import { criarApp } from "./app";
import { lerConfig } from "./config";
import { conectar, migrarComTrava } from "./db/conexao";
import { carregarDadosIniciais } from "./db/seed/carregar";
import { ArmazenamentoSupabase } from "./servicos/armazenamento";
import { AuthSupabase } from "./servicos/auth";
import { EmailEmMemoria, EmailSmtp } from "./servicos/email";
import { ClienteSapHttp } from "./servicos/sap-http";
import { iniciarTarefas } from "./servicos/tarefas";

/**
 * Sobe a `api`: aplica as migrações sob trava, carrega os dados iniciais (modelos de APR e atividades) e só então abre a
 * porta, então `GET /saude` só responde depois. Uma migração que falha impede a subida.
 */
async function main() {
  const config = lerConfig();
  const { pool, db } = conectar(config.databaseUrl);

  await migrarComTrava(pool);
  const carga = await carregarDadosIniciais(db);
  if (carga.modelosCarregados.length > 0) console.log(`Carga inicial: ${carga.modelosCarregados.join(", ")}`);

  const email = config.smtpUrl ? new EmailSmtp(config.smtpUrl, config.emailRemetente) : new EmailEmMemoria();
  if (!config.smtpUrl) console.warn("SMTP_URL vazio: os e-mails de alerta não serão enviados.");

  const armazenamento = new ArmazenamentoSupabase(config.supabaseUrl, config.supabaseServiceRoleKey);
  await armazenamento.garantirBuckets().catch((erro) => console.warn(`Buckets do Storage não verificados: ${erro.message}`));

  const deps = {
    db,
    config,
    auth: new AuthSupabase(config.supabaseUrl, config.supabaseServiceRoleKey),
    armazenamento,
    email,
    sap: new ClienteSapHttp(config.sapApiUrl, config.sapApiToken),
    agora: () => new Date(),
  };

  const parar = iniciarTarefas(deps);
  const servidor = serve({ fetch: criarApp(deps).fetch, port: config.porta }, ({ port }) => console.log(`api em http://localhost:${port}`));

  const encerrar = () => {
    parar();
    servidor.close(() => pool.end().finally(() => process.exit(0)));
  };
  process.on("SIGTERM", encerrar);
  process.on("SIGINT", encerrar);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
