import { serve } from "@hono/node-server";
import { criarApp } from "./app";
import { lerConfig } from "./config";
import { conectar, migrarComTrava } from "./db/conexao";
import { carregarDadosIniciais } from "./db/seed/carregar";
import { preencherHistoricoDaGamificacao } from "./db/seed/gamificacao-historico";
import { garantirImagensDaGamificacao } from "./db/seed/imagens-gamificacao";
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

  // Implantação da gamificação: o extrato nasce do histórico já gravado (só enquanto o extrato está vazio, numa transação só:
  // se falhar nada é gravado, a `api` sobe mesmo assim e a próxima subida tenta de novo).
  try {
    const historico = await preencherHistoricoDaGamificacao(db, new Date());
    if (historico) console.log(`Gamificação: ${historico.lancamentos} lançamentos do histórico, ${historico.temporadasFechadas} temporadas fechadas, ${historico.conquistas} conquistas concedidas`);
  } catch (erro) {
    console.error("Gamificação: não foi possível preencher o histórico (nada foi gravado):", erro);
  }

  const email = config.smtpUrl ? new EmailSmtp(config.smtpUrl, config.emailRemetente) : new EmailEmMemoria();
  if (!config.smtpUrl) console.warn("SMTP_URL vazio: os e-mails de alerta não serão enviados.");

  const armazenamento = new ArmazenamentoSupabase(config.supabaseUrl, config.supabaseServiceRoleKey);
  await armazenamento.garantirBuckets().catch((erro) => console.warn(`Buckets do Storage não verificados: ${erro.message}`));
  // As imagens das patentes e das conquistas da carga inicial (as que o admin trocou não voltam).
  await garantirImagensDaGamificacao(armazenamento).catch((erro) => console.warn(`Imagens da gamificação não verificadas: ${erro.message}`));

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
