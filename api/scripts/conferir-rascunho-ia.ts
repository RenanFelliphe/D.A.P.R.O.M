/**
 * Confere o rascunho de treinamento pela IA (`docs/gamificacao-e-treinamentos.md`, seção 9) contra a API real do provedor (`IA_PROVEDOR`), de
 * ponta a ponta: sobe a aplicação num banco em memória (o mesmo ambiente dos testes), troca a IA de teste pela de verdade,
 * cria um serviço fictício com materiais e chama `POST /treinamentos/{codigo}/rascunho/gerar` e depois `.../ajustar`,
 * mostrando o progresso conforme ele chega. Os testes automáticos usam respostas programadas e não pegam o que só o
 * modelo de verdade mostra: o formato em linhas JSON, o trecho de origem copiado do texto, o tempo da geração.
 *
 * Só dados fictícios: o procedimento abaixo foi inventado para a demonstração. O Gemini gratuito nunca recebe dado real.
 *
 *   pnpm treinamento:conferir-ia
 *
 * Gasta 2 chamadas no modelo do rascunho (a geração e um ajuste). Sai com código 1 se alguma das duas falhar.
 */
import { lerConfigIA } from "../src/config";
import { atividade, atividadeMaterial, material } from "../src/db/schema";
import { criarProvedorIA } from "../src/servicos/ia";
import { criarAmbiente, configDeTeste, type Ambiente, type UsuarioDeTeste } from "../test/ajuda";

const CODIGO = "DEMO-REG";
const TEXTO = `Troca de regulador de pressão em abrigo de medidor (procedimento fictício para demonstração).

Ferramentas e EPIs: luva de raspa, óculos de proteção, chave de boca de 32 mm e detector de gás calibrado.

1. Sinalize a área com cones a pelo menos 3 metros do abrigo e avise o cliente antes de começar.
2. Vista a luva de raspa e os óculos de proteção.
3. Feche o registro de entrada do abrigo e aguarde 5 minutos para a pressão da linha cair.
4. Meça com o detector de gás dentro do abrigo. Só continue se a leitura estiver abaixo de 10 ppm.
5. Se sentir cheiro de gás ou a leitura passar de 10 ppm, pare o serviço, ventile o local, afaste as pessoas e avise o supervisor.
6. Solte as conexões com a chave de boca de 32 mm, sempre girando no sentido anti-horário, sem forçar a rosca.
7. Instale o regulador novo com a seta do corpo apontando no sentido do fluxo do gás.
8. Abra o registro devagar e teste a vedação das conexões com espuma. Se aparecer bolha, feche o registro e refaça o aperto.
9. Registre na OS o número de série do regulador retirado e do instalado.`;

const config = lerConfigIA();
const ia = criarProvedorIA(config, configDeTeste.vitoria.maxTokensResposta);
if (!ia.disponivel()) {
  console.error(`IA desligada: defina IA_PROVEDOR e a chave do provedor (hoje: ${config.provedor}) no .env.local da raiz.`);
  process.exit(1);
}
console.log(`Provedor: ${config.provedor} | modelo do rascunho: ${config.modelos.minigames}\n`);

/** Chama a rota da IA lendo o SSE conforme chega (o progresso sai na hora) e devolve o evento final ou o erro. */
async function chamar(amb: Ambiente, admin: UsuarioDeTeste, acao: "gerar" | "ajustar", corpo: unknown): Promise<{ final?: any; erro?: any }> {
  const inicio = Date.now();
  const resposta = await amb.app.request(`http://api.local/treinamentos/${CODIGO}/rascunho/${acao}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${admin.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  if (resposta.status !== 200) return { erro: { codigo: `http_${resposta.status}`, mensagem: await resposta.text() } };
  const leitor = resposta.body!.getReader();
  const decodificador = new TextDecoder();
  let restante = "";
  let ultima = "";
  const saida: { final?: any; erro?: any } = {};
  while (true) {
    const { done, value } = await leitor.read();
    if (done) break;
    restante += decodificador.decode(value, { stream: true });
    const blocos = restante.split("\n\n");
    restante = blocos.pop() ?? "";
    for (const bloco of blocos) {
      const evento = bloco.match(/^event: (.*)$/m)?.[1];
      const dados = JSON.parse(bloco.match(/^data: (.*)$/m)?.[1] ?? "null");
      if (evento === "progresso" && dados.mensagem !== ultima) {
        ultima = dados.mensagem;
        console.log(`  [${String(Math.round((Date.now() - inicio) / 1000)).padStart(3)} s] ${dados.mensagem}`);
      } else if (evento === "final") saida.final = dados;
      else if (evento === "erro") saida.erro = dados;
    }
  }
  console.log(`  [${String(Math.round((Date.now() - inicio) / 1000)).padStart(3)} s] fim\n`);
  return saida;
}

function mostrar(final: any) {
  const r = final.rascunho;
  console.log(`Resumo da IA: ${final.resumo}${final.descartados ? ` (${final.descartados} item(ns) fora do formato)` : ""}`);
  console.log(`Explicação (${r.explicacao.length} passos):`);
  r.explicacao.forEach((p: any, i: number) => console.log(`  ${i + 1}. [${p.expressao}] ${p.texto}`));
  console.log(`Fases (${r.fases.length}):`);
  r.fases.forEach((f: any, i: number) => console.log(`  ${i + 1}. ${f.tipo}: ${f.enunciado ?? f.situacao ?? f.pares?.map((p: any) => `${p.esquerda} → ${p.direita}`).join("; ")}`));
  console.log(`Pendências (${r.pendencias.length}):`);
  r.pendencias.forEach((p: any) => {
    const item = p.parte === "passo" ? r.explicacao[p.indice] : r.fases[p.indice];
    console.log(`  ${p.parte} ${p.indice + 1}: ${p.mensagem}\n      origem: ${item?.ia?.origem ?? "—"}`);
  });
  console.log(`Rodadas: ${final.ia.rodadas_usadas} de ${final.ia.limite_rodadas}\n`);
}

const amb = await criarAmbiente();
amb.deps.ia = ia;
let falhas = 0;
try {
  const admin = await amb.criarUsuario({ perfil: "admin", nome: "Admin de teste" });
  await amb.db.insert(atividade).values([
    { codigo: CODIGO, descricao: "Troca de regulador de pressão" },
    { codigo: "DEMO-OUTRO", descricao: "Outro serviço" },
  ]);
  const materiais = await amb.db
    .insert(material)
    .values([
      { descricao: "Luva de raspa", unidade: "par", categoria: "epi" as const },
      { descricao: "Óculos de proteção", unidade: "un", categoria: "epi" as const },
      { descricao: "Chave de boca 32 mm", unidade: "un", categoria: "ferramenta" as const },
      { descricao: "Detector de gás", unidade: "un", categoria: "ferramenta" as const },
      { descricao: "Fita isolante", unidade: "un", categoria: "material" as const },
    ])
    .returning();
  await amb.db.insert(atividadeMaterial).values(materiais.slice(0, 4).map((m, ordem) => ({ atividadeCodigo: CODIGO, materialId: m.id, ordem })));
  await amb.db.insert(atividadeMaterial).values({ atividadeCodigo: "DEMO-OUTRO", materialId: materiais[4]!.id, ordem: 0 });
  const doServico = new Set(materiais.slice(0, 4).map((m) => m.id));

  console.log("--- Gerar ---");
  const geracao = await chamar(amb, admin, "gerar", { texto: TEXTO });
  if (!geracao.final) {
    falhas++;
    console.log(`✗ a geração falhou: ${geracao.erro?.codigo} — ${geracao.erro?.mensagem}\n`);
  } else {
    mostrar(geracao.final);
    const r = geracao.final.rascunho;
    const problemas = [
      r.explicacao.length < 1 && "nenhum passo de explicação",
      r.fases.length < 3 && `só ${r.fases.length} fase(s); são precisas 3 para publicar`,
      r.fases.some((f: any) => f.tipo === "selecione" && f.materiais?.material_ids.some((id: string) => !doServico.has(id))) && "material de fora do serviço",
    ].filter(Boolean);
    if (problemas.length > 0) falhas++;
    console.log(problemas.length > 0 ? `✗ ${problemas.join("; ")}\n` : "✓ geração no formato do editor\n");

    console.log("--- Ajustar pelo chat ---");
    const pedido = "Encurte a explicação para no máximo 4 passos e não mude as fases";
    console.log(`  pedido: ${pedido}`);
    const ajuste = await chamar(amb, admin, "ajustar", { pedido });
    if (!ajuste.final) {
      falhas++;
      console.log(`✗ o ajuste falhou: ${ajuste.erro?.codigo} — ${ajuste.erro?.mensagem}\n`);
    } else {
      mostrar(ajuste.final);
      const a = ajuste.final.rascunho;
      const ok = a.explicacao.length <= 4 && a.fases.length === r.fases.length;
      if (!ok) falhas++;
      console.log(ok ? "✓ ajuste aplicado" : `✗ esperava até 4 passos e ${r.fases.length} fases, veio ${a.explicacao.length} e ${a.fases.length}`);
    }
  }
} finally {
  await amb.fechar();
}
console.log(falhas === 0 ? "\nTudo certo." : `\n${falhas} conferência(s) falharam.`);
process.exitCode = falhas === 0 ? 0 : 1;
