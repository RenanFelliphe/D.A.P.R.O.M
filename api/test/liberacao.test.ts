import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { PASTA_MIGRACOES } from "../src/db/conexao";
import { criarAmbiente, SENHA_PADRAO, type Ambiente, type UsuarioDeTeste } from "./ajuda";

const NOME_DO_SUPERVISOR = "Sandra Supervisora";

/** Onde o corpo novo registra o funcionário (o `POST /usuarios` só cadastra quem está no registro) e o centro de trabalho de cada equipe. */
let registro: Ambiente | undefined;
const centrosDasEquipes = new Map<string, string>();

/**
 * O corpo do cadastro (matrícula, e-mail e senha: nome e cargo vêm do registro) e, de passagem, o funcionário no registro em
 * memória, do setor da `equipe_id` (sem equipe, de um setor que nenhuma equipe tem).
 */
const corpoNovo = (n: number, extra: Record<string, unknown> = {}) => {
  const corpo: { matricula: string; email: string; senha_inicial: string } & Record<string, unknown> = {
    matricula: `N${n}`,
    email: `novato${n}@empresa.com.br`,
    senha_inicial: "senha-inicial-1",
    ...extra,
  };
  const centro = (typeof corpo.equipe_id === "string" && centrosDasEquipes.get(corpo.equipe_id)) || "SEM_EQUIPE";
  registro!.registrarFuncionario({ matricula: corpo.matricula, email: corpo.email as string, nome: `Novato ${n}`, centro_trabalho: centro, setor: centro });
  return corpo;
};

describe("Cadastro pelo supervisor e liberação de acesso", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let supervisor: UsuarioDeTeste;
  let outroSupervisor: UsuarioDeTeste;
  let semEquipes: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;
  let equipeId: string;
  let outraEquipeId: string;

  /** Cadastra pelo supervisor, entra com a senha provisória e devolve o usuário com o token (como o front faz). */
  async function cadastrar(n: number, como = supervisor, equipe = equipeId) {
    const { id } = await amb.esperar(201, "POST", "/usuarios", { como, json: corpoNovo(n, { equipe_id: equipe }) });
    const login = await amb.esperar(200, "POST", "/auth/login", { json: { email: `novato${n}@empresa.com.br`, senha: "senha-inicial-1" } });
    const novo: UsuarioDeTeste = { id, matricula: `N${n}`, email: `novato${n}@empresa.com.br`, senha: "senha-inicial-1", token: login.access_token, perfil: "tecnico", equipeId: equipe };
    return novo;
  }

  before(async () => {
    amb = await criarAmbiente();
    registro = amb;
    const equipe = await amb.criarEquipe();
    const outraEquipe = await amb.criarEquipe();
    equipeId = equipe.id;
    outraEquipeId = outraEquipe.id;
    centrosDasEquipes.set(equipeId, equipe.centroTrabalho);
    centrosDasEquipes.set(outraEquipeId, outraEquipe.centroTrabalho);
    admin = await amb.criarUsuario({ perfil: "admin" });
    supervisor = await amb.criarUsuario({ perfil: "tecnico", equipeId, supervisor: true, nome: NOME_DO_SUPERVISOR });
    outroSupervisor = await amb.criarUsuario({ perfil: "tecnico", equipeId: outraEquipeId, supervisor: true });
    semEquipes = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    tecnico = semEquipes;
  });
  after(() => amb.fechar());

  describe("POST /usuarios", () => {
    it("supervisor cadastra técnico na equipe do setor dele: nasce pendente, com criado_por_id, e perfil forçado a técnico", async () => {
      const { id } = await amb.esperar(201, "POST", "/usuarios", { como: supervisor, json: corpoNovo(1, { equipe_id: equipeId }) });
      const u = (await amb.esperar(200, "GET", `/usuarios/${id}`, { como: admin })).usuario;
      assert.equal(u.liberacao, "pendente");
      assert.equal(u.criado_por_id, supervisor.id);
      assert.equal(u.perfil, "tecnico");
      assert.equal(u.equipe_id, equipeId);
      assert.equal(u.liberado_em, null);
      assert.equal(u.criado_por_nome, NOME_DO_SUPERVISOR);
      assert.ok(u.criado_em, "o cadastro grava a data");
      assert.equal(u.recusa_motivo, null);
      assert.equal(u.senha_provisoria, true);
      // O nome veio do registro de funcionários.
      assert.equal(u.nome, "Novato 1");
    });

    it("aceita perfil tecnico explícito; recusa admin, setor de equipe alheia, setor sem equipe e quem não supervisiona (403)", async () => {
      await amb.esperar(201, "POST", "/usuarios", { como: supervisor, json: corpoNovo(2, { equipe_id: equipeId, perfil: "tecnico" }) });
      assert.equal((await amb.req("POST", "/usuarios", { como: supervisor, json: corpoNovo(3, { equipe_id: equipeId, perfil: "admin" }) })).status, 403);
      assert.equal((await amb.req("POST", "/usuarios", { como: supervisor, json: corpoNovo(4, { equipe_id: outraEquipeId }) })).status, 403);
      const semEquipe = await amb.req("POST", "/usuarios", { como: supervisor, json: corpoNovo(5) });
      assert.equal(semEquipe.status, 403);
      assert.equal(semEquipe.corpo.erro.codigo, "fora_da_supervisao");
      assert.match(semEquipe.corpo.erro.mensagem, /setor SEM_EQUIPE, que você não supervisiona/);
      assert.equal((await amb.req("POST", "/usuarios", { como: tecnico, json: corpoNovo(6, { equipe_id: equipeId }) })).status, 403);
      assert.equal((await amb.req("POST", "/usuarios", { como: semEquipes, json: corpoNovo(7, { equipe_id: equipeId }) })).status, 403);
    });

    it("mantém as validações de matrícula e e-mail duplicados", async () => {
      const mat = await amb.req("POST", "/usuarios", { como: supervisor, json: corpoNovo(8, { equipe_id: equipeId, matricula: "n1" }) });
      assert.equal(mat.corpo.erro.codigo, "matricula_duplicada");
      const email = await amb.req("POST", "/usuarios", { como: supervisor, json: corpoNovo(9, { equipe_id: equipeId, email: "Novato1@empresa.com.br" }) });
      assert.equal(email.corpo.erro.codigo, "email_duplicado");
    });

    it("admin segue criando usuário já liberado, de qualquer perfil, e exige o perfil", async () => {
      const { id } = await amb.esperar(201, "POST", "/usuarios", { como: admin, json: corpoNovo(10, { perfil: "admin" }) });
      const u = (await amb.esperar(200, "GET", `/usuarios/${id}`, { como: admin })).usuario;
      assert.equal(u.liberacao, "liberado");
      assert.equal(u.criado_por_id, admin.id);
      assert.equal((await amb.req("POST", "/usuarios", { como: admin, json: corpoNovo(11) })).status, 422);
    });
  });

  describe("usuário pendente", () => {
    let novo: UsuarioDeTeste;
    before(async () => {
      novo = await cadastrar(20);
    });

    it("entra, vê /me com a liberação e faz o Campo de treino", async () => {
      const login = await amb.esperar(200, "POST", "/auth/login", { json: { email: novo.email, senha: "senha-inicial-1" } });
      assert.equal(login.usuario.liberacao, "pendente");
      assert.equal(login.senha_provisoria, true);
      const eu = await amb.esperar(200, "GET", "/me", { como: novo });
      assert.equal(eu.usuario.liberacao, "pendente");
      assert.equal(eu.usuario.criado_por_id, supervisor.id);
      assert.equal(eu.usuario.criado_por_nome, NOME_DO_SUPERVISOR);
      assert.ok(Date.now() - new Date(eu.usuario.criado_em).getTime() < 60_000, "criado_em marca o cadastro");
      const t = await amb.esperar(200, "PUT", "/me/treinamento", { como: novo, json: { estado: "concluido" } });
      assert.equal(t.treinamento.estado, "concluido");
    });

    it("troca a senha provisória e renova a sessão", async () => {
      await amb.esperar(200, "POST", "/auth/trocar-senha", { como: novo, json: { senha_atual: "senha-inicial-1", senha_nova: "senha-nova-123" } });
      const login = await amb.esperar(200, "POST", "/auth/login", { json: { email: novo.email, senha: "senha-nova-123" } });
      assert.equal(login.senha_provisoria, false);
      novo = { ...novo, token: login.access_token };
      await amb.esperar(200, "POST", "/auth/refresh", { json: { refresh_token: login.refresh_token } });
      await amb.esperar(200, "GET", "/me", { como: novo });
    });

    it("todo o resto é 403 aguardando_liberacao", async () => {
      const id = "00000000-0000-4000-8000-000000000001";
      const rotas: [string, string, unknown?][] = [
        ["GET", "/os"],
        ["GET", `/os/${id}`],
        ["GET", `/os/${id}/aprs`],
        ["GET", `/os/${id}/pdf`],
        ["POST", `/os/${id}/ciencia`],
        ["POST", `/os/${id}/reprogramar`, {}],
        ["POST", `/os/${id}/cancelar`, {}],
        ["POST", "/os", {}],
        ["GET", "/historico"],
        ["GET", "/indicadores"],
        ["GET", "/indicadores/tempo"],
        ["GET", "/indicadores/os"],
        ["GET", "/indicadores/equipes"],
        ["GET", "/aprs/resumo"],
        ["POST", "/exportacoes/sap", {}],
        ["POST", "/eventos", { eventos: [] }],
        ["POST", "/sync/pull", {}],
        ["PUT", `/arquivos/${id}`],
        ["GET", `/arquivos/${id}/url`],
        ["GET", "/busca/exata", undefined],
        ["GET", "/alertas"],
        ["PATCH", `/alertas/${id}`, {}],
        ["GET", "/equipes"],
        ["GET", `/equipes/${id}`],
        ["POST", "/equipes", {}],
        ["PATCH", `/equipes/${id}`, {}],
        ["GET", "/usuarios"],
        ["GET", `/usuarios/${id}`],
        ["POST", "/usuarios", {}],
        ["PATCH", `/usuarios/${id}`, {}],
        ["DELETE", `/usuarios/${id}`],
        ["POST", `/usuarios/${id}/liberar`],
        ["POST", `/usuarios/${id}/recusar`, { motivo: "x" }],
        ["POST", `/usuarios/${id}/redefinir-senha`],
        ["PUT", "/me/assinatura", {}],
        ["GET", "/me/execucoes-abertas"],
        ["GET", "/me/historico"],
        ["GET", "/modelos-apr"],
        ["GET", "/modelos-apr/APR 03"],
        ["GET", "/atividades"],
        ["GET", "/locais"],
        ["GET", "/importacoes"],
        ["POST", "/importacoes", {}],
        ["POST", "/sap/leituras", {}],
        ["GET", "/sap/sincronizacao"],
      ];
      for (const [metodo, caminho, json] of rotas) {
        const r = await amb.req(metodo, caminho, { como: novo, ...(json !== undefined ? { json } : {}) });
        assert.equal(r.status, 403, `${metodo} ${caminho} → ${r.status}`);
        assert.equal(r.corpo.erro.codigo, "aguardando_liberacao", `${metodo} ${caminho}`);
        assert.equal(r.corpo.erro.mensagem, "Seu acesso aguarda a liberação de um administrador");
      }
    });

    it("não aparece nas listas de colegas, na equipe nem na busca de quem não administra", async () => {
      const lista = await amb.esperar(200, "GET", "/usuarios", { como: tecnico });
      assert.ok(!lista.usuarios.some((u: any) => u.id === novo.id));
      assert.equal((await amb.req("GET", `/usuarios/${novo.id}`, { como: tecnico })).status, 404);
      const eq = await amb.esperar(200, "GET", `/equipes/${equipeId}`, { como: tecnico });
      assert.ok(!eq.membros.some((m: any) => m.id === novo.id));
      // liberação não é acessível a quem não é supervisor
      assert.equal((await amb.req("GET", "/usuarios", { como: tecnico, consulta: { liberacao: "pendente" } })).corpo.total, 0);
    });
  });

  describe("liberar e recusar (admin)", () => {
    it("GET /usuarios?liberacao=pendente devolve a contagem em total; só o admin libera", async () => {
      const novo = await cadastrar(30);
      const lista = await amb.esperar(200, "GET", "/usuarios", { como: admin, consulta: { liberacao: "pendente" } });
      assert.ok(lista.total >= 1);
      assert.ok(lista.usuarios.every((u: any) => u.liberacao === "pendente"));
      assert.ok(lista.usuarios.some((u: any) => u.id === novo.id));

      assert.equal((await amb.req("POST", `/usuarios/${novo.id}/liberar`, { como: supervisor })).status, 403);
      assert.equal((await amb.req("POST", `/usuarios/${novo.id}/recusar`, { como: supervisor, json: { motivo: "x" } })).status, 403);
      assert.equal((await amb.req("POST", `/usuarios/${novo.id}/liberar`, { como: novo })).status, 403);

      await amb.esperar(200, "POST", `/usuarios/${novo.id}/liberar`, { como: admin });
      const u = (await amb.esperar(200, "GET", `/usuarios/${novo.id}`, { como: admin })).usuario;
      assert.equal(u.liberacao, "liberado");
      assert.ok(u.liberado_em);
      assert.equal((await amb.sql<{ liberado_por_id: string }>("select liberado_por_id from usuario where id = $1", [novo.id]))[0]!.liberado_por_id, admin.id);
      // A liberação é assinada: guarda a imagem do perfil do admin.
      assert.equal((await amb.sql<{ p: string | null }>("select liberacao_assinatura_path as p from usuario where id = $1", [novo.id]))[0]!.p, await amb.assinaturaDe(admin));

      // Troca a senha provisória; liberado e sem assinatura, só cadastra a assinatura, e depois acessa o resto.
      await amb.esperar(200, "POST", "/auth/trocar-senha", { como: novo, json: { senha_atual: "senha-inicial-1", senha_nova: "senha-nova-123" } });
      const semAssinatura = await amb.req("GET", "/os", { como: novo });
      assert.equal(semAssinatura.status, 403);
      assert.equal(semAssinatura.corpo.erro.codigo, "assinatura_pendente");
      await amb.cadastrarAssinatura(novo);
      await amb.esperar(200, "GET", "/os", { como: novo });
      await amb.esperar(200, "GET", "/equipes", { como: novo });
    });

    it("recusar exige o motivo, desativa, revoga a sessão e impede o login", async () => {
      const novo = await cadastrar(31);
      assert.equal((await amb.req("POST", `/usuarios/${novo.id}/recusar`, { como: admin, json: {} })).status, 422);
      assert.equal((await amb.req("POST", `/usuarios/${novo.id}/recusar`, { como: admin, json: { motivo: "   " } })).status, 422);
      await amb.esperar(200, "POST", `/usuarios/${novo.id}/recusar`, { como: admin, json: { motivo: "Matrícula não confere" } });

      const u = (await amb.esperar(200, "GET", `/usuarios/${novo.id}`, { como: admin })).usuario;
      assert.equal(u.liberacao, "recusado");
      assert.equal(u.ativo, false);
      assert.equal(u.recusa_motivo, "Matrícula não confere");
      assert.equal((await amb.sql<{ p: string | null }>("select liberacao_assinatura_path as p from usuario where id = $1", [novo.id]))[0]!.p, await amb.assinaturaDe(admin));

      const login = await amb.req("POST", "/auth/login", { json: { email: novo.email, senha: "senha-inicial-1" } });
      assert.equal(login.status, 403);
      assert.equal(login.corpo.erro.codigo, "acesso_recusado");
      assert.match(login.corpo.erro.mensagem, /Matrícula não confere/);

      // Token já emitido: recusado nunca passa (nem nas rotas da fila offline).
      for (const [m, c, json] of [["GET", "/me"], ["POST", "/eventos", { eventos: [] }], ["GET", "/os"]] as [string, string, unknown?][]) {
        const r = await amb.req(m, c, { como: novo, ...(json ? { json } : {}) });
        assert.equal(r.status, 401, c);
        assert.equal(r.corpo.erro.codigo, "acesso_revogado", c);
      }
      assert.equal((await amb.req("POST", "/auth/refresh", { json: { refresh_token: "qualquer" } })).status, 401);
    });

    it("liberar ou recusar quem não está pendente é 409 (e 404 se não existe)", async () => {
      const liberado = await cadastrar(32);
      await amb.esperar(200, "POST", `/usuarios/${liberado.id}/liberar`, { como: admin });
      for (const acao of [["liberar", undefined], ["recusar", { motivo: "x" }]] as const) {
        const r = await amb.req("POST", `/usuarios/${liberado.id}/${acao[0]}`, { como: admin, ...(acao[1] ? { json: acao[1] } : {}) });
        assert.equal(r.status, 409);
        assert.equal(r.corpo.erro.codigo, "nao_pendente");
      }
      const recusado = await cadastrar(33);
      await amb.esperar(200, "POST", `/usuarios/${recusado.id}/recusar`, { como: admin, json: { motivo: "Não" } });
      assert.equal((await amb.req("POST", `/usuarios/${recusado.id}/liberar`, { como: admin })).status, 409);
      assert.equal((await amb.req("POST", `/usuarios/${recusado.id}/recusar`, { como: admin, json: { motivo: "Não" } })).status, 409);
      assert.equal((await amb.req("POST", `/usuarios/${admin.id}/liberar`, { como: admin })).status, 409);
      assert.equal((await amb.req("POST", "/usuarios/00000000-0000-4000-8000-0000000000ff/liberar", { como: admin })).status, 404);
    });

    it("admin não ativa nem desativa pelo PATCH quem não está liberado", async () => {
      const novo = await cadastrar(34);
      const r = await amb.req("PATCH", `/usuarios/${novo.id}`, { como: admin, json: { ativo: false } });
      assert.equal(r.status, 409);
      assert.equal(r.corpo.erro.codigo, "usuario_nao_liberado");
    });

    it("filtro liberacao no admin: liberado, pendente e recusado", async () => {
      for (const liberacao of ["liberado", "pendente", "recusado"]) {
        const lista = await amb.esperar(200, "GET", "/usuarios", { como: admin, consulta: { liberacao } });
        assert.ok(lista.total >= 1, liberacao);
        assert.ok(lista.usuarios.every((u: any) => u.liberacao === liberacao), liberacao);
      }
      assert.equal((await amb.req("GET", "/usuarios", { como: admin, consulta: { liberacao: "x" } })).status, 422);
    });
  });

  describe("supervisor sobre os pendentes", () => {
    it("vê pendentes e recusados das equipes dele (com o motivo) e não os das outras", async () => {
      const meu = await cadastrar(40);
      const alheio = await cadastrar(41, outroSupervisor, outraEquipeId);
      const recusado = await cadastrar(42);
      await amb.esperar(200, "POST", `/usuarios/${recusado.id}/recusar`, { como: admin, json: { motivo: "Sem vaga" } });

      const pendentes = await amb.esperar(200, "GET", "/usuarios", { como: supervisor, consulta: { liberacao: "pendente" } });
      assert.ok(pendentes.usuarios.some((u: any) => u.id === meu.id));
      assert.ok(!pendentes.usuarios.some((u: any) => u.id === alheio.id));
      assert.ok(pendentes.usuarios.every((u: any) => u.liberacao === "pendente" && u.equipe_id === equipeId));

      const recusados = await amb.esperar(200, "GET", "/usuarios", { como: supervisor, consulta: { liberacao: "recusado" } });
      const r = recusados.usuarios.find((u: any) => u.id === recusado.id);
      assert.equal(r.recusa_motivo, "Sem vaga");
      assert.equal(r.email, undefined);

      const um = await amb.esperar(200, "GET", `/usuarios/${recusado.id}`, { como: supervisor });
      assert.equal(um.usuario.recusa_motivo, "Sem vaga");
      assert.equal((await amb.req("GET", `/usuarios/${alheio.id}`, { como: supervisor })).status, 404);

      // A lista comum do supervisor segue sendo só de colegas liberados.
      const comum = await amb.esperar(200, "GET", "/usuarios", { como: supervisor });
      assert.ok(!comum.usuarios.some((u: any) => u.liberacao !== "liberado"));
    });

    it("não edita ninguém, nem o pendente que cadastrou: nome, cargo e registro vêm do registro de funcionários", async () => {
      const meu = await cadastrar(50);
      const alheio = await cadastrar(51, outroSupervisor, outraEquipeId);
      for (const json of [{ perfil: "tecnico" }, { equipe_id: outraEquipeId }, { ativo: false }, {}]) {
        assert.equal((await amb.req("PATCH", `/usuarios/${meu.id}`, { como: supervisor, json })).status, 403, JSON.stringify(json));
      }
      assert.equal((await amb.req("PATCH", `/usuarios/${alheio.id}`, { como: supervisor, json: { perfil: "tecnico" } })).status, 403);
      const liberado = await cadastrar(52);
      await amb.esperar(200, "POST", `/usuarios/${liberado.id}/liberar`, { como: admin });
      assert.equal((await amb.req("PATCH", `/usuarios/${liberado.id}`, { como: supervisor, json: { perfil: "tecnico" } })).status, 403);
      assert.equal((await amb.req("PATCH", `/usuarios/${tecnico.id}`, { como: supervisor, json: { perfil: "tecnico" } })).status, 403);
      // técnico comum não edita
      assert.equal((await amb.req("PATCH", `/usuarios/${meu.id}`, { como: tecnico, json: { perfil: "tecnico" } })).status, 403);
    });

    it("não redefine a senha", async () => {
      const meu = await cadastrar(53);
      assert.equal((await amb.req("POST", `/usuarios/${meu.id}/redefinir-senha`, { como: supervisor })).status, 403);
    });

    it("cancela só o pendente que criou: apaga a conta e libera e-mail e matrícula", async () => {
      const meu = await cadastrar(60);
      const alheio = await cadastrar(61, outroSupervisor, outraEquipeId);
      const liberado = await cadastrar(62);
      await amb.esperar(200, "POST", `/usuarios/${liberado.id}/liberar`, { como: admin });

      assert.equal((await amb.req("DELETE", `/usuarios/${alheio.id}`, { como: supervisor })).status, 403);
      assert.equal((await amb.req("DELETE", `/usuarios/${liberado.id}`, { como: supervisor })).status, 403);
      assert.equal((await amb.req("DELETE", `/usuarios/${tecnico.id}`, { como: supervisor })).status, 403);

      await amb.esperar(200, "DELETE", `/usuarios/${meu.id}`, { como: supervisor });
      assert.equal((await amb.req("GET", `/usuarios/${meu.id}`, { como: admin })).status, 404);
      assert.equal((await amb.req("POST", "/auth/login", { json: { email: meu.email, senha: "senha-inicial-1" } })).status, 401);
      await amb.esperar(201, "POST", "/usuarios", { como: supervisor, json: corpoNovo(60, { equipe_id: equipeId }) });
    });

    it("admin exclui o recusado e e-mail e matrícula voltam a ser usáveis", async () => {
      const novo = await cadastrar(70);
      await amb.esperar(200, "POST", `/usuarios/${novo.id}/recusar`, { como: admin, json: { motivo: "Erro de cadastro" } });
      assert.equal((await amb.req("POST", "/usuarios", { como: supervisor, json: corpoNovo(70, { equipe_id: equipeId }) })).status, 409);
      await amb.esperar(200, "DELETE", `/usuarios/${novo.id}`, { como: admin });
      await amb.esperar(201, "POST", "/usuarios", { como: supervisor, json: corpoNovo(70, { equipe_id: equipeId }) });
    });

    it("pendente de supervisor que deixou de supervisionar: o supervisor perde o acesso, o admin segue vendo", async () => {
      const criada3 = await amb.criarEquipe();
      const equipe3 = criada3.id;
      centrosDasEquipes.set(equipe3, criada3.centroTrabalho);
      const sup3 = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipe3, supervisor: true });
      const novo = await cadastrar(80, sup3, equipe3);
      await amb.sql("update equipe set supervisor_id = null where id = $1", [equipe3]);
      // o token de sup3 ainda vale, mas sem equipes ele deixa de ser supervisor
      assert.equal((await amb.req("PATCH", `/usuarios/${novo.id}`, { como: sup3, json: { perfil: "tecnico" } })).status, 403);
      assert.equal((await amb.req("DELETE", `/usuarios/${novo.id}`, { como: sup3 })).status, 403);
      await amb.esperar(200, "POST", `/usuarios/${novo.id}/liberar`, { como: admin });
    });
  });

  it("o login de admin e técnico liberados não muda", async () => {
    const login = await amb.esperar(200, "POST", "/auth/login", { json: { email: admin.email, senha: SENHA_PADRAO } });
    assert.equal(login.usuario.liberacao, "liberado");
  });
});

describe("Migrações 0009 e 0010: usuários existentes ficam liberados e sem data de cadastro", () => {
  it("quem já existia vira liberado, sem criador nem data de cadastro", async () => {
    const cliente = new PGlite();
    try {
      const executar = async (arquivo: string) => {
        for (const comando of readFileSync(join(PASTA_MIGRACOES, arquivo), "utf8").split("--> statement-breakpoint")) await cliente.exec(comando);
      };
      for (const a of ["0000_schema.sql", "0001_gatilhos.sql", "0002_os_cancelamento.sql", "0003_email_institucional.sql", "0004_os_origem_apoio.sql", "0005_alerta_falha_importacao.sql", "0006_modelo_apr_arquivado.sql", "0007_supreme_white_queen.sql", "0008_treinamento_estado.sql"]) await executar(a);
      await cliente.exec(`insert into usuario (id, nome, matricula, email, perfil) values ('00000000-0000-4000-8000-000000000001', 'Antigo', 'A', 'a@e.com', 'tecnico'), ('00000000-0000-4000-8000-000000000002', 'Adm', 'B', 'b@e.com', 'admin')`);
      await executar("0009_liberacao_de_acesso.sql");
      await executar("0010_criado_em_do_usuario.sql");
      const { rows } = await cliente.query<Record<string, unknown>>("select matricula, liberacao, criado_por_id, criado_em, liberado_por_id, liberado_em, recusa_motivo from usuario order by matricula");
      assert.deepEqual(rows, [
        { matricula: "A", liberacao: "liberado", criado_por_id: null, criado_em: null, liberado_por_id: null, liberado_em: null, recusa_motivo: null },
        { matricula: "B", liberacao: "liberado", criado_por_id: null, criado_em: null, liberado_por_id: null, liberado_em: null, recusa_motivo: null },
      ]);
      await assert.rejects(() => cliente.exec(`update usuario set liberacao = 'quase'`), /usuario_liberacao_check/);
    } finally {
      await cliente.close();
    }
  });
});
