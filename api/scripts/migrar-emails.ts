/**
 * Passa os usuários que já existem para o login por e-mail institucional. A migração 0003 deu a cada um um e-mail
 * provisório (`<matrícula>@empresa.com.br`) e as contas do Supabase Auth ainda estão em `<matrícula>@daprom.local`;
 * este script grava o e-mail definitivo no banco e na conta de acesso, sem mudar a senha nem o id. Ao aplicar, também acerta a conta de acesso de quem já tinha o e-mail certo no banco.
 *
 *   pnpm usuarios:migrar-emails                        # mostra o que mudaria
 *   pnpm usuarios:migrar-emails -- --aplicar           # aplica
 *   pnpm usuarios:migrar-emails -- --aplicar --dominio empresa.com.br
 *
 * O e-mail sai de `emailDoNome` (primeiro nome e último sobrenome); a matrícula `admin` vira `admin@<domínio>`.
 * Só mexe em quem ainda está com e-mail provisório (`@daprom.local` ou `<matrícula>@<domínio>`); se dois usuários
 * dariam o mesmo e-mail, para antes de alterar qualquer coisa. Para um caso especial, use `PATCH /usuarios/{id}`.
 */
import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { conectar } from "../src/db/conexao";
import { usuario } from "../src/db/schema";
import { DOMINIO_DEMO, emailDoNome } from "../src/dominio/usuarios";
import { AuthSupabase } from "../src/servicos/auth";

const { values } = parseArgs({
  args: process.argv.slice(2).filter((a) => a !== "--"),
  options: { aplicar: { type: "boolean" }, dominio: { type: "string" } },
});
const dominio = values.dominio ?? DOMINIO_DEMO;
const { DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!DATABASE_URL || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltam DATABASE_URL, SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente (.env.local).");
  process.exit(1);
}

const { pool, db } = conectar(DATABASE_URL);
try {
  const todos = await db.select({ id: usuario.id, nome: usuario.nome, matricula: usuario.matricula, email: usuario.email }).from(usuario);
  const provisorio = (u: (typeof todos)[number]) => u.email.endsWith("@daprom.local") || u.email === `${u.matricula.trim().toLowerCase()}@${dominio}`;
  const alvos = todos
    .filter(provisorio)
    .map((u) => ({ ...u, novo: u.matricula.toLowerCase() === "admin" ? `admin@${dominio}` : emailDoNome(u.nome, dominio) }))
    .filter((u) => u.novo !== u.email);

  const emUso = new Set(todos.filter((u) => !alvos.some((a) => a.id === u.id)).map((u) => u.email));
  const repetidos = alvos.filter((u, i) => emUso.has(u.novo) || alvos.findIndex((o) => o.novo === u.novo) !== i);
  if (repetidos.length > 0) {
    console.error("Dois usuários ficariam com o mesmo e-mail; ajuste antes (PATCH /usuarios/{id}):");
    for (const u of repetidos) console.error(`  ${u.matricula}  ${u.nome}  →  ${u.novo}`);
    process.exit(1);
  }

  for (const u of alvos) console.log(`${u.matricula.padEnd(8)} ${u.nome.padEnd(24)} ${u.email}  →  ${u.novo}`);
  if (alvos.length === 0) console.log("Nada a migrar: nenhum usuário com e-mail provisório.");
  if (alvos.length === 0 || !values.aplicar) {
    if (alvos.length > 0) console.log("\nNada foi alterado. Rode de novo com --aplicar.");
    process.exit(0);
  }

  const auth = new AuthSupabase(new URL(SUPABASE_URL).origin, SUPABASE_SERVICE_ROLE_KEY);
  // A conta de acesso pode ter ficado em `<matrícula>@daprom.local` mesmo quando o e-mail do banco já está certo
  // (usuário criado depois da migração 0003, ou com o e-mail provisório igual ao definitivo): confere todas.
  for (const u of todos) if (!alvos.some((x) => x.id === u.id)) await auth.atualizarEmail(u.id, u.email);
  for (const u of alvos) {
    await auth.atualizarEmail(u.id, u.novo);
    try {
      await db.update(usuario).set({ email: u.novo }).where(eq(usuario.id, u.id));
    } catch (erro) {
      await auth.atualizarEmail(u.id, u.email).catch(() => {});
      throw erro;
    }
  }
  console.log(`\n${alvos.length} usuário(s) migrado(s). O login agora é o e-mail; as senhas continuam as mesmas.`);
} finally {
  await pool.end();
}
