// Troca do modelo no meio da APR (sem servidor e sem navegador): monta rascunhos com os 8 modelos reais da carga inicial
// (`api/src/db/seed/modelos-apr.json`) e confere, com as funções puras da tela (`src/lib/apr.ts`), que as perguntas iguais
// guardam a resposta, as diferentes ficam em branco, o "NA" só passa para onde é aceito e os riscos de mesmo nome continuam
// marcados.
//
//   cd api && node --import tsx ../web/scripts/testar-troca-de-modelo.mts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  novoRascunho,
  perguntasDe,
  responder,
  riscosEquivalentes,
  trocarModelo,
  observar,
  type ItemDoModelo,
  type ModeloDoRascunho,
  type RascunhoApr,
} from "../src/lib/apr";

interface ModeloDoSeed {
  codigo: string;
  versao: number;
  titulo: string;
  riscos: { classificacao: string; nome: string; ordem: number }[];
  itens: { secao: "verificacao" | "medida_preventiva"; ordem: number; texto: string; permiteNa: boolean; risco: number | null }[];
}

const seed = JSON.parse(readFileSync(new URL("../../api/src/db/seed/modelos-apr.json", import.meta.url), "utf8")) as { modelos: ModeloDoSeed[] };

/** O modelo como a tela o recebe, com ids próprios de cada modelo (como no banco: cada versão tem os seus). */
function modelo(codigo: string): ModeloDoRascunho {
  const m = seed.modelos.find((x) => x.codigo === codigo)!;
  const riscos = m.riscos.map((r) => ({ id: `${codigo}/r${r.ordem}`, classificacao: r.classificacao, nome: r.nome, ordem: r.ordem }));
  const itens: ItemDoModelo[] = m.itens.map((i) => ({
    id: `${codigo}/i${i.ordem}`,
    secao: i.secao,
    risco_id: i.risco === null ? null : `${codigo}/r${i.risco}`,
    ordem: i.ordem,
    texto: i.texto,
    permite_na: i.permiteNa,
  }));
  return { id: `${codigo}/v${m.versao}`, codigo, versao: m.versao, titulo: m.titulo, riscos, itens };
}

const comparavel = (t: string) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const riscoPorNome = (m: ModeloDoRascunho, nome: string) => m.riscos.find((r) => comparavel(r.nome) === comparavel(nome))!.id;
const ok = (msg: string) => console.log(`ok  ${msg}`);

function rascunhoRespondido(m: ModeloDoRascunho, riscos: string[], resposta: (i: ItemDoModelo) => "sim" | "nao" | "na" = () => "sim"): RascunhoApr {
  let r = novoRascunho({ osId: "os", usuarioId: "eu", modelo: m, participantes: [{ usuarioId: "eu", funcao: "responsavel" }], riscos, id: () => "id" });
  for (const item of perguntasDe(m, riscos)) {
    r = responder(r, item, resposta(item));
    if (resposta(item) === "na") r = observar(r, item.id, "Não se aplica neste local.");
  }
  return r;
}

// ---- APR 01 → APR 03: verificações iguais e medidas dos mesmos riscos continuam ------------------------------------------
{
  const apr01 = modelo("APR 01");
  const apr03 = modelo("APR 03");
  const marcados01 = [riscoPorNome(apr01, "Insolação"), riscoPorNome(apr01, "Áreas molhadas"), riscoPorNome(apr01, "Separador de flange")];
  const r = { ...rascunhoRespondido(apr01, marcados01), avaliacao: { resultado: "aprovada" as const, reprovados: [], materiaisFaltando: [] }, concluidaEm: "2026-10-14T10:00:00Z" };

  const equivalentes = riscosEquivalentes(apr01, marcados01, apr03);
  assert.deepEqual(equivalentes.sort(), [riscoPorNome(apr03, "Insolação"), riscoPorNome(apr03, "Áreas molhadas")].sort(), "risco que o modelo novo não tem sai");
  ok("riscos de mesmo nome continuam marcados (Insolação e Áreas molhadas); o Separador de flange, que a APR 03 não tem, sai");

  const { rascunho: t, mantidas, perdidas, emBranco } = trocarModelo(r, apr03, equivalentes);
  const novas = perguntasDe(apr03, equivalentes);
  const antigas = perguntasDe(apr01, marcados01);
  const chave = (m: ModeloDoRascunho, i: ItemDoModelo) => `${i.secao}|${i.risco_id ? comparavel(m.riscos.find((x) => x.id === i.risco_id)!.nome) : ""}|${comparavel(i.texto)}`;
  const esperadas = novas.filter((i) => antigas.some((a) => chave(apr01, a) === chave(apr03, i)));
  assert.equal(mantidas, esperadas.length);
  assert.ok(mantidas >= 10, `as verificações em comum ficam (vieram ${mantidas})`);
  assert.deepEqual(Object.keys(t.respostas).sort(), esperadas.map((i) => i.id).sort(), "as respostas ficam nos itens do modelo novo");
  assert.equal(emBranco, novas.length - mantidas);
  assert.equal(perdidas, antigas.length - mantidas);
  assert.ok(perdidas > 0, "as medidas do Separador de flange se perdem");
  assert.equal(t.modelo.codigo, "APR 03");
  assert.deepEqual([t.avaliacao, t.concluidaEm, t.modo], [null, null, "pergunta"], "a validação anterior é apagada");
  assert.equal(t.indice, novas.findIndex((i) => !t.respostas[i.id]), "volta para a primeira pergunta em branco");
  ok(`APR 01 → APR 03: ${mantidas} respostas continuam, ${emBranco} perguntas em branco, ${perdidas} respostas apagadas`);

  // De volta para a APR 01: só o que era igual volta; as que a APR 03 não tinha ficaram em branco.
  const volta = trocarModelo(t, apr01, riscosEquivalentes(apr03, t.riscos, apr01));
  assert.equal(volta.mantidas, mantidas);
  ok("voltar ao modelo anterior não recupera as respostas apagadas");
}

// ---- "NA" só passa para onde o modelo aceita NA -------------------------------------------------------------------------
{
  const apr04 = modelo("APR 04");
  const apr05 = modelo("APR 05");
  const apr01 = modelo("APR 01");
  const comNa = rascunhoRespondido(apr04, [riscoPorNome(apr04, "Insolação")], () => "na");

  const para05 = trocarModelo(comNa, apr05, riscosEquivalentes(apr04, comNa.riscos, apr05));
  assert.ok(para05.mantidas > 0 && Object.values(para05.rascunho.respostas).every((x) => x.resposta === "na" && x.observacao === "Não se aplica neste local."));
  ok(`APR 04 → APR 05 (as duas aceitam NA): ${para05.mantidas} "NA" continuam, com a observação`);

  const para01 = trocarModelo(comNa, apr01, riscosEquivalentes(apr04, comNa.riscos, apr01));
  assert.equal(para01.mantidas, 0, "a APR 01 não aceita NA: nenhum NA passa");
  ok('APR 04 → APR 01 (sem NA): os "NA" ficam em branco');
}

// ---- Tudo igual: o checklist abre na revisão ---------------------------------------------------------------------------
{
  const apr02 = modelo("APR 02");
  const r = rascunhoRespondido(apr02, []);
  const mesma = trocarModelo(r, { ...apr02, id: "APR 02/v5", itens: apr02.itens.map((i) => ({ ...i, id: `${i.id}-v5` })) }, []);
  assert.equal(mesma.emBranco, 0);
  assert.equal(mesma.rascunho.modo, "revisao");
  ok("trocar para outra versão com as mesmas perguntas mantém tudo e abre a revisão");
}

console.log("\ntroca de modelo ok");
