/* eslint-disable @typescript-eslint/no-explicit-any -- script de teste: as respostas da api são lidas como vêm */
// Fluxo do técnico até a APR, ponta a ponta contra a api local (sem navegador): injeta as OS de teste no SAP simulado e as lê, monta o
// rascunho com as mesmas funções que a tela usa (`src/lib/apr.ts`), valida a APR (`POST /aprs/avaliar`: a bloqueada já fica
// registrada), envia `apr_concluida` (a aprovada inteira; da bloqueada, a evidência) e confere resultado, status da OS e o
// alerta ao supervisor. O técnico não recebe o que é eliminatório: o script usa o modelo do admin só para escolher que
// respostas dar.
//
//   cd api && node --import tsx ../web/scripts/testar-fluxo-apr.mts
//
// Precisa da api em http://localhost:3333 (`pnpm dev:local`). Deixa na api OS "[teste apr web] ..." criadas.
import assert from "node:assert/strict";
import {
  doModeloCompleto,
  montarAvaliacao,
  montarPayload,
  novoRascunho,
  adicionarFoto,
  observar,
  perguntasDe,
  reprovadosSemEvidencia,
  responder,
  resumoDe,
  type ModeloCompleto,
  type RascunhoApr,
} from "../src/lib/apr";

const API = process.env.API_URL ?? "http://localhost:3333";
const SAP_TOKEN = process.env.SAP_API_TOKEN ?? "token-de-desenvolvimento";
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
/** Login pelo e-mail institucional (os usuários de `pnpm dev:local`: primeiro nome e último sobrenome, `@empresa.com.br`). */
const entrar = async (email: string, senha = "synqos123") => (await ok(null, "POST", "/auth/login", { email, senha })).access_token as string;

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

/** O item como o admin o vê: com o tipo, a resposta que bloqueia e a evidência, que o técnico não recebe. */
interface ItemDoAdmin {
  id: string;
  tipo: "eliminatorio" | "alerta";
  resposta_bloqueante: "sim" | "nao" | null;
  evidencia: "foto" | "texto";
}
const classificacaoDe = async (codigo: string) =>
  new Map<string, ItemDoAdmin>(((await ok(admToken, "GET", `/modelos-apr/${encodeURIComponent(codigo)}/versoes/publicada`)).itens as ItemDoAdmin[]).map((i) => [i.id, i]));

/**
 * `POST /aprs/avaliar` com a APR do rascunho, como a tela faz: o rascunho volta concluído, com o que a `api` disse (aprovada
 * ou bloqueada). A bloqueada já fica registrada.
 */
async function avaliar(token: string, r: RascunhoApr): Promise<RascunhoApr> {
  const concluidaEm = new Date().toISOString();
  const res = await ok(token, "POST", "/aprs/avaliar", montarAvaliacao({ ...r, concluidaEm }));
  return { ...r, concluidaEm, avaliacao: { resultado: res.resultado, reprovados: res.reprovados.map((x: any) => ({ itemId: x.item_id, texto: x.texto, evidencia: x.evidencia })) } };
}

/** Responde "tudo certo" (a resposta que não bloqueia) em todas as perguntas; `bloqueantes` troca a resposta de itens escolhidos. */
function responderTudo(r: RascunhoApr, classificacao: Map<string, ItemDoAdmin>, bloqueantes: Set<string> = new Set()) {
  for (const item of perguntasDe(r.modelo, r.riscos)) {
    const bloq = classificacao.get(item.id)!.resposta_bloqueante;
    const valor = bloq === null ? "sim" : bloqueantes.has(item.id) ? bloq : bloq === "sim" ? "nao" : "sim";
    r = responder(r, item, valor);
  }
  return r;
}

const [tec1Token, tec2Token, sup1Token, admToken] = await Promise.all([
  entrar("tiago.tecnico@empresa.com.br"),
  entrar("tais.tecnica@empresa.com.br"),
  entrar("sandra.supervisora@empresa.com.br"),
  entrar("admin@empresa.com.br"),
]);
const eu = (await ok(tec1Token, "GET", "/me")).usuario;
const equipeId: string = eu.equipe_id;
const centroTrabalho: string = (await ok(tec1Token, "GET", "/me")).equipe.centro_trabalho;
const tec2 = (await ok(tec1Token, "GET", `/usuarios?equipe_id=${equipeId}`)).usuarios.find((u: any) => u.matricula === "tec2");
assert.ok(tec2, "tec2 está na equipe de tec1");
console.log("login ok · equipe", equipeId);

// ---- OS de teste: a OS não nasce no sistema, então entram como em produção: o SAP simulado recebe as ordens e a leitura as traz.
// Uma com atividade (o serviço do catálogo) e as outras sem atividade; o modelo da APR, o técnico escolhe em todas ----------
const local = (await ok(sup1Token, "GET", "/locais?tamanho=1")).locais[0];
const lote = Date.now() % 1_000_000;
let sequencia = 0;
const injetar = async (titulo: string, codigo_atividade?: string) => {
  const numero_ordem = `9${lote}${++sequencia}`;
  await ok(SAP_TOKEN, "POST", "/sap-simulado/ordens", {
    numero_ordem,
    tipo_ordem: "YBA2",
    tipo_atividade: "Z02-Manutenção Preventiva",
    codigo_atividade: codigo_atividade ?? null,
    titulo,
    descricao: "Criada pelo teste do fluxo da APR",
    centro_trabalho: centroTrabalho,
    local_instalacao: { codigo: local.codigo },
    data_inicio_prog: "2026-10-13",
    status_sap: "LIB IMPR",
  });
  return numero_ordem;
};
const numeroAprovada = await injetar("[teste apr web] APR aprovada", "Teste, manutenção e válvulas");
const numeroBloqueada = await injetar("[teste apr web] APR bloqueada");
const numeroNa = await injetar("[teste apr web] APR com NA");
await ok(admToken, "POST", "/sap/leituras");
/** A leitura roda na tarefa em segundo plano (a cada poucos segundos): espera a OS aparecer. */
const aguardarOs = async (numero: string) => {
  for (let tentativa = 0; tentativa < 40; tentativa++) {
    const achada = (await ok(tec1Token, "GET", `/os?numero_ordem=${numero}`)).os[0];
    if (achada) return achada.id as string;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`A OS ${numero} não chegou pela leitura do SAP`);
};
const osAprovada = await aguardarOs(numeroAprovada);
const osBloqueada = await aguardarOs(numeroBloqueada);
const osNa = await aguardarOs(numeroNa);

// ---- 1. Detalhe e modelo ----------------------------------------------------------------------------------------------
const detA = await ok(tec1Token, "GET", `/os/${osAprovada}`);
assert.equal(detA.os.status, "liberada");
assert.equal("modelo_apr_codigo" in detA.os, false, "a OS não traz modelo: o técnico escolhe a cada APR");
const escolhaA = await ok(tec1Token, "GET", `/os/${osAprovada}/modelos-apr`);
assert.ok(escolhaA.modelos.length >= 8 && escolhaA.modelos.every((m: any) => m.descricao && m.exemplos.length > 0), "cada modelo vem com a orientação");
assert.ok(escolhaA.modelos.every((m: any) => !("palavras_chave" in m)), "as palavras-chave não vão para o técnico");
console.log("escolha do modelo: recomendado", escolhaA.recomendado ?? "nenhum");

// O técnico escolhe a APR 03 para a OS da atividade "Teste, manutenção e válvulas", qualquer que seja a recomendação.
const CODIGO_A = "APR 03";
const modeloA: ModeloCompleto = await ok(tec1Token, "GET", `/modelos-apr/${encodeURIComponent(CODIGO_A)}/versoes/publicada`);
const publicados = (await ok(tec1Token, "GET", "/modelos-apr?publicados=true&tamanho=200")).modelos;
assert.ok(publicados.length >= 8);

// ---- 2. APR aprovada -----------------------------------------------------------------------------------------------
{
  // participante sem assinatura cadastrada: a api recusa (e o técnico logado desenha na hora no caso dele)
  const matriculaNova = `semassin${Date.now() % 100000}`;
  const emailNovo = `${matriculaNova}@empresa.com.br`;
  const novo = await ok(admToken, "POST", "/usuarios", { nome: "Teste Sem Assinatura", matricula: matriculaNova, email: emailNovo, perfil: "tecnico", equipe_id: equipeId, senha_inicial: "Provisoria#123" });
  const provisorio = await entrar(emailNovo, "Provisoria#123");
  await ok(provisorio, "POST", "/auth/trocar-senha", { senha_atual: "Provisoria#123", senha_nova: "Definitiva#123" });
  const tokenNovo = await entrar(emailNovo, "Definitiva#123");

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

  // o técnico não vê o que é eliminatório: o modelo dele não traz tipo, resposta bloqueante nem evidência
  assert.ok(modeloA.itens.every((i) => !("tipo" in i) && !("resposta_bloqueante" in i) && !("evidencia" in i)), "o modelo do técnico não traz a classificação");
  // com um item de alerta respondido com a resposta bloqueante: segue, marcado
  const classeA = await classificacaoDe(CODIGO_A);
  const alerta = [...classeA.values()].find((i) => i.tipo === "alerta" && i.resposta_bloqueante !== null)!;
  r = responderTudo(r, classeA, new Set([alerta.id]));
  assert.ok(resumoDe(r).completo);

  // 2a. participante sem assinatura: a validação recusa antes de dizer o resultado (a recusa não revela o que reprova)
  const recusado = await chamar(tec1Token, "POST", "/aprs/avaliar", montarAvaliacao({ ...r, concluidaEm: new Date().toISOString() }));
  assert.equal(recusado.status, 422);
  assert.equal(recusado.corpo.erro?.codigo, "assinatura_ausente", JSON.stringify(recusado.corpo));
  console.log("validar com um participante sem assinatura ->", recusado.corpo.erro.mensagem);

  // 2b. o participante desenha a assinatura (PUT /arquivos + PUT /me/assinatura) e a APR é validada de novo
  const arquivoAssinatura = crypto.randomUUID();
  await subir(tokenNovo, arquivoAssinatura, "assinatura");
  await ok(tokenNovo, "PUT", "/me/assinatura", { arquivo_id: arquivoAssinatura });
  r = await avaliar(tec1Token, r);
  assert.equal(r.avaliacao?.resultado, "aprovada");
  assert.equal(r.avaliacao?.reprovados.length, 0);
  assert.equal((await ok(tec1Token, "GET", `/os/${osAprovada}`)).aprs.length, 0, "a aprovada só é registrada quando o evento `apr_concluida` é enviado (sem assinaturas: cada um assina depois, na conta)");
  const registrada = await enviarEvento(tec1Token, osAprovada, montarPayload(r), r.eventoId);
  assert.equal(registrada.rejeitados.length + registrada.pendentes.length, 0, JSON.stringify(registrada));
  assert.equal(registrada.aprs[0]?.resultado, "aprovada");
  assert.equal(registrada.os[0]?.status, "liberada", "OS continua liberada: falta a execução");
  // reenviar o mesmo evento não duplica a APR
  const repetida = await enviarEvento(tec1Token, osAprovada, montarPayload(r), r.eventoId);
  assert.equal(repetida.aprs[0]?.resultado, "aprovada");
  const det = await ok(tec1Token, "GET", `/os/${osAprovada}`);
  assert.equal(det.aprs.length, 1);
  assert.equal(det.aprs[0].resultado, "aprovada");
  assert.equal(det.aprs[0].participantes.length, 3);
  assert.ok(det.aprs[0].respostas.every((x: any) => !("alerta_marcado" in x) && !("tipo" in x)), "o detalhe da OS não diz ao técnico o que é alerta");
  const detAdmin = await ok(admToken, "GET", `/os/${osAprovada}`);
  assert.equal(detAdmin.aprs[0].respostas.filter((x: any) => x.alerta_marcado).length, 1, "o admin vê o alerta marcado");
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
  const classe = await classificacaoDe(resumoModelo.codigo);
  const eliminatorios = perguntasDe(r.modelo, r.riscos).filter((i) => classe.get(i.id)!.tipo === "eliminatorio" && classe.get(i.id)!.resposta_bloqueante !== null);
  const comFoto = eliminatorios.find((i) => classe.get(i.id)!.evidencia === "foto")!;
  const soTexto = eliminatorios.find((i) => classe.get(i.id)!.evidencia === "texto");
  const reprovar = [comFoto, ...(soTexto ? [soTexto] : [])];
  r = responderTudo(r, classe, new Set(reprovar.map((i) => i.id)));
  assert.ok(resumoDe(r).completo, "o checklist não pede evidência: só responde");
  // validar: só agora a api diz o que reprovou e que evidência cada item pede; a APR bloqueada já fica registrada
  r = { ...r, observacaoGeral: "Caixa de válvula alagada" };
  r = await avaliar(tec1Token, r);
  assert.equal(r.avaliacao?.resultado, "bloqueada");
  assert.deepEqual(r.avaliacao?.reprovados.map((x) => x.itemId).sort(), reprovar.map((i) => i.id).sort(), "todos os itens reprovados contam");
  assert.equal(r.avaliacao?.reprovados.find((x) => x.itemId === comFoto.id)?.evidencia, "foto");
  assert.ok(reprovadosSemEvidencia(r).length === reprovar.length, "sem observação nem foto: falta evidência em todos");
  const naHora = await ok(tec1Token, "GET", `/os/${osBloqueada}`);
  assert.equal(naHora.os.status, "pendente", "a OS fica pendente já na validação");
  assert.deepEqual(naHora.aprs.map((a: any) => [a.id, a.resultado]), [[r.aprId, "bloqueada"]], "a APR bloqueada fica registrada na validação");
  const alertasNaHora = (await ok(sup1Token, "GET", "/alertas?tamanho=200")).alertas.filter((a: any) => a.os_id === osBloqueada && a.tipo === "bloqueio");
  assert.equal(alertasNaHora.length, 1, "a supervisora é avisada na hora");
  console.log("bloqueada na validação: status da OS =", naHora.os.status, "· alerta à supervisora:", alertasNaHora[0].detalhe);

  // 3a. evidência faltando: a api recusa com "Falta evidência em N item(ns)"
  const semEvidencia = await enviarEvento(tec1Token, osBloqueada, montarPayload(r));
  assert.match(semEvidencia.rejeitados[0]?.mensagem ?? "", new RegExp(`Falta evidência em ${reprovar.length} item\\(ns\\)`), JSON.stringify(semEvidencia));
  console.log("evidência faltando ->", semEvidencia.rejeitados[0]!.mensagem);

  // 3b. observação (e foto, quando o item pede) em cada item reprovado
  const fotoId = crypto.randomUUID();
  await subir(tec1Token, fotoId, "foto");
  for (const item of reprovar) r = observar(r, item.id, `Motivo do teste: ${item.texto.slice(0, 40)}`);
  r = adicionarFoto(r, comFoto.id, { id: crypto.randomUUID(), arquivoId: fotoId, capturadaEm: new Date().toISOString(), latitude: -20.31, longitude: -40.29 });
  assert.equal(reprovadosSemEvidencia(r).length, 0, "evidência completa: pode registrar o impedimento");

  const resposta = await enviarEvento(tec1Token, osBloqueada, montarPayload(r), r.eventoId);
  assert.equal(resposta.rejeitados.length + resposta.pendentes.length, 0, JSON.stringify(resposta));
  assert.equal(resposta.aprs[0]?.resultado, "bloqueada");
  assert.equal(resposta.os[0]?.status, "pendente", "a OS continua pendente");

  const det = await ok(tec1Token, "GET", `/os/${osBloqueada}`);
  assert.equal(det.os.status, "pendente");
  assert.equal(det.aprs[0].resultado, "bloqueada");
  assert.equal(det.aprs[0].itens_reprovados.length, reprovar.length, "a APR bloqueada registra TODOS os itens reprovados");
  const reprovadoComFoto = det.aprs[0].itens_reprovados.find((i: any) => i.item_id === comFoto.id);
  assert.equal(reprovadoComFoto.fotos[0].foto_path, fotoId);
  assert.equal(reprovadoComFoto.resposta, classe.get(comFoto.id)!.resposta_bloqueante);
  assert.ok(det.aprs[0].itens_reprovados.every((i: any) => !("tipo" in i) && !("evidencia" in i)), "o técnico não recebe o tipo do item");
  const url = await ok(tec1Token, "GET", `/arquivos/${fotoId}/url`);
  assert.ok(url.url, "a foto da evidência abre depois que a APR a referencia");

  const alertas = (await ok(sup1Token, "GET", "/alertas?tamanho=200")).alertas.filter((a: any) => a.os_id === osBloqueada);
  assert.equal(alertas.filter((a: any) => a.tipo === "bloqueio").length, 1, `um alerta só ao supervisor: ${JSON.stringify(alertas)}`);
  console.log("bloqueada com evidência: aprs[0].resultado =", det.aprs[0].resultado, "· status da OS =", det.os.status, "· alertas ao supervisor =", alertas.length);

  // 3c. a mesma APR validada de novo (a resposta se perdeu) devolve o que ficou gravado, sem duplicar nada
  const deNovo = await ok(tec1Token, "POST", "/aprs/avaliar", montarAvaliacao(r));
  assert.equal(deNovo.resultado, "bloqueada");
  assert.equal((await ok(tec1Token, "GET", `/os/${osBloqueada}`)).aprs.length, 1);

  // 3d. a OS pendente aceita uma APR nova (qualquer um da equipe: aqui tec2), sem nada aproveitado da anterior; a
  // bloqueada continua lá (descartar o rascunho e refazer não a apaga)
  const modeloNovo = doModeloCompleto(modelo);
  let nova = novoRascunho({ osId: osBloqueada, usuarioId: tec2.id, modelo: modeloNovo, participantes: [{ usuarioId: tec2.id, funcao: "responsavel" }], riscos: [] });
  assert.equal(Object.keys(nova.respostas).length, 0);
  nova = await avaliar(tec2Token, responderTudo(nova, classe));
  assert.equal(nova.avaliacao?.resultado, "aprovada");
  const retomada = await enviarEvento(tec2Token, osBloqueada, montarPayload(nova), nova.eventoId);
  assert.equal(retomada.aprs[0]?.resultado, "aprovada", JSON.stringify(retomada));
  const depois = await ok(tec2Token, "GET", `/os/${osBloqueada}`);
  assert.equal(depois.aprs.length, 2);
  console.log("retomada com APR nova (tec2): resultado =", retomada.aprs[0]!.resultado, "· status da OS =", depois.os.status);
}

// ---- 4. "NA": só nos itens que o modelo permite, e sempre com observação ---------------------------------------------------
{
  const modelo: ModeloCompleto = await ok(tec1Token, "GET", "/modelos-apr/APR%2004/versoes/publicada");
  assert.ok(modelo.itens.some((i) => i.permite_na), "o APR 04 tem itens com NA");
  let r = novoRascunho({ osId: osNa, usuarioId: eu.id, modelo: doModeloCompleto(modelo), participantes: [{ usuarioId: eu.id, funcao: "responsavel" }], riscos: [] });
  r = responderTudo(r, await classificacaoDe("APR 04"));
  const comNa = perguntasDe(r.modelo, r.riscos).find((i) => i.permite_na);
  assert.ok(comNa, "há pergunta com NA entre as de verificação do APR 04");
  r = responder(r, comNa, "na");
  assert.ok(resumoDe(r).naSemObservacao.length === 1, "NA sem observação fica pendente na tela");
  const recusada = await chamar(tec1Token, "POST", "/aprs/avaliar", montarAvaliacao({ ...r, concluidaEm: new Date().toISOString() }));
  assert.equal(recusada.corpo.erro?.codigo, "observacao_obrigatoria", JSON.stringify(recusada.corpo));
  r = observar(r, comNa.id, "Não há válvula neste ponto");
  assert.equal(resumoDe(r).naSemObservacao.length, 0);
  r = await avaliar(tec1Token, r);
  const aceita = await enviarEvento(tec1Token, osNa, montarPayload(r), r.eventoId);
  assert.equal(aceita.aprs[0]?.resultado, "aprovada", JSON.stringify(aceita));
  console.log("NA sem observação ->", recusada.corpo.erro.mensagem, "· com observação: aprs[0].resultado =", aceita.aprs[0]!.resultado);
}

console.log("\nFluxo da APR ok.");
