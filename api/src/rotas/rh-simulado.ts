import { Hono, type MiddlewareHandler } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import {
  agirEmMassa,
  catalogoDoSimulador,
  criarAleatorios,
  criarFuncionario,
  criarRapido,
  editarFuncionario,
  esquemaCriacaoRapida,
  esquemaEdicaoFuncionario,
  esquemaEmMassa,
  esquemaLotes,
  esquemaNovoFuncionario,
  excluirFuncionario,
  listarFuncionarios,
  obterFuncionarioSimulado,
  paginaDoContrato,
  paraContrato,
} from "../dominio/rh-simulado";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { naoAutenticado, naoEncontrado } from "../http/erros";
import { esquemaPaginacao } from "../http/paginacao";
import { responder } from "../http/resposta";
import { lerConsulta, lerCorpo } from "../http/validacao";

/** Como o simulador avisa o SYNQ OS de que estas matrículas mudaram (`POST /rh/avisos`). Não lança: falhar só vai ao log. */
export type EnviarAvisoRh = (matriculas: string[]) => Promise<void>;

const TEMPO_LIMITE_AVISO_MS = 10_000;

/** O aviso real do simulador: `POST {RH_AVISO_URL}` com `Authorization: Bearer {RH_AVISO_TOKEN}`; se falhar, a leitura diária cobre. */
export function avisoPorHttp(deps: Deps, buscar: typeof fetch = fetch): EnviarAvisoRh {
  return async (matriculas) => {
    if (matriculas.length === 0) return;
    const { rhAvisoUrl, rhAvisoToken } = deps.config;
    if (!rhAvisoUrl) return;
    try {
      const r = await buscar(rhAvisoUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${rhAvisoToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ matriculas }),
        signal: AbortSignal.timeout(TEMPO_LIMITE_AVISO_MS),
      });
      if (!r.ok) console.warn(`Aviso de desligamento ao SYNQ OS: respondeu ${r.status}`);
    } catch (erro) {
      console.warn(`Aviso de desligamento ao SYNQ OS não enviado: ${erro instanceof Error ? erro.message : String(erro)}`);
    }
  };
}

const esquemaConsultaContrato = esquemaPaginacao;
const esquemaBusca = esquemaPaginacao.extend({ busca: z.string().trim().min(1).optional() });

/**
 * Simulador do registro de funcionários (RH), só montado com `RH_SIMULADO=true` (em `/rh-simulado`). Tem duas partes:
 * - **Contrato** (`GET /funcionarios`, `GET /funcionarios/{matricula}`), com `Authorization: Bearer <RH_API_TOKEN>`: o que o
 *   SYNQ OS lê;
 * - **Gestão** (`/gestao/...`), com o admin logado no SYNQ OS: o CRUD que a tela `/simulador/funcionarios` usa. Quando um
 *   funcionário passa a desligado, o simulador avisa o SYNQ OS (`enviarAviso`).
 * Os dados ficam na tabela `funcionario_simulado`, no banco do SYNQ OS. Ver `docs/integracoes-simuladas.md`, seção 5.9.
 */
export function rotasRhSimulado(deps: Deps, { autenticar, exigirPerfil }: Autenticacao, enviarAviso: EnviarAvisoRh) {
  const r = new Hono<Ambiente>();
  const admin = [autenticar(), exigirPerfil("admin")] as const;

  const exigirToken: MiddlewareHandler = async (c, proximo) => {
    const cabecalho = c.req.header("Authorization") ?? "";
    if (!/^Bearer(\s|$)/.test(cabecalho) || cabecalho.replace(/^Bearer\s*/, "").trim() !== deps.config.rhApiToken) throw naoAutenticado("Token do registro de funcionários inválido");
    await proximo();
  };
  r.use("/funcionarios", exigirToken);
  r.use("/funcionarios/*", exigirToken);

  // ---- contrato ----
  r.get("/funcionarios", async (c) => {
    const { pagina, tamanho } = lerConsulta(c, esquemaConsultaContrato);
    return c.json(await paginaDoContrato(deps.db, pagina, tamanho));
  });

  r.get("/funcionarios/:matricula", async (c) => {
    const f = await obterFuncionarioSimulado(deps.db, c.req.param("matricula"));
    if (!f) throw naoEncontrado("Funcionário não encontrado");
    return c.json(paraContrato(f));
  });

  // ---- gestão ----
  r.get("/gestao/funcionarios", ...admin, async (c) => {
    const filtros = lerConsulta(c, esquemaBusca);
    const { funcionarios, total, contagem } = await listarFuncionarios(deps.db, filtros);
    return responder(c, { funcionarios, total, pagina: filtros.pagina, tamanho: filtros.tamanho, contagem });
  });

  r.get("/gestao/catalogo", ...admin, async (c) => responder(c, await catalogoDoSimulador(deps.db)));

  r.post("/gestao/funcionarios", ...admin, async (c) => {
    const dados = await lerCorpo(c, esquemaNovoFuncionario);
    return responder(c, { funcionario: await criarFuncionario(deps.db, dados, deps.agora()) }, 201);
  });

  // Criação rápida: nome, e-mail e, opcionalmente, o setor; o resto é sorteado.
  r.post("/gestao/funcionarios/rapido", ...admin, async (c) => {
    const dados = await lerCorpo(c, esquemaCriacaoRapida);
    return responder(c, { funcionario: await criarRapido(deps.db, dados, deps.agora()) }, 201);
  });

  r.post("/gestao/funcionarios/aleatorios", ...admin, async (c) => {
    const { lotes } = await lerCorpo(c, esquemaLotes);
    return responder(c, { criados: await criarAleatorios(deps.db, lotes, deps.agora()) }, 201);
  });

  r.post("/gestao/funcionarios/em-massa", ...admin, async (c) => {
    const corpo = await lerCorpo(c, esquemaEmMassa);
    const { desligados, ...resultado } = await agirEmMassa(deps.db, corpo, deps.agora());
    if (desligados.length > 0) await enviarAviso(desligados);
    return responder(c, resultado);
  });

  r.patch("/gestao/funcionarios/:matricula", ...admin, async (c) => {
    const dados = await lerCorpo(c, esquemaEdicaoFuncionario);
    const { funcionario, virouDesligado } = await editarFuncionario(deps.db, c.req.param("matricula"), dados, deps.agora());
    if (virouDesligado) await enviarAviso([funcionario.matricula]);
    return responder(c, { funcionario });
  });

  r.delete("/gestao/funcionarios/:matricula", ...admin, async (c) => {
    await excluirFuncionario(deps.db, c.req.param("matricula"));
    return responder(c, {});
  });

  return r;
}
