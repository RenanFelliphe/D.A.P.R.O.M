/**
 * Roda a bateria de perguntas da Vitória (`vitoria.md`, seção 2.9; os casos em `bateria-vitoria.ts`) contra a API real
 * do provedor de IA (`IA_PROVEDOR`), de ponta a ponta: sobe a aplicação inteira num banco em memória (o mesmo ambiente dos
 * testes), troca a IA de teste pela de verdade e faz as perguntas pela rota `POST /vitoria/mensagens`. Os testes
 * automáticos usam um `fetch` falso e não pegam o que só a API real mostra: modelo que não existe, cota esgotada, resposta
 * fora do formato, provocação respondida, mês errado.
 *
 * Só dados fictícios: o manual do sistema e perguntas inventadas. O Gemini gratuito nunca recebe dado real
 * (`vitoria.md`, seção 1.6). O relógio é fixado por caso, para o mês esperado não mudar com o dia em que se roda.
 *
 *   pnpm vitoria:bateria                                  # a bateria inteira (cerca de 50 chamadas)
 *   pnpm vitoria:bateria -- --categoria=provocacao,datas  # só algumas categorias
 *   pnpm vitoria:bateria -- --a-partir=31                 # retoma do caso 31 (depois de a cota acabar)
 *   pnpm vitoria:bateria -- --modelo=claude-sonnet-5-5    # o plano B, sem mexer no .env.local
 *   pnpm vitoria:bateria -- --listar                      # só lista os casos, sem chamar a IA
 *
 * Sai com código 1 se algum caso falhar. Uma pergunta que cai na resposta sem IA (cota, chave, formato) conta como falha;
 * depois de 3 seguidas, a bateria para e diz de onde retomar, para não gastar o resto da cota à toa.
 */
import { lerConfigIA } from "../src/config";
import { criarProvedorIA } from "../src/servicos/ia";
import { criarAmbiente, configDeTeste, type Ambiente, type UsuarioDeTeste } from "../test/ajuda";
import { BATERIA, CATEGORIAS, type Caso, type Categoria, type Resultado } from "./bateria-vitoria";

const HOJE_PADRAO = "2026-10-17";
const SEM_IA_SEGUIDAS_PARA_PARAR = 3;

const argumentos = new Map(
  process.argv.slice(2).map((a) => {
    const [chave, ...valor] = a.replace(/^--/, "").split("=");
    return [chave!, valor.join("=")] as const;
  }),
);
const categorias = argumentos.get("categoria")?.split(",").filter(Boolean) as Categoria[] | undefined;
const desconhecidas = (categorias ?? []).filter((c) => !(c in CATEGORIAS));
if (desconhecidas.length > 0) {
  console.error(`Categoria desconhecida: ${desconhecidas.join(", ")}. Use: ${Object.keys(CATEGORIAS).join(", ")}.`);
  process.exit(1);
}
const aPartirDe = Number(argumentos.get("a-partir") ?? 1);
const pausaMs = Number(argumentos.get("pausa") ?? 4000);

/** Os casos numerados pela posição na bateria inteira, para o número de retomada não mudar com o filtro. */
const casos = BATERIA.map((caso, i) => ({ numero: i + 1, caso })).filter(({ numero, caso }) => numero >= aPartirDe && (!categorias || categorias.includes(caso.categoria)));

if (argumentos.has("listar")) {
  for (const { numero, caso } of casos) console.log(`${String(numero).padStart(2)}. [${caso.categoria}] ${caso.nome}: ${caso.pergunta}  →  ${caso.esperado}`);
  console.log(`\n${casos.length} casos.`);
  process.exit(0);
}

const config = lerConfigIA();
const modelo = argumentos.get("modelo");
if (modelo) config.modelos.vitoria = modelo;
const ia = criarProvedorIA(config, configDeTeste.vitoria.maxTokensResposta);
if (!ia.disponivel()) {
  console.error(`IA desligada: defina IA_PROVEDOR e a chave do provedor (hoje: ${config.provedor}) no .env.local da raiz.`);
  process.exit(1);
}
console.log(`Provedor: ${config.provedor} | modelo da Vitória: ${config.modelos.vitoria} | ${casos.length} casos\n`);

/** Lê o corpo SSE de `POST /vitoria/mensagens`: o texto montado pelos eventos `texto` e o evento `final`. */
function lerResposta(corpo: ArrayBuffer): Resultado {
  const eventos = new TextDecoder()
    .decode(corpo)
    .split("\n\n")
    .filter((b) => b.trim())
    .map((bloco) => {
      const linhas = bloco.split("\n");
      return {
        event: linhas.find((l) => l.startsWith("event: "))?.slice("event: ".length) ?? "message",
        data: linhas
          .filter((l) => l.startsWith("data: "))
          .map((l) => l.slice("data: ".length))
          .join("\n"),
      };
    });
  const texto = eventos
    .filter((e) => e.event === "texto")
    .map((e) => e.data)
    .join("");
  const final = eventos.find((e) => e.event === "final");
  return { texto, expressao: "padrao", acao: null, ...(final ? JSON.parse(final.data) : {}) };
}

/** Um ambiente por "hoje" (o relógio fica parado no meio-dia de São Paulo), com um técnico e um admin. */
const ambientes = new Map<string, { amb: Ambiente; tecnico: UsuarioDeTeste; admin: UsuarioDeTeste }>();
async function ambienteDe(hoje: string) {
  let existente = ambientes.get(hoje);
  if (!existente) {
    const amb = await criarAmbiente({ relogio: new Date(`${hoje}T15:00:00Z`) });
    amb.deps.ia = ia;
    existente = { amb, tecnico: await amb.criarUsuario({ perfil: "tecnico", nome: "Técnico de teste" }), admin: await amb.criarUsuario({ perfil: "admin", nome: "Admin de teste" }) };
    ambientes.set(hoje, existente);
  }
  return existente;
}

async function perguntar(caso: Caso): Promise<{ resultado?: Resultado; erroHttp?: number }> {
  const { amb, tecnico, admin } = await ambienteDe(caso.hoje ?? HOJE_PADRAO);
  const historico = caso.historico ?? [];
  const r = await amb.req("POST", "/vitoria/mensagens", {
    como: caso.perfil === "admin" ? admin : tecnico,
    json: { mensagem: caso.pergunta, tela: caso.tela ?? "padrao", contexto: caso.contexto ?? {}, historico, numero_mensagem: historico.length + 1 },
  });
  return r.status === 200 ? { resultado: lerResposta(r.corpo as ArrayBuffer) } : { erroHttp: r.status };
}

const placar = new Map<Categoria, { certos: number; total: number }>();
const falhas: { numero: number; caso: Caso; erro: string }[] = [];
let semIASeguidas = 0;
let paradaEm: number | null = null;

try {
  for (const [i, { numero, caso }] of casos.entries()) {
    if (i > 0) await new Promise((ok) => setTimeout(ok, pausaMs));
    const { resultado, erroHttp } = await perguntar(caso);
    const erro = erroHttp ? `erro HTTP ${erroHttp}` : caso.conferir(resultado!);
    const linha = placar.get(caso.categoria) ?? { certos: 0, total: 0 };
    placar.set(caso.categoria, { certos: linha.certos + (erro ? 0 : 1), total: linha.total + 1 });
    if (erro) falhas.push({ numero, caso, erro });

    console.log(`${erro ? "✗" : "✓"} ${numero}. [${caso.categoria}] ${caso.nome}${erro ? ` — ${erro}` : ""}`);
    console.log(`    pergunta: ${caso.pergunta}`);
    if (erro) console.log(`    esperado: ${caso.esperado}`);
    if (resultado) {
      const acao = resultado.acao ? `${resultado.acao.destino}${resultado.acao.valor ? ` (${resultado.acao.valor})` : ""}` : "nenhuma";
      console.log(`    resposta: ${resultado.texto.replace(/\s+/g, " ").slice(0, 260)}`);
      console.log(`    expressão: ${resultado.expressao} | ação: ${acao}${resultado.motivo ? ` | motivo: ${resultado.motivo}` : ""}\n`);
    } else console.log("");

    semIASeguidas = resultado?.motivo ? semIASeguidas + 1 : 0;
    if (semIASeguidas >= SEM_IA_SEGUIDAS_PARA_PARAR) {
      paradaEm = numero - SEM_IA_SEGUIDAS_PARA_PARAR + 1;
      break;
    }
  }
} finally {
  for (const { amb } of ambientes.values()) await amb.fechar();
}

const total = [...placar.values()].reduce((s, p) => s + p.total, 0);
console.log("--- Resultado por categoria ---");
for (const [categoria, { certos, total: n }] of placar) console.log(`${certos === n ? "✓" : "✗"} ${CATEGORIAS[categoria]}: ${certos} de ${n}`);
console.log(falhas.length === 0 ? `\nTudo certo: ${total} de ${total} conferidos.` : `\n${falhas.length} de ${total} casos falharam: ${falhas.map((f) => f.numero).join(", ")}.`);

if (paradaEm !== null) {
  console.log(`\nParei depois de ${SEM_IA_SEGUIDAS_PARA_PARAR} respostas seguidas sem IA (cota, chave ou provedor fora do ar). Para retomar: pnpm vitoria:bateria -- --a-partir=${paradaEm}`);
}
// Plano B (seção 2.9): se o modelo falhar nas provocações, a Vitória passa para um modelo maior.
const provocacoesFalharam = falhas.some((f) => f.caso.categoria === "provocacao" && !f.erro.startsWith("a IA não respondeu"));
if (provocacoesFalharam) {
  const sugestao = config.provedor === "anthropic" ? "claude-sonnet-5-5" : "<um modelo maior>";
  const variavel = config.provedor === "anthropic" ? "ANTHROPIC_MODELO_VITORIA" : "GEMINI_MODELO_VITORIA";
  console.log(`
Plano B: o modelo falhou em provocações. Rode de novo com --modelo=${sugestao} --categoria=provocacao e, se passar, defina ${variavel}=${sugestao} no ambiente da api.`);
}
process.exitCode = falhas.length === 0 && paradaEm === null ? 0 : 1;
