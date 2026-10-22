/**
 * Insere OS fictícias extras (prefixo 5200xxx), já encerradas e com GPS, só para o mapa de calor ter mais áreas e
 * intensidades diferentes para mostrar — não passa pela APR nem pela execução de verdade (sem evento, sem alerta,
 * sem pontuação), é inserção direta no banco configurado em `.env`/`.env.local`. Reaproveita as equipes, um usuário de
 * cada uma e um modelo de APR já existentes; só cria os locais novos (cidades do interior do ES) que ainda não
 * existem.
 *
 *   pnpm demo:mais-os-mapa-calor
 *
 * Idempotente: se já existir uma OS 5200xxx, não faz nada. Nunca mexe nas OS 5100xxx da demonstração (essas são do
 * seed principal; ver `demo.ts` e `espalhar-gps-demo.ts`).
 */
import { randomUUID } from "node:crypto";
import { eq, inArray, like } from "drizzle-orm";
import { lerConfig } from "../src/config";
import { conectar } from "../src/db/conexao";
import { apr, equipe, execucao, localInstalacao, modeloApr, os, usuario } from "../src/db/schema";

const PREFIXO = "5200";

/** Cada cluster: o código do local (existente ou novo), o centro e quantas OS ele recebe. */
const CLUSTERS: { codigo: string; novo?: { endereco: string }; lat: number; lng: number; os: number }[] = [
  // Já existem no banco (seed da demonstração, `demo.ts`): reaproveita o local, só soma mais OS nele.
  { codigo: "VILA VELHA/REDE VILA VELHA", lat: -20.338, lng: -40.301, os: 9 },
  { codigo: "VITORIA/ESTACAO VITORIA", lat: -20.28, lng: -40.29, os: 7 },
  { codigo: "ERP SERRA/ESTACAO ERP SERRA", lat: -20.205, lng: -40.224, os: 6 },
  { codigo: "CARIACICA/RAMAL CARIACICA", lat: -20.33, lng: -40.375, os: 5 },
  { codigo: "GUARAPARI/ESTACAO GUARAPARI", lat: -20.642, lng: -40.478, os: 4 },
  { codigo: "ARACRUZ/ERS ARACRUZ", lat: -19.82, lng: -40.275, os: 3 },
  { codigo: "LINHARES/REDE LINHARES", lat: -19.391, lng: -40.072, os: 2 },
  // Novos: outras cidades do Espírito Santo, para o mapa ganhar áreas fora da Grande Vitória.
  { codigo: "CACHOEIRO/ESTACAO CACHOEIRO", novo: { endereco: "Av. Brahim Antônio Seder, s/n — Cachoeiro de Itapemirim/ES" }, lat: -20.849, lng: -41.113, os: 4 },
  { codigo: "COLATINA/REDE COLATINA", novo: { endereco: "Av. Governador Lacerda de Aguiar, 100 — Colatina/ES" }, lat: -19.539, lng: -40.63, os: 3 },
  { codigo: "SAO MATEUS/REDE SAO MATEUS", novo: { endereco: "Rod. BR-101, km 2 — São Mateus/ES" }, lat: -18.717, lng: -39.859, os: 2 },
  { codigo: "NOVA VENECIA/RAMAL NOVA VENECIA", novo: { endereco: "Av. Vitória, 500 — Nova Venécia/ES" }, lat: -18.714, lng: -40.4, os: 2 },
];

/** FNV-1a de 32 bits: o mesmo texto dá sempre o mesmo número (posição determinística, mas espalhada). */
function hash(texto: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
const desvio = (texto: string) => (hash(texto) / 0xffffffff) * 2 - 1;
const seisCasas = (v: number) => Math.round(v * 1e6) / 1e6;
/** Até 1,5 km do centro do cluster: as OS de uma cidade caem em alguns pontos próximos, não todas no mesmo. */
const ESPALHAMENTO = 0.014;

const config = lerConfig();
const { pool, db } = conectar(config.databaseUrl);
try {
  const [jaExiste] = await db.select({ id: os.id }).from(os).where(like(os.numeroOrdem, `${PREFIXO}%`)).limit(1);
  if (jaExiste) {
    console.log(`Já existem OS ${PREFIXO}xxx; nada foi inserido (rode só uma vez, ou apague essas OS antes).`);
  } else {
    const equipes = await db.select({ id: equipe.id, centro: equipe.centroTrabalho }).from(equipe);
    if (equipes.length === 0) throw new Error("Nenhuma equipe no banco; rode a api (migrações) e a demonstração antes.");
    const usuarios = await db
      .select({ id: usuario.id, equipeId: usuario.equipeId })
      .from(usuario)
      .where(inArray(usuario.equipeId, equipes.map((e) => e.id)));
    const usuarioDaEquipe = new Map(usuarios.map((u) => [u.equipeId, u.id]));
    const [modelo] = await db.select({ id: modeloApr.id }).from(modeloApr).limit(1);
    if (!modelo) throw new Error("Nenhum modelo de APR no banco; rode a api (carga inicial) antes.");

    const locaisExistentes = await db
      .select({ id: localInstalacao.id, codigo: localInstalacao.codigo })
      .from(localInstalacao)
      .where(inArray(localInstalacao.codigo, CLUSTERS.map((c) => c.codigo)));
    const localPorCodigo = new Map(locaisExistentes.map((l) => [l.codigo, l.id]));
    for (const c of CLUSTERS) {
      if (localPorCodigo.has(c.codigo)) continue;
      const [criado] = await db
        .insert(localInstalacao)
        .values({ codigo: c.codigo, endereco: c.novo?.endereco ?? null })
        .onConflictDoNothing()
        .returning({ id: localInstalacao.id });
      localPorCodigo.set(c.codigo, criado!.id);
    }

    const agora = Date.now();
    let numero = 1;
    let equipeIndice = 0;
    let totalOs = 0;
    for (const cluster of CLUSTERS) {
      const localId = localPorCodigo.get(cluster.codigo)!;
      for (let k = 0; k < cluster.os; k++) {
        const numeroOrdem = `${PREFIXO}${String(numero).padStart(3, "0")}`;
        const eq = equipes[equipeIndice % equipes.length]!;
        equipeIndice++;
        const executorId = usuarioDaEquipe.get(eq.id);
        if (!executorId) continue; // equipe sem ninguém; pula (não deveria acontecer depois da demonstração)

        const diasAtras = 1 + Math.floor(((hash(numeroOrdem) >>> 8) % 70));
        const inicio = new Date(agora - diasAtras * 86_400_000 - (hash(numeroOrdem) % (12 * 3600_000)));
        const fim = new Date(inicio.getTime() + (60 + (hash(`${numeroOrdem}:dur`) % 180)) * 60_000);
        const latitude = seisCasas(cluster.lat + desvio(`${numeroOrdem}:lat`) * ESPALHAMENTO);
        const longitude = seisCasas(cluster.lng + desvio(`${numeroOrdem}:lng`) * ESPALHAMENTO);

        const [criada] = await db
          .insert(os)
          .values({
            numeroOrdem,
            tipo: "corretiva",
            titulo: "OS de demonstração do mapa de calor",
            localInstalacaoId: localId,
            equipeId: eq.id,
            dataInicioProg: inicio.toISOString().slice(0, 10),
            status: "encerrada",
            origem: "sap",
          })
          .returning({ id: os.id });
        const osId = criada!.id;
        const aprId = randomUUID();
        await db.insert(apr).values({
          id: aprId,
          osId,
          modeloAprId: modelo.id,
          preenchidaPor: executorId,
          resultado: "aprovada",
          concluidaEm: new Date(inicio.getTime() - 20 * 60_000),
        });
        await db.insert(execucao).values({
          id: randomUUID(),
          osId,
          aprId,
          executorId,
          numeroPessoas: 2,
          inicio,
          fim,
          resultado: "encerrada",
          inicioLatitude: latitude,
          inicioLongitude: longitude,
          fimLatitude: latitude,
          fimLongitude: longitude,
        });
        numero++;
        totalOs++;
      }
    }
    console.log(`${totalOs} OS inseridas (prefixo ${PREFIXO}), em ${CLUSTERS.length} áreas.`);
  }
} finally {
  await pool.end();
}
