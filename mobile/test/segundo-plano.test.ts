import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RespostaEventos } from "@shared/api/eventos";
import type { RespostaMe } from "@shared/api/tipos";
import { ErroDeRede } from "../src/api/erros";
import { textoDoSegundoPlano } from "../src/offline/faixa";
import { eventosPendentes, guardarEvento } from "../src/offline/fila";
import { guardarEu } from "../src/offline/identidade";
import type { PessoaLogada } from "../src/offline/leitura";
import { enviarEmSegundoPlano, registrarPassadaEmSegundoPlano, ultimaPassadaEmSegundoPlano, type DependenciasDoSegundoPlano } from "../src/offline/segundo-plano";
import { criarSincronizador } from "../src/offline/sincronizar";
import { EU, novoBancoDeTeste, osDe, snapshotDe, uuidDe } from "./ajuda-offline";

const AGORA = new Date("2026-10-19T15:00:00.000Z");
const vazia = (): RespostaEventos => ({ confirmados: [], alertas: [], aprs: [], os: [], rejeitados: [], pendentes: [], pontos_ganhos: 0, ganhos: [] });
const euDe = (perfil = "tecnico", equipe: unknown = { id: "eq", nome: "Equipe A" }) =>
  ({ usuario: { id: EU, nome: "Maria", matricula: "123", perfil }, equipe, equipes_supervisionadas: [] }) as unknown as RespostaMe;

/** O aparelho com o app fechado: o banco, a `api` que responde (ou não) e as peças que o app abriria. */
async function montar(opcoes: { naFrente?: boolean; sessao?: boolean; eu?: RespostaMe | null; pessoaDoApp?: PessoaLogada | null; semSinal?: boolean } = {}) {
  const banco = await novoBancoDeTeste();
  if (opcoes.eu !== null) await guardarEu(banco, opcoes.eu ?? euDe(), AGORA);
  const estado = { enviados: [] as string[], pulls: 0, sincronizacoes: 0, pessoa: opcoes.pessoaDoApp ?? null, semSinal: opcoes.semSinal ?? false };
  const sincronizador = criarSincronizador({
    banco,
    usuarioId: () => estado.pessoa?.id ?? null,
    enviarEvento: async (e) => {
      if (estado.semSinal) throw new ErroDeRede();
      if (!estado.enviados.includes(e.id)) estado.enviados.push(e.id);
      return { ...vazia(), confirmados: [e.id] };
    },
    subirArquivo: async () => undefined,
    baixarSnapshot: async () => {
      estado.pulls++;
      return snapshotDe([osDe(1)]);
    },
    apagarArquivoLocal: () => undefined,
    conexao: () => "online",
    agora: () => AGORA,
    aoMudar: () => undefined,
  });
  const dependencias: DependenciasDoSegundoPlano = {
    banco,
    appNaFrente: () => opcoes.naFrente ?? false,
    temSessao: async () => opcoes.sessao ?? true,
    pessoaDoApp: () => estado.pessoa,
    definirPessoa: (p) => void (estado.pessoa = p),
    sincronizar: () => {
      estado.sincronizacoes++;
      return sincronizador.sincronizar();
    },
  };
  return { banco, estado, rodar: () => enviarEmSegundoPlano(dependencias) };
}

const guardar = (banco: Awaited<ReturnType<typeof novoBancoDeTeste>>, id: string, minutosAtras: number) =>
  guardarEvento(banco, {
    id,
    usuarioId: EU,
    tipo: "pausa_iniciada",
    osId: uuidDe(1),
    payload: { id },
    ocorridoEm: new Date(AGORA.getTime() - minutosAtras * 60_000).toISOString(),
    criadoEm: AGORA.toISOString(),
  });

describe("o envio em segundo plano: quando a tarefa não mexe na fila", () => {
  it("com o app na frente, deixa a fila para a tela (não concorre com ela)", async () => {
    const { banco, estado, rodar } = await montar({ naFrente: true });
    await guardar(banco, "e1", 5);
    assert.equal((await rodar()).situacao, "app-na-frente");
    assert.equal(estado.sincronizacoes, 0);
    assert.equal((await eventosPendentes(banco, EU)).length, 1);
  });

  it("sem sessão no aparelho (saiu, ou entrou sem sinal), não tenta: não há token para enviar", async () => {
    const { banco, estado, rodar } = await montar({ sessao: false });
    await guardar(banco, "e1", 5);
    assert.equal((await rodar()).situacao, "sem-sessao");
    assert.equal(estado.sincronizacoes, 0);
  });

  it("sem saber quem é a pessoa (nunca entrou neste aparelho), não faz nada", async () => {
    const { rodar, estado } = await montar({ eu: null });
    assert.equal((await rodar()).situacao, "sem-pessoa");
    assert.equal(estado.sincronizacoes, 0);
  });

  it("quem não tem fila (supervisor, técnico sem equipe) não envia nem baixa nada", async () => {
    for (const eu of [euDe("supervisor"), euDe("tecnico", null)]) {
      const { rodar, estado } = await montar({ eu });
      assert.equal((await rodar()).situacao, "nao-se-aplica");
      assert.equal(estado.sincronizacoes, 0);
    }
  });

  it("fila vazia: não gasta bateria nem rede (nem baixa a cópia)", async () => {
    const { rodar, estado } = await montar();
    const r = await rodar();
    assert.deepEqual([r.situacao, r.ok], ["nada-a-enviar", true]);
    assert.deepEqual([estado.sincronizacoes, estado.pulls], [0, 0]);
  });
});

describe("o envio em segundo plano: quando a tarefa envia", () => {
  it("com o app fechado, descobre a pessoa pelo último GET /me, sobe a fila em ordem e baixa a cópia nova", async () => {
    const { banco, estado, rodar } = await montar();
    await guardar(banco, "e2", 5);
    await guardar(banco, "e1", 30);
    const r = await rodar();
    assert.deepEqual(r, { situacao: "enviou", ok: true, confirmados: 2, recusados: 0 });
    assert.deepEqual(estado.enviados, ["e1", "e2"]);
    assert.deepEqual(await eventosPendentes(banco, EU), []);
    assert.equal(estado.pulls, 1, "depois da fila, a cópia: quem abre o app sem sinal não vê a OS como se nada tivesse acontecido");
    assert.deepEqual(estado.pessoa, { id: EU, nome: "Maria", matricula: "123" });
  });

  it("com o app vivo em segundo plano, usa a pessoa que ele já conhece (sem depender do banco)", async () => {
    const { banco, estado, rodar } = await montar({ eu: null, pessoaDoApp: { id: EU, nome: "Maria", matricula: "123" } });
    await guardar(banco, "e1", 5);
    assert.equal((await rodar()).situacao, "enviou");
    assert.deepEqual(estado.enviados, ["e1"]);
  });

  it("sem sinal, a fila fica como estava e a tarefa conta como não concluída (o Android tenta no próximo intervalo)", async () => {
    const { banco, estado, rodar } = await montar({ semSinal: true });
    await guardar(banco, "e1", 5);
    const r = await rodar();
    assert.equal(r.ok, false);
    assert.equal(r.situacao === "ainda-pendente" && r.restantes, 1);
    assert.deepEqual(estado.enviados, []);
    assert.equal((await eventosPendentes(banco, EU)).length, 1, "nada se perde");
    assert.equal(estado.pulls, 0);
    // Na passada seguinte, com sinal, sobe tudo, sem duplicar.
    estado.semSinal = false;
    assert.equal((await rodar()).situacao, "enviou");
    assert.deepEqual(estado.enviados, ["e1"]);
  });
});

describe("o registro da última passada em segundo plano", () => {
  it("guarda quando a tarefa enviou (e quantos) ou tentou sem conseguir; as passadas sem nada a fazer não apagam o registro", async () => {
    const banco = await novoBancoDeTeste();
    assert.equal(await ultimaPassadaEmSegundoPlano(banco), null);
    await registrarPassadaEmSegundoPlano(banco, { situacao: "enviou", ok: true, confirmados: 3, recusados: 0 }, AGORA);
    assert.deepEqual(await ultimaPassadaEmSegundoPlano(banco), { em: AGORA.toISOString(), confirmados: 3, restantes: 0 });
    await registrarPassadaEmSegundoPlano(banco, { situacao: "nada-a-enviar", ok: true }, new Date(AGORA.getTime() + 60_000));
    await registrarPassadaEmSegundoPlano(banco, { situacao: "app-na-frente", ok: true }, new Date(AGORA.getTime() + 60_000));
    assert.equal((await ultimaPassadaEmSegundoPlano(banco))?.em, AGORA.toISOString());
    const depois = new Date(AGORA.getTime() + 15 * 60_000);
    await registrarPassadaEmSegundoPlano(banco, { situacao: "ainda-pendente", ok: false, confirmados: 1, restantes: 2, motivo: "sem sinal" }, depois);
    assert.deepEqual(await ultimaPassadaEmSegundoPlano(banco), { em: depois.toISOString(), confirmados: 1, restantes: 2 });
  });

  it("o texto do perfil diz o que aconteceu", () => {
    const em = AGORA.toISOString();
    assert.match(textoDoSegundoPlano(em, 3), /^Enviado com o app fechado às \d{2}:\d{2} \(3 registros\)$/);
    assert.match(textoDoSegundoPlano(em, 1), /\(1 registro\)$/);
    assert.match(textoDoSegundoPlano(em, 0), /^Tentativa com o app fechado às \d{2}:\d{2}, sem conseguir enviar$/);
  });
});
