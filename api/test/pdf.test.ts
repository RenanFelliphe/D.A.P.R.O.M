import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { eq, isNotNull } from "drizzle-orm";
import { apr, aprParticipante, aprResposta, aprRisco, execucao, execucaoPausa, itemModeloApr, modeloApr, os, riscoModeloApr } from "../src/db/schema";
import { ErroApi } from "../src/http/erros";
import { gerarPdfOs, manipularPdfOs } from "../src/servicos/pdf-os";
import { gerarRelatorioDaExecucao } from "../src/servicos/relatorio-execucao";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";
import { criarOs, paginasDoPdf, textoDoPdf } from "./fixture-os";

const comeca = (b: Uint8Array) => Buffer.from(b.subarray(0, 5)).toString("latin1");
const ocorrencias = (texto: string, trecho: string) => texto.split(trecho).length - 1;
const textoDaOs = async (amb: Ambiente, osId: string) => textoDoPdf(await gerarPdfOs(amb.deps, osId, { comprimir: false }));
const textoDoRelatorio = async (amb: Ambiente, osId: string) => textoDoPdf(await gerarRelatorioDaExecucao(amb.deps, osId, { comprimir: false }));

describe("PDF da OS", () => {
  let amb: Ambiente;
  let equipeId: string;
  let supervisor: UsuarioDeTeste;

  before(async () => {
    amb = await criarAmbiente({ relogio: new Date("2026-10-10T15:00:00Z") });
    equipeId = (await amb.criarEquipe()).id;
    supervisor = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Marta Supervisora", supervisor: true });
  });
  after(() => amb.fechar());

  it("é a APR e a folha do SAP (2 folhas), com os dados da OS, da execução e das assinaturas (horário de Brasília)", async () => {
    const o = await criarOs(amb, { equipeId, encerrada: true, numeroOrdem: "4023470", fotos: 2 });
    const pdf = await gerarPdfOs(amb.deps, o.osId);
    assert.equal(comeca(pdf), "%PDF-");
    assert.equal(paginasDoPdf(pdf), 3, "a APR (1 folha) e as 2 folhas da OS do SAP");

    const texto = await textoDaOs(amb, o.osId);
    for (const esperado of [
      // A APR, como o modelo.
      "ANÁLISE PRELIMINAR DE RISCO",
      "Supervisor da Atividade",
      "O local está sinalizado?",
      "ALERTA",
      "Sem intercorrências",
      "Grande Vitória",
      "Versão 04",
      "24/07/2026",
      // Folha 1 do SAP: cabeçalho, objetos técnicos, planejamento e operações.
      "SYNQ OS",
      "Ordem de Manutenção",
      "4023470",
      "Data da Ordem:  01/10/2026",
      "Folha: 1/2",
      "Tipo Ativ Manut:",
      "Desobstrução de DCV",
      "OBJETOS TÉCNICOS",
      "Rua das Flores, 10",
      "DCV-01",
      "N-123",
      "Código de Planejamento da Ordem",
      "Planejamento de Datas da Ordem",
      "09/10/2026",
      "10/10/2026",
      "HOUVE DESVIO?",
      "Tempo parada:",
      "Texto breve operação",
      "DCV Desobstrução de dreno",
      "Dreno entupido",
      "09:00", // 12:00Z em Brasília: o início da execução
      "12:00", // 15:00Z: o clique em "Encerrar OS"
      // Folha 2: descrição, atesto, executantes, responsável, supervisor e solicitante.
      "Folha: 2/2",
      "Descrição da atividade:",
      "Dreno desobstruído e testado",
      "Atesto que os serviços acima foram executados satisfatoriamente:",
      "Executante:",
      "Elismário dos Santos",
      "Damião Pestana",
      "Hora (Inicio):",
      "Hora (Fim):",
      "Responsável - Manutenção",
      "Supervisor",
      "Heloísa Supervisora",
      "10/10/2026", // a data da assinatura final do supervisor
      "Solicitante da Manutenção",
    ]) {
      assert.ok(texto.includes(esperado), `faltou "${esperado}" no PDF`);
    }
    // Sem nada a mais: o que o papel não tem vai para o relatório da execução.
    for (const sobra of ["RESULTADO DA APR", "TEMPO LÍQUIDO", "PAUSAS", "FOTOS", "Posição", "CHECKLIST", "DOCUMENTOS ANEXADOS", "STATUS", "CRITICIDADE", "Registro digital", "Ciente", "TRECHOS ANTERIORES"]) {
      assert.ok(!texto.includes(sobra), `"${sobra}" não é do papel e não deve estar no PDF`);
    }
    assert.ok(!texto.includes("[imagem indisponível]"));
  });

  it("a coluna \"Assinatura\" dos participantes só existe nos modelos que a têm; sem ela, a tabela é só função, nome e matrícula", async () => {
    const com = await criarOs(amb, { equipeId, encerrada: true });
    const textoCom = await textoDaOs(amb, com.osId);
    assert.ok(textoCom.includes("Assinatura"), "o modelo tem a coluna");
    assert.ok(textoCom.includes("Matrícula"));

    const sem = await criarOs(amb, { equipeId, encerrada: true, modeloSemColunaDeAssinatura: true });
    const textoSem = await textoDaOs(amb, sem.osId);
    assert.ok(!textoSem.includes("Assinatura"), "o modelo não tem a coluna");
    for (const esperado of ["Função", "Nome", "Matrícula", "Elismário dos Santos", "Damião Pestana"]) assert.ok(textoSem.includes(esperado), esperado);
  });

  it("quem recusou a APR saiu dela: não entra nas listas do PDF", async () => {
    const o = await criarOs(amb, { equipeId, encerrada: true, recusante: true });
    const texto = await textoDaOs(amb, o.osId);
    assert.ok(!texto.includes("Rita Recusante"));
    assert.ok(!texto.includes("Não me sinto bem"));
    assert.ok(texto.includes("Damião Pestana"));
  });

  it("assinatura da APR nula = célula vazia (o PDF sai igual, sem erro nem \"[imagem indisponível]\")", async () => {
    const o = await criarOs(amb, { equipeId, encerrada: true });
    await amb.db.update(aprParticipante).set({ assinaturaPath: null, assinadaEm: null }).where(eq(aprParticipante.usuarioId, o.executanteId));
    const pdf = await gerarPdfOs(amb.deps, o.osId, { comprimir: false });
    assert.equal(paginasDoPdf(pdf), 3);
    const texto = textoDoPdf(pdf);
    assert.ok(texto.includes("Damião Pestana"));
    assert.ok(!texto.includes("[imagem indisponível]"));
  });

  it("sem descrição no encerramento sai \"Executado conforme a OS, sem ocorrências\"", async () => {
    const o = await criarOs(amb, { equipeId, encerrada: true });
    await amb.db.update(execucao).set({ descricaoAtividade: null }).where(eq(execucao.id, o.execId));
    const texto = await textoDaOs(amb, o.osId);
    assert.ok(texto.includes("Executado conforme a OS, sem ocorrências"));
    await amb.db.update(execucao).set({ descricaoAtividade: "   " }).where(eq(execucao.id, o.execId));
    assert.ok((await textoDaOs(amb, o.osId)).includes("Executado conforme a OS, sem ocorrências"));
  });

  it("atividade de vários dias: o início é o do primeiro trecho e o fim, o da execução que encerrou", async () => {
    const o = await criarOs(amb, { equipeId, encerrada: true, trechoAnterior: true });
    const texto = await textoDaOs(amb, o.osId);
    assert.ok(texto.includes("08/10/2026"), "data de início do primeiro trecho");
    assert.ok(texto.includes("09/10/2026"), "data de fim da execução que encerrou");
    assert.ok(!texto.includes("TRECHOS ANTERIORES"));
  });

  it("mais de 3 participantes: os extras seguem em novas linhas de blocos iguais", async () => {
    const o = await criarOs(amb, { equipeId, encerrada: true });
    const extras = [await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Quarto Executante" }), await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Quinto Executante" })];
    for (const u of extras) await amb.db.insert(aprParticipante).values({ aprId: o.aprId, usuarioId: u.id, funcao: "executor", assinaturaPath: randomUUID(), assinadaEm: new Date("2026-10-09T11:53:00Z") });
    const pdf = await gerarPdfOs(amb.deps, o.osId, { comprimir: false });
    assert.equal(paginasDoPdf(pdf), 3);
    const texto = textoDoPdf(pdf);
    assert.equal(ocorrencias(texto, "Executante:"), 6, "duas linhas de 3 blocos");
    assert.ok(texto.includes("Quarto Executante") && texto.includes("Quinto Executante"));
    assert.equal(ocorrencias(texto, "Hora (Inicio):"), 6);
  });

  it("muitos participantes continuam em outra folha, sem cortar ninguém", async () => {
    const o = await criarOs(amb, { equipeId, encerrada: true });
    for (let i = 0; i < 14; i++) {
      const u = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: `Participante ${String(i).padStart(2, "0")}` });
      await amb.db.insert(aprParticipante).values({ aprId: o.aprId, usuarioId: u.id, funcao: "executor", assinaturaPath: randomUUID(), assinadaEm: new Date("2026-10-09T11:53:00Z") });
    }
    const texto = await textoDaOs(amb, o.osId);
    for (let i = 0; i < 14; i++) assert.ok(texto.includes(`Participante ${String(i).padStart(2, "0")}`), `participante ${i}`);
    assert.ok(texto.includes("Solicitante da Manutenção"));
  });

  it("imagem ausente do armazenamento vira \"[imagem indisponível]\" e o PDF sai igual", async () => {
    const ausentes = await criarOs(amb, { equipeId, encerrada: true, gravarImagens: false });
    const pdf = await gerarPdfOs(amb.deps, ausentes.osId, { comprimir: false });
    assert.equal(paginasDoPdf(pdf), 3);
    assert.ok(textoDoPdf(pdf).includes("[imagem indisponível]"));
  });

  it("OS sem Execução encerrada e assinada não gera PDF", async () => {
    const o = await criarOs(amb, { equipeId });
    await assert.rejects(() => gerarPdfOs(amb.deps, o.osId), /Execução encerrada/);
    await assert.rejects(() => gerarPdfOs(amb.deps, "00000000-0000-4000-8000-000000000000"), /não encontrada/);
    // O clique em "Encerrar OS" gravou o fim, mas o responsável ainda não assinou: a OS está em `encerrando`.
    const encerrando = await criarOs(amb, { equipeId, encerrada: true, status: "encerrando" });
    await assert.rejects(() => gerarPdfOs(amb.deps, encerrando.osId), /não foi assinada/);
  });

  it("a tarefa pdf_os guarda o PDF no bucket pdfs (caminho = id da OS), atualiza a OS e regera sobrescrevendo", async () => {
    const o = await criarOs(amb, { equipeId, encerrada: true });
    await manipularPdfOs(amb.deps, { id: "t", referenciaId: o.osId });
    const guardado = amb.armazenamento.arquivos.get(`pdfs/${o.osId}`);
    assert.ok(guardado);
    assert.equal(guardado.tipoMime, "application/pdf");
    assert.equal(comeca(guardado.bytes), "%PDF-");
    const [linha] = await amb.db.select().from(os).where(eq(os.id, o.osId));
    assert.equal(linha!.pdfPath, o.osId);
    assert.deepEqual(linha!.pdfEm, amb.relogio.agora);

    // A assinatura final foi refeita depois: o PDF é gerado de novo, no mesmo caminho.
    amb.relogio.agora = new Date("2026-10-11T12:00:00Z");
    await amb.db.update(os).set({ cienciaPor: supervisor.id, cienciaEm: amb.relogio.agora, cienciaAssinaturaPath: null }).where(eq(os.id, o.osId));
    await manipularPdfOs(amb.deps, { id: "t", referenciaId: o.osId });
    const novo = amb.armazenamento.arquivos.get(`pdfs/${o.osId}`)!;
    assert.notEqual(Buffer.compare(Buffer.from(novo.bytes), Buffer.from(guardado.bytes)), 0);
    const [depois] = await amb.db.select().from(os).where(eq(os.id, o.osId));
    assert.deepEqual(depois!.pdfEm, new Date("2026-10-11T12:00:00Z"));
    amb.relogio.agora = new Date("2026-10-10T15:00:00Z");
  });

  it("a tarefa pdf_os de OS ainda sem encerramento falha (a tarefa tenta de novo) e sem referência também", async () => {
    const o = await criarOs(amb, { equipeId });
    await assert.rejects(() => manipularPdfOs(amb.deps, { id: "t", referenciaId: o.osId }));
    await assert.rejects(() => manipularPdfOs(amb.deps, { id: "t", referenciaId: null }), /referência/);
  });
});

describe("PDF da OS com os modelos de APR reais", () => {
  let amb: Ambiente;
  let equipeId: string;

  before(async () => {
    amb = await criarAmbiente({ relogio: new Date("2026-10-10T15:00:00Z"), comCarga: true });
    equipeId = (await amb.criarEquipe()).id;
  });
  after(() => amb.fechar());

  it("cada modelo da carga inicial, com todos os riscos marcados e todas as perguntas, sai em 3 folhas (a APR em uma e as 2 do SAP)", async () => {
    const modelos = await amb.db.select().from(modeloApr).where(isNotNull(modeloApr.publicadoEm));
    assert.ok(modelos.length >= 8);
    const semColuna: string[] = [];
    for (const m of modelos) {
      const o = await criarOs(amb, { equipeId, encerrada: true });
      await amb.db.update(apr).set({ modeloAprId: m.id }).where(eq(apr.id, o.aprId));
      await amb.db.delete(aprResposta).where(eq(aprResposta.aprId, o.aprId));
      await amb.db.delete(aprRisco).where(eq(aprRisco.aprId, o.aprId));
      const riscos = await amb.db.select({ id: riscoModeloApr.id }).from(riscoModeloApr).where(eq(riscoModeloApr.modeloAprId, m.id));
      if (riscos.length > 0) await amb.db.insert(aprRisco).values(riscos.map((r) => ({ aprId: o.aprId, riscoId: r.id })));
      const itens = await amb.db.select({ id: itemModeloApr.id }).from(itemModeloApr).where(eq(itemModeloApr.modeloAprId, m.id));
      await amb.db
        .insert(aprResposta)
        .values(itens.map((i, n) => ({ aprId: o.aprId, itemId: i.id, resposta: "sim" as const, observacao: n % 7 === 0 ? "Conferido no local" : null, respondidaEm: amb.relogio.agora })));

      const pdf = await gerarPdfOs(amb.deps, o.osId, { comprimir: false });
      assert.equal(paginasDoPdf(pdf), 3, `${m.codigo} v${m.versao}`);
      const texto = textoDoPdf(pdf);
      assert.ok(texto.includes("Obs.: Conferido no local"), `${m.codigo}: a observação sai sob o item`);
      assert.ok(texto.includes("Atesto que os serviços acima foram executados satisfatoriamente:"), `${m.codigo}: a folha de execução do SAP`);
      assert.equal(texto.includes("Assinatura"), m.participantesComAssinatura, `${m.codigo}: a coluna Assinatura segue o modelo`);
      if (!m.participantesComAssinatura) semColuna.push(m.codigo);
    }
    assert.ok(semColuna.length > 0, "a carga tem modelos sem a coluna Assinatura (APR 01, 02, 03, 07 e 09)");
  });
});

describe("Relatório da execução", () => {
  let amb: Ambiente;
  let equipeId: string;

  before(async () => {
    amb = await criarAmbiente({ relogio: new Date("2026-10-10T15:00:00Z") });
    equipeId = (await amb.criarEquipe()).id;
  });
  after(() => amb.fechar());

  it("traz tudo o que o SYNQ OS acrescenta ao papel, somando todas as execuções da OS", async () => {
    const o = await criarOs(amb, { equipeId, encerrada: true, numeroOrdem: "4023470", fotos: 2, documentos: 2, trechoAnterior: "interrompida", saude: "lesao", recusante: true });
    const pdf = await gerarRelatorioDaExecucao(amb.deps, o.osId);
    assert.equal(comeca(pdf), "%PDF-");

    const texto = await textoDoRelatorio(amb, o.osId);
    for (const esperado of [
      // 1. Cabeçalho e situação.
      "RELATÓRIO DA EXECUÇÃO",
      "4023470",
      "DCV Desobstrução de dreno",
      "Concluída",
      // 9. Ocorrência de saúde em destaque.
      "OCORRÊNCIAS DE SAÚDE (LESÃO OU ENFERMIDADE)",
      "Pausa por lesão",
      // 2. Tempo: 2h do trecho interrompido + 3h do que encerrou = 5h; 30min + 10min de pausa = 40min; líquido 4h 20min.
      "5h 00min",
      "40min",
      "4h 20min",
      "08/10/2026 09:00",
      "09/10/2026 09:00",
      "Interrompida por risco",
      "Encerrada",
      // 3. Cada pausa: início, fim, motivo com complemento e localização.
      "PAUSAS (2)",
      "09/10/2026 10:00",
      "09/10/2026 10:30",
      "Aguardando: Peça do almoxarifado",
      "-20.315600, -40.312900",
      // 4. Suspensões e interrupções.
      "SUSPENSÕES E INTERRUPÇÕES",
      "Interrupção por risco",
      "Vazamento no ramal",
      // 5. A localização ao lado do endereço da OS, com o link do mapa.
      "LOCALIZAÇÃO",
      "Rua das Flores, 10",
      "Início da execução",
      "Encerramento da OS",
      "-20.315500, -40.312800",
      "-20.315800, -40.313000",
      "https://www.google.com/maps?q=-20.315500,-40.312800",
      // 6. Fotos e documentos da execução.
      "FOTOS (2)",
      "Posição: -20.315500, -40.312800",
      "Posição: não informada",
      "DOCUMENTOS ANEXADOS (PDF)",
      "laudo-1.pdf",
      "laudo-2.pdf",
      // 8. Assinaturas da APR, com a hora, o "presencial" e a recusa.
      "ASSINATURAS DA APR",
      "Assinou em 09/10/2026 08:51",
      "Assinou em 09/10/2026 08:52 (presencial)",
      "RECUSOU em 09/10/2026 08:45",
      "Rita Recusante",
      "Não me sinto bem",
      // 10. Assinatura do responsável e a do supervisor.
      "ASSINATURAS DO ENCERRAMENTO",
      "Responsável",
      "Elismário dos Santos",
      "Supervisor",
      "Heloísa Supervisora",
    ]) {
      assert.ok(texto.includes(esperado), `faltou "${esperado}" no relatório`);
    }
    assert.ok(!texto.includes("[imagem indisponível]"));
    assert.ok(!texto.includes("sem localização"), "a fixture tem todas as posições");
  });

  it("as coordenadas viram link clicável para o mapa (anotação de link no PDF)", async () => {
    const o = await criarOs(amb, { equipeId, encerrada: true });
    const bruto = Buffer.from(await gerarRelatorioDaExecucao(amb.deps, o.osId, { comprimir: false })).toString("latin1");
    assert.match(bruto, /\/Subtype \/Link/);
    assert.match(bruto, /\/URI \(https:\/\/www\.google\.com\/maps\?q=-20\.315500,-40\.312800\)/);
  });

  it("sem coordenadas: \"sem localização\" e nenhum link para o mapa (o endereço não é convertido)", async () => {
    const o = await criarOs(amb, { equipeId, encerrada: true, semLocalizacao: true });
    const texto = await textoDoRelatorio(amb, o.osId);
    assert.ok(texto.includes("sem localização"));
    assert.ok(texto.includes("Rua das Flores, 10"));
    assert.ok(!texto.includes("google.com/maps"));
    const bruto = Buffer.from(await gerarRelatorioDaExecucao(amb.deps, o.osId, { comprimir: false })).toString("latin1");
    assert.ok(!bruto.includes("/URI"));
  });

  it("sem lesão ou enfermidade não há o quadro de ocorrências de saúde; suspensão por saúde entra nele", async () => {
    const limpa = await criarOs(amb, { equipeId, encerrada: true });
    const texto = await textoDoRelatorio(amb, limpa.osId);
    assert.ok(!texto.includes("OCORRÊNCIAS DE SAÚDE"));
    assert.ok(texto.includes("Nenhuma suspensão ou interrupção."));

    const o = await criarOs(amb, { equipeId, encerrada: true, trechoAnterior: true });
    await amb.db.update(execucao).set({ suspensaoMotivo: "enfermidade" }).where(eq(execucao.id, o.anteriorId!));
    const comSuspensao = await textoDoRelatorio(amb, o.osId);
    assert.ok(comSuspensao.includes("OCORRÊNCIAS DE SAÚDE"));
    assert.ok(comSuspensao.includes("Suspensão por enfermidade"));
    assert.ok(comSuspensao.includes("Suspensão"));
  });

  it("a suspensão traz o motivo e o complemento", async () => {
    const o = await criarOs(amb, { equipeId, encerrada: true, trechoAnterior: true });
    await amb.db.update(execucao).set({ suspensaoMotivo: "outro", suspensaoComplemento: "Aguardando o carro de apoio" }).where(eq(execucao.id, o.anteriorId!));
    const texto = await textoDoRelatorio(amb, o.osId);
    assert.ok(texto.includes("Outro: Aguardando o carro de apoio"));
    const [legada] = [await criarOs(amb, { equipeId, encerrada: true, trechoAnterior: true })];
    await amb.db.update(execucao).set({ suspensaoMotivo: null }).where(eq(execucao.id, legada.anteriorId!));
    assert.ok((await textoDoRelatorio(amb, legada.osId)).includes("sem motivo informado"), "a suspensa antiga não tem motivo");
  });

  it("a pausa aberta no encerramento conta até o fim da execução", async () => {
    const o = await criarOs(amb, { equipeId, encerrada: true });
    await amb.db.insert(execucaoPausa).values({ id: randomUUID(), execucaoId: o.execId, inicio: new Date("2026-10-09T14:30:00Z"), motivo: "descanso" });
    const texto = await textoDoRelatorio(amb, o.osId);
    assert.ok(texto.includes("(com o encerramento)"));
    assert.ok(texto.includes("Descanso"));
    assert.ok(texto.includes("1h 00min"), "30min + 30min de pausa");
  });

  it("o checklist de inspeção da preventiva sai aqui (caixa marcada ou vazia, pergunta e observação)", async () => {
    const o = await criarOs(amb, { equipeId, encerrada: true });
    await amb.db
      .update(execucao)
      .set({ dadosInspecao: { itens: [{ pergunta: "Tensão de saída dentro da faixa?", marcado: true, observacao: null }, { pergunta: "Telemetria funcionando?", marcado: false, observacao: "Sem sinal" }, { pergunta: "Gabinete limpo?", marcado: null, observacao: null }] } })
      .where(eq(execucao.id, o.execId));
    const texto = await textoDoRelatorio(amb, o.osId);
    for (const esperado of ["CHECKLIST DE INSPEÇÃO", "Tensão de saída dentro da faixa?", "[X]", "Telemetria funcionando?", "[  ]", "Obs.: Sem sinal", "Gabinete limpo?", "[?]", "Não respondida."]) {
      assert.ok(texto.includes(esperado), `faltou "${esperado}"`);
    }
    assert.ok(!(await textoDaOs(amb, o.osId)).includes("CHECKLIST"), "o checklist não está no PDF da OS");
  });

  it("modelo sem coluna de assinatura: o relatório avisa que as assinaturas aparecem só nele", async () => {
    const o = await criarOs(amb, { equipeId, encerrada: true, modeloSemColunaDeAssinatura: true });
    const texto = await textoDoRelatorio(amb, o.osId);
    assert.ok(texto.includes("não tem coluna de assinatura"));
    assert.ok(texto.includes("Assinou em 09/10/2026 08:51"));
  });

  it("OS que ainda espera as assinaturas: o relatório já existe e mostra o que falta", async () => {
    const encerrando = await criarOs(amb, { equipeId, encerrada: true, status: "encerrando" });
    const t1 = await textoDoRelatorio(amb, encerrando.osId);
    assert.ok(t1.includes("Encerrando (falta a assinatura do responsável)"));
    assert.ok(t1.includes("Aguardando a assinatura do responsável"));
    assert.ok(t1.includes("Ainda não assinou"));

    const aguardando = await criarOs(amb, { equipeId, encerrada: true, status: "aguardando_supervisor" });
    const t2 = await textoDoRelatorio(amb, aguardando.osId);
    assert.ok(t2.includes("Aguardando a assinatura do supervisor"));
    assert.ok(t2.includes("Elismário dos Santos"), "o responsável já assinou");
    assert.ok(t2.includes("Ainda não assinou"), "o supervisor ainda não");
  });

  it("imagem ausente do armazenamento vira \"[imagem indisponível]\"", async () => {
    const o = await criarOs(amb, { equipeId, encerrada: true, fotos: 1, gravarImagens: false });
    assert.ok((await textoDoRelatorio(amb, o.osId)).includes("[imagem indisponível]"));
  });

  it("muitas fotos continuam em outras folhas, com o número da página", async () => {
    const o = await criarOs(amb, { equipeId, encerrada: true, fotos: 30 });
    const pdf = await gerarRelatorioDaExecucao(amb.deps, o.osId, { comprimir: false });
    const paginas = paginasDoPdf(pdf);
    assert.ok(paginas >= 2);
    const texto = textoDoPdf(pdf);
    assert.ok(texto.includes(`página 1 de ${paginas}`));
    assert.ok(texto.includes(`página ${paginas} de ${paginas}`));
    assert.equal(ocorrencias(texto, "Posição: não informada"), 29);
  });

  it("OS sem execução finalizada (nenhuma, só em andamento ou só cancelada): 409 os_sem_execucao", async () => {
    const codigo = async (osId: string) => {
      try {
        await gerarRelatorioDaExecucao(amb.deps, osId);
      } catch (e) {
        assert.ok(e instanceof ErroApi);
        assert.equal(e.status, 409);
        return e.codigo;
      }
      return null;
    };
    const semNada = await criarOs(amb, { equipeId });
    assert.equal(await codigo(semNada.osId), "os_sem_execucao");

    const completa = await criarOs(amb, { equipeId, encerrada: true });
    await amb.db.update(execucao).set({ resultado: null, fim: null, encerramentoAssinadoEm: null }).where(eq(execucao.id, completa.execId));
    assert.equal(await codigo(completa.osId), "os_sem_execucao", "execução em andamento não conta");
    await amb.db.update(execucao).set({ resultado: "cancelada", fim: new Date("2026-10-09T15:00:00Z") }).where(eq(execucao.id, completa.execId));
    assert.equal(await codigo(completa.osId), "os_sem_execucao", "cancelada não conta");

    await assert.rejects(() => gerarRelatorioDaExecucao(amb.deps, "00000000-0000-4000-8000-000000000000"), (e: unknown) => e instanceof ErroApi && e.status === 404);
  });
});

describe("GET /os/{id}/pdf", () => {
  let amb: Ambiente;
  let equipeA: string;
  let equipeB: string;
  let tecnicoA: UsuarioDeTeste;
  let supervisorA: UsuarioDeTeste;
  let tecnicoB: UsuarioDeTeste;
  let admin: UsuarioDeTeste;

  before(async () => {
    amb = await criarAmbiente({ relogio: new Date("2026-10-10T15:00:00Z") });
    equipeA = (await amb.criarEquipe()).id;
    equipeB = (await amb.criarEquipe()).id;
    tecnicoA = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeA });
    supervisorA = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeA, supervisor: true });
    tecnicoB = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeB });
    admin = await amb.criarUsuario({ perfil: "admin" });
  });
  after(() => amb.fechar());

  it("recusa sem token (401)", async () => {
    const o = await criarOs(amb, { equipeId: equipeA, encerrada: true });
    assert.equal((await amb.req("GET", `/os/${o.osId}/pdf`)).status, 401);
  });

  it("OS concluída sem PDF guardado: gera na hora, guarda, atualiza a OS e devolve application/pdf inline", async () => {
    const o = await criarOs(amb, { equipeId: equipeA, encerrada: true });
    const r = await amb.req("GET", `/os/${o.osId}/pdf`, { como: tecnicoA });
    assert.equal(r.status, 200);
    assert.equal(r.cabecalhos.get("content-type"), "application/pdf");
    assert.match(r.cabecalhos.get("content-disposition") ?? "", /^inline/);
    const bytes = new Uint8Array(r.corpo as ArrayBuffer);
    assert.equal(comeca(bytes), "%PDF-");
    assert.equal(paginasDoPdf(bytes), 3);
    assert.ok(amb.armazenamento.arquivos.has(`pdfs/${o.osId}`));
    const [linha] = await amb.db.select().from(os).where(eq(os.id, o.osId));
    assert.equal(linha!.pdfPath, o.osId);
    assert.ok(linha!.pdfEm);
  });

  it("com PDF guardado, devolve o guardado sem gerar de novo", async () => {
    const o = await criarOs(amb, { equipeId: equipeA, encerrada: true });
    await amb.armazenamento.gravar("pdfs", o.osId, new TextEncoder().encode("%PDF-guardado"), "application/pdf");
    await amb.db.update(os).set({ pdfPath: o.osId, pdfEm: amb.relogio.agora }).where(eq(os.id, o.osId));
    const r = await amb.req("GET", `/os/${o.osId}/pdf`, { como: supervisorA });
    assert.equal(r.status, 200);
    assert.equal(Buffer.from(r.corpo as ArrayBuffer).toString(), "%PDF-guardado");
  });

  it("OS que ainda não foi concluída (falta a assinatura do responsável ou a do supervisor): 409", async () => {
    for (const status of ["em_execucao", "encerrando", "aguardando_supervisor"] as const) {
      const o = await criarOs(amb, { equipeId: equipeA, status });
      const r = await amb.req("GET", `/os/${o.osId}/pdf`, { como: tecnicoA });
      assert.equal(r.status, 409, status);
      assert.equal(r.corpo.erro.codigo, "os_nao_encerrada");
      assert.equal(r.corpo.erro.mensagem, "A OS ainda não foi encerrada");
    }
  });

  it("técnico e supervisor só veem a própria equipe (404 para a outra); o admin vê todas", async () => {
    const o = await criarOs(amb, { equipeId: equipeA, encerrada: true });
    const caminho = `/os/${o.osId}/pdf`;
    assert.equal((await amb.req("GET", caminho, { como: tecnicoB })).status, 404);
    assert.equal((await amb.req("GET", caminho, { como: tecnicoA })).status, 200);
    assert.equal((await amb.req("GET", caminho, { como: supervisorA })).status, 200);
    for (const u of [admin]) assert.equal((await amb.req("GET", caminho, { como: u })).status, 200, u.perfil);
  });

  it("OS inexistente ou id que não é UUID: 404", async () => {
    assert.equal((await amb.req("GET", "/os/00000000-0000-4000-8000-000000000000/pdf", { como: admin })).status, 404);
    assert.equal((await amb.req("GET", "/os/abc/pdf", { como: admin })).status, 404);
  });
});

describe("GET /os/{id}/relatorio-execucao", () => {
  let amb: Ambiente;
  let equipeA: string;
  let equipeB: string;
  let tecnicoA: UsuarioDeTeste;
  let supervisorA: UsuarioDeTeste;
  let supervisorB: UsuarioDeTeste;
  let tecnicoB: UsuarioDeTeste;
  let admin: UsuarioDeTeste;

  before(async () => {
    amb = await criarAmbiente({ relogio: new Date("2026-10-10T15:00:00Z") });
    equipeA = (await amb.criarEquipe()).id;
    equipeB = (await amb.criarEquipe()).id;
    tecnicoA = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeA });
    supervisorA = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeA, supervisor: true });
    tecnicoB = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeB });
    supervisorB = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeB, supervisor: true });
    admin = await amb.criarUsuario({ perfil: "admin" });
  });
  after(() => amb.fechar());

  it("recusa sem token (401)", async () => {
    const o = await criarOs(amb, { equipeId: equipeA, encerrada: true });
    assert.equal((await amb.req("GET", `/os/${o.osId}/relatorio-execucao`)).status, 401);
  });

  it("o supervisor da equipe e o admin recebem o PDF inline, sem cache e sem guardar arquivo", async () => {
    const o = await criarOs(amb, { equipeId: equipeA, encerrada: true, status: "aguardando_supervisor", fotos: 1 });
    for (const como of [supervisorA, admin]) {
      const r = await amb.req("GET", `/os/${o.osId}/relatorio-execucao`, { como });
      assert.equal(r.status, 200, como.perfil);
      assert.equal(r.cabecalhos.get("content-type"), "application/pdf");
      assert.match(r.cabecalhos.get("content-disposition") ?? "", /^inline/);
      assert.equal(r.cabecalhos.get("cache-control"), "private, no-store");
      assert.equal(comeca(new Uint8Array(r.corpo as ArrayBuffer)), "%PDF-");
    }
    assert.ok(!amb.armazenamento.arquivos.has(`pdfs/${o.osId}`), "o relatório é gerado na hora: nada vai para o bucket pdfs");
    const [linha] = await amb.db.select().from(os).where(eq(os.id, o.osId));
    assert.equal(linha!.pdfPath, null);
  });

  it("o técnico da própria equipe que não a supervisiona recebe 403; quem não vê a equipe, 404", async () => {
    const o = await criarOs(amb, { equipeId: equipeA, encerrada: true });
    const caminho = `/os/${o.osId}/relatorio-execucao`;
    const r = await amb.req("GET", caminho, { como: tecnicoA });
    assert.equal(r.status, 403);
    assert.equal(r.corpo.erro.codigo, "proibido");
    assert.equal((await amb.req("GET", caminho, { como: tecnicoB })).status, 404);
    assert.equal((await amb.req("GET", caminho, { como: supervisorB })).status, 404, "o supervisor de outra equipe não vê a OS");
  });

  it("OS sem execução finalizada: 409 os_sem_execucao", async () => {
    const o = await criarOs(amb, { equipeId: equipeA, status: "em_execucao" });
    const r = await amb.req("GET", `/os/${o.osId}/relatorio-execucao`, { como: supervisorA });
    assert.equal(r.status, 409);
    assert.equal(r.corpo.erro.codigo, "os_sem_execucao");
    // O 409 vem depois da checagem de acesso: quem não supervisiona não descobre o estado da OS.
    assert.equal((await amb.req("GET", `/os/${o.osId}/relatorio-execucao`, { como: tecnicoA })).status, 403);
  });

  it("OS inexistente ou id que não é UUID: 404", async () => {
    assert.equal((await amb.req("GET", "/os/00000000-0000-4000-8000-000000000000/relatorio-execucao", { como: admin })).status, 404);
    assert.equal((await amb.req("GET", "/os/abc/relatorio-execucao", { como: admin })).status, 404);
  });
});
