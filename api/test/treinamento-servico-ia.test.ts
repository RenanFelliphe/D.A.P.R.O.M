import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { atividade, atividadeMaterial, auditoria, material } from "../src/db/schema";
import { LeitorDeObjetosJson } from "../src/dominio/treinamento-servico-ia";
import { criarAmbiente, configDeTeste, type Ambiente, type UsuarioDeTeste } from "./ajuda";

/**
 * O rascunho de treinamento pela IA (seção 3.6 do `vitoria.md`): a geração em streaming com o progresso, as conferências
 * que viram pendências (origem fora do texto, número fora do texto, fase sem opção certa, material fora do catálogo), a
 * publicação travada até o admin editar ou confirmar, os ajustes pelo chat, a fase regerada, os limites da demonstração,
 * a IA desligada ou falhando sem gravar nada e o jogador sem a meta da IA.
 */
describe("Treinamentos de serviço — rascunho pela IA", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;
  const materiais: Record<string, string> = {};

  const TEXTO = [
    "Procedimento de troca do regulador de pressão.",
    "1. Antes de começar, use luva de raspa e óculos de proteção.",
    "2. Feche o registro geral e aguarde 5 minutos.",
    "3. Confira com o detector se a leitura está abaixo de 10 ppm.",
    "4. Se sentir cheiro de gás, pare o serviço, ventile o local e avise o supervisor.",
    "5. Troque o regulador usando a chave de boca de 32 mm.",
    "6. Abra o registro devagar e teste a vedação com espuma.",
  ].join("\n");

  const linha = (o: unknown) => JSON.stringify(o);
  const PASSO_LIMPO = { item: "passo", texto: "Antes de começar, use luva de raspa e óculos de proteção.", expressao: "explicando", origem: "Antes de começar, use luva de raspa e óculos de proteção." };
  const QUIZ_LIMPO = {
    item: "fase",
    tipo: "quiz",
    enunciado: "Qual leitura o detector precisa mostrar?",
    opcoes: [
      { texto: "Abaixo de 10 ppm", certa: true },
      { texto: "Só olhar, sem detector", certa: false },
      { texto: "Qualquer leitura", certa: false },
    ],
    explicacao: "O procedimento pede abaixo de 10 ppm.",
    origem: "Confira com o detector se a leitura está abaixo de 10 ppm.",
  };
  const DECISAO_SEM_CERTA = {
    item: "fase",
    tipo: "decisao",
    situacao: "Você sente cheiro de gás durante a troca.",
    opcoes: [
      { texto: "Continuar", consequencia: "Risco de acidente." },
      { texto: "Parar, ventilar e avisar o supervisor", consequencia: "Local seguro." },
      { texto: "Acelerar o serviço", consequencia: "Risco maior." },
    ],
    explicacao: "Pare, ventile e avise.",
    origem: "Se sentir cheiro de gás, pare o serviço, ventile o local e avise o supervisor.",
  };
  const SEPARAR_COM_MATERIAL_INVENTADO = {
    item: "fase",
    tipo: "separar_itens",
    enunciado: "Toque nos itens deste serviço.",
    materiais: ["M1", "M3", "M9"],
    quantidade_errados: 2,
    explicacao: "Luva e chave de boca.",
    origem: "Troque o regulador usando a chave de boca de 32 mm.",
  };
  const ORDEM_COM_ORIGEM_INVENTADA = {
    item: "fase",
    tipo: "ordem",
    enunciado: "Ponha as etapas na ordem.",
    etapas: ["Feche o registro geral", "Troque o regulador", "Abra o registro devagar"],
    explicacao: "Fechar, trocar e abrir devagar.",
    origem: "Abra o registro devagar e teste a vedação com o manômetro.",
  };

  /** A resposta da geração: embrulhada em bloco de código, com uma fase fora do formato (um par só) no meio. */
  const RESPOSTA_DA_GERACAO = [
    "```json",
    linha({ item: "plano", passos: 2, fases: 4 }),
    linha(PASSO_LIMPO),
    // Número que não está no texto (15, em vez de 5); a origem junta frases de dois passos, o que vale.
    linha({ item: "passo", texto: "Feche o registro geral e aguarde 15 minutos.", expressao: "alerta", origem: "Feche o registro geral e aguarde 5 minutos. Confira com o detector se a leitura está abaixo de 10 ppm." }),
    linha(QUIZ_LIMPO),
    linha({ item: "fase", tipo: "ligar", pares: [{ esquerda: "Gás", direita: "Ventilar" }], explicacao: "x", origem: "x" }),
    linha(DECISAO_SEM_CERTA),
    linha(SEPARAR_COM_MATERIAL_INVENTADO),
    linha(ORDEM_COM_ORIGEM_INVENTADA),
    linha({ item: "resumo", texto: "Montei 2 passos e 4 fases sobre a troca do regulador." }),
    "```",
  ].join("\n");

  before(async () => {
    amb = await criarAmbiente();
    admin = await amb.criarUsuario({ perfil: "admin", nome: "Admin" });
    tecnico = await amb.criarUsuario({ perfil: "tecnico", nome: "Técnico" });
    for (const [chave, descricao, categoria] of [
      ["luva", "Luva de raspa", "epi"],
      ["oculos", "Óculos de proteção", "epi"],
      ["chave", "Chave de boca 32 mm", "ferramenta"],
      ["fita", "Fita isolante", "material"],
    ] as const) {
      const [m] = await amb.db.insert(material).values({ descricao, unidade: "un", categoria }).returning();
      materiais[chave] = m!.id;
    }
    await amb.db.insert(atividade).values({ codigo: "IA-OUTRO", descricao: "Outro serviço" });
    await amb.db.insert(atividadeMaterial).values({ atividadeCodigo: "IA-OUTRO", materialId: materiais.fita!, ordem: 0 });
  });
  after(() => amb.fechar());

  async function novoServico(codigo: string) {
    await amb.db.insert(atividade).values({ codigo, descricao: "Troca do regulador" });
    for (const [i, chave] of (["luva", "oculos", "chave"] as const).entries()) {
      await amb.db.insert(atividadeMaterial).values({ atividadeCodigo: codigo, materialId: materiais[chave]!, ordem: i });
    }
  }

  interface Evento {
    event: string;
    dados: any;
  }

  function lerSSE(corpo: ArrayBuffer): Evento[] {
    return new TextDecoder()
      .decode(corpo)
      .split("\n\n")
      .filter((b) => b.trim())
      .map((bloco) => {
        const linhas = bloco.split("\n");
        const event = linhas.find((l) => l.startsWith("event: "))?.slice("event: ".length) ?? "message";
        const data = linhas
          .filter((l) => l.startsWith("data: "))
          .map((l) => l.slice("data: ".length))
          .join("\n");
        return { event, dados: JSON.parse(data) };
      });
  }

  /** Chama a rota da IA e devolve os eventos SSE (o status tem que ser 200: os erros de antes do streaming são testados à parte). */
  async function chamarIA(codigo: string, acao: "gerar" | "ajustar", json: unknown) {
    const r = await amb.req("POST", `/treinamentos/${codigo}/rascunho/${acao}`, { como: admin, json });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    const eventos = lerSSE(r.corpo as ArrayBuffer);
    return { eventos, final: eventos.find((e) => e.event === "final")?.dados, erro: eventos.find((e) => e.event === "erro")?.dados };
  }

  const obterRascunho = (codigo: string) => amb.esperar(200, "GET", `/treinamentos/${codigo}/rascunho`, { como: admin });
  const salvar = (codigo: string, r: { explicacao: unknown[]; fases: unknown[] }) => amb.esperar(200, "PUT", `/treinamentos/${codigo}/rascunho`, { como: admin, json: { explicacao: r.explicacao, fases: r.fases } });
  async function publicar(codigo: string) {
    const id = randomUUID();
    await amb.armazenamento.gravar("assinaturas", id, new Uint8Array([1, 2, 3]), "image/png");
    return amb.req("POST", `/treinamentos/${codigo}/publicar`, { como: admin, json: { arquivo_id: id } });
  }
  const confirmar = (item: any) => ({ ...item, ia: { ...item.ia, conferido: true } });
  const codigos = (pendencias: { codigo: string }[]) => pendencias.map((p) => p.codigo).sort();

  it("o leitor tira cada objeto JSON conforme chega: linhas, objeto em várias linhas, chaves dentro de texto e lixo ao redor", () => {
    const leitor = new LeitorDeObjetosJson();
    const pedacos = ['Aqui está:\n```json\n{"item":"pla', 'no","passos":1}\n{\n  "item": "passo",\n  "texto": "use a chave {A} \\"', 'grande\\""\n}\n{quebrado}\n```'];
    const objetos = pedacos.flatMap((p) => leitor.alimentar(p));
    assert.deepEqual(objetos, [
      { item: "plano", passos: 1 },
      { item: "passo", texto: 'use a chave {A} "grande"' },
    ]);
    assert.equal(leitor.invalidos, 1);
  });

  it("gera em streaming com o progresso, converte para o editor e transforma as conferências em pendências", async () => {
    const codigo = "IA-GERAR";
    await novoServico(codigo);
    const antes = await obterRascunho(codigo);
    assert.equal(antes.ia.disponivel, true);
    assert.equal(antes.ia.pode_gerar, true);
    assert.equal(antes.ia.pode_ajustar, false, "ajustar só depois de gerar");

    amb.ia.respostas.push(RESPOSTA_DA_GERACAO);
    const { eventos, final, erro } = await chamarIA(codigo, "gerar", { texto: TEXTO });
    assert.equal(erro, undefined);
    const mensagens = eventos.filter((e) => e.event === "progresso").map((e) => e.dados.mensagem);
    assert.equal(mensagens[0], "Lendo o texto do procedimento…");
    assert.ok(mensagens.includes("Montando a explicação: passo 2 de 2…"), mensagens.join(" | "));
    assert.ok(mensagens.includes("Montando a fase 3 de 4…"), mensagens.join(" | "));
    assert.ok(mensagens.includes("Conferindo o rascunho…"), mensagens.join(" | "));

    // O pedido à IA: o texto, os materiais com códigos curtos (nunca o id) e o modelo do rascunho, com tempo para 1-2 minutos.
    const pedido = amb.ia.chamadas.at(-1)!;
    assert.equal(pedido.modelo, "rascunho");
    assert.ok((pedido.tempoLimiteMs ?? 0) > 60_000);
    const tudo = pedido.mensagens.map((m) => m.texto).join("\n");
    assert.ok(tudo.includes(TEXTO));
    assert.ok(tudo.includes("M1 — Luva de raspa (EPI)") && tudo.includes("M3 — Chave de boca 32 mm (ferramenta)"));
    assert.ok(!Object.values(materiais).some((id) => tudo.includes(id)), "o id do material nunca vai à IA");

    assert.equal(final.resumo, "Montei 2 passos e 4 fases sobre a troca do regulador.");
    assert.equal(final.descartados, 1, "a fase de ligar com um par só é descartada");
    const r = final.rascunho;
    assert.equal(r.gerado_com_ia, true);
    assert.equal(r.texto_origem, TEXTO);
    assert.equal(r.rodadas_ia, 0, "a primeira geração não gasta rodada");
    assert.equal(r.explicacao.length, 2);
    assert.deepEqual(
      r.fases.map((f: any) => f.tipo),
      ["quiz", "decisao", "separar_itens", "ordem"],
    );
    assert.equal(r.fases[0].correta, 0);
    assert.deepEqual(r.fases[2].material_ids, [materiais.luva, materiais.chave]);
    assert.equal(r.fases[3].ia.origem, ORDEM_COM_ORIGEM_INVENTADA.origem);
    assert.deepEqual(
      r.pendencias.map((p: any) => `${p.parte}${p.indice}:${p.codigo}`),
      ["passo1:numero_fora_do_texto", "fase1:fase_sem_opcao_certa", "fase2:material_fora_do_catalogo", "fase3:origem_fora_do_texto"],
    );
    assert.match(r.pendencias[0].mensagem, /15/);
    assert.equal(final.ia.usa_ia, true);
    assert.equal(final.ia.treinamentos_usados, 1);

    // Gravado: abrir o editor de novo traz o mesmo rascunho e as mesmas pendências.
    const depois = await obterRascunho(codigo);
    assert.equal(depois.pendencias.length, 4);
    assert.equal(depois.ia.pode_ajustar, true);

    // Com pendência aberta, não publica.
    const recusa = await publicar(codigo);
    assert.equal(recusa.status, 422);
    assert.equal(recusa.corpo.erro.codigo, "pendencias_abertas");
    assert.equal(recusa.corpo.erro.detalhes.pendencias.length, 4);

    // Editar o item fecha a pendência dele; confirmar fecha as outras.
    const fases = depois.fases.map((f: any, i: number) => (i === 1 ? { ...f, correta: 1 } : i === 0 ? f : confirmar(f)));
    const explicacao = depois.explicacao.map((p: any, i: number) => (i === 1 ? confirmar(p) : p));
    const salvo = await salvar(codigo, { explicacao, fases });
    assert.deepEqual(salvo.pendencias, []);

    assert.equal((await publicar(codigo)).status, 200);
    const [registro] = await amb.db.select().from(auditoria).where(and(eq(auditoria.acao, "treinamento.publicar"), eq(auditoria.entidadeId, codigo)));
    assert.match(registro!.resumo, /rascunho feito com a IA/);
    assert.deepEqual(registro!.detalhes, { versao: 1, gerado_com_ia: true, texto_origem: TEXTO });

    // Quem treina recebe a explicação sem a meta da IA (o trecho de origem e as pendências são do editor).
    const jogo = await amb.esperar(200, "GET", `/treinamentos/${codigo}`, { como: tecnico });
    assert.ok(jogo.explicacao.every((p: any) => !("ia" in p)));
  });

  it("editar depois de publicar parte da versão publicada; ajustes pelo chat e a fase regerada gastam rodadas", async () => {
    const codigo = "IA-GERAR";
    // A versão 2 nasce com o conteúdo e o texto de origem da versão publicada.
    const v2 = await obterRascunho(codigo);
    assert.equal(v2.versao, 2);
    assert.equal(v2.fases.length, 4);
    assert.equal(v2.texto_origem, TEXTO);
    assert.deepEqual(v2.pendencias, []);

    // Uma imagem no primeiro passo, que a IA não conhece e precisa sobreviver ao ajuste.
    const imagem = randomUUID();
    const comImagem = await salvar(codigo, { explicacao: v2.explicacao.map((p: any, i: number) => (i === 0 ? { ...p, imagem_path: imagem } : p)), fases: v2.fases });
    assert.deepEqual(comImagem.pendencias, [], "pôr a imagem é editar: não reabre nada");

    // O chat: a IA devolve tudo, troca o quiz por um com um número fora do texto e repete o resto igual.
    const segundoPasso = comImagem.explicacao[1];
    const resposta = [
      linha({ item: "plano", passos: 2, fases: 4 }),
      linha(PASSO_LIMPO),
      linha({ item: "passo", texto: segundoPasso.texto, expressao: segundoPasso.expressao, origem: segundoPasso.ia.origem }),
      linha({ ...QUIZ_LIMPO, opcoes: [{ texto: "Abaixo de 10 ppm", certa: true }, { texto: "Abaixo de 50 ppm", certa: false }, { texto: "Qualquer leitura", certa: false }] }),
      linha({ ...DECISAO_SEM_CERTA, opcoes: DECISAO_SEM_CERTA.opcoes.map((o, i) => ({ ...o, certa: i === 1 })) }),
      linha({ ...SEPARAR_COM_MATERIAL_INVENTADO, materiais: ["M1", "M3"] }),
      linha(ORDEM_COM_ORIGEM_INVENTADA),
      linha({ item: "resumo", texto: "Troquei uma opção do quiz." }),
    ].join("\n");
    amb.ia.respostas.push(resposta);
    const { final } = await chamarIA(codigo, "ajustar", { pedido: "Deixe o quiz mais difícil" });
    assert.ok(final, "o ajuste termina com o evento final");
    assert.equal(final.resumo, "Troquei uma opção do quiz.");
    assert.equal(final.rascunho.rodadas_ia, 1);
    assert.equal(final.ia.rodadas_usadas, 1);
    assert.equal(final.rascunho.explicacao[0].imagem_path, imagem, "a imagem do passo volta pelo texto igual");
    // Só o quiz mudou: os itens que o admin já tinha confirmado ou editado voltam iguais e não reabrem pendência.
    assert.deepEqual(codigos(final.rascunho.pendencias), ["numero_fora_do_texto"]);
    assert.equal(final.rascunho.pendencias[0].parte, "fase");
    assert.equal(final.rascunho.pendencias[0].indice, 0);
    const pedido = amb.ia.chamadas.at(-1)!.mensagens.map((m) => m.texto).join("\n");
    assert.ok(pedido.includes("Rascunho atual:") && pedido.includes("Deixe o quiz mais difícil"));
    assert.ok(pedido.includes('"materiais":["M1","M3"]'), "o rascunho atual vai à IA com os códigos curtos");

    // Regerar só a fase 1: as outras ficam como estavam.
    const antes = final.rascunho;
    amb.ia.respostas.push([linha({ ...QUIZ_LIMPO, enunciado: "O detector precisa mostrar o quê?" }), linha({ item: "resumo", texto: "Refiz a fase 1." })].join("\n"));
    const { final: refeita } = await chamarIA(codigo, "ajustar", { fase: 0 });
    assert.equal(refeita.rascunho.fases[0].enunciado, "O detector precisa mostrar o quê?");
    assert.deepEqual(refeita.rascunho.fases.slice(1), antes.fases.slice(1));
    assert.deepEqual(refeita.rascunho.explicacao, antes.explicacao);
    assert.deepEqual(refeita.rascunho.pendencias, []);
    assert.equal(refeita.ia.rodadas_usadas, 2);
  });

  it("os limites da demonstração: rodadas por treinamento e treinamentos com IA", async () => {
    const original = amb.deps.config;
    try {
      amb.deps.config = { ...configDeTeste, treinamentoIa: { ...configDeTeste.treinamentoIa, limiteRodadas: 2, limiteTreinamentos: 1 } };
      // IA-GERAR já gastou 2 rodadas: nem ajuste, nem nova geração.
      const situacao = (await obterRascunho("IA-GERAR")).ia;
      assert.equal(situacao.pode_ajustar, false);
      assert.equal(situacao.pode_gerar, false);
      assert.equal(situacao.motivo, "Limite da demonstração atingido");
      const ajuste = await amb.req("POST", "/treinamentos/IA-GERAR/rascunho/ajustar", { como: admin, json: { pedido: "Encurte" } });
      assert.equal(ajuste.status, 409);
      assert.equal(ajuste.corpo.erro.codigo, "limite_ia");

      // Um treinamento já usou a IA, e o limite é 1: outro serviço não gera.
      await novoServico("IA-LIMITE");
      assert.equal((await obterRascunho("IA-LIMITE")).ia.pode_gerar, false);
      const geracao = await amb.req("POST", "/treinamentos/IA-LIMITE/rascunho/gerar", { como: admin, json: { texto: TEXTO } });
      assert.equal(geracao.status, 409);
      assert.equal(amb.ia.respostas.length, 0);
    } finally {
      amb.deps.config = original;
    }
  });

  it("IA desligada, IA falhando ou resposta sem nada aproveitável: nada é gravado e nenhuma rodada conta", async () => {
    const codigo = "IA-FALHA";
    await novoServico(codigo);

    amb.ia.falhar = true;
    try {
      const desligada = await obterRascunho(codigo);
      assert.equal(desligada.ia.disponivel, false);
      assert.equal(desligada.ia.pode_gerar, false);
      const r = await amb.req("POST", `/treinamentos/${codigo}/rascunho/gerar`, { como: admin, json: { texto: TEXTO } });
      assert.equal(r.status, 503);
      assert.equal(r.corpo.erro.codigo, "ia_indisponivel");
    } finally {
      amb.ia.falhar = false;
    }

    // Sem resposta programada: a IA "cai" no meio, depois que a resposta já é streaming.
    const caiu = await chamarIA(codigo, "gerar", { texto: TEXTO });
    assert.equal(caiu.erro.codigo, "ia_indisponivel");
    assert.equal(caiu.final, undefined);

    amb.ia.respostas.push("Desculpe, não consigo ajudar com isso.");
    const lixo = await chamarIA(codigo, "gerar", { texto: TEXTO });
    assert.equal(lixo.erro.codigo, "resposta_ia_invalida");

    const rascunho = await obterRascunho(codigo);
    assert.equal(rascunho.gerado_com_ia, false);
    assert.equal(rascunho.texto_origem, null);
    assert.deepEqual(rascunho.fases, []);
    assert.equal(rascunho.ia.usa_ia, false);
  });

  it("validações e permissões: texto curto, ajuste sem geração, fase inexistente e só o admin", async () => {
    const codigo = "IA-REGRAS";
    await novoServico(codigo);
    await obterRascunho(codigo);

    assert.equal((await amb.req("POST", `/treinamentos/${codigo}/rascunho/gerar`, { como: admin, json: { texto: "curto" } })).status, 422);
    const semTexto = await amb.req("POST", `/treinamentos/${codigo}/rascunho/ajustar`, { como: admin, json: { pedido: "Encurte" } });
    assert.equal(semTexto.status, 422);
    assert.equal(semTexto.corpo.erro.codigo, "sem_texto_origem");
    const faseInexistente = await amb.req("POST", "/treinamentos/IA-GERAR/rascunho/ajustar", { como: admin, json: { fase: 9 } });
    assert.ok([409, 422].includes(faseInexistente.status));

    for (const acao of ["gerar", "ajustar"]) {
      assert.equal((await amb.req("POST", `/treinamentos/${codigo}/rascunho/${acao}`, { como: tecnico, json: { texto: TEXTO } })).status, 403);
      assert.equal((await amb.req("POST", `/treinamentos/${codigo}/rascunho/${acao}`, { json: { texto: TEXTO } })).status, 401);
    }
    assert.equal(amb.ia.respostas.length, 0);
  });
});
