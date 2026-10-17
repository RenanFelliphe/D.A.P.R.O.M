import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { usuario } from "../src/db/schema";
import { arquivoDeImagem, criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

/** A assinatura é a primeira coisa depois da liberação: sem ela, nada abre além de ler o perfil, cadastrá-la, sair e trocar a senha. */
describe("Assinatura obrigatória depois da liberação", () => {
  let amb: Ambiente;
  let equipeId: string;

  before(async () => {
    amb = await criarAmbiente();
    const supervisor = await amb.criarUsuario({ perfil: "tecnico" });
    equipeId = (await amb.criarEquipe({ supervisorId: supervisor.id })).id;
  });
  after(() => amb.fechar());

  const semAssinatura = (perfil: "tecnico" | "admin") => amb.criarUsuario({ perfil, ...(perfil === "tecnico" ? { equipeId } : {}), comAssinatura: false });

  async function bloqueado(como: UsuarioDeTeste, metodo: string, caminho: string, json?: unknown) {
    const r = await amb.req(metodo, caminho, { como, ...(json ? { json } : {}) });
    assert.equal(r.status, 403, `${metodo} ${caminho}`);
    assert.equal(r.corpo.erro.codigo, "assinatura_pendente", `${metodo} ${caminho}`);
  }

  it("técnico liberado sem assinatura só lê o perfil e cadastra a assinatura; o resto é 403 assinatura_pendente", async () => {
    const novo = await semAssinatura("tecnico");
    await bloqueado(novo, "GET", "/os");
    await bloqueado(novo, "GET", "/equipes");
    await bloqueado(novo, "POST", "/eventos", { eventos: [] });
    await bloqueado(novo, "PUT", "/me/treinamento", { estado: "concluido" });

    const eu = await amb.esperar(200, "GET", "/me", { como: novo });
    assert.equal(eu.usuario.assinatura_path, null);

    // O que a tela de cadastro faz: sobe a imagem e grava no perfil.
    const arquivo = randomUUID();
    const form = new FormData();
    form.set("arquivo", arquivoDeImagem("traco"));
    form.set("tipo", "assinatura");
    await amb.esperar(200, "PUT", `/arquivos/${arquivo}`, { como: novo, form });
    await amb.esperar(200, "PUT", "/me/assinatura", { como: novo, json: { arquivo_id: arquivo } });

    assert.equal((await amb.esperar(200, "GET", "/me", { como: novo })).usuario.assinatura_path, arquivo);
    await amb.esperar(200, "GET", "/os", { como: novo });
    await amb.esperar(200, "GET", "/equipes", { como: novo });
  });

  it("o admin também precisa cadastrar a assinatura antes de usar o sistema", async () => {
    const admin = await semAssinatura("admin");
    await bloqueado(admin, "GET", "/os");
    await bloqueado(admin, "GET", "/usuarios");
    await amb.esperar(200, "GET", "/me", { como: admin });
    await amb.cadastrarAssinatura(admin);
    await amb.esperar(200, "GET", "/os", { como: admin });
  });

  it("sair e trocar a senha passam sem assinatura (a senha provisória vem antes)", async () => {
    const novo = await amb.criarUsuario({ perfil: "tecnico", equipeId, comAssinatura: false, senhaProvisoria: true });
    const r = await amb.req("GET", "/os", { como: novo });
    assert.equal(r.corpo.erro.codigo, "senha_provisoria");
    await amb.esperar(200, "POST", "/auth/trocar-senha", { como: novo, json: { senha_atual: novo.senha, senha_nova: "outra-senha-9" } });
    await bloqueado(novo, "GET", "/os");
    await amb.esperar(200, "POST", "/auth/sair", { como: novo });
  });

  it("quem aguarda a liberação ainda não é cobrado: segue na espera, e a assinatura vem depois que o admin liberar", async () => {
    const pendente = await semAssinatura("tecnico");
    await amb.db.update(usuario).set({ liberacao: "pendente" }).where(eq(usuario.id, pendente.id));
    const r = await amb.req("GET", "/os", { como: pendente });
    assert.equal(r.status, 403);
    assert.equal(r.corpo.erro.codigo, "aguardando_liberacao");
    await amb.esperar(200, "GET", "/me", { como: pendente });
    await amb.esperar(200, "PUT", "/me/treinamento", { como: pendente, json: { estado: "pulado" } });

    // Liberado, passa a ser cobrado.
    await amb.db.update(usuario).set({ liberacao: "liberado" }).where(eq(usuario.id, pendente.id));
    await bloqueado(pendente, "GET", "/os");
  });
});
