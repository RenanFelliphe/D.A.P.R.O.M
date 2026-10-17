// Uso: node scripts/sessao.mjs tiago.tecnico@empresa.com.br         -> imprime o cabeçalho de cookies da sessão (para `curl -b "$(...)"`)
//      node scripts/sessao.mjs tiago.tecnico@empresa.com.br --token -> imprime só o access_token (para chamar a api direto: `Authorization: Bearer ...`)
// O login é pelo e-mail institucional. A api local (`pnpm dev:local` em api/) tem admin@empresa.com.br, sandra.supervisora@,
// saulo.supervisor@, tiago.tecnico@, tais.tecnica@ e tomas.tecnico@ (todos @empresa.com.br), com a senha synqos123.
const [email = "tiago.tecnico@empresa.com.br", opcao] = process.argv.slice(2);
const api = process.env.API_URL ?? "http://localhost:3333";
const r = await fetch(`${api}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, senha: "synqos123" }) });
const j = await r.json();
if (!r.ok) {
  console.error(j);
  process.exit(1);
}
console.log(opcao === "--token" ? j.access_token : `synqos_at=${j.access_token}; synqos_rt=${j.refresh_token}`);
