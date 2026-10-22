import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { atividade, material, os, sugestaoMateriais, sugestaoMateriaisItem } from "../src/db/schema";
import { montarBlocoDoServico } from "../src/dominio/treinamento-servico-dados";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";
import { criarOs } from "./fixture-os";

/**
 * Os minigames com dados (`docs/ia-e-vitoria.md`, seção 1.1): sem a leitura de dados autorizada o pedido do rascunho é o de sempre; com ela, leva
 * um resumo agregado das OS do serviço (motivos de pausa e de suspensão, itens de APR com problema e materiais sugeridos), sem
 * pessoa, sem texto livre e sem dado de outro serviço; sem dado nenhum não vai bloco, e uma falha na leitura nunca derruba o rascunho.
 */
describe("Criação de jogos com dados — o que acontece no serviço entra no pedido do rascunho", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;

  const TEXTO = ["Procedimento de troca do regulador de pressão.", "1. Use luva de raspa e óculos de proteção.", "2. Feche o registro geral e aguarde 5 minutos."].join("\n");

  /** Pede o rascunho e devolve o texto de tudo o que a IA recebeu (a resposta, vazia, termina em erro: aqui só importa o pedido). */
  async function pedirRascunho(codigo: string) {
    const antes = amb.ia.chamadas.length;
    amb.ia.respostas.push("");
    const r = await amb.req("POST", `/treinamentos/${codigo}/rascunho/gerar`, { como: admin, json: { texto: TEXTO } });
    assert.equal(r.status, 200);
    assert.equal(amb.ia.chamadas.length, antes + 1, "a IA foi chamada");
    const pedido = amb.ia.chamadas.at(-1)!;
    return pedido.mensagens.filter((m) => m.papel === "usuario").map((m) => m.texto).join("\n");
  }

  before(async () => {
    amb = await criarAmbiente({ comCarga: false });
    admin = await amb.criarUsuario({ perfil: "admin", nome: "Admin" });
    const equipe = (await amb.criarEquipe({ nome: "Equipe do serviço" })).id;
    tecnico = await amb.criarUsuario({ perfil: "tecnico", nome: "Autora da Sugestão", equipeId: equipe });
    await amb.db.insert(atividade).values([
      { codigo: "DADOS-1", descricao: "Troca do regulador" },
      { codigo: "DADOS-2", descricao: "Outro serviço" },
      { codigo: "DADOS-VAZIO", descricao: "Serviço sem OS" },
    ]);

    // As OS do serviço 1: uma encerrada com pausa "Aguardando" (complemento livre), um item de APR com problema e um trecho suspenso por fim de expediente.
    const a = await criarOs(amb, { equipeId: equipe, encerrada: true, trechoAnterior: true, numeroOrdem: "4800001" });
    await amb.db.update(os).set({ codigoAtividade: "DADOS-1" }).where(eq(os.id, a.osId));
    const b = await criarOs(amb, { equipeId: equipe, encerrada: true, numeroOrdem: "4800002" });
    await amb.db.update(os).set({ codigoAtividade: "DADOS-1" }).where(eq(os.id, b.osId));
    // A OS do serviço 2 tem uma lesão: não pode aparecer no serviço 1.
    const c = await criarOs(amb, { equipeId: equipe, encerrada: true, saude: "lesao", numeroOrdem: "4800003" });
    await amb.db.update(os).set({ codigoAtividade: "DADOS-2" }).where(eq(os.id, c.osId));

    // Uma sugestão aceita de material para o serviço 1 (do catálogo) e um item digitado, que é texto livre e fica de fora.
    const [fita] = await amb.db.insert(material).values({ descricao: "Fita isolante", unidade: "un", categoria: "material" }).returning();
    const [s] = await amb.db
      .insert(sugestaoMateriais)
      .values({ atividadeCodigo: "DADOS-1", tipo: "sugestao", estado: "aceita", autorId: tecnico.id, temLista: true, listaBase: [], avaliadaPor: admin.id, avaliadaEm: new Date() })
      .returning();
    await amb.db.insert(sugestaoMateriaisItem).values([
      { sugestaoId: s!.id, ordem: 0, materialId: fita!.id },
      { sugestaoId: s!.id, ordem: 1, descricao: "Peça digitada pela pessoa", unidade: "un", categoria: "material" },
    ]);
  });
  after(() => amb.fechar());

  it("sem a leitura de dados autorizada, o pedido do rascunho é o de sempre", async () => {
    const tudo = await pedirRascunho("DADOS-1");
    assert.ok(tudo.includes(TEXTO));
    assert.ok(!tudo.includes("Dados reais deste serviço"));
    assert.ok(!tudo.includes("Fita isolante: "));
  });

  it("ligada só a função, sem a leitura de dados, continua igual", async () => {
    await amb.ligarIa("minigames", { comDados: false, como: admin });
    assert.ok(!(await pedirRascunho("DADOS-1")).includes("Dados reais deste serviço"));
  });

  it("com a leitura autorizada, o pedido leva as contagens do serviço, entre o procedimento e a ordem de montar", async () => {
    await amb.ligarIa("minigames", { comDados: true, como: admin });
    const tudo = await pedirRascunho("DADOS-1");
    assert.ok(tudo.includes("Dados reais deste serviço"));
    assert.ok(tudo.includes("- Pausa: Aguardando: 2 vezes"), tudo);
    assert.ok(tudo.includes("- Suspensão: Fim de expediente: 1 vez"), tudo);
    assert.ok(tudo.includes("- Faz uso do protetor solar?: 2 vezes"), tudo);
    assert.ok(tudo.includes("- Fita isolante: 1 vez"), tudo);
    assert.ok(tudo.indexOf(TEXTO) < tudo.indexOf("Dados reais deste serviço") && tudo.indexOf("Dados reais deste serviço") < tudo.indexOf("Monte o rascunho completo."));
    assert.match(tudo, /só para escolher em quais assuntos do procedimento os jogos insistem/);
    assert.match(tudo, /Nunca invente nem cite estes números/);
  });

  it("nunca vai pessoa, OS, texto livre nem dado de outro serviço", async () => {
    const tudo = await pedirRascunho("DADOS-1");
    for (const proibido of [
      "Peça do almoxarifado", // complemento livre da pausa
      "Peça digitada pela pessoa", // item digitado da sugestão
      "Autora da Sugestão",
      "Elismário",
      "Damião",
      "Heloísa",
      "4800001",
      "4800002",
      "4800003",
      "Sem intercorrências",
      "Lanterna de cabeça", // observação da resposta de APR
      "Dreno desobstruído", // descrição do encerramento
      "Lesão", // pausa do outro serviço
    ]) {
      assert.ok(!tudo.includes(proibido), `"${proibido}" não pode ir para a IA`);
    }
  });

  it("serviço sem nada registrado não leva bloco", async () => {
    assert.ok(!(await pedirRascunho("DADOS-VAZIO")).includes("Dados reais deste serviço"));
    assert.equal(await montarBlocoDoServico(amb.deps, "DADOS-VAZIO"), null);
  });

  it("cada serviço leva só o seu: o outro serviço tem a lesão e nenhuma sugestão", async () => {
    const tudo = await pedirRascunho("DADOS-2");
    assert.ok(tudo.includes("- Pausa: Lesão: 1 vez"), tudo);
    assert.ok(tudo.includes("- Pausa: Aguardando: 1 vez"), tudo);
    assert.ok(!tudo.includes("Fita isolante"));
    assert.ok(!tudo.includes("Suspensão"));
  });

  it("falha na leitura dos dados nunca derruba o rascunho: o pedido sai sem o bloco", async () => {
    await amb.sql("alter table execucao_pausa rename to execucao_pausa_fora");
    try {
      const tudo = await pedirRascunho("DADOS-1");
      assert.ok(tudo.includes(TEXTO));
      assert.ok(!tudo.includes("Dados reais deste serviço"));
    } finally {
      await amb.sql("alter table execucao_pausa_fora rename to execucao_pausa");
    }
    assert.ok((await pedirRascunho("DADOS-1")).includes("Dados reais deste serviço"), "voltando a leitura, o bloco volta");
  });

  it("revogar a leitura de dados tira o bloco na hora", async () => {
    await amb.esperar(200, "PUT", "/vitoria/ia/minigames", { como: admin, json: { ligada: true, com_dados: false } });
    assert.ok(!(await pedirRascunho("DADOS-1")).includes("Dados reais deste serviço"));
  });
});
