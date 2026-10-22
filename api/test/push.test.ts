import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { corpoDoPush, ehTokenDeExpo, LIMITE_DO_CORPO_DO_PUSH, PUSH_DO_AVISO } from "../../shared/notificacoes/push";
import { TIPOS_DE_AVISO } from "../../shared/notificacoes/avisos";
import { localInstalacao, os } from "../src/db/schema";
import { criarAviso } from "../src/dominio/alertas";
import { executarTarefasPendentes } from "../src/servicos/tarefas";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

const TOKEN_A = "ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]";
const TOKEN_B = "ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]";

/**
 * Notificação push (`docs/pessoas-e-equipes.md`, seção 8.6): o app registra o aparelho; todo aviso que toca no celular enfileira a tarefa
 * `push_alerta`, que manda a notificação a quem tem aparelho, desde que o aviso ainda esteja não lido. O push nunca é o único canal.
 */
describe("Notificação push", () => {
  let amb: Ambiente;
  let equipeId: string;
  let supervisor: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;
  let outro: UsuarioDeTeste;
  let osId: string;

  before(async () => {
    amb = await criarAmbiente({ relogio: new Date("2026-10-22T15:00:00Z") });
    supervisor = await amb.criarUsuario({ perfil: "tecnico", nome: "Sônia Supervisora" });
    equipeId = (await amb.criarEquipe({ supervisorId: supervisor.id })).id;
    await amb.sql("update usuario set equipe_id = $1 where id = $2", [equipeId, supervisor.id]);
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Tiago Técnico" });
    outro = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Olga Outra" });
    const [local] = await amb.db.insert(localInstalacao).values({ codigo: "VILA VELHA/REDE" }).returning({ id: localInstalacao.id });
    const [o] = await amb.db.insert(os).values({ numeroOrdem: "5500001", tipo: "corretiva", titulo: "DCV Desobstrução", localInstalacaoId: local!.id, equipeId, dataInicioProg: "2026-10-22", origem: "sap" }).returning();
    osId = o!.id;
  });
  after(() => amb.fechar());

  const registrar = (como: UsuarioDeTeste, token: string) => amb.esperar(200, "POST", "/me/dispositivos", { como, json: { token, plataforma: "android" } });
  const aparelhos = async (token: string) => amb.sql<{ usuario_id: string; token: string }>("select usuario_id, token from dispositivo_push where token = $1", [token]);
  const enviarTarefas = () => executarTarefasPendentes(amb.deps);
  /** Reserva a OS (um aviso `os_reservada`, que toca no celular) e roda as tarefas. */
  async function reservarPara(pessoa: UsuarioDeTeste) {
    await amb.req("DELETE", `/os/${osId}/responsavel`, { como: supervisor });
    await amb.esperar(200, "PUT", `/os/${osId}/responsavel`, { como: supervisor, json: { usuario_id: pessoa.id } });
    await enviarTarefas();
  }

  describe("o registro do aparelho", () => {
    it("só aceita o token do serviço da Expo", async () => {
      assert.equal(ehTokenDeExpo(TOKEN_A), true);
      assert.equal(ehTokenDeExpo("qualquer-coisa"), false);
      assert.equal((await amb.req("POST", "/me/dispositivos", { como: tecnico, json: { token: "qualquer-coisa", plataforma: "android" } })).status, 422);
      assert.equal((await amb.req("POST", "/me/dispositivos", { como: tecnico, json: { token: TOKEN_A, plataforma: "windows" } })).status, 422);
      assert.equal((await amb.req("POST", "/me/dispositivos", { json: { token: TOKEN_A, plataforma: "android" } })).status, 401);
    });

    it("registra, repete sem duplicar e diz quantos aparelhos a pessoa tem", async () => {
      await registrar(tecnico, TOKEN_A);
      await registrar(tecnico, TOKEN_A);
      assert.equal((await aparelhos(TOKEN_A)).length, 1);
      assert.deepEqual(await amb.esperar(200, "GET", "/me/dispositivos", { como: tecnico }), { aparelhos: 1, servico_ligado: true });
      assert.equal((await amb.esperar(200, "GET", "/me/dispositivos", { como: outro })).aparelhos, 0);
    });

    it("o aparelho que troca de mãos passa para quem entrou, e quem sai só tira o que é dele", async () => {
      await registrar(outro, TOKEN_A);
      assert.equal((await aparelhos(TOKEN_A))[0]!.usuario_id, outro.id);
      // O técnico (que já não tem o aparelho) tentando tirar o token de outra pessoa não faz nada.
      await amb.esperar(200, "DELETE", "/me/dispositivos", { como: tecnico, json: { token: TOKEN_A } });
      assert.equal((await aparelhos(TOKEN_A)).length, 1);
      await amb.esperar(200, "DELETE", "/me/dispositivos", { como: outro, json: { token: TOKEN_A } });
      assert.equal((await aparelhos(TOKEN_A)).length, 0);
    });
  });

  describe("o envio", () => {
    it("o aviso que toca no celular vai a todos os aparelhos da pessoa, com o texto do aviso e o que o app precisa para abrir a tela", async () => {
      await registrar(tecnico, TOKEN_A);
      await registrar(tecnico, TOKEN_B);
      amb.push.enviadas.length = 0;
      await reservarPara(tecnico);
      assert.equal(amb.push.enviadas.length, 2);
      const m = amb.push.enviadas.find((x) => x.token === TOKEN_A)!;
      assert.equal(m.titulo, "OS reservada para você");
      assert.match(m.corpo, /Sônia Supervisora reservou a OS 5500001 para você/);
      assert.equal(m.canal, "padrao");
      const [alerta] = await amb.sql<{ id: string }>("select id from alerta where destinatario_id = $1 and tipo = 'os_reservada' order by criado_em desc limit 1", [tecnico.id]);
      assert.deepEqual(m.dados, { alerta_id: alerta!.id, tipo: "os_reservada", os_id: osId, destinatario_id: tecnico.id, usuario_alvo_id: null, sugestao_id: null });
      await amb.esperar(200, "DELETE", "/me/dispositivos", { como: tecnico, json: { token: TOKEN_B } });
    });

    it("quem não tem aparelho registrado só recebe o aviso no sino (a tarefa termina sem enviar)", async () => {
      amb.push.enviadas.length = 0;
      await reservarPara(outro);
      // O técnico que perdeu a reserva tem aparelho e é avisado; a Olga não tem, e fica só com o sino.
      assert.deepEqual(amb.push.enviadas.map((m) => m.dados.destinatario_id), [tecnico.id]);
      assert.ok((await amb.sql("select 1 from alerta where destinatario_id = $1 and tipo = 'os_reservada'", [outro.id])).length > 0);
      assert.equal((await amb.sql("select 1 from tarefa where tipo = 'push_alerta' and estado <> 'concluida'")).length, 0);
    });

    it("o aviso já lido não toca (o convite respondido, a OS já assinada)", async () => {
      await registrar(tecnico, TOKEN_A);
      amb.push.enviadas.length = 0;
      await criarAviso(amb.db, [tecnico.id], { tipo: "os_reservada", osId, detalhe: "já lido", agora: amb.relogio.agora });
      await amb.sql("update alerta set lido_em = now() where destinatario_id = $1 and detalhe = 'já lido'", [tecnico.id]);
      await enviarTarefas();
      assert.equal(amb.push.enviadas.length, 0);
    });

    it("quem está desativado não recebe", async () => {
      amb.push.enviadas.length = 0;
      await amb.sql("update usuario set ativo = false where id = $1", [tecnico.id]);
      await criarAviso(amb.db, [tecnico.id], { tipo: "os_reservada", osId, detalhe: "teste", agora: amb.relogio.agora });
      await enviarTarefas();
      assert.equal(amb.push.enviadas.length, 0);
      await amb.sql("update usuario set ativo = true where id = $1", [tecnico.id]);
    });

    it("o aviso de segurança e o pedido que vence em 2 minutos saem no canal urgente, com a validade do pedido", async () => {
      amb.push.enviadas.length = 0;
      await criarAviso(amb.db, [tecnico.id], { tipo: "pedido_de_acao", osId, detalhe: "Olga pediu para encerrar a execução", agora: amb.relogio.agora });
      await criarAviso(amb.db, [tecnico.id], { tipo: "bloqueio", osId, detalhe: "APR bloqueada", agora: amb.relogio.agora });
      await enviarTarefas();
      const porTipo = Object.fromEntries(amb.push.enviadas.map((m) => [m.dados.tipo as string, m]));
      assert.equal(porTipo.pedido_de_acao!.canal, "urgente");
      assert.equal(porTipo.pedido_de_acao!.validadeS, 120);
      assert.equal(porTipo.bloqueio!.canal, "urgente");
    });

    it("o aviso que fica só no sino não enfileira push", async () => {
      await amb.sql("delete from tarefa");
      await criarAviso(amb.db, [tecnico.id], { tipo: "acao_de_participante", osId, detalhe: "Olga pausou a execução", agora: amb.relogio.agora });
      assert.equal((await amb.sql("select 1 from tarefa where tipo = 'push_alerta'")).length, 0);
    });

    it("o token que o serviço diz não existir mais é apagado", async () => {
      await registrar(tecnico, TOKEN_B);
      amb.push.tokensInvalidos.add(TOKEN_B);
      await criarAviso(amb.db, [tecnico.id], { tipo: "os_reservada", osId, detalhe: "teste de token", agora: amb.relogio.agora });
      await enviarTarefas();
      assert.equal((await aparelhos(TOKEN_B)).length, 0);
      assert.equal((await aparelhos(TOKEN_A)).length, 1, "o token bom segue");
    });

    it("o serviço fora do ar não perde a notificação: a tarefa tenta de novo", async () => {
      amb.push.enviadas.length = 0;
      amb.push.falhar = true;
      await criarAviso(amb.db, [tecnico.id], { tipo: "os_reservada", osId, detalhe: "tentativa", agora: amb.relogio.agora });
      await enviarTarefas();
      assert.equal(amb.push.enviadas.length, 0);
      const [t] = await amb.sql<{ estado: string; tentativas: number }>("select estado, tentativas from tarefa where tipo = 'push_alerta' and estado <> 'concluida'");
      assert.equal(t!.estado, "pendente");
      assert.equal(t!.tentativas, 1);
      amb.push.falhar = false;
      amb.relogio.agora = new Date(amb.relogio.agora.getTime() + 2 * 60_000);
      await enviarTarefas();
      assert.equal(amb.push.enviadas.length, 1);
    });

    it("sem o serviço de push configurado, nada sai e o aviso fica no sino", async () => {
      amb.push.enviadas.length = 0;
      amb.push.configurado = false;
      await criarAviso(amb.db, [tecnico.id], { tipo: "os_reservada", osId, detalhe: "sem serviço", agora: amb.relogio.agora });
      await enviarTarefas();
      assert.equal(amb.push.enviadas.length, 0);
      assert.equal((await amb.esperar(200, "GET", "/me/dispositivos", { como: tecnico })).servico_ligado, false);
      amb.push.configurado = true;
    });
  });

  describe("o que toca no celular", () => {
    it("todo tipo da lista é um aviso que existe, e o corpo cabe na bandeja", () => {
      for (const tipo of Object.keys(PUSH_DO_AVISO)) assert.ok((TIPOS_DE_AVISO as readonly string[]).includes(tipo), tipo);
      const longo = "palavra ".repeat(80);
      assert.ok(corpoDoPush(longo).length <= LIMITE_DO_CORPO_DO_PUSH);
      assert.match(corpoDoPush(longo), /…$/);
      assert.equal(corpoDoPush("  curto   e  limpo "), "curto e limpo");
    });

    it("os avisos de gestão do admin e do ciclo das preventivas ficam de fora", () => {
      for (const tipo of ["cadastro_pendente", "falha_importacao", "preventiva_vencida", "rh_leitura_falhou", "treinamento_publicado", "materiais_atualizados", "acao_de_participante"] as const) {
        assert.equal(PUSH_DO_AVISO[tipo], undefined, tipo);
      }
    });
  });
});
