/**
 * Modo local de desenvolvimento (`pnpm dev:local`): a `api` inteira sem Supabase, SMTP nem Postgres instalado.
 *
 * - Banco: PGlite (Postgres em WebAssembly), em memória, com as migrações aplicadas e a carga inicial dos modelos de APR.
 * - Autenticação, arquivos e e-mail: versões em memória (`AuthEmMemoria`, `ArmazenamentoEmMemoria`, `EmailEmMemoria`).
 * - SAP: o simulador do próprio back-end; as OS das fixtures entram logo depois da subida.
 * - Dados de exemplo: equipes, um usuário de cada perfil e a assinatura deles, e um catálogo de serviço fictício.
 *
 * Tudo some quando o processo termina e a cada subida recomeça igual. Serve ao `web` e ao `mobile` em desenvolvimento
 * e aos testes manuais; nunca à produção.
 */
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { criarApp } from "./app";
import { lerConfigIA, type Config } from "./config";
import { PASTA_MIGRACOES, type Db } from "./db/conexao";
import { equipe, usuario, type Perfil } from "./db/schema";
import { popularCatalogoDemo } from "./db/seed/catalogo-demo";
import { carregarDadosIniciais } from "./db/seed/carregar";
import { carregarOrdensDeExemplo } from "./db/seed/ordens-sap";
import { carregarRegistroDosUsuarios } from "./db/seed/registro-rh";
import { garantirImagensDaGamificacao } from "./db/seed/imagens-gamificacao";
import { garantirImagensDeTreinamentoServico } from "./db/seed/treinamento-servico-imagens";
import type { Deps } from "./deps";
import { executarLeitura } from "./servicos/leitura-sap";
import { ArmazenamentoEmMemoria } from "./servicos/armazenamento";
import { DOMINIO_DEMO, emailDoNome } from "./dominio/usuarios";
import { AuthEmMemoria } from "./servicos/auth";
import { EmailEmMemoria } from "./servicos/email";
import { criarProvedorIA } from "./servicos/ia";
import { ClienteRhHttp } from "./servicos/rh-http";
import { ClienteSapHttp } from "./servicos/sap-http";
import { iniciarTarefas } from "./servicos/tarefas";
import { garantirRepresentantes } from "./dominio/representacao";

const PORTA = Number(process.env.PORT ?? 3333);
const SENHA = "syncos123";
const SEGREDO_JWT = "segredo-local-so-para-desenvolvimento-0123456789";
const TOKEN_SAP = "token-de-desenvolvimento";
const TOKEN_RH = "token-rh-de-desenvolvimento";
const TOKEN_AVISO_RH = "token-aviso-rh-de-desenvolvimento";
/** PNG de 1×1 pixel: serve de "assinatura" nos dados de exemplo. */
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));

const config: Config = {
  porta: PORTA,
  versao: "local",
  databaseUrl: "",
  supabaseUrl: "http://supabase.local",
  supabaseServiceRoleKey: "local",
  supabaseJwtSecret: SEGREDO_JWT,
  sapApiUrl: `http://127.0.0.1:${PORTA}/sap-simulado`,
  sapApiToken: TOKEN_SAP,
  sapSimulado: true,
  sapLeituraIntervaloMin: 15,
  rhSimulado: true,
  rhApiUrl: `http://127.0.0.1:${PORTA}/rh-simulado`,
  rhApiToken: TOKEN_RH,
  rhAvisoToken: TOKEN_AVISO_RH,
  rhAvisoUrl: `http://127.0.0.1:${PORTA}/rh/avisos`,
  rhLeituraHora: 3,
  smtpUrl: "",
  emailRemetente: "syncos@localhost",
  painelUrl: process.env.PAINEL_URL ?? "http://localhost:3000",
  ia: lerConfigIA(),
  vitoria: { limitePorConversa: 20, limitePorContaDia: 40, limiteGlobalDia: 1000, maxTokensResposta: 1024 },
};

async function main() {
  const cliente = new PGlite();
  const db = drizzle(cliente, { casing: "snake_case" }) as unknown as Db;
  await migrate(drizzle(cliente, { casing: "snake_case" }), { migrationsFolder: PASTA_MIGRACOES });
  const carga = await carregarDadosIniciais(db);
  console.log(`Modelos de APR: ${carga.modelosCarregados.join(", ")}`);
  console.log(`Catálogo de serviço fictício: ${await popularCatalogoDemo(db)} serviços com materiais`);

  const auth = new AuthEmMemoria(SEGREDO_JWT, () => new Date(), 8 * 3600);
  const armazenamento = new ArmazenamentoEmMemoria(`http://localhost:${PORTA}/arquivos-locais`);
  const deps: Deps = {
    db,
    config,
    auth,
    armazenamento,
    email: new EmailEmMemoria(),
    sap: new ClienteSapHttp(config.sapApiUrl, TOKEN_SAP),
    rh: new ClienteRhHttp(config.rhApiUrl, TOKEN_RH),
    ia: criarProvedorIA(config.ia, config.vitoria.maxTokensResposta),
    agora: () => new Date(),
  };

  // Equipes dos centros de trabalho das fixtures do SAP.
  const equipes: Record<string, string> = {};
  for (const [centro, nome] of [["SERV_ESP", "Serviços Especiais"], ["INSTRUM", "Instrumentação"], ["LAB_QUI", "Laboratório Químico"]] as const) {
    const [e] = await db.insert(equipe).values({ nome, centroTrabalho: centro }).returning({ id: equipe.id });
    equipes[centro] = e!.id;
  }

  const assinaturaId = "00000000-0000-4000-8000-000000000001";
  await armazenamento.gravar("assinaturas", assinaturaId, PNG, "image/png");
  console.log(`Gamificação: ${await garantirImagensDaGamificacao(armazenamento)} imagens de patentes e conquistas`);
  await garantirImagensDeTreinamentoServico(armazenamento);

  const logins: string[] = [];
  async function criar(matricula: string, nome: string, perfil: Perfil, centro: string | null, extra: { cargo?: string; email?: string } = {}) {
    const email = extra.email ?? emailDoNome(nome);
    const conta = await auth.criarConta(email, SENHA);
    logins.push(`${email} (${perfil})`);
    await db.insert(usuario).values({
      id: conta.id,
      nome,
      matricula,
      email,
      cargo: extra.cargo ?? null,
      perfil,
      equipeId: centro ? equipes[centro]! : null,
      senhaProvisoria: false,
      assinaturaPath: assinaturaId,
      assinaturaEm: new Date(),
    });
    return conta.id;
  }

  await criar("adm", "Administrador", "admin", null, { email: `admin@${DOMINIO_DEMO}` });
  const sup1 = await criar("sup1", "Sandra Supervisora", "tecnico", "SERV_ESP");
  const sup2 = await criar("sup2", "Saulo Supervisor", "tecnico", "INSTRUM");
  await criar("tec1", "Tiago Técnico", "tecnico", "SERV_ESP", { cargo: "Técnico em Gás" });
  await criar("tec2", "Taís Técnica", "tecnico", "SERV_ESP", { cargo: "Técnica em Gás" });
  await criar("tec3", "Tomás Técnico", "tecnico", "INSTRUM", { cargo: "Técnico em Instrumentação" });
  await db.update(equipe).set({ supervisorId: sup1 }).where(eq(equipe.id, equipes.SERV_ESP!));
  await db.update(equipe).set({ supervisorId: sup2 }).where(eq(equipe.id, equipes.INSTRUM!));
  await garantirRepresentantes(db);

  // O SAP simulado: as ordens de exemplo (o modo local recomeça igual a cada subida).
  console.log(`SAP simulado: ${await carregarOrdensDeExemplo(db)} ordens de exemplo`);

  // O registro de funcionários simulado: um funcionário para cada usuário acima, mais uns 30 sem conta para demonstrar o cadastro.
  const registro = await carregarRegistroDosUsuarios(db, { aleatorios: 30 });
  console.log(`Registro de funcionários simulado: ${registro.criados + registro.aleatorios} funcionários (${registro.aleatorios} sem conta)`);

  const parar = iniciarTarefas(deps);
  // As URLs "assinadas" do armazenamento em memória apontam para cá, para o navegador conseguir exibir fotos e assinaturas.
  const raiz = new Hono();
  raiz.get("/arquivos-locais/:bucket/:id", (c) => {
    const arquivo = armazenamento.arquivos.get(`${c.req.param("bucket")}/${c.req.param("id")}`);
    if (!arquivo) return c.notFound();
    return new Response(arquivo.bytes as unknown as BodyInit, { headers: { "Content-Type": arquivo.tipoMime, "Cache-Control": "private, max-age=60" } });
  });
  raiz.route("/", criarApp(deps));
  serve({ fetch: raiz.fetch, port: PORTA }, async ({ port }) => {
    const leitura = await executarLeitura(deps, {});
    console.log(`api local em http://localhost:${port} — OS do SAP simulado: ${leitura.criadas} novas, ${leitura.atualizadas} atualizadas`);
    console.log(`Usuários (senha ${SENHA}):\n  ${logins.join("\n  ")}`);
  });
  process.on("SIGINT", () => {
    parar();
    process.exit(0);
  });
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
