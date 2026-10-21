/**
 * Corrige o GPS das execuções de demonstração (OS 5100xxx) já gravadas no banco configurado em `.env`/`.env.local`: o seed
 * antigo pôs todas no mesmo ponto, e o mapa de calor mostrava uma mancha só. Cada execução passa a ficar perto do local
 * de instalação da OS, no mesmo ponto que o seed atual escolhe (`src/db/seed/posicoes-demo.ts`). Só mexe em posições que
 * já existem (uma execução sem GPS continua sem) e pode rodar de novo sem mudar nada.
 *
 *   pnpm demo:espalhar-gps
 *
 * Nunca toca em OS fora do prefixo da demonstração.
 */
import { and, asc, eq, isNotNull, like } from "drizzle-orm";
import { lerConfig } from "../src/config";
import { conectar } from "../src/db/conexao";
import { evidencia, execucao, execucaoPausa, localInstalacao, os } from "../src/db/schema";
import { posicaoDaDemo } from "../src/db/seed/posicoes-demo";

const config = lerConfig();
const { pool, db } = conectar(config.databaseUrl);
try {
  const execucoes = await db
    .select({ id: execucao.id, numero: os.numeroOrdem, local: localInstalacao.codigo, inicio: execucao.inicioLatitude, fim: execucao.fimLatitude })
    .from(execucao)
    .innerJoin(os, eq(os.id, execucao.osId))
    .leftJoin(localInstalacao, eq(localInstalacao.id, os.localInstalacaoId))
    .where(like(os.numeroOrdem, "5100%"));

  const contagem = { execucoes: 0, pausas: 0, fotos: 0 };
  await db.transaction(async (tx) => {
    for (const ex of execucoes) {
      const gps = (deslocamento = 0) => posicaoDaDemo(ex.local, ex.numero ?? ex.id, deslocamento);
      if (ex.inicio !== null || ex.fim !== null) {
        const inicio = gps();
        const fim = gps(1);
        await tx
          .update(execucao)
          .set({
            ...(ex.inicio === null ? {} : { inicioLatitude: inicio.latitude, inicioLongitude: inicio.longitude }),
            ...(ex.fim === null ? {} : { fimLatitude: fim.latitude, fimLongitude: fim.longitude }),
          })
          .where(eq(execucao.id, ex.id));
        contagem.execucoes++;
      }
      const pausa = gps(1);
      const pausas = await tx
        .update(execucaoPausa)
        .set(pausa)
        .where(and(eq(execucaoPausa.execucaoId, ex.id), isNotNull(execucaoPausa.latitude)))
        .returning({ id: execucaoPausa.id });
      contagem.pausas += pausas.length;
      const fotos = await tx
        .select({ id: evidencia.id })
        .from(evidencia)
        .where(and(eq(evidencia.execucaoId, ex.id), isNotNull(evidencia.latitude)))
        .orderBy(asc(evidencia.capturadaEm), asc(evidencia.id));
      for (const [k, foto] of fotos.entries()) {
        await tx.update(evidencia).set(gps(2 + k)).where(eq(evidencia.id, foto.id));
      }
      contagem.fotos += fotos.length;
    }
  });
  console.log(`GPS da demonstração reposicionado: ${contagem.execucoes} execuções, ${contagem.pausas} pausas e ${contagem.fotos} fotos.`);
} finally {
  await pool.end();
}
