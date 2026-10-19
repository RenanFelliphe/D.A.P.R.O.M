import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { ausencia, usuario, vitoriaPerguntaSemResposta, vitoriaUso } from "../src/db/schema";
import { diaDe } from "../src/dominio/tempo";
import { criarAmbiente, configDeTeste, type Ambiente, type UsuarioDeTeste } from "./ajuda";

/**
 * `POST /vitoria/mensagens` (`vitoria.md`, seção 2): o fallback sem IA por padrão, a validação da ação contra o
 * manifesto (chave inválida vira "não sei"; `com_contexto` sem o campo necessário só descarta a ação), os 3 limites, o
 * acesso de quem aguarda liberação e de quem está ausente, e que uma falha da IA nunca vira um 500.
 */
describe("Vitória — POST /vitoria/mensagens", () => {
  let amb: Ambiente;
  let tecnico: UsuarioDeTeste;
  let admin: UsuarioDeTeste;

  before(async () => {
    amb = await criarAmbiente();
    tecnico = await amb.criarUsuario({ perfil: "tecnico", nome: "Técnico" });
    admin = await amb.criarUsuario({ perfil: "admin", nome: "Admin" });
  });
  after(() => amb.fechar());

  interface SseEvento {
    event: string;
    data: string;
  }

  function lerSSE(corpo: ArrayBuffer): SseEvento[] {
    const texto = new TextDecoder().decode(corpo);
    return texto
      .split("\n\n")
      .filter((b) => b.trim())
      .map((bloco) => {
        const linhas = bloco.split("\n");
        const event = linhas.find((l) => l.startsWith("event: "))?.slice("event: ".length) ?? "message";
        const data = linhas
          .filter((l) => l.startsWith("data: "))
          .map((l) => l.slice("data: ".length))
          .join("\n");
        return { event, data };
      });
  }

  async function enviarMensagem(como: UsuarioDeTeste | null, corpo: Record<string, unknown>) {
    const r = await amb.req("POST", "/vitoria/mensagens", { como, json: corpo });
    if (r.status !== 200) return { status: r.status, corpo: r.corpo };
    const eventos = lerSSE(r.corpo as ArrayBuffer);
    const texto = eventos
      .filter((e) => e.event === "texto")
      .map((e) => e.data)
      .join("");
    const final = eventos.find((e) => e.event === "final");
    return { status: r.status, texto, ...(final ? JSON.parse(final.data) : {}) };
  }

  const pedidoBase = (mensagem: string, extra: Record<string, unknown> = {}) => ({ mensagem, tela: "busca", contexto: {}, historico: [], numero_mensagem: 1, ...extra });

  it("sem resposta programada na IA (fallback padrão), responde pelo manual e resolve a ação de um destino fixo", async () => {
    const r = await enviarMensagem(tecnico, pedidoBase("Onde fica o ícone de lupa?"));
    assert.equal(r.status, 200);
    assert.equal(r.motivo, "sem_ia");
    assert.match(r.texto, /lupa/i);
    assert.deepEqual(r.acao, { tipo: "navegar", url: "/app/busca", destino: "busca" });
    assert.ok(Array.isArray(r.sugestoes) && r.sugestoes.length === 3, "traz as 3 sugestões fixas da tela");
  });

  it("IAIndisponivel (fornecedor fora do ar) cai no fallback, sem 500", async () => {
    amb.ia.falhar = false;
    amb.ia.respostas.length = 0; // fila vazia: conversar() lança IAIndisponivel mesmo com disponivel() = true
    const r = await enviarMensagem(tecnico, pedidoBase("Como faço uma busca no sistema?"));
    assert.equal(r.status, 200);
    assert.equal(r.motivo, "sem_ia");
  });

  it("IA desligada (falhar = true, como sem crédito ou sem chave) também cai no fallback, sem 500", async () => {
    amb.ia.falhar = true;
    try {
      const r = await enviarMensagem(tecnico, pedidoBase("Como faço uma busca no sistema?"));
      assert.equal(r.status, 200);
      assert.equal(r.motivo, "sem_ia");
    } finally {
      amb.ia.falhar = false;
    }
  });

  it("sem nenhum item do manual batendo, grava a pergunta sem resposta (sem identificar quem perguntou)", async () => {
    const antes = (await amb.sql<{ n: string }>("select count(*)::text as n from vitoria_pergunta_sem_resposta")).at(0)!.n;
    const r = await enviarMensagem(tecnico, pedidoBase("zzxyqwkt plpmnbv qqrrsstt"));
    assert.equal(r.status, 200);
    assert.equal(r.texto, "Isso eu não sei responder pelo manual. Fale com seu supervisor ou com o administrador.");
    const depois = (await amb.sql<{ n: string }>("select count(*)::text as n from vitoria_pergunta_sem_resposta")).at(0)!.n;
    assert.equal(Number(depois), Number(antes) + 1);
    const [linha] = await amb.db.select().from(vitoriaPerguntaSemResposta).orderBy(vitoriaPerguntaSemResposta.criadaEm);
    assert.equal((linha as any).usuarioId, undefined, "a tabela nem tem a coluna usuario_id");
  });

  it("ação da IA com chave que não existe no manifesto vira 'não sei' e grava a pergunta sem resposta", async () => {
    amb.ia.respostas.push(JSON.stringify({ texto: "Vou te levar para uma tela qualquer", acao: { tipo: "navegar", destino: "chave-que-nao-existe" } }));
    const r = await enviarMensagem(tecnico, pedidoBase("pergunta com chave inválida da ia"));
    assert.equal(r.status, 200);
    assert.equal(r.texto, "Isso eu não sei responder pelo manual. Fale com seu supervisor ou com o administrador.");
    assert.equal(r.expressao, "ops");
    assert.equal(r.acao, null);
    const [linha] = await amb.db
      .select()
      .from(vitoriaPerguntaSemResposta)
      .where(eq(vitoriaPerguntaSemResposta.pergunta, "pergunta com chave inválida da ia"));
    assert.ok(linha, "a pergunta com a chave inválida ficou registrada");
  });

  it("ação com_contexto sem o campo necessário é descartada (o texto continua valendo, sem botão, sem virar 'não sei')", async () => {
    amb.ia.respostas.push(JSON.stringify({ texto: "Abra a nova APR da OS", expressao: "padrao", acao: { tipo: "navegar", destino: "apr_nova" } }));
    const r = await enviarMensagem(tecnico, pedidoBase("como faço a apr", { contexto: {} }));
    assert.equal(r.status, 200);
    assert.equal(r.texto, "Abra a nova APR da OS");
    assert.equal(r.acao, null);
    const [linha] = await amb.db
      .select()
      .from(vitoriaPerguntaSemResposta)
      .where(eq(vitoriaPerguntaSemResposta.pergunta, "como faço a apr"));
    assert.equal(linha, undefined, "não é uma pergunta sem resposta: só a ação foi descartada");
  });

  it("resposta parcial: vale o texto da IA, leva à tela próxima e grava a pergunta para o admin melhorar o manual", async () => {
    const texto = "Seus pontos estão em Como pontuar. O salário não consta no manual: fale com o seu supervisor.";
    amb.ia.respostas.push(JSON.stringify({ texto, expressao: "padrao", fonte: "manual", acao: { tipo: "parcial", destino: "gamificacao_pontos" } }));
    const r = await enviarMensagem(tecnico, pedidoBase("como vejo meus pontos e qual o meu salário parcial?"));
    assert.equal(r.status, 200);
    assert.equal(r.texto, texto, "o texto da IA vale, não a mensagem fixa do 'não sei'");
    assert.equal(r.expressao, "padrao");
    assert.equal(r.acao?.destino, "gamificacao_pontos");
    assert.equal(r.fonte, "manual");
    const [linha] = await amb.db.select().from(vitoriaPerguntaSemResposta).where(eq(vitoriaPerguntaSemResposta.pergunta, "como vejo meus pontos e qual o meu salário parcial?"));
    assert.ok(linha, "a parte sem resposta ficou registrada");
  });

  it("resposta parcial com destino que não existe só derruba o botão: o texto continua valendo", async () => {
    amb.ia.respostas.push(JSON.stringify({ texto: "Isto o manual cobre; o resto não consta.", acao: { tipo: "parcial", destino: "chave-que-nao-existe" } }));
    const r = await enviarMensagem(tecnico, pedidoBase("parcial com chave inválida"));
    assert.equal(r.texto, "Isto o manual cobre; o resto não consta.");
    assert.equal(r.acao, null);
  });

  it("parcial sem destino é só texto; o 'não sei' total continua com a mensagem fixa, ignorando o texto da IA", async () => {
    amb.ia.respostas.push(JSON.stringify({ texto: "Cobri uma parte; falta o resto.", acao: { tipo: "parcial" } }));
    const parcial = await enviarMensagem(tecnico, pedidoBase("parcial sem destino"));
    assert.equal(parcial.texto, "Cobri uma parte; falta o resto.");
    assert.equal(parcial.acao, null);

    amb.ia.respostas.push(JSON.stringify({ texto: "Sei lá, invento qualquer coisa.", expressao: "ops", acao: { tipo: "nao_sei" } }));
    const nada = await enviarMensagem(tecnico, pedidoBase("nada disso está no manual"));
    assert.equal(nada.texto, "Isso eu não sei responder pelo manual. Fale com seu supervisor ou com o administrador.");
    assert.equal(nada.expressao, "ops");
  });

  it("a fonte 'geral' chega à web (para o selo); sem fonte, vale 'manual'", async () => {
    amb.ia.respostas.push(JSON.stringify({ texto: "Manutenção preventiva é a que se faz em ciclo, antes de algo quebrar. É uma explicação geral.", fonte: "geral", acao: { tipo: "nenhuma" } }));
    const geral = await enviarMensagem(tecnico, pedidoBase("o que é manutenção preventiva?"));
    assert.equal(geral.fonte, "geral");

    amb.ia.respostas.push(JSON.stringify({ texto: "Abra a busca.", acao: { tipo: "nenhuma" } }));
    const manual = await enviarMensagem(tecnico, pedidoBase("onde fica a busca, de novo?"));
    assert.equal(manual.fonte, "manual");
  });

  it("o prompt libera o raciocínio e o conhecimento geral, mas mantém as recusas de segurança sem exceção", async () => {
    amb.ia.respostas.push(JSON.stringify({ texto: "Ok", acao: { tipo: "nenhuma" } }));
    await enviarMensagem(tecnico, pedidoBase("teste do prompt"));
    const instrucao = amb.ia.chamadas.at(-1)!.mensagens.find((m) => m.papel === "sistema")!.texto;
    assert.doesNotMatch(instrucao, /Responda só pelo manual/, "a trava antiga de 'só pelo manual' saiu");
    assert.match(instrucao, /Raciocínio: aqui você é livre/);
    assert.match(instrucao, /fonte "geral"/);
    assert.match(instrucao, /Nunca use esta camada para segurança de campo/);
    assert.match(instrucao, /Nunca diga o que é um item eliminatório/);
    assert.match(instrucao, /Nunca ensine normas de segurança de campo/);
  });

  it("ação com_contexto com o campo presente resolve a URL de verdade, e 'destacar' leva o alvo do destino", async () => {
    amb.ia.respostas.push(JSON.stringify({ texto: "Abra a nova APR da OS", acao: { tipo: "destacar", destino: "apr_nova" } }));
    const r = await enviarMensagem(tecnico, pedidoBase("como faço a apr desta os", { contexto: { os_id: "os-123" } }));
    assert.equal(r.status, 200);
    assert.deepEqual(r.acao, { tipo: "destacar", url: "/app/os/os-123/apr", destino: "apr_nova", alvo: "os-nova-apr" });
  });

  it("ação com_filtro: valor válido resolve a URL com o filtro; valor fora do padrão é descartado", async () => {
    amb.ia.respostas.push(JSON.stringify({ texto: "Veja maio", acao: { tipo: "navegar", destino: "dashboard_meus_periodo", filtro: "2026-05" } }));
    const certo = await enviarMensagem(tecnico, pedidoBase("o que eu executei em maio"));
    assert.deepEqual(certo.acao, { tipo: "navegar", url: "/app/dashboard/meus?periodo=2026-05", destino: "dashboard_meus_periodo", valor: "2026-05" });

    amb.ia.respostas.push(JSON.stringify({ texto: "Veja maio", acao: { tipo: "navegar", destino: "dashboard_meus_periodo", filtro: "maio de 2026" } }));
    const errado = await enviarMensagem(tecnico, pedidoBase("o que eu executei em maio, de novo"));
    assert.equal(errado.acao, null, "o valor não bate com o padrão AAAA-MM: a ação é descartada, não vira URL livre");
  });

  it("limite por conversa: numero_mensagem acima do limite nem chama a IA", async () => {
    const r = await enviarMensagem(tecnico, pedidoBase("mais uma pergunta", { numero_mensagem: configDeTeste.vitoria.limitePorConversa + 1 }));
    assert.equal(r.status, 200);
    assert.equal(r.motivo, "limite_conversa");
    assert.equal(r.texto, "Esta conversa já foi longa. Vamos começar uma conversa nova?");
  });

  it("limite por conta/dia", async () => {
    const dia = diaDe(amb.relogio.agora);
    await amb.db
      .insert(vitoriaUso)
      .values({ usuarioId: tecnico.id, dia, mensagens: configDeTeste.vitoria.limitePorContaDia })
      .onConflictDoUpdate({ target: [vitoriaUso.usuarioId, vitoriaUso.dia], set: { mensagens: configDeTeste.vitoria.limitePorContaDia } });
    try {
      amb.ia.respostas.push(JSON.stringify({ texto: "não devia chegar aqui" }));
      const r = await enviarMensagem(tecnico, pedidoBase("Como faço uma busca no sistema?"));
      assert.equal(r.status, 200);
      assert.equal(r.motivo, "limite_conta");
      assert.equal(amb.ia.respostas.length, 1, "a IA nem foi chamada");
    } finally {
      await amb.db.delete(vitoriaUso).where(eq(vitoriaUso.usuarioId, tecnico.id));
      amb.ia.respostas.length = 0;
    }
  });

  it("limite global/dia (a soma do dia, de qualquer conta)", async () => {
    const outraConta = await amb.criarUsuario({ perfil: "tecnico", nome: "Outro técnico" });
    const dia = diaDe(amb.relogio.agora);
    await amb.db.insert(vitoriaUso).values({ usuarioId: outraConta.id, dia, mensagens: configDeTeste.vitoria.limiteGlobalDia });
    try {
      amb.ia.respostas.push(JSON.stringify({ texto: "não devia chegar aqui" }));
      const r = await enviarMensagem(tecnico, pedidoBase("Como faço uma busca no sistema?"));
      assert.equal(r.status, 200);
      assert.equal(r.motivo, "limite_global");
      assert.equal(amb.ia.respostas.length, 1, "a IA nem foi chamada");
    } finally {
      await amb.db.delete(vitoriaUso).where(eq(vitoriaUso.usuarioId, outraConta.id));
      amb.ia.respostas.length = 0;
    }
  });

  it("quem aguarda liberação (pendente) consegue usar a Vitória", async () => {
    const pendente = await amb.criarUsuario({ perfil: "tecnico", nome: "Pendente" });
    await amb.db.update(usuario).set({ liberacao: "pendente" }).where(eq(usuario.id, pendente.id));
    const r = await enviarMensagem(pendente, pedidoBase("Como faço uma busca no sistema?"));
    assert.equal(r.status, 200);
  });

  it("quem está ausente consegue usar a Vitória (ela só consulta, nunca grava dado de OS)", async () => {
    const ausente = await amb.criarUsuario({ perfil: "tecnico", nome: "Ausente", equipeId: (await amb.criarEquipe()).id });
    await amb.db.insert(ausencia).values({
      usuarioId: ausente.id,
      equipeId: ausente.equipeId!,
      supervisorId: admin.id,
      motivo: "Teste de ausência",
      inicio: "2020-01-01",
      retorno: "2099-01-01",
      estado: "confirmada",
      origem: "propria",
    });
    const r = await enviarMensagem(ausente, pedidoBase("Como faço uma busca no sistema?"));
    assert.equal(r.status, 200);
  });

  it("admin usa o manual do admin (nunca o do técnico)", async () => {
    const r = await enviarMensagem(admin, pedidoBase("Como funciona a auditoria?"));
    assert.equal(r.status, 200);
    assert.match(r.texto, /auditoria/i);
  });

  it("sem autenticação é 401", async () => {
    const r = await amb.req("POST", "/vitoria/mensagens", { json: pedidoBase("oi") });
    assert.equal(r.status, 401);
  });
});
