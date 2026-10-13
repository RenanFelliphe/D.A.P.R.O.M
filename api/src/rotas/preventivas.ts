import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import { diferencas, registrarAuditoria } from "../dominio/auditoria";
import {
  SITUACOES_DO_CICLO,
  detalharPlano,
  editarPlano,
  esquemaEdicaoDoPlano,
  listarPlanos,
  planoDaOs,
  rotuloDoPlano,
  verificarCiclos,
} from "../dominio/preventivas";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { naoEncontrado } from "../http/erros";
import { responder } from "../http/resposta";
import { lerConsulta, lerCorpo, lerId, uuid } from "../http/validacao";

/**
 * Intervalo entre ciclos das preventivas: os planos com a contagem até o próximo ciclo (`/preventivas`), o histórico de
 * cada um e a definição do intervalo. Todo perfil lê o que é do próprio escopo (a equipe da última OS do plano); só o admin
 * e o supervisor da equipe definem o intervalo. O sistema não cria OS: os alertas do ciclo saem em `verificarCiclos`.
 */
export function rotasPreventivas(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();

  r.get("/preventivas", autenticar(), async (c) => {
    const f = lerConsulta(
      c,
      z.object({
        situacao: z.enum(SITUACOES_DO_CICLO).optional(),
        equipe_id: uuid.optional(),
        busca: z.string().trim().min(1).optional(),
      }),
    );
    return responder(c, await listarPlanos(deps.db, c.get("usuario"), f, deps.agora()));
  });

  r.get("/preventivas/:id", autenticar(), async (c) => {
    return responder(c, await detalharPlano(deps.db, c.get("usuario"), lerId(c), deps.agora()));
  });

  /** O plano da OS preventiva (para o detalhe da OS); `404` quando a OS não é preventiva de plano ou não é visível. */
  r.get("/os/:id/preventiva", autenticar(), async (c) => {
    const plano = await planoDaOs(deps.db, c.get("usuario"), lerId(c), deps.agora());
    if (!plano) throw naoEncontrado("A OS não pertence a um plano de preventiva");
    return responder(c, plano);
  });

  /**
   * Define o intervalo (`{quantidade, unidade}` ou `null`), de onde o ciclo é contado, a antecedência do aviso, a pausa e a
   * observação. Só os campos enviados mudam. Depois confere o ciclo: o vencimento novo pode pedir um alerta já.
   */
  r.put("/preventivas/:id", autenticar(), exigirPerfil("supervisor", "admin"), async (c) => {
    const id = lerId(c);
    const dados = await lerCorpo(c, esquemaEdicaoDoPlano);
    const eu = c.get("usuario");
    const { antes, depois, plano } = await editarPlano(deps.db, eu, id, dados, deps.agora());
    const mudancas = diferencas(antes, depois);
    const campos = Object.keys(mudancas);
    if (campos.length > 0) {
      const rotulo = rotuloDoPlano(plano);
      const soAtivo = campos.length === 1 && "ativo" in mudancas;
      await registrarAuditoria(deps.db, eu, {
        entidade: "plano_preventiva",
        verbo: soAtivo ? (plano.ativo ? "retomar" : "pausar") : "editar",
        entidadeId: id,
        alvo: plano.titulo ?? `Plano ${plano.planoManutencao}`,
        resumo: soAtivo
          ? `${plano.ativo ? "Retomou" : "Pausou"} o ciclo da preventiva ${rotulo}`
          : "intervalo" in mudancas && campos.length === 1
            ? plano.intervaloDescricao
              ? `Definiu o intervalo da preventiva ${rotulo}: ${plano.intervaloDescricao}`
              : `Tirou o intervalo da preventiva ${rotulo}`
            : `Editou o ciclo da preventiva ${rotulo} (${campos.join(", ")})`,
        detalhes: mudancas,
      });
    }
    await verificarCiclos(deps.db, deps.agora(), [id]);
    return responder(c, await detalharPlano(deps.db, eu, id, deps.agora()));
  });

  return r;
}
