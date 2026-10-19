/**
 * Confere o cliente do app contra uma `api` de verdade (sem aparelho): login, `GET /me` e o destino da conta, a lista e o detalhe
 * das OS, a renovação do token vencido e o envio de um evento. Pensado para a `api` local em memória:
 *
 *   cd api && PORT=3399 pnpm dev:local          (em outro terminal)
 *   cd mobile && API_URL=http://localhost:3399 pnpm conferir:api
 *
 * Nunca aponte para a `api` do Supabase compartilhado: o script grava um evento (recusado) e faz login/logout.
 */
import assert from "node:assert/strict";
import type { DetalheDaOs, ListaDeOs } from "@shared/api/os-app";
import type { RespostaMe } from "@shared/api/tipos";
import { criarClienteApi, type ArmazemDeTokens, type Tokens } from "../src/api/cliente";
import { ErroDaApi, mensagemDoErro } from "../src/api/erros";
import { criarEnvio } from "../src/api/eventos";
import { destinoDaConta } from "../src/sessao/destino";
import { ErroDeEvento } from "@shared/api/eventos";

const API_URL = process.env.API_URL ?? "http://localhost:3399";
const SENHA = "synqos123";

function novoCliente() {
  let tokens: Tokens | null = null;
  const armazem: ArmazemDeTokens = {
    ler: async () => tokens,
    gravar: async (t) => {
      tokens = t;
    },
    apagar: async () => {
      tokens = null;
    },
  };
  let encerrada = 0;
  const cliente = criarClienteApi({ urlBase: API_URL, armazem, aoSessaoEncerrada: () => encerrada++ });
  return { cliente, armazem, sessoesEncerradas: () => encerrada };
}

const ok = (msg: string) => console.log(`ok  ${msg}`);

async function main() {
  // --- admin: o app não é dele
  const admin = novoCliente();
  await admin.cliente.entrar("admin@empresa.com.br", SENHA);
  const eAdmin = await admin.cliente.chamar<RespostaMe>("/me");
  assert.equal(destinoDaConta(eAdmin), "somente-web");
  ok("admin cai em 'somente-web' (a gestão é na web)");

  // --- senha errada e e-mail inexistente: a mensagem da api
  const anonimo = novoCliente();
  await assert.rejects(anonimo.cliente.entrar("tiago.tecnico@empresa.com.br", "errada"), (e: unknown) => e instanceof ErroDaApi && mensagemDoErro(e) === "Senha incorreta");
  await assert.rejects(anonimo.cliente.entrar("ninguem@empresa.com.br", "x"), (e: unknown) => e instanceof ErroDaApi && e.codigo === "usuario_inexistente");
  assert.equal(await anonimo.cliente.temSessao(), false);
  ok("senha errada e e-mail inexistente mostram a mensagem da api e não deixam sessão");

  // --- técnico: login, /me, destino
  const { cliente, armazem, sessoesEncerradas } = novoCliente();
  const login = await cliente.entrar("  Tiago.Tecnico@Empresa.com.br ", SENHA);
  assert.equal(login.senhaProvisoria, false);
  const eu = await cliente.chamar<RespostaMe>("/me");
  assert.equal(eu.usuario.perfil, "tecnico");
  assert.equal(destinoDaConta(eu), "abas");
  assert.ok(eu.equipe, "o técnico tem equipe");
  ok(`${eu.usuario.nome} entra e cai na lista de OS (equipe ${eu.equipe!.nome})`);

  // --- lista de OS: paginação, contagem por status e busca
  const lista = await cliente.chamar<ListaDeOs>("/os", { consulta: { status: "liberada", tamanho: 5, pagina: 1 } });
  assert.ok(lista.total > 0, "há OS liberadas na carga local");
  assert.ok(lista.os.every((o) => o.status === "liberada"));
  assert.ok(lista.contagem_por_status.liberada >= lista.os.length);
  const primeira = lista.os[0]!;
  if (primeira.numero_ordem) {
    const busca = await cliente.chamar<ListaDeOs>("/os", { consulta: { status: "liberada", busca: primeira.numero_ordem } });
    assert.ok(busca.os.some((o) => o.id === primeira.id), "a busca pelo número da ordem acha a OS");
  }
  ok(`lista: ${lista.total} liberadas, contagem por status e busca pelo número da ordem`);

  // --- faixas da lista
  const aprs = await cliente.chamar<{ aprs: unknown[] }>("/me/aprs-para-assinar");
  const abertas = await cliente.chamar<{ execucoes: unknown[] }>("/me/execucoes-abertas");
  assert.ok(Array.isArray(aprs.aprs) && Array.isArray(abertas.execucoes));
  ok("faixas: APRs para assinar e execuções abertas respondem");

  // --- detalhe: todas as OS liberadas da primeira página abrem, com o que o app lê
  for (const o of lista.os) {
    const d = await cliente.chamar<DetalheDaOs>(`/os/${o.id}`);
    assert.equal(d.os.id, o.id);
    assert.ok(d.os.local_instalacao.codigo && d.os.equipe.nome);
    assert.ok(Array.isArray(d.aprs) && Array.isArray(d.execucoes));
    assert.ok(d.servico === null || Array.isArray(d.servico.materiais));
    if (d.os.tipo === "preventiva") {
      const plano = await cliente.chamar<{ situacao: string }>(`/os/${o.id}/preventiva`).catch((e: unknown) => (e instanceof ErroDaApi && e.status === 404 ? null : Promise.reject(e)));
      assert.ok(plano === null || typeof plano.situacao === "string");
    }
  }
  ok(`detalhe: ${lista.os.length} OS abrem com local, equipe, APRs, execuções e serviço`);

  // --- histórico do local
  const hist = await cliente.chamar<{ execucoes: unknown[]; total: number }>("/historico", { consulta: { local_instalacao_id: primeira.local_instalacao.id, pagina: 1, tamanho: 10 } });
  assert.ok(Array.isArray(hist.execucoes));
  ok("histórico do local responde");

  // --- OS de outra equipe não existe (404)
  await assert.rejects(cliente.chamar("/os/00000000-0000-4000-8000-000000000000"), (e: unknown) => e instanceof ErroDaApi && e.status === 404);
  ok("OS inexistente é 404 (ErroDaApi)");

  // --- token vencido: renova sozinho e repete
  const antes = (await armazem.ler())!;
  await armazem.gravar({ ...antes, accessToken: "token-invalido" });
  const de_novo = await cliente.chamar<RespostaMe>("/me");
  assert.equal(de_novo.usuario.id, eu.usuario.id);
  const depois = (await armazem.ler())!;
  assert.notEqual(depois.accessToken, "token-invalido");
  ok("token inválido (401): renovou pelo refresh e repetiu a chamada, sem pedir a senha");

  // --- evento recusado pela api vira ErroDeEvento com a mensagem pronta
  const envio = criarEnvio(cliente);
  await assert.rejects(envio.enviarEvento({ tipo: "execucao_iniciada", os_id: primeira.id, payload: { apr_id: "00000000-0000-4000-8000-000000000001" } }), (e: unknown) => {
    assert.ok(e instanceof ErroDeEvento, `esperava ErroDeEvento, veio ${String(e)}`);
    return true;
  });
  ok("POST /eventos: o evento sem APR é recusado e vira ErroDeEvento com a mensagem da api");

  // --- sair: a api derruba a sessão e os tokens somem
  await cliente.sair();
  assert.equal(await cliente.temSessao(), false);
  await assert.rejects(cliente.chamar("/me"), (e: unknown) => e instanceof ErroDaApi && e.codigo === "nao_autenticado");
  assert.equal(sessoesEncerradas(), 0);
  ok("sair: tokens apagados e a chamada seguinte pede o login");

  // --- contas novas: senha provisória, aguardando a liberação e assinatura pendente
  const sufixo = Date.now().toString().slice(-6);
  const contaDoAdmin = { matricula: `9${sufixo}1`, email: `novo.admin.${sufixo}@empresa.com.br` };
  const contaDoSupervisor = { matricula: `9${sufixo}2`, email: `novo.sup.${sufixo}@empresa.com.br` };
  for (const c of [contaDoAdmin, contaDoSupervisor]) {
    await admin.cliente.chamar("/rh-simulado/gestao/funcionarios", { corpo: { matricula: c.matricula, nome: `Novo ${c.matricula}`, email: c.email, cargo: "Técnico", centro_trabalho: "SERV_ESP" } });
  }
  const sandra = novoCliente();
  await sandra.cliente.entrar("sandra.supervisora@empresa.com.br", SENHA);
  const equipeId = (await sandra.cliente.chamar<RespostaMe>("/me")).equipe!.id;
  await admin.cliente.chamar("/usuarios", { corpo: { ...contaDoAdmin, perfil: "tecnico", equipe_id: equipeId, senha_inicial: "provisoria-1" } });
  const criadoPelaSandra = await sandra.cliente.chamar<{ id: string }>("/usuarios", { corpo: { ...contaDoSupervisor, senha_inicial: "provisoria-2" } });

  // Conta criada pelo admin: senha provisória → troca → assinatura pendente (liberada, ainda sem assinatura).
  const novo = novoCliente();
  const l1 = await novo.cliente.entrar(contaDoAdmin.email, "provisoria-1");
  assert.equal(l1.senhaProvisoria, true);
  assert.equal(destinoDaConta(await novo.cliente.chamar<RespostaMe>("/me")), "trocar-senha");
  await assert.rejects(novo.cliente.chamar("/os"), (e: unknown) => e instanceof ErroDaApi && e.codigo === "senha_provisoria");
  await assert.rejects(novo.cliente.chamar("/auth/trocar-senha", { corpo: { senha_atual: "provisoria-1", senha_nova: "curta" } }), (e: unknown) => e instanceof ErroDaApi && e.status === 422);
  await novo.cliente.chamar("/auth/trocar-senha", { corpo: { senha_atual: "provisoria-1", senha_nova: "senha-nova-123" } });
  assert.equal(destinoDaConta(await novo.cliente.chamar<RespostaMe>("/me")), "assinatura");
  await assert.rejects(novo.cliente.chamar("/os"), (e: unknown) => e instanceof ErroDaApi && e.codigo === "assinatura_pendente");
  ok("conta nova: senha provisória → trocar senha (com a regra dos 8 caracteres) → assinatura pendente; as demais rotas recusam até lá");

  // Conta criada pelo supervisor: depois de trocar a senha espera a liberação; liberada, cai na assinatura.
  const pendente = novoCliente();
  await pendente.cliente.entrar(contaDoSupervisor.email, "provisoria-2");
  await pendente.cliente.chamar("/auth/trocar-senha", { corpo: { senha_atual: "provisoria-2", senha_nova: "senha-nova-456" } });
  assert.equal(destinoDaConta(await pendente.cliente.chamar<RespostaMe>("/me")), "aguardando");
  await assert.rejects(pendente.cliente.chamar("/os"), (e: unknown) => e instanceof ErroDaApi && e.codigo === "aguardando_liberacao");
  await admin.cliente.chamar(`/usuarios/${criadoPelaSandra.id}/liberar`, { metodo: "POST", corpo: {} });
  assert.equal(destinoDaConta(await pendente.cliente.chamar<RespostaMe>("/me")), "assinatura");
  ok("cadastro de supervisor: aguardando a liberação → liberado → assinatura pendente");

  console.log("\ncliente do app ok contra a api");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
