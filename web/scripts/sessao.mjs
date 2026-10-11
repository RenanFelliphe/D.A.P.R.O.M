// Uso: node scripts/sessao.mjs tec1        -> imprime o cabeçalho de cookies da sessão (para `curl -b "$(...)"`)
//      node scripts/sessao.mjs tec1 --token -> imprime só o access_token (para chamar a api direto: `Authorization: Bearer ...`)
// A api local (`pnpm dev:local` em api/) tem os usuários adm, ana, seg, sup1, sup2, tec1, tec2, tec3, todos com a senha daprom123.
const [matricula = "tec1", opcao] = process.argv.slice(2);
const api = process.env.API_URL ?? "http://localhost:3333";
const r = await fetch(`${api}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matricula, senha: "daprom123" }) });
const j = await r.json();
if (!r.ok) {
  console.error(j);
  process.exit(1);
}
console.log(opcao === "--token" ? j.access_token : `daprom_at=${j.access_token}; daprom_rt=${j.refresh_token}`);
