/**
 * Cria o primeiro usuário `admin` (a api não tem como criar o primeiro: `POST /usuarios` exige um admin).
 * Usa as mesmas variáveis da api (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`), lidas do `.env` da raiz do repositório.
 * A conta nasce com senha provisória: no primeiro login a pessoa é levada a "Defina sua senha".
 *
 *   pnpm admin:criar -- --matricula adm --nome "Administrador" --senha "senha-inicial-123"
 *
 * Rode depois de subir a api uma vez (ela aplica as migrações).
 */
import { parseArgs } from "node:util";
import { eq, sql } from "drizzle-orm";
import { conectar } from "../src/db/conexao";
import { usuario } from "../src/db/schema";
import { AuthSupabase, emailInterno } from "../src/servicos/auth";

const { values } = parseArgs({ options: { matricula: { type: "string" }, nome: { type: "string" }, senha: { type: "string" } }, allowPositionals: true });
const { matricula, nome, senha } = values;
const { DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!matricula || !nome || !senha || !DATABASE_URL || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Uso: pnpm admin:criar -- --matricula adm --nome \"Administrador\" --senha \"...\" (com DATABASE_URL, SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente)");
  process.exit(1);
}
if (senha.length < 8) {
  console.error("A senha precisa ter ao menos 8 caracteres.");
  process.exit(1);
}
if (!/^[A-Za-z0-9._-]{1,40}$/.test(matricula)) {
  console.error("A matrícula só aceita letras, números, ponto, hífen e sublinhado.");
  process.exit(1);
}

const { pool, db } = conectar(DATABASE_URL);
try {
  const [existente] = await db.select({ id: usuario.id }).from(usuario).where(eq(sql`lower(${usuario.matricula})`, matricula.toLowerCase()));
  if (existente) {
    console.error(`A matrícula ${matricula} já está cadastrada.`);
    process.exit(1);
  }
  const auth = new AuthSupabase(SUPABASE_URL.replace(/\/$/, ""), SUPABASE_SERVICE_ROLE_KEY);
  const conta = await auth.criarConta(emailInterno(matricula), senha);
  try {
    await db.insert(usuario).values({ id: conta.id, nome, matricula, perfil: "admin", senhaProvisoria: true });
  } catch (erro) {
    await auth.excluirConta(conta.id);
    throw erro;
  }
  console.log(`Admin ${matricula} criado. Entre no web com essa matrícula e a senha informada; será pedida uma senha nova.`);
} finally {
  await pool.end();
}
