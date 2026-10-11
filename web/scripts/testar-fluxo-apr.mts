/* eslint-disable @typescript-eslint/no-explicit-any -- script de teste: as respostas da api são lidas como vêm */
// Fluxo do técnico até a APR, ponta a ponta contra a api local (sem navegador): cria duas OS de teste, monta o
// rascunho com as mesmas funções que a tela usa (`src/lib/apr.ts`), envia `apr_concluida` aprovada e bloqueada (com foto)
// e confere resultado, status da OS e o alerta ao supervisor.
//
//   cd api && node --import tsx ../web/scripts/testar-fluxo-apr.mts
//
// Precisa da api em http://localhost:3333 (`pnpm dev:local`). Deixa na api OS "[teste apr web] ..." criadas.
import assert from "node:assert/strict";
import {
  doModeloCompleto,
  estaReprovado,
  geraAlerta,
  montarPayload,
  novoRascunho,
  adicionarFoto,
  observar,
  perguntasDe,
  responder,
  resultadoEsperado,
  resumoDe,
  type ModeloCompleto,
  type RascunhoApr,
} from "../src/lib/apr";

const API = process.env.API_URL ?? "http://localhost:3333";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function chamar(token: string | null, metodo: string, caminho: string, corpo?: unknown) {
  const r = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(corpo === undefined ? {} : { "Content-Type": "application/json" }) },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await r.text();
  return { status: r.status, corpo: texto ? JSON.parse(texto) : {} };
}
const ok = async (token: string | null, metodo: string, caminho: string, corpo?: unknown) => {
  const r = await chamar(token, metodo, caminho, corpo);
  assert.ok(r.status < 300, `${metodo} ${caminho} -> ${r.status} ${JSON.stringify(r.corpo)}`);
  return r.corpo;
};
const entrar = async (matricula: string, senha = "daprom123") => (await ok(null, "POST", "/auth/login", { matricula, senha })).access_token as string;

async function subir(token: string, id: string, tipo: "foto" | "assinatura") {
  const form = new FormData();
  form.set("arquivo", new File([PNG], tipo === "foto" ? "foto.png" : "assinatura.png", { type: "image/png" }));
  form.set("tipo", tipo);
  const r = await fetch(`${API}/arquivos/${id}`, { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: form });
  assert.ok(r.ok, `PUT /arquivos/${id} -> ${r.status} ${await r.text()}`);
}

/** O mesmo que `enviarEvento` do cliente: um evento no envelope de `POST /eventos`. */
async function enviarEvento(token: string, osId: string, payload: unknown, id = crypto.randomUUID()) {
  const r = await ok(token, "POST", "/eventos", { eventos: [{ id, tipo: "apr_concluida", os_id: osId, payload, ocorrido_em: new Date().toISOString() }] });
  return { ...r, id } as { id: string; aprs: { id: string; resultado: string }[]; os: { id: string; status: string }[]; alertas: string[]; rejeitados: { id: string; codigo: string; mensagem: string }[]; pendentes: { id: string; codigo: string; mensagem: string }[] };
}

/** Responde "tudo certo" (a resposta que não bloqueia) em todas as perguntas; `bloqueantes` troca a resposta de itens escolhidos. */
function responderTudo(r: RascunhoApr, bloqueantes: Set<string> = new Set()) {
  for (const item of perguntasDe(r.modelo, r.riscos)) {
    const bloq = item.resposta_bloqueante;
    const valor = bloq === null ? "sim" : bloqueantes.has(item.id) ? bloq : bloq === "sim" ? "nao" : "sim";
    r = responder(r, item, valor);
  }
  return r;
}

const [tec1Token, tec2Token, sup1Token, admToken] = await Promise.all([entrar("tec1"), entrar("tec2"), entrar("sup1"), entrar("adm")]);
const eu = (await ok(tec1Token, "GET", "/me")).usuario;
const equipeId: string = eu.equipe_id;
const tec2 = (await ok(tec1Token, "GET", `/usuarios?equipe_id=${equipeId}`)).usuarios.find((u: any) => u.matricula === "tec2");
assert.ok(tec2, "tec2 está na equipe de tec1");
console.log("login ok · equipe", equipeId);

// ---- OS de teste: uma com atividade mapeada (modelo da atividade) e outra sem atividade (o técnico escolhe) -----
const local = (await ok(sup1Token, "GET", "/locais?tamanho=1")).locais[0];
const criar = async (titulo: string, codigo_atividade?: string) =>
  (await ok(sup1Token, "POST", "/os", { tipo: "preventiva", titulo, descricao: "Criada pelo teste do fluxo da APR", local_instalacao_id: local.id, equipe_id: equipeId, data_inicio_prog: "2026-10-13", ...(codigo_atividade ? { codigo_atividade } : {}) })).id as string;
const osAprovada = await criar("[teste apr web] APR aprovada", "Teste, manutenção e válvulas");
const osBloqueada = await criar("[teste apr web] APR bloqueada");

// ---- 1. Detalhe e modelo ----------------------------------------------------------------------------------------------
const detA = await ok(tec1Token, "GET", `/os/${osAprovada}`);
assert.equal(detA.os.status, "liberada");
assert.equal(detA.os.modelo_apr_codigo, "APR 03", "a OS com atividade mapeada traz o modelo");
const detB = await ok(tec1Token, "GET", `/os/${osBloqueada}`);
assert.equal(detB.os.modelo_apr_codigo, null, "OS sem atividade mapeada: o técnico escolhe o modelo");
console.log("detalhe: modelo_apr_codigo", detA.os.modelo_apr_codigo, "/", detB.os.modelo_apr_codigo);

const modeloA: ModeloCompleto = await ok(tec1Token, "GET", `/modelos-apr/${encodeURIComponent(detA.os.modelo_apr_codigo)}/versoes/publicada`);
const publicados = (await ok(tec1Token, "GET", "/modelos-apr?publicados=true&tamanho=200")).modelos;
assert.ok(publicados.length >= 8);

// ---- 2. APR aprovada -----------------------------------------------------------------------------------------------
{
  // participante sem assinatura cadastrada: a api recusa (e o técnico logado desenha na hora no caso dele)
  const matriculaNova = `semassin${Date.now() % 100000}`;
  const novo = await ok(admToken, "POST", "/usuarios", { nome: "Teste Sem Assinatura", matricula: matriculaNova, perfil: "tecnico", equipe_id: equipeId, senha_inicial: "Provisoria#123" });
  const provisorio = await entrar(matriculaNova, "Provisoria#123");
  await ok(provisorio, "POST", "/auth/trocar-senha", { senha_atual: "Provisoria#123", senha_nova: "Definitiva#123" });
  const tokenNovo = await entrar(matriculaNova, "Definitiva#123");

  const riscos = modeloA.riscos.slice(0, 2).map((r) => r.id);
  let r = novoRascunho({
    osId: osAprovada,
    usuarioId: eu.id,
    modelo: doModeloCompleto(modeloA),
    participantes: [
      { usuarioId: eu.id, funcao: "responsavel" },
      { usuarioId: tec2.id, funcao: "executor" },
      { usuarioId: novo.id, funcao: "executor" },
    ],
    riscos,
  });
  assert.equal(r.respostas && Object.keys(r.respostas).length, 0, "APR nova nasce sem respostas");
  const total = perguntasDe(r.modelo, r.riscos).length;
  const verificacao = modeloA.itens.filter((i) => i.secao === "verificacao").length;
  const medidas = modeloA.itens.filter((i) => i.secao === "medida_preventiva" && riscos.includes(i.risco_id!)).length;
  assert.equal(total, verificacao + medidas, "perguntas = verificação + medidas dos riscos marcados");

  // com um item de alerta respondido com a resposta bloqueante: segue, marcado
  const alerta = modeloA.itens.find((i) => i.tipo === "alerta" && i.resposta_bloqueante !== null)!;
  r = responderTudo(r, new Set([alerta.id]));
  const resumo = resumoDe(r);
  assert.ok(resumo.completo && resumo.reprovados.length === 0 && resumo.alertas.length === 1);
  assert.equal(resultadoEsperado(r), "aprovada");
  assert.ok(geraAlerta(alerta, r.respostas[alerta.id]!.resposta));

  // 2a. participante sem assinatura: rejeitado com assinatura_ausente
  r = { ...r, concluidaEm: new Date().toISOString(), assinaturas: Object.fromEntries(r.participantes.map((p) => [p.usuarioId, new Date().toISOString()])) };
  const recusado = await enviarEvento(tec1Token, osAprovada, montarPayload(r, "aprovada"), r.eventoId);
  assert.equal(recusado.rejeitados[0]?.codigo, "assinatura_ausente", JSON.stringify(recusado));
  console.log("aprovada, sem assinatura de um participante ->", recusado.rejeitados[0]!.mensagem);

  // 2b. o participante desenha a assinatura (PUT /arquivos + PUT /me/assinatura) e o mesmo evento é reenviado
  const arquivoAssinatura = crypto.randomUUID();
  await subir(tokenNovo, arquivoAssinatura, "assinatura");
  await ok(tokenNovo, "PUT", "/me/assinatura", { arquivo_id: arquivoAssinatura });
  const registrada = await enviarEvento(tec1Token, osAprovada, montarPayload(r, "aprovada"), r.eventoId);
  assert.equal(registrada.rejeitados.length + registrada.pendentes.length, 0, JSON.stringify(registrada));
  assert.equal(registrada.aprs[0]?.resultado, "aprovada");
  assert.equal(registrada.os[0]?.status, "liberada", "OS continua liberada: falta a execução");
  // reenviar o mesmo evento não duplica a APR
  const repetida = await enviarEvento(tec1Token, osAprovada, montarPayload(r, "aprovada"), r.eventoId);
  assert.equal(repetida.aprs[0]?.resultado, "aprovada");
  const det = await ok(tec1Token, "GET", `/os/${osAprovada}`);
  assert.equal(det.aprs.length, 1);
  assert.equal(det.aprs[0].resultado, "aprovada");
  assert.equal(det.aprs[0].participantes.length, 3);
  assert.equal(det.aprs[0].respostas.filter((x: any) => x.alerta_marcado).length, 1);
  assert.equal(det.alertas.length, 0, "APR aprovada não gera alerta de bloqueio");
  console.log("aprovada: aprs[0].resultado =", det.aprs[0].resultado, "· status da OS =", det.os.status);

}

// ---- 3. APR bloqueada, com foto ----------------------------------------------------------------------------------------
{
  const resumoModelo = publicados.find((m: any) => m.codigo === "APR 01")!;
  const modelo: ModeloCompleto = await ok(tec1Token, "GET", `/modelos-apr/${encodeURIComponent(resumoModelo.codigo)}/versoes/publicada`);
  assert.equal(modelo.id, resumoModelo.id, "versão publicada mais recente");
  let r = novoRascunho({
    osId: osBloqueada,
    usuarioId: eu.id,
    modelo: doModeloCompleto(modelo),
    participantes: [
      { usuarioId: eu.id, funcao: "responsavel" },
      { usuarioId: tec2.id, funcao: "executor" },
    ],
    riscos: modelo.riscos.slice(0, 1).map((x) => x.id),
  });
  const eliminatorios = perguntasDe(r.modelo, r.riscos).filter((i) => i.tipo === "eliminatorio" && i.resposta_bloqueante !== null);
  const comFoto = eliminatorios.find((i) => i.evidencia === "foto")!;
  const soTexto = eliminatorios.find((i) => i.evidencia === "texto");
  const reprovar = [comFoto, ...(soTexto ? [soTexto] : [])];
  r = responderTudo(r, new Set(reprovar.map((i) => i.id)));
  assert.equal(resultadoEsperado(r), "bloqueada");
  assert.equal(resumoDe(r).reprovados.length, reprovar.length, "todos os itens reprovados contam");
  assert.ok(resumoDe(r).semEvidencia.length === reprovar.length, "sem observação nem foto: falta evidência em todos");

  // 3a. evidência faltando: a api recusa com "Falta evidência em N item(ns)"
  const semEvidencia = await enviarEvento(tec1Token, osBloqueada, montarPayload({ ...r, concluidaEm: new Date().toISOString() }, "bloqueada"));
  assert.match(semEvidencia.rejeitados[0]?.mensagem ?? "", new RegExp(`Falta evidência em ${reprovar.length} item\\(ns\\)`), JSON.stringify(semEvidencia));
  console.log("bloqueada sem evidência ->", semEvidencia.rejeitados[0]!.mensagem);

  // 3b. observação (e foto, quando o item pede) em cada item reprovado; "NA" só onde o modelo permite
  const fotoId = crypto.randomUUID();
  await subir(tec1Token, fotoId, "foto");
  for (const item of reprovar) r = observar(r, item.id, `Motivo do teste: ${item.texto.slice(0, 40)}`);
  r = adicionarFoto(r, comFoto.id, { id: crypto.randomUUID(), arquivoId: fotoId, capturadaEm: new Date().toISOString(), latitude: -20.31, longitude: -40.29 });
  const resumo = resumoDe(r);
  assert.ok(resumo.completo && resumo.semEvidencia.length === 0, "evidência completa: pode concluir");
  r = { ...r, observacaoGeral: "Caixa de válvula alagada", concluidaEm: new Date().toISOString() };

  const resposta = await enviarEvento(tec1Token, osBloqueada, montarPayload(r, "bloqueada"), r.eventoId);
  assert.equal(resposta.rejeitados.length + resposta.pendentes.length, 0, JSON.stringify(resposta));
  assert.equal(resposta.aprs[0]?.resultado, "bloqueada");
  assert.equal(resposta.os[0]?.status, "pendente", "a OS fica pendente");
  assert.ok(resposta.alertas.length >= 1, "alerta ao supervisor");

  const det = await ok(tec1Token, "GET", `/os/${osBloqueada}`);
  assert.equal(det.os.status, "pendente");
  assert.equal(det.aprs[0].resultado, "bloqueada");
  assert.equal(det.aprs[0].itens_reprovados.length, reprovar.length, "a APR bloqueada registra TODOS os itens reprovados");
  const reprovadoComFoto = det.aprs[0].itens_reprovados.find((i: any) => i.item_id === comFoto.id);
  assert.equal(reprovadoComFoto.fotos[0].foto_path, fotoId);
  assert.ok(estaReprovado(comFoto, reprovadoComFoto.resposta));
  const url = await ok(tec1Token, "GET", `/arquivos/${fotoId}/url`);
  assert.ok(url.url, "a foto da evidência abre depois que a APR a referencia");

  const alertas = (await ok(sup1Token, "GET", "/alertas?tamanho=200")).alertas.filter((a: any) => a.os_id === osBloqueada);
  assert.ok(alertas.some((a: any) => a.tipo === "bloqueio"), `alerta ao supervisor: ${JSON.stringify(alertas)}`);
  console.log("bloqueada: aprs[0].resultado =", det.aprs[0].resultado, "· status da OS =", det.os.status, "· alertas ao supervisor =", alertas.length);

  // 3c. a OS pendente aceita uma APR nova (qualquer um da equipe: aqui tec2), sem nada aproveitado da anterior
  const modeloNovo = doModeloCompleto(modelo);
  let nova = novoRascunho({ osId: osBloqueada, usuarioId: tec2.id, modelo: modeloNovo, participantes: [{ usuarioId: tec2.id, funcao: "responsavel" }], riscos: [] });
  assert.equal(Object.keys(nova.respostas).length, 0);
  nova = { ...responderTudo(nova), concluidaEm: new Date().toISOString(), assinaturas: { [tec2.id]: new Date().toISOString() } };
  assert.equal(resultadoEsperado(nova), "aprovada");
  const retomada = await enviarEvento(tec2Token, osBloqueada, montarPayload(nova, "aprovada"), nova.eventoId);
  assert.equal(retomada.aprs[0]?.resultado, "aprovada", JSON.stringify(retomada));
  const depois = await ok(tec2Token, "GET", `/os/${osBloqueada}`);
  assert.equal(depois.aprs.length, 2);
  console.log("retomada com APR nova (tec2): resultado =", retomada.aprs[0]!.resultado, "· status da OS =", depois.os.status);
}

// ---- 4. "NA": só nos itens que o modelo permite, e sempre com observação ---------------------------------------------------
{
  const osNa = await criar("[teste apr web] APR com NA");
  const modelo: ModeloCompleto = await ok(tec1Token, "GET", "/modelos-apr/APR%2004/versoes/publicada");
  assert.ok(modelo.itens.some((i) => i.permite_na), "o APR 04 tem itens com NA");
  let r = novoRascunho({ osId: osNa, usuarioId: eu.id, modelo: doModeloCompleto(modelo), participantes: [{ usuarioId: eu.id, funcao: "responsavel" }], riscos: [] });
  r = responderTudo(r);
  const comNa = perguntasDe(r.modelo, r.riscos).find((i) => i.permite_na);
  assert.ok(comNa, "há pergunta com NA entre as de verificação do APR 04");
  r = responder(r, comNa, "na");
  assert.ok(resumoDe(r).naSemObservacao.length === 1, "NA sem observação fica pendente na tela");
  r = { ...r, concluidaEm: new Date().toISOString(), assinaturas: { [eu.id]: new Date().toISOString() } };
  const recusada = await enviarEvento(tec1Token, osNa, montarPayload(r, "aprovada"));
  assert.equal(recusada.rejeitados[0]?.codigo, "observacao_obrigatoria", JSON.stringify(recusada));
  r = observar(r, comNa.id, "Não há válvula neste ponto");
  assert.equal(resumoDe(r).naSemObservacao.length, 0);
  const aceita = await enviarEvento(tec1Token, osNa, montarPayload(r, "aprovada"), r.eventoId);
  assert.equal(aceita.aprs[0]?.resultado, "aprovada", JSON.stringify(aceita));
  console.log("NA sem observação ->", recusada.rejeitados[0]!.mensagem, "· com observação: aprs[0].resultado =", aceita.aprs[0]!.resultado);
}

console.log("\nFluxo da APR ok.");
