import { eq, sql } from "drizzle-orm";
import { Hono, type MiddlewareHandler } from "hono";
import { z } from "zod";
import { leituraRh, usuario } from "../db/schema";
import type { Deps } from "../deps";
import { registrarAuditoria } from "../dominio/auditoria";
import { conferirParaCadastro, enfileirarConferencias, exigirSetorSupervisionado, ultimaLeituraRh } from "../dominio/rh";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { ErroApi, naoAutenticado } from "../http/erros";
import { responder } from "../http/resposta";
import { emailInstitucional, lerConsulta, lerCorpo } from "../http/validacao";
import { enfileirarTarefa } from "../servicos/fila";

const LIMITE_DE_MATRICULAS_POR_AVISO = 1000;

/**
 * Integração com o registro de funcionários (RH): a prévia do cadastro, o aviso de mudanças que o registro envia, a leitura sob
 * demanda ("Ler agora") e o estado da sincronização. A conferência em si (do aviso e da leitura) roda no executor de tarefas,
 * em `dominio/rh.ts`. Ver `docs/integracoes-simuladas.md`, seções 5.5 a 5.7.
 */
export function rotasRh(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();

  /**
   * Prévia do cadastro (etapa 1): consulta o registro e devolve nome, cargo, setor, CREA, situação, a equipe que o setor sugere
   * e se a pessoa já tem conta. Recusa pelas mesmas regras do `POST /usuarios`. O supervisor só vê quem é de um setor
   * cuja equipe ele supervisiona.
   */
  r.get("/rh/funcionarios/:matricula", autenticar(), exigirPerfil("admin", "supervisor"), async (c) => {
    const eu = c.get("usuario");
    const { email } = lerConsulta(c, z.object({ email: emailInstitucional }));
    const { funcionario: f, equipeSugerida } = await conferirParaCadastro(deps, c.req.param("matricula"), email);
    if (eu.perfil !== "admin") exigirSetorSupervisionado(eu, f, equipeSugerida);
    const [conta] = await deps.db.select({ id: usuario.id }).from(usuario).where(eq(sql`lower(${usuario.matricula})`, f.matricula.toLowerCase()));
    return responder(c, {
      funcionario: {
        matricula: f.matricula,
        nome: f.nome,
        cargo: f.cargo,
        centro_trabalho: f.centro_trabalho,
        setor: f.setor,
        registro_profissional: f.registro_profissional ?? null,
        situacao: f.situacao,
      },
      equipe_sugerida: equipeSugerida,
      conta_existente: Boolean(conta),
    });
  });

  /** O token que só o registro tem: `Authorization: Bearer {RH_AVISO_TOKEN}`. Sem token configurado, ninguém avisa. */
  const exigirTokenDeAviso: MiddlewareHandler = async (c, proximo) => {
    const cabecalho = c.req.header("Authorization") ?? "";
    const token = cabecalho.replace(/^Bearer\s*/, "").trim();
    if (!deps.config.rhAvisoToken || !/^Bearer(\s|$)/.test(cabecalho) || token !== deps.config.rhAvisoToken) throw naoAutenticado("Token de aviso inválido");
    await proximo();
  };

  /**
   * O aviso do registro: só a lista de matrículas a conferir, nunca uma decisão. Cada matrícula com conta vira uma tarefa
   * `conferencia_rh`, que consulta o registro e age pelo que ele responder: um aviso falso não desativa ninguém.
   */
  r.post("/rh/avisos", exigirTokenDeAviso, async (c) => {
    const { matriculas } = await lerCorpo(c, z.object({ matriculas: z.array(z.string().trim().min(1)).min(1).max(LIMITE_DE_MATRICULAS_POR_AVISO) }));
    const enfileiradas = await enfileirarConferencias(deps.db, matriculas, deps.agora());
    return responder(c, { enfileiradas }, 202);
  });

  /** "Ler agora": registra a leitura e enfileira a tarefa; quem lê é o executor de tarefas. */
  r.post("/rh/leituras", autenticar(), exigirPerfil("admin"), async (c) => {
    const eu = c.get("usuario");
    if (!deps.config.rhApiUrl) throw new ErroApi(503, "registro_indisponivel", "O registro de funcionários não está configurado");
    const leituraId = await deps.db.transaction(async (tx) => {
      const [criada] = await tx.insert(leituraRh).values({ origem: "manual", usuarioId: eu.id, iniciadaEm: deps.agora() }).returning({ id: leituraRh.id });
      await enfileirarTarefa(tx, "leitura_rh", criada!.id, deps.agora());
      return criada!.id;
    });
    await registrarAuditoria(deps.db, eu, { entidade: "rh", verbo: "leitura", entidadeId: leituraId, resumo: "Pediu a leitura imediata do registro de funcionários" });
    return responder(c, { leituraId }, 202);
  });

  /** Estado da sincronização: a última leitura e o resultado, e se a leitura diária está ligada. */
  r.get("/rh/sincronizacao", autenticar(), exigirPerfil("admin"), async (c) => {
    return responder(c, {
      ultimaLeitura: await ultimaLeituraRh(deps.db),
      // Sem `RH_API_URL` a leitura diária não roda e o cadastro responde 503.
      configurado: Boolean(deps.config.rhApiUrl),
      leituraHora: deps.config.rhLeituraHora,
    });
  });

  return r;
}
