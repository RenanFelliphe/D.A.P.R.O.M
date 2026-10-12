import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import { OS_STATUS, OS_TIPOS } from "../db/schema";
import { resumoDasAprs } from "../dominio/apr-resumo";
import { registrarAuditoria, rotuloDaOs } from "../dominio/auditoria";
import { dashboardDeEquipes, dashboardDeOs, dashboardGeral } from "../dominio/dashboards";
import { exportarParaSap, MENSAGEM_SEM_NOVAS, nomeDoArquivo, TIPO_XLSX } from "../dominio/painel-exportacao";
import { equipeDoIndicador, historicoDoLocal, indicadoresDeTempo, indicadoresMensais } from "../dominio/painel-indicadores";
import { darCiencia, detalharOs, listarAprsDaOs, listarOs } from "../dominio/painel-os";
import { esquemaPeriodo } from "../dominio/periodo";
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
        exportada: booleanoDaConsulta,
        numero_ordem: z.string().trim().min(1).optional(),
        busca: z.string().trim().min(1).optional(),
        ordem: z.enum(["prioridade", "data_limite"]).optional(),
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
    const eu = c.get("usuario");
    const id = lerId(c);
    const resultado = await darCiencia(deps.db, eu, id, deps.agora());
    const rotulo = await rotuloDaOs(deps.db, id);
    await registrarAuditoria(deps.db, eu, { entidade: "os", verbo: "ciencia", entidadeId: id, alvo: rotulo, resumo: `Deu ciência da ${rotulo}` });
    return responder(c, resultado);
  });

  r.get("/indicadores", autenticar(), exigirPerfil("supervisor", "admin"), async (c) => {
    const f = lerConsulta(c, z.object({ mes, equipe_id: uuid.optional() }));
    return responder(c, await indicadoresMensais(deps.db, c.get("usuario"), f, deps.agora()));
  });

  r.get("/indicadores/tempo", autenticar(), exigirPerfil("supervisor", "admin"), async (c) => {
    const f = lerConsulta(c, z.object({ mes, equipe_id: uuid.optional(), usuario_id: uuid.optional() }));
    return responder(c, await indicadoresDeTempo(deps.db, c.get("usuario"), f));
  });

  // ---- Dashboards de Indicadores e exportação ---------------------------------------------------------------------
  // Todos com o mesmo filtro: `?periodo=7d|30d|90d|12m|AAAA-MM` (30 dias se ausente) e `?equipe_id=`. O supervisor só
  // vê a própria equipe (pedir outra é `403`); os demais perfis de gestão veem todas.

  const gestao = exigirPerfil("supervisor", "admin");
  const lerFiltro = (c: Parameters<typeof lerConsulta>[0]) => {
    const f = lerConsulta(c, z.object({ periodo: esquemaPeriodo, equipe_id: uuid.optional() }));
    return { periodo: f.periodo, equipeId: equipeDoIndicador(c.get("usuario"), f.equipe_id) };
  };

  /** Dashboard geral: a carteira de agora, o resumo do período e as pendências. */
  r.get("/indicadores/geral", autenticar(), gestao, async (c) => {
    return responder(c, await dashboardGeral(deps.db, c.get("usuario"), lerFiltro(c), deps.agora()));
  });

  /** Dashboard de OS: carteira, programadas e encerradas, preventivas, tempo, interrupções, reprogramações e locais. */
  r.get("/indicadores/os", autenticar(), gestao, async (c) => {
    return responder(c, await dashboardDeOs(deps.db, c.get("usuario"), lerFiltro(c), deps.agora()));
  });

  /** Dashboard de equipes e usuários: por equipe e por técnico; o estado do cadastro só para o admin. */
  r.get("/indicadores/equipes", autenticar(), gestao, async (c) => {
    const eu = c.get("usuario");
    return responder(c, await dashboardDeEquipes(deps.db, eu, { ...lerFiltro(c), comCadastro: eu.perfil === "admin" }, deps.agora()));
  });

  /**
   * Dashboard de APR: respondidas, aprovadas e bloqueadas por faixa, itens que mais bloqueiam, alertas mais registrados,
   * APRs por modelo e por equipe (a da OS).
   */
  r.get("/aprs/resumo", autenticar(), gestao, async (c) => {
    return responder(c, await resumoDasAprs(deps.db, c.get("usuario"), lerFiltro(c), deps.agora()));
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
  r.post("/exportacoes/sap", autenticar(), exigirPerfil("admin"), async (c) => {
    const agora = deps.agora();
    const { planilha, novas } = await exportarParaSap(deps.db, deps.config.painelUrl, agora);
    const cabecalhos: Record<string, string> = {
      "Content-Type": TIPO_XLSX,
      "Content-Disposition": `attachment; filename="${nomeDoArquivo(agora)}"`,
    };
    if (novas === 0) cabecalhos["X-Mensagem"] = MENSAGEM_SEM_NOVAS;
    await registrarAuditoria(deps.db, c.get("usuario"), {
      entidade: "exportacao",
      verbo: "sap",
      alvo: nomeDoArquivo(agora),
      resumo: novas === 0 ? "Gerou a planilha de baixa do SAP (nenhuma OS nova)" : `Exportou a planilha de baixa do SAP com ${novas} OS encerradas`,
      detalhes: { os_exportadas: novas },
    });
    return c.body(new Uint8Array(planilha), 200, cabecalhos);
  });

  return r;
}
