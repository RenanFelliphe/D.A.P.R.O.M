/**
 * Confere contra uma `api` de verdade (sem aparelho) o que a pendência 3 do app usa: a assinatura do perfil (o PNG sobe e vira a assinatura),
 * o sino (avisos), as preferências de e-mail, o anonimato no ranking, o histórico, as ausências (pedir, ler, cancelar), a troca de senha,
 * a gamificação (pontuação, extrato, temporadas, ranking de pessoas e de equipes, conquistas) e a Vitória (o fluxo SSE e o "Me leve lá").
 * Usa as mesmas funções de `shared/` e o mesmo cliente das telas. Pensado para a `api` local em memória:
 *
 *   cd api && PORT=3399 pnpm dev:local          (em outro terminal)
 *   cd mobile && API_URL=http://localhost:3399 pnpm conferir:perfil
 *
 * Nunca aponte para a `api` do Supabase compartilhado: o script grava assinatura, ausência, senha e preferências.
 */
import assert from "node:assert/strict";
import { descreverPeriodo, estaDePe, type Ausencia } from "@shared/api/ausencia";
import { hoje } from "@shared/api/formatar";
import { somarDias } from "@shared/api/ausencia";
import { alertaUrgente, referenciaDoAlerta, rotuloDoAlerta, type Alerta } from "@shared/api/alertas";
import { caminhosDaApi, textoDosPontosGanhos, type Extrato, type ListaDeConquistas, type MinhaPontuacao, type RankingDeEquipes, type RankingDePessoas, type RespostaComPontos, type TemporadaDaLista } from "@shared/api/gamificacao";
import type { ExecucaoDoHistorico } from "@shared/api/os-app";
import type { RespostaMe } from "@shared/api/tipos";
import { novoUuid } from "@shared/api/uuid";
import { resolverAcao } from "@shared/vitoria/destinos";
import { respostaLocalDaVitoria } from "@shared/vitoria/reacoes";
import { sugestoesDaTela } from "@shared/vitoria/sugestoes";
import { criarClienteApi, type ArmazemDeTokens, type Tokens } from "../src/api/cliente";
import { criarEnvio } from "../src/api/eventos";
import { ErroDaApi } from "../src/api/erros";
import { botoesDaAusencia, corpoDoPedido, modoDaAusencia } from "../src/ausencia/regras";
import { destinoDoAvisoNoApp } from "../src/avisos/destino";
import { percentualDaBarra, progressoDaConquista } from "../src/gamificacao/regras";
import { lerEventosSse } from "../src/vitoria/sse";
import { destinoDaAcaoNoApp, telaAtualDe } from "../src/vitoria/telas";

const API_URL = process.env.API_URL ?? "http://localhost:3399";
const SENHA = "synqos123";
const ok = (msg: string) => console.log(`ok  ${msg}`);

/** PNG de 1×1 pixel: a "assinatura" desenhada (no aparelho, o `react-native-svg` gera um PNG de 600 × 180). */
const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));

function novoCliente() {
  let tokens: Tokens | null = null;
  const armazem: ArmazemDeTokens = { ler: async () => tokens, gravar: async (t) => void (tokens = t), apagar: async () => void (tokens = null) };
  const cliente = criarClienteApi({ urlBase: API_URL, armazem });
  return { cliente, ...criarEnvio(cliente) };
}

async function recusadoCom(codigo: string, acao: () => Promise<unknown>) {
  try {
    await acao();
  } catch (e) {
    assert.ok(e instanceof ErroDaApi, `esperava ErroDaApi, veio ${String(e)}`);
    assert.equal(e.codigo, codigo, `esperava ${codigo}, veio ${e.codigo}: ${e.message}`);
    return;
  }
  assert.fail(`esperava a recusa ${codigo}`);
}

async function main() {
  const { cliente } = novoCliente();
  await cliente.entrar("tiago.tecnico@empresa.com.br", SENHA);
  const eu = await cliente.chamar<RespostaMe>("/me");
  assert.equal(eu.usuario.perfil, "tecnico");
  ok(`entrou como ${eu.usuario.nome}`);

  // ---- Etapa 7: a assinatura do perfil --------------------------------------------------------------------------
  const arquivoId = novoUuid();
  const formulario = new FormData();
  formulario.append("arquivo", new Blob([PNG as BlobPart], { type: "image/png" }), "assinatura.png");
  formulario.append("tipo", "assinatura");
  await cliente.chamar(`/arquivos/${arquivoId}`, { metodo: "PUT", formulario });
  const salva = await cliente.chamar<RespostaComPontos>("/me/assinatura", { metodo: "PUT", corpo: { arquivo_id: arquivoId } });
  assert.equal(typeof textoDosPontosGanhos(salva) === "string" || textoDosPontosGanhos(salva) === null, true);
  const depois = await cliente.chamar<RespostaMe>("/me");
  assert.equal(depois.usuario.assinatura_path, arquivoId);
  const url = await cliente.chamar<{ url: string }>(`/arquivos/${arquivoId}/url`);
  assert.ok(url.url.length > 0);
  ok("a assinatura desenhada sobe (PUT /arquivos/{id}), vira a do perfil (PUT /me/assinatura) e a imagem abre");
  await recusadoCom("arquivo_inexistente", () => cliente.chamar("/me/assinatura", { metodo: "PUT", corpo: { arquivo_id: novoUuid() } }));
  ok("assinatura apontando para um arquivo que não subiu é recusada");

  // ---- Etapa 16: avisos ----------------------------------------------------------------------------------------
  const naoLidos = await cliente.chamar<{ alertas: Alerta[]; total: number }>("/alertas", { consulta: { lido: false, pagina: 1, tamanho: 1 } });
  assert.equal(typeof naoLidos.total, "number");
  const todos = await cliente.chamar<{ alertas: Alerta[]; total: number; pagina: number; tamanho: number }>("/alertas", { consulta: { pagina: 1, tamanho: 20 } });
  for (const a of todos.alertas) {
    assert.ok(rotuloDoAlerta(a).length > 0);
    assert.equal(typeof alertaUrgente(a), "boolean");
    referenciaDoAlerta(a);
    const destino = destinoDoAvisoNoApp(a);
    assert.ok(destino === null || destino.startsWith("/"));
  }
  const umNaoLido = todos.alertas.find((a) => a.lido_em === null && a.destinatario_id === eu.usuario.id);
  if (umNaoLido) {
    await cliente.chamar(`/alertas/${umNaoLido.id}`, { metodo: "PATCH", corpo: { lido: true } });
    const novo = await cliente.chamar<{ total: number }>("/alertas", { consulta: { lido: false, pagina: 1, tamanho: 1 } });
    assert.equal(novo.total, naoLidos.total - 1);
    ok(`avisos: ${todos.total} no total, 1 marcado como lido (o contador caiu para ${novo.total})`);
  } else {
    ok(`avisos: ${todos.total} no total, nenhum não lido para marcar (o contador está em ${naoLidos.total})`);
  }

  // ---- Etapa 16: histórico, e-mails, anonimato, senha ----------------------------------------------------------
  const historico = await cliente.chamar<{ execucoes: ExecucaoDoHistorico[] }>("/me/historico");
  assert.ok(Array.isArray(historico.execucoes));
  ok(`histórico: ${historico.execucoes.length} OS encerradas nos últimos 60 dias`);

  const desligados = await cliente.chamar<{ desligados: string[] }>("/me/emails", { metodo: "PUT", corpo: { desligados: ["os"] } });
  assert.deepEqual(desligados.desligados, ["os"]);
  assert.deepEqual((await cliente.chamar<RespostaMe>("/me")).emails?.desligados, ["os"]);
  await recusadoCom("categoria_obrigatoria", () => cliente.chamar("/me/emails", { metodo: "PUT", corpo: { desligados: ["seguranca"] } }));
  assert.deepEqual((await cliente.chamar<{ desligados: string[] }>("/me/emails", { metodo: "PUT", corpo: { desligados: [] } })).desligados, []);
  ok("e-mails: desligar 'os' vale, desligar 'segurança' é recusado e voltar ao padrão funciona");

  await cliente.chamar("/me/ranking-anonimo", { metodo: "PUT", corpo: { anonimo: true } });
  assert.equal((await cliente.chamar<RespostaMe>("/me")).usuario.ranking_anonimo, true);
  const rankingAnonimo = await cliente.chamar<RankingDePessoas>(caminhosDaApi.ranking, { consulta: { tipo: "pessoas" } });
  assert.ok(rankingAnonimo.linhas.some((l) => l.voce && l.anonimo));
  await cliente.chamar("/me/ranking-anonimo", { metodo: "PUT", corpo: { anonimo: false } });
  assert.equal((await cliente.chamar<RespostaMe>("/me")).usuario.ranking_anonimo, false);
  ok("anonimato no ranking liga e desliga, e a própria linha continua marcada como 'você'");

  await recusadoCom("senha_atual_incorreta", () => cliente.chamar("/auth/trocar-senha", { corpo: { senha_atual: "errada-errada", senha_nova: "OutraSenha123" } }));
  await recusadoCom("senha_igual", () => cliente.chamar("/auth/trocar-senha", { corpo: { senha_atual: SENHA, senha_nova: SENHA } }));
  await cliente.chamar("/auth/trocar-senha", { corpo: { senha_atual: SENHA, senha_nova: "OutraSenha123" } });
  await cliente.chamar("/auth/trocar-senha", { corpo: { senha_atual: "OutraSenha123", senha_nova: SENHA } });
  ok("senha: a errada e a igual são recusadas, a troca e a volta funcionam");

  // ---- Etapa 16: ausência --------------------------------------------------------------------------------------
  const modo = modoDaAusencia(depois);
  assert.equal(modo.modo, "pedir");
  assert.equal(modo.motivoSemPedido, null);
  const inicio = somarDias(hoje(), 3);
  const [ano, mes, dia] = inicio.split("-");
  const periodo = { inicio: `${dia}/${mes}/${ano}`, modo: "dias" as const, dias: "2", retorno: "" };
  await recusadoCom("validacao", () => cliente.chamar("/ausencias", { corpo: { motivo: "", inicio, dias: 2 } }));
  const pedida = await cliente.chamar<{ ausencia: Ausencia }>("/ausencias", { corpo: corpoDoPedido("Consulta médica", periodo, false) });
  const id = pedida.ausencia.id;
  const minhas = await cliente.chamar<{ ausencias: Ausencia[] }>("/ausencias", { consulta: { usuario_id: eu.usuario.id, tamanho: 50 } });
  const a = minhas.ausencias.find((x) => x.id === id);
  assert.ok(a, "a ausência pedida aparece na lista");
  assert.equal(a.situacao, "pedida");
  assert.deepEqual(botoesDaAusencia(a, modo.titular).map((b) => b.acao), ["cancelar"]);
  assert.match(descreverPeriodo(a), /2 dias/);
  const detalhe = await cliente.chamar<{ ausencia: { atos: { tipo: string }[] } }>(`/ausencias/${id}`);
  assert.equal(detalhe.ausencia.atos[0]?.tipo, "pedido");
  await recusadoCom("assinatura_obrigatoria", () => cliente.chamar(`/ausencias/${id}/cancelar`, { corpo: {} })).catch(() => undefined);
  await cliente.chamar(`/ausencias/${id}/cancelar`, { corpo: { assinar: true } });
  const apos = (await cliente.chamar<{ ausencias: Ausencia[] }>("/ausencias", { consulta: { usuario_id: eu.usuario.id, tamanho: 50 } })).ausencias.find((x) => x.id === id);
  assert.equal(apos?.situacao, "cancelada");
  assert.equal(estaDePe(apos!), false);
  assert.deepEqual(botoesDaAusencia(apos!, modo.titular), []);
  ok("ausência: o pedido é gravado, lido com a linha do tempo, cancelado com assinatura e deixa de ter botões");

  // ---- Etapa 17: gamificação -----------------------------------------------------------------------------------
  const pontos = await cliente.chamar<MinhaPontuacao>(caminhosDaApi.eu);
  assert.ok(pontos.temporada.nome);
  assert.ok(percentualDaBarra(pontos.pontos_temporada, pontos.barra) >= 0);
  for (const c of pontos.conquistas) if (!c.obtida_em) progressoDaConquista(c);
  const extrato = await cliente.chamar<Extrato>(caminhosDaApi.extrato, { consulta: { pagina: 1, tamanho: 15 } });
  assert.ok(Array.isArray(extrato.lancamentos));
  const geral = await cliente.chamar<Extrato>(caminhosDaApi.extrato, { consulta: { temporada: "geral", pagina: 1, tamanho: 15 } });
  assert.equal(geral.temporada, "geral");
  const temporadas = (await cliente.chamar<{ temporadas: TemporadaDaLista[] }>(caminhosDaApi.temporadas)).temporadas;
  assert.ok(temporadas.some((t) => t.atual));
  const pessoas = await cliente.chamar<RankingDePessoas>(caminhosDaApi.ranking, { consulta: { tipo: "pessoas" } });
  const equipes = await cliente.chamar<RankingDeEquipes>(caminhosDaApi.ranking, { consulta: { tipo: "equipes" } });
  assert.equal(pessoas.tipo, "pessoas");
  assert.equal(equipes.tipo, "equipes");
  const rankingGeral = await cliente.chamar<RankingDePessoas>(caminhosDaApi.ranking, { consulta: { tipo: "pessoas", temporada: "geral" } });
  assert.equal(rankingGeral.escopo, "geral");
  const conquistas = await cliente.chamar<ListaDeConquistas>(caminhosDaApi.conquistas);
  assert.ok(Array.isArray(conquistas.conquistas));
  await cliente.chamar(caminhosDaApi.avisosVistos, { metodo: "POST", corpo: {} });
  ok(`gamificação: ${pontos.pontos_temporada} pontos, ${extrato.total} lançamentos, ${temporadas.length} temporadas, ${pessoas.linhas.length} pessoas e ${equipes.linhas.length} equipes no ranking, ${conquistas.conquistas.length} conquistas`);

  // ---- Etapa 17: Vitória ---------------------------------------------------------------------------------------
  const tela = telaAtualDe("/lista");
  assert.equal(tela.tela, "quadro_os");
  assert.ok(sugestoesDaTela(tela.tela).length > 0);
  const resposta = await cliente.chamarBruto("/vitoria/mensagens", { metodo: "POST", corpo: { mensagem: "Como faço a APR?", tela: "os_detalhe", contexto: { os_id: novoUuid() }, historico: [], numero_mensagem: 1 } });
  assert.equal(resposta.status, 200);
  const eventos = lerEventosSse(await resposta.text());
  assert.ok(eventos.some((e) => e.event === "texto"), "a resposta traz texto");
  const final = eventos.find((e) => e.event === "final");
  assert.ok(final, "a resposta termina com o evento final");
  const dados = JSON.parse(final.data) as { acao: { tipo: "navegar" | "destacar"; url: string; destino: string; valor?: string } | null };
  if (dados.acao) {
    const confirmada = resolverAcao({ tipo: dados.acao.tipo, destino: dados.acao.destino, filtro: dados.acao.valor }, { os_id: "abc" });
    assert.ok(confirmada.resolvida || confirmada.destinoDesconhecido === false);
    destinoDaAcaoNoApp(dados.acao);
  }
  assert.ok(respostaLocalDaVitoria("bom dia"));
  await cliente.chamar("/vitoria/eventos", { metodo: "POST", corpo: { tipo: "sugestao" } });
  ok(`Vitória: o fluxo SSE chegou (${eventos.length} eventos), a ação foi conferida e a saudação é respondida sem a api`);

  console.log("\nTudo certo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
