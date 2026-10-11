import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import { esquemaOrdem } from "../dominio/importacao-ordens";
import { conflito, ErroApi, naoAutenticado, naoEncontrado } from "../http/erros";
import { lerCorpo, lerConsulta } from "../http/validacao";
import type { OrdemSap } from "../servicos/sap";
import fixtures from "../../fixtures/sap/ordens.json" with { type: "json" };

interface OrdemGuardada {
  ordem: OrdemSap;
  /** Campo interno, não faz parte do contrato: o que `alteradas_desde` filtra. */
  alteradaEm: Date;
}

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
 * Simulador da API do SAP, só montado com `SAP_SIMULADO=true` (em `/sap-simulado`). Fala o mesmo contrato da API real
 * (`GET /ordens`, `GET /ordens/{numero_ordem}`), mais duas rotas só dele para a demonstração: `POST /ordens` injeta uma
 * OS e `PATCH /ordens/{numero_ordem}` muda o status (por exemplo, para mostrar uma OS cancelada). Não tem login de
 * usuário, mas exige `Authorization: Bearer <SAP_API_TOKEN>`, como o SAP. As ordens vivem na memória do processo, a
 * partir de `fixtures/sap/ordens.json` (dados fictícios); reiniciar a `api` volta ao estado das fixtures.
 */
export function rotasSapSimulado(deps: Deps) {
  const r = new Hono();
  const inicial = new Date();
  const ordens = new Map<string, OrdemGuardada>();
  for (const o of fixtures as OrdemSap[]) {
    ordens.set(o.numero_ordem, { ordem: structuredClone(o), alteradaEm: o.criada_em ? new Date(o.criada_em) : inicial });
  }

  r.use("*", async (c, proximo) => {
    const cabecalho = c.req.header("Authorization") ?? "";
    if (!/^Bearer(\s|$)/.test(cabecalho) || cabecalho.replace(/^Bearer\s*/, "").trim() !== deps.config.sapApiToken) throw naoAutenticado("Token do SAP inválido");
    await proximo();
  });

  r.get("/ordens", (c) => {
    const { alteradas_desde, pagina, tamanho } = lerConsulta(c, esquemaConsulta);
    const filtradas = [...ordens.values()]
      .filter((o) => !alteradas_desde || o.alteradaEm >= alteradas_desde)
      .sort((a, b) => a.ordem.numero_ordem.localeCompare(b.ordem.numero_ordem));
    const inicio = (pagina - 1) * tamanho;
    return c.json({
      ordens: filtradas.slice(inicio, inicio + tamanho).map((o) => o.ordem),
      ...(inicio + tamanho < filtradas.length ? { proxima_pagina: pagina + 1 } : {}),
    });
  });

  r.get("/ordens/:numero", (c) => {
    const o = ordens.get(c.req.param("numero"));
    if (!o) throw naoEncontrado("Ordem não encontrada");
    return c.json(o.ordem);
  });

  r.post("/ordens", async (c) => {
    const corpo = await lerCorpo(c, esquemaOrdem);
    if (ordens.has(corpo.numero_ordem)) throw conflito("ordem_duplicada", "Ordem já existe no simulador");
    // Guarda no formato do contrato (texto vazio como nulo, datas só com o dia).
    const ordem: OrdemSap = {
      numero_ordem: corpo.numero_ordem,
      numero_nota: corpo.numero_nota ?? null,
      tipo_ordem: corpo.tipo_ordem,
      tipo_atividade: corpo.tipo_atividade ?? null,
      codigo_atividade: corpo.codigo_atividade ?? null,
      titulo: corpo.titulo,
      descricao: corpo.descricao ?? null,
      centro_trabalho: corpo.centro_trabalho,
      local_instalacao: {
        codigo: corpo.local_instalacao.codigo,
        endereco: corpo.local_instalacao.endereco ?? null,
        plus_code: corpo.local_instalacao.plus_code ?? null,
        cliente: corpo.local_instalacao.cliente ?? null,
      },
      equipamento: corpo.equipamento ?? null,
      prioridade: corpo.prioridade ?? null,
      data_inicio_prog: corpo.data_inicio_prog,
      data_fim_prog: corpo.data_fim_prog ?? null,
      status_sap: corpo.status_sap ?? null,
      solicitante: corpo.solicitante ?? null,
      criado_por: corpo.criado_por ?? null,
      criada_em: corpo.criada_em ?? deps.agora().toISOString(),
      plano_manutencao: corpo.plano_manutencao ?? null,
      item_manutencao: corpo.item_manutencao ?? null,
    };
    ordens.set(ordem.numero_ordem, { ordem, alteradaEm: deps.agora() });
    return c.json(ordem, 201);
  });

  r.patch("/ordens/:numero", async (c) => {
    const { status_sap } = await lerCorpo(c, z.object({ status_sap: z.string().trim() }));
    const o = ordens.get(c.req.param("numero"));
    if (!o) throw new ErroApi(404, "nao_encontrado", "Ordem não encontrada");
    o.ordem.status_sap = status_sap;
    o.alteradaEm = deps.agora();
    return c.json(o.ordem);
  });

  return r;
}
