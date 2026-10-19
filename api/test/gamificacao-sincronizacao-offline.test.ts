import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { conquista, conquistaUsuario, eventoCampo } from "../src/db/schema";
import { imagensDaCargaDeSincronizacaoOffline } from "../src/db/seed/sincronizacao-offline-imagens";
import { CONQUISTAS_SINCRONIZACAO_OFFLINE, sqlDaCargaDeSincronizacaoOffline } from "../src/db/seed/sincronizacao-offline-dados";
import { carregarDadosDaPessoa, progressoDaPessoa, textoDaMeta } from "../src/dominio/conquistas";
import { lerImagem } from "../src/dominio/imagem";
import { prepararCampo, type Campo, type UsuarioDeTeste } from "./gamificacao-ajuda";

const TITULO = "Sem sinal, sem problema";

/** A conquista de sincronização offline (pendência 8): o servidor reconhece o evento que veio da fila pelo atraso (regra dos 60 s). */
describe("Gamificação: conquista de sincronização offline", () => {
  let c: Campo;
  before(async () => {
    c = await prepararCampo();
  });
  after(() => c.amb.fechar());

  const duasHorasAtras = () => new Date(c.amb.relogio.agora.getTime() - 2 * 3600_000).toISOString();

  /** Uma APR completa feita "sem sinal": o aparelho a registrou há 2 horas e ela chega agora. */
  async function aprDaFila(como: UsuarioDeTeste, osId: string) {
    const quando = duasHorasAtras();
    const corpo = { ...(await c.corpoDaApr([como])), concluida_em: quando };
    const r = await c.enviar(como, { ...c.evento("apr_concluida", corpo, osId), ocorrido_em: quando });
    assert.equal(r.rejeitados.length, 0, JSON.stringify(r.rejeitados));
    return r;
  }
  const temOTrofeu = async (usuarioId: string) => {
    const linhas = await c.amb.db
      .select({ obtidaEm: conquistaUsuario.obtidaEm, vistaEm: conquistaUsuario.vistaEm })
      .from(conquistaUsuario)
      .innerJoin(conquista, eq(conquista.id, conquistaUsuario.conquistaId))
      .where(and(eq(conquistaUsuario.usuarioId, usuarioId), eq(conquista.titulo, TITULO)));
    return linhas[0] ?? null;
  };

  it("a carga traz a conquista de pessoa, com 0 ponto (a sincronização não pontua) e o critério próprio", async () => {
    const [x] = await c.amb.db.select().from(conquista).where(eq(conquista.titulo, TITULO));
    assert.equal(x!.criterio, "sincronizacoes_offline");
    assert.equal(x!.quantidade, 1);
    assert.equal(x!.pontos, 0);
    assert.equal(x!.ativa, true);
    assert.equal(textoDaMeta({ criterio: "sincronizacoes_offline", quantidade: 1 }), "Sincronize 1 OS feita sem sinal");
    assert.equal(textoDaMeta({ criterio: "sincronizacoes_offline", quantidade: 5 }), "Sincronize 5 OS feitas sem sinal");
  });

  it("o evento online não conta; o que chega da fila marca `offline`, concede o troféu sem lançar ponto e deixa o aviso pendente", async () => {
    const u = await c.tecnico("Online Primeiro");
    const o1 = await c.novaOs();
    await c.apr(u, o1.id);
    assert.equal(await temOTrofeu(u.id), null, "trabalhar com sinal não dá o troféu");
    assert.ok((await c.amb.db.select({ offline: eventoCampo.offline }).from(eventoCampo).where(eq(eventoCampo.usuarioId, u.id))).every((e) => !e.offline));

    const o2 = await c.novaOs();
    const antes = await c.pontosDe(u.id, true);
    const r = await aprDaFila(u, o2.id);
    const trofeu = await temOTrofeu(u.id);
    assert.ok(trofeu, "o evento da fila concede o troféu");
    assert.equal(trofeu.obtidaEm.toISOString(), c.amb.relogio.agora.toISOString(), "a data é a da chegada ao servidor, não a do aparelho");
    assert.equal(trofeu.vistaEm, null, "o aviso 'Conquista desbloqueada' fica pendente");
    assert.equal(await c.pontosDe(u.id, true), antes, "0 ponto: nada entra no extrato");
    assert.ok(!r.ganhos.some((g: { regra: string }) => g.regra === "conquista_obtida"));
    const marcados = await c.amb.db.select({ offline: eventoCampo.offline }).from(eventoCampo).where(and(eq(eventoCampo.usuarioId, u.id), eq(eventoCampo.osId, o2.id)));
    assert.ok(marcados.length > 0 && marcados.every((e) => e.offline));

    // A pessoa vê a conquista na própria pontuação, como obtida.
    const eu = await c.amb.esperar(200, "GET", "/gamificacao/eu", { como: u });
    assert.ok(JSON.stringify(eu).includes(TITULO));
  });

  it("conta OS, não eventos: vários eventos da fila na mesma OS valem uma; outra OS vale mais uma", async () => {
    const u = await c.tecnico("Duas Folhas");
    const o1 = await c.novaOs();
    const o2 = await c.novaOs();
    // Dois eventos da fila na mesma OS (a APR e a assinatura de quem a fez).
    const quando = duasHorasAtras();
    const corpo = { ...(await c.corpoDaApr([u])), concluida_em: quando };
    await c.enviar(u, { ...c.evento("apr_concluida", corpo, o1.id), ocorrido_em: quando });
    await c.enviar(u, { ...c.evento("apr_assinada", { apr_id: corpo.id }, o1.id), ocorrido_em: quando });
    let dados = await carregarDadosDaPessoa(c.amb.db, u.id);
    assert.equal(dados.sincronizacoesOffline.length, 1);

    await aprDaFila(u, o2.id);
    dados = await carregarDadosDaPessoa(c.amb.db, u.id);
    assert.equal(dados.sincronizacoesOffline.length, 2);
    assert.deepEqual(progressoDaPessoa({ criterio: "sincronizacoes_offline", quantidade: 3, patentePontos: null }, dados), { atual: 2, meta: 3, cumprida: false });
    assert.equal(progressoDaPessoa({ criterio: "sincronizacoes_offline", quantidade: 2, patentePontos: null }, dados).cumprida, true);
  });

  it("o evento recusado não conta (a transação dele é desfeita) e reenviar o já aplicado não duplica nada", async () => {
    const u = await c.tecnico("Recusado");
    const inexistente = "00000000-0000-4000-8000-0000000000aa";
    const quando = duasHorasAtras();
    const corpo = { ...(await c.corpoDaApr([u])), concluida_em: quando };
    const r = await c.enviar(u, { ...c.evento("apr_concluida", corpo, inexistente), ocorrido_em: quando });
    assert.equal(r.rejeitados.length, 1);
    assert.equal(await temOTrofeu(u.id), null);
    assert.equal((await carregarDadosDaPessoa(c.amb.db, u.id)).sincronizacoesOffline.length, 0);

    const o = await c.novaOs();
    const evento = { ...c.evento("apr_concluida", { ...(await c.corpoDaApr([u])), concluida_em: quando }, o.id), ocorrido_em: quando };
    await c.enviar(u, evento);
    await c.enviar(u, evento);
    assert.equal((await carregarDadosDaPessoa(c.amb.db, u.id)).sincronizacoesOffline.length, 1);
    assert.equal(await c.amb.db.$count(conquistaUsuario, and(eq(conquistaUsuario.usuarioId, u.id), eq(conquistaUsuario.conquistaId, CONQUISTAS_SINCRONIZACAO_OFFLINE[0]!.id))), 1);
  });

  it("a migração tem exatamente os dados do arquivo da carga e a imagem do troféu é um PNG quadrado", () => {
    const migracao = readFileSync(join(import.meta.dirname, "..", "db", "migrations", "0037_sincronizacao_offline.sql"), "utf8").replace(/\r\n/g, "\n");
    assert.ok(migracao.includes(sqlDaCargaDeSincronizacaoOffline()), "o SQL da carga confere com os dados em TypeScript");
    const imagens = imagensDaCargaDeSincronizacaoOffline();
    assert.equal(imagens.size, 1);
    for (const bytes of imagens.values()) assert.deepEqual(lerImagem(bytes), { tipoMime: "image/png", largura: 192, altura: 192 });
  });
});
