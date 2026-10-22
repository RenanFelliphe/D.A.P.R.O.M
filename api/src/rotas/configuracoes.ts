import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { configuracao } from "../db/schema";
import type { Deps } from "../deps";
import { registrarAuditoria } from "../dominio/auditoria";
import { aplicarConfiguracoes, ehChaveDeConfiguracao, lerConfiguracoes, validarConfiguracao } from "../dominio/configuracoes";
import type { Autenticacao, Ambiente } from "../http/autenticacao";
import { naoEncontrado } from "../http/erros";
import { responder } from "../http/resposta";
import { lerCorpo } from "../http/validacao";

/**
 * As configurações do sistema (`docs/operacao-de-campo.md`, seção 13), só do admin: a cidade padrão da previsão do tempo, os horários das
 * rotinas e os limites de uso da IA. O valor mudado vale na hora (`aplicarConfiguracoes`) e cada mudança vai à trilha de auditoria.
 */
export function rotasConfiguracoes(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();

  r.get("/configuracoes/sistema", autenticar(), exigirPerfil("admin"), async (c) => responder(c, await lerConfiguracoes(deps)));

  r.put("/configuracoes/sistema/:chave", autenticar(), exigirPerfil("admin"), async (c) => {
    const chave = c.req.param("chave");
    if (!ehChaveDeConfiguracao(chave)) throw naoEncontrado("Configuração inexistente");
    const { valor } = await lerCorpo(c, z.object({ valor: z.unknown() }));
    const novo = validarConfiguracao(chave, valor);
    const [antes] = await deps.db.select().from(configuracao).where(eq(configuracao.chave, chave));
    const eu = c.get("usuario");
    await deps.db
      .insert(configuracao)
      .values({ chave, valor: novo.valor, atualizadoEm: deps.agora(), atualizadoPor: eu.id })
      .onConflictDoUpdate({ target: configuracao.chave, set: { valor: novo.valor, atualizadoEm: deps.agora(), atualizadoPor: eu.id } });
    await aplicarConfiguracoes(deps);
    await registrarAuditoria(deps.db, eu, {
      entidade: "configuracao",
      verbo: "alterar",
      entidadeId: chave,
      alvo: novo.rotulo,
      resumo: `Alterou a configuração "${novo.rotulo}"`,
      detalhes: { chave, de: antes?.valor ?? null, para: novo.valor },
    });
    return responder(c, await lerConfiguracoes(deps));
  });

  /** Volta ao padrão (o valor do ambiente, ou Vitória na cidade padrão). */
  r.delete("/configuracoes/sistema/:chave", autenticar(), exigirPerfil("admin"), async (c) => {
    const chave = c.req.param("chave");
    if (!ehChaveDeConfiguracao(chave)) throw naoEncontrado("Configuração inexistente");
    const [antes] = await deps.db.select().from(configuracao).where(eq(configuracao.chave, chave));
    if (antes) {
      await deps.db.delete(configuracao).where(eq(configuracao.chave, chave));
      await aplicarConfiguracoes(deps);
      const eu = c.get("usuario");
      await registrarAuditoria(deps.db, eu, {
        entidade: "configuracao",
        verbo: "restaurar",
        entidadeId: chave,
        alvo: chave,
        resumo: `Voltou a configuração "${chave}" ao padrão`,
        detalhes: { chave, de: antes.valor, para: null },
      });
    }
    return responder(c, await lerConfiguracoes(deps));
  });

  return r;
}
