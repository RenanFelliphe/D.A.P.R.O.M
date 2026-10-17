import { serve } from "@hono/node-server";
import { criarApp } from "./app";
import { lerConfig } from "./config";
import { conectar, migrarComTrava } from "./db/conexao";
import { carregarDadosIniciais } from "./db/seed/carregar";
import { carregarOrdensDeExemplo } from "./db/seed/ordens-sap";
import { preencherHistoricoDaGamificacao } from "./db/seed/gamificacao-historico";
import { garantirImagensDaGamificacao } from "./db/seed/imagens-gamificacao";
import { garantirImagensDeTreinamentoServico } from "./db/seed/treinamento-servico-imagens";
import { ArmazenamentoSupabase } from "./servicos/armazenamento";
import { AuthSupabase } from "./servicos/auth";
import { EmailEmMemoria, EmailSmtp } from "./servicos/email";
import { criarProvedorIA } from "./servicos/ia";
import { ClienteRhHttp } from "./servicos/rh-http";
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

  // O SAP simulado guarda as ordens no banco: com a tabela vazia, entram as de exemplo (as que a tela criar não são tocadas).
  if (config.sapSimulado) {
    const ordens = await carregarOrdensDeExemplo(db);
    if (ordens > 0) console.log(`SAP simulado: ${ordens} ordens de exemplo`);
  }

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
  await garantirImagensDeTreinamentoServico(armazenamento).catch((erro) => console.warn(`Imagens dos treinamentos de serviço não verificadas: ${erro.message}`));

  const deps = {
    db,
    config,
    auth: new AuthSupabase(config.supabaseUrl, config.supabaseServiceRoleKey),
    armazenamento,
    email,
    sap: new ClienteSapHttp(config.sapApiUrl, config.sapApiToken),
    rh: new ClienteRhHttp(config.rhApiUrl, config.rhApiToken),
    ia: criarProvedorIA(config.ia, config.vitoria.maxTokensResposta),
    agora: () => new Date(),
  };
  if (config.ia.ligada) console.log(`IA ligada: ${config.ia.provedor} (Vitória: ${config.ia.modelos.vitoria})`);
  else console.warn(`Chave de IA vazia para IA_PROVEDOR=${config.ia.provedor} (${config.ia.provedor === "gemini" ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY"}): o módulo de IA fica desligado (fallback sem IA).`);

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
