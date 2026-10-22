import { and, eq, gte, inArray } from "drizzle-orm";
import { ROTULO_DO_AVISO } from "../../../shared/notificacoes/avisos";
import { corpoDoPush, PUSH_DO_AVISO, type DadosDoPush, type RegistroDeDispositivo } from "../../../shared/notificacoes/push";
import type { Db } from "../db/conexao";
import { alerta, dispositivoPush, usuario } from "../db/schema";
import type { Deps } from "../deps";

/** O token que o app não confirma há tanto tempo é de um aparelho que deixou de ser usado: não recebe mais. */
export const DIAS_SEM_CONFIRMAR_O_TOKEN = 120;

/**
 * Registra o aparelho de quem pede (`POST /me/dispositivos`). O token é do aparelho: se ele já era de outra pessoa (o aparelho
 * trocou de mãos sem a saída ter chegado à `api`), passa para quem entrou agora. Repetir não muda nada além da confirmação.
 */
export async function registrarDispositivo(db: Db, usuarioId: string, d: RegistroDeDispositivo, agora: Date): Promise<void> {
  await db
    .insert(dispositivoPush)
    .values({ usuarioId, token: d.token, plataforma: d.plataforma, registradoEm: agora, confirmadoEm: agora })
    .onConflictDoUpdate({ target: dispositivoPush.token, set: { usuarioId, plataforma: d.plataforma, confirmadoEm: agora } });
}

/** Tira o aparelho de quem pede (`DELETE /me/dispositivos`): ao sair, ou ao desligar as notificações. O token de outra pessoa não se mexe. */
export async function removerDispositivo(db: Db, usuarioId: string, token: string): Promise<void> {
  await db.delete(dispositivoPush).where(and(eq(dispositivoPush.token, token), eq(dispositivoPush.usuarioId, usuarioId)));
}

/** Os dados que a notificação leva (`DadosDoPush`): o que o app precisa para abrir a tela do aviso. */
export const dadosDoPush = (a: Pick<typeof alerta.$inferSelect, "id" | "tipo" | "osId" | "destinatarioId" | "usuarioAlvoId" | "sugestaoMateriaisId">): DadosDoPush => ({
  alerta_id: a.id,
  tipo: a.tipo,
  os_id: a.osId,
  destinatario_id: a.destinatarioId,
  usuario_alvo_id: a.usuarioAlvoId,
  sugestao_id: a.sugestaoMateriaisId,
});

/**
 * Tarefa `push_alerta`: `referenciaId` é o `alerta.id`. Manda a notificação a todos os aparelhos da pessoa quando: há serviço de push, o
 * tipo toca no celular (`PUSH_DO_AVISO`), a pessoa está ativa e liberada e o aviso ainda não foi lido (o convite respondido, a OS já
 * assinada: o aviso some do "não lido" e a notificação atrasada não faz sentido). Sem aparelho registrado, termina sem enviar: o aviso
 * continua no sino. O token que o serviço recusa (aparelho que desinstalou o app) é apagado. Falha do serviço lança: a tarefa repete.
 */
export async function manipularPushAlerta(deps: Deps, tarefa: { referenciaId: string | null }): Promise<void> {
  if (!tarefa.referenciaId) throw new Error("Tarefa push_alerta sem referência ao alerta");
  if (!deps.push.configurado) return;
  const { db } = deps;

  const [a] = await db.select().from(alerta).where(eq(alerta.id, tarefa.referenciaId));
  const config = a ? PUSH_DO_AVISO[a.tipo] : undefined;
  if (!a || !config || a.lidoEm !== null) return;

  const [pessoa] = await db.select({ ativo: usuario.ativo, liberacao: usuario.liberacao }).from(usuario).where(eq(usuario.id, a.destinatarioId));
  if (!pessoa?.ativo || pessoa.liberacao !== "liberado") return;

  const limite = new Date(deps.agora().getTime() - DIAS_SEM_CONFIRMAR_O_TOKEN * 86_400_000);
  const aparelhos = await db
    .select({ token: dispositivoPush.token })
    .from(dispositivoPush)
    .where(and(eq(dispositivoPush.usuarioId, a.destinatarioId), gte(dispositivoPush.confirmadoEm, limite)));
  if (aparelhos.length === 0) return;

  const titulo = ROTULO_DO_AVISO[a.tipo];
  const corpo = corpoDoPush(a.detalhe);
  const dados = dadosDoPush(a);
  const resultados = await deps.push.enviar(aparelhos.map((d) => ({ token: d.token, titulo, corpo, dados: { ...dados }, canal: config.canal, validadeS: config.validadeS })));

  const invalidos = resultados.filter((r) => r.situacao === "token_invalido").map((r) => r.token);
  if (invalidos.length > 0) await db.delete(dispositivoPush).where(inArray(dispositivoPush.token, invalidos));
}

/** Quantos aparelhos a pessoa tem registrados (para a tela de configurações dizer se as notificações estão ligadas). */
export async function aparelhosDe(db: Db, usuarioId: string): Promise<number> {
  return (await db.select({ id: dispositivoPush.id }).from(dispositivoPush).where(eq(dispositivoPush.usuarioId, usuarioId))).length;
}

