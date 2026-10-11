import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import { OS_STATUS, OS_TIPOS } from "../db/schema";
import { exportarParaSap, MENSAGEM_SEM_NOVAS, nomeDoArquivo, TIPO_XLSX } from "../dominio/painel-exportacao";
import { historicoDoLocal, indicadoresDeTempo, indicadoresMensais } from "../dominio/painel-indicadores";
import { darCiencia, detalharOs, listarAprsDaOs, listarOs } from "../dominio/painel-os";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { esquemaPaginacao, meta } from "../http/paginacao";
import { responder } from "../http/resposta";
import { booleanoDaConsulta, lerConsulta, lerId, uuid } from "../http/validacao";

/** `AAAA-MM`, com mês de 01 a 12. */
const mes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use o formato AAAA-MM");

/**
 * Painel de gestão: quadro e detalhe da OS, ciência do supervisor, indicadores, histórico por local e a planilha de
 * baixa do SAP. Quem não vê a equipe de uma OS recebe `404` ao abrir o detalhe, como se ela não existisse.
 */
export function rotasPainel(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();

  r.get("/os", autenticar(), async (c) => {
    const filtros = lerConsulta(
      c,
      esquemaPaginacao.extend({
        equipe_id: uuid.optional(),
        tipo: z.enum(OS_TIPOS).optional(),
        critica: booleanoDaConsulta,
        periodo: mes.optional(),
        status: z.enum(OS_STATUS).optional(),
        numero_ordem: z.string().trim().min(1).optional(),
        busca: z.string().trim().min(1).optional(),
      }),
    );
    const { itens, total, contagemPorStatus } = await listarOs(deps.db, c.get("usuario"), filtros, deps.agora());
    return responder(c, { os: itens, contagemPorStatus, ...meta(filtros, total) });
  });

  r.get("/os/:id", autenticar(), async (c) => {
    return responder(c, await detalharOs(deps.db, c.get("usuario"), lerId(c), deps.agora()));
  });

  r.get("/os/:id/aprs", autenticar(), async (c) => {
    return responder(c, { aprs: await listarAprsDaOs(deps.db, c.get("usuario"), lerId(c)) });
  });

  r.post("/os/:id/ciencia", autenticar(), exigirPerfil("supervisor"), async (c) => {
    return responder(c, await darCiencia(deps.db, c.get("usuario"), lerId(c), deps.agora()));
  });

  r.get("/indicadores", autenticar(), exigirPerfil("supervisor", "analista", "seguranca", "admin"), async (c) => {
    const f = lerConsulta(c, z.object({ mes, equipe_id: uuid.optional() }));
    return responder(c, await indicadoresMensais(deps.db, c.get("usuario"), f, deps.agora()));
  });

  r.get("/indicadores/tempo", autenticar(), exigirPerfil("supervisor", "analista", "seguranca", "admin"), async (c) => {
    const f = lerConsulta(c, z.object({ mes, equipe_id: uuid.optional(), usuario_id: uuid.optional() }));
    return responder(c, await indicadoresDeTempo(deps.db, c.get("usuario"), f));
  });

  r.get("/historico", autenticar(), async (c) => {
    const f = lerConsulta(c, esquemaPaginacao.extend({ local_instalacao_id: uuid, equipamento: z.string().trim().min(1).optional() }));
    const { itens, total } = await historicoDoLocal(deps.db, c.get("usuario"), f);
    return responder(c, { execucoes: itens, ...meta(f, total) });
  });

  /**
   * Sem OS nova em `Encerradas` e `Sem ordem SAP` a resposta continua `200` (não `204`, para o cliente sempre receber
   * um arquivo válido) com as abas só de cabeçalho — e `Impedimentos`, que não depende de exportação anterior —,
   * mais o cabeçalho `X-Mensagem` para a tela avisar.
   */
  r.post("/exportacoes/sap", autenticar(), exigirPerfil("analista", "admin"), async (c) => {
    const agora = deps.agora();
    const { planilha, novas } = await exportarParaSap(deps.db, deps.config.painelUrl, agora);
    const cabecalhos: Record<string, string> = {
      "Content-Type": TIPO_XLSX,
      "Content-Disposition": `attachment; filename="${nomeDoArquivo(agora)}"`,
    };
    if (novas === 0) cabecalhos["X-Mensagem"] = MENSAGEM_SEM_NOVAS;
    return c.body(new Uint8Array(planilha), 200, cabecalhos);
  });

  return r;
}
