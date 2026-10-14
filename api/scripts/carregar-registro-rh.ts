/**
 * Carga única do registro de funcionários simulado: cria um funcionário (situação ativo) para cada usuário do DAPROM que ainda não
 * tem o seu, com a mesma matrícula, nome, e-mail, cargo e registro profissional. Em ambiente publicado com `RH_SIMULADO=true`,
 * rode **antes** de ligar a conferência (a leitura diária), senão a primeira leitura trataria todo mundo como fora do registro
 * (a trava de segurança impediria o estrago, mas a leitura falharia todos os dias). Pode rodar de novo sem duplicar.
 *
 *   pnpm rh:carga-inicial
 */
import { conectar } from "../src/db/conexao";
import { carregarRegistroDosUsuarios } from "../src/db/seed/registro-rh";
import { lerConfig } from "../src/config";

const config = lerConfig();
const { pool, db } = conectar(config.databaseUrl);
try {
  const r = await carregarRegistroDosUsuarios(db);
  console.log(`Registro de funcionários: ${r.criados} funcionário(s) criado(s) para usuários que não tinham o seu.`);
  if (r.ignorados.length > 0) console.warn(`Ficaram de fora (e-mail já é de outro funcionário do registro): ${r.ignorados.join(", ")}`);
} finally {
  await pool.end();
}
