import { Hono, type MiddlewareHandler } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import {
  agirEmMassaNasOrdens,
  catalogoDoSimuladorSap,
  criarAleatorias,
  criarOrdem,
  editarOrdem,
  esquemaEdicaoDeOrdem,
  esquemaEmMassaDeOrdens,
  esquemaListaDeOrdens,
  esquemaLotesDeOrdens,
  esquemaNovaOrdem,
  excluirOrdem,
  listarOrdens,
  obterOrdemSimulada,
  paginaDoContrato,
  paraContrato,
} from "../dominio/sap-simulado";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { naoAutenticado, naoEncontrado } from "../http/erros";
import { responder } from "../http/resposta";
import { lerConsulta, lerCorpo } from "../http/validacao";

const esquemaConsulta = z.object({
  alteradas_desde: z
    .string()
    .datetime({ offset: true })
    .transform((v) => new Date(v))
    .optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  tamanho: z.coerce.number().int().min(1).max(200).default(50),
});

/**
 * Simulador da API do SAP, só montado com `SAP_SIMULADO=true` (em `/sap-simulado`). Tem duas partes:
 * - **Contrato** (`GET /ordens`, `GET /ordens/{numero_ordem}`), com `Authorization: Bearer <SAP_API_TOKEN>`: o que o SYNQ OS lê, no mesmo
 *   formato do contrato. É só leitura;
 * - **Gestão** (`/gestao/...`), com o admin logado no SYNQ OS: o CRUD das ordens que a tela `/simulador/ordens` usa, com criação manual
 *   e aleatória, edição, exclusão e ações em massa.
 * As ordens ficam na tabela `ordem_sap_simulada`, no banco do SYNQ OS, e o que `alteradas_desde` filtra é a `alterada_em` dela. Ver `apiSAP.md`.
 */
export function rotasSapSimulado(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();
  const admin = [autenticar(), exigirPerfil("admin")] as const;

  const exigirToken: MiddlewareHandler = async (c, proximo) => {
    const cabecalho = c.req.header("Authorization") ?? "";
    if (!/^Bearer(\s|$)/.test(cabecalho) || cabecalho.replace(/^Bearer\s*/, "").trim() !== deps.config.sapApiToken) throw naoAutenticado("Token do SAP inválido");
    await proximo();
  };
  r.use("/ordens", exigirToken);
  r.use("/ordens/*", exigirToken);

  // ---- contrato ----
  r.get("/ordens", async (c) => {
    const { alteradas_desde, pagina, tamanho } = lerConsulta(c, esquemaConsulta);
    return c.json(await paginaDoContrato(deps.db, { ...(alteradas_desde ? { alteradasDesde: alteradas_desde } : {}), pagina, tamanho }));
  });

  r.get("/ordens/:numero", async (c) => {
    const o = await obterOrdemSimulada(deps.db, c.req.param("numero"));
    if (!o) throw naoEncontrado("Ordem não encontrada");
    return c.json(paraContrato(o));
  });

  // ---- gestão ----
  r.get("/gestao/ordens", ...admin, async (c) => {
    const filtros = lerConsulta(c, esquemaListaDeOrdens);
    const { ordens, total, contagem, totalGeral } = await listarOrdens(deps.db, filtros);
    return responder(c, { ordens, total, pagina: filtros.pagina, tamanho: filtros.tamanho, contagem, totalGeral });
  });

  r.get("/gestao/catalogo", ...admin, async (c) => responder(c, await catalogoDoSimuladorSap(deps.db)));

  r.post("/gestao/ordens", ...admin, async (c) => {
    const dados = await lerCorpo(c, esquemaNovaOrdem);
    return responder(c, { ordem: paraContrato(await criarOrdem(deps.db, dados, deps.agora())) }, 201);
  });

  r.post("/gestao/ordens/aleatorias", ...admin, async (c) => {
    const corpo = await lerCorpo(c, esquemaLotesDeOrdens);
    return responder(c, { criadas: await criarAleatorias(deps.db, corpo, deps.agora()) }, 201);
  });

  r.post("/gestao/ordens/em-massa", ...admin, async (c) => {
    const corpo = await lerCorpo(c, esquemaEmMassaDeOrdens);
    return responder(c, await agirEmMassaNasOrdens(deps.db, corpo, deps.agora()));
  });

  r.patch("/gestao/ordens/:numero", ...admin, async (c) => {
    const dados = await lerCorpo(c, esquemaEdicaoDeOrdem);
    return responder(c, { ordem: paraContrato(await editarOrdem(deps.db, c.req.param("numero"), dados, deps.agora())) });
  });

  r.delete("/gestao/ordens/:numero", ...admin, async (c) => {
    await excluirOrdem(deps.db, c.req.param("numero"));
    return responder(c, {});
  });

  return r;
}
