import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { apr, execucao, localInstalacao, modeloApr, os } from "../src/db/schema";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

const AGORA = new Date("2026-10-21T15:00:00Z");
const instante = (valor: string) => new Date(valor);

describe("Mapa de calor das OS", () => {
  let amb: Ambiente;
  let supervisor: UsuarioDeTeste;
  let admin: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;
  let equipeDaSupervisora: string;
  let outraEquipe: string;
  let equipeDaBorda: string;
  let localId: string;
  let modeloId: string;

  before(async () => {
    amb = await criarAmbiente({ relogio: AGORA });
    equipeDaSupervisora = (await amb.criarEquipe({ nome: "Equipe A" })).id;
    outraEquipe = (await amb.criarEquipe({ nome: "Equipe B" })).id;
    equipeDaBorda = (await amb.criarEquipe({ nome: "Equipe C" })).id;
    supervisor = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeDaSupervisora, supervisor: true });
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId: outraEquipe });
    admin = await amb.criarUsuario({ perfil: "admin" });

    localId = (await amb.db.insert(localInstalacao).values({ codigo: "LOCAL-MAPA" }).returning())[0]!.id;
    modeloId = (await amb.db.insert(modeloApr).values({ codigo: "MAPA", versao: 1, titulo: "Modelo de teste" }).returning())[0]!.id;

    const inserirOsComExecucao = async (dados: {
      equipeId: string;
      inicio: string;
      status: "encerrada" | "em_execucao";
      latitude?: number;
      longitude?: number;
    }) => {
      const osId = (await amb.db
        .insert(os)
        .values({
          numeroOrdem: randomUUID(),
          tipo: "corretiva",
          titulo: "OS do mapa",
          localInstalacaoId: localId,
          equipeId: dados.equipeId,
          dataInicioProg: "2026-10-01",
          status: dados.status,
          origem: "sap",
        })
        .returning())[0]!.id;
      const aprId = randomUUID();
      await amb.db.insert(apr).values({
        id: aprId,
        osId,
        modeloAprId: modeloId,
        preenchidaPor: dados.equipeId === equipeDaSupervisora ? supervisor.id : tecnico.id,
        resultado: "aprovada",
        concluidaEm: instante(dados.inicio),
      });
      await amb.db.insert(execucao).values({
        id: randomUUID(),
        osId,
        aprId,
        executorId: dados.equipeId === equipeDaSupervisora ? supervisor.id : tecnico.id,
        numeroPessoas: 1,
        inicio: instante(dados.inicio),
        fim: instante(new Date(instante(dados.inicio).getTime() + 60 * 60_000).toISOString()),
        resultado: "encerrada",
        ...(dados.latitude === undefined ? {} : { inicioLatitude: dados.latitude, inicioLongitude: dados.longitude }),
      });
      return osId;
    };

    await inserirOsComExecucao({ equipeId: equipeDaSupervisora, inicio: "2026-10-15T12:00:00Z", status: "encerrada", latitude: -20.311, longitude: -40.291 });
    await inserirOsComExecucao({ equipeId: equipeDaSupervisora, inicio: "2026-10-16T12:00:00Z", status: "encerrada", latitude: -20.312, longitude: -40.293 });
    await inserirOsComExecucao({ equipeId: equipeDaSupervisora, inicio: "2026-10-17T12:00:00Z", status: "em_execucao" });
    await inserirOsComExecucao({ equipeId: outraEquipe, inicio: "2026-10-18T12:00:00Z", status: "encerrada", latitude: -20.311, longitude: -40.291 });
    await inserirOsComExecucao({ equipeId: equipeDaSupervisora, inicio: "2026-08-01T12:00:00Z", status: "encerrada", latitude: -20.311, longitude: -40.291 });
    // Na borda da célula: em ponto flutuante, -40.95 * 100 cai na célula vizinha de -40.945.
    await inserirOsComExecucao({ equipeId: equipeDaBorda, inicio: "2026-10-19T12:00:00Z", status: "encerrada", latitude: -20.401, longitude: -40.95 });
    await inserirOsComExecucao({ equipeId: equipeDaBorda, inicio: "2026-10-20T12:00:00Z", status: "em_execucao", latitude: -20.405, longitude: -40.945 });
  });

  after(() => amb.fechar());

  it("agrega uma OS por célula e conta execuções sem GPS no escopo do supervisor", async () => {
    const r = await amb.req("GET", "/os/mapa-calor", { como: supervisor });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.os_no_periodo, 3);
    assert.equal(r.corpo.com_localizacao, 2);
    assert.equal(r.corpo.sem_localizacao, 1);
    assert.equal(r.corpo.celulas.length, 1);
    assert.equal(r.corpo.celulas[0].total, 2);
    assert.equal(r.corpo.celulas[0].latitude, -20.315);
    assert.equal(r.corpo.celulas[0].longitude, -40.295);
    assert.deepEqual(r.corpo.celulas[0].por_status, { encerrada: 2 });
    assert.equal(r.corpo.de, "2026-09-22");
    assert.equal(r.corpo.ate, "2026-10-21");
  });

  it("agrupa pelo valor decimal exato, sem erro de ponto flutuante na borda da célula", async () => {
    const r = await amb.req("GET", "/os/mapa-calor", { como: admin, consulta: { equipe_id: equipeDaBorda } });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.celulas.length, 1);
    assert.equal(r.corpo.celulas[0].total, 2);
    assert.equal(r.corpo.celulas[0].latitude, -20.405);
    assert.equal(r.corpo.celulas[0].longitude, -40.945);
    assert.deepEqual(r.corpo.celulas[0].por_status, { encerrada: 1, em_execucao: 1 });
  });

  it("deixa o administrador consultar todas as equipes e aplica os filtros", async () => {
    const r = await amb.req("GET", "/os/mapa-calor", { como: admin, consulta: { equipe_id: outraEquipe, status: "encerrada" } });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.os_no_periodo, 1);
    assert.equal(r.corpo.com_localizacao, 1);

    const filtrado = await amb.req("GET", "/os/mapa-calor", { como: supervisor, consulta: { status: "encerrada" } });
    assert.equal(filtrado.status, 200);
    assert.equal(filtrado.corpo.os_no_periodo, 2);
  });

  it("recusa perfis sem supervisão e equipes fora do escopo", async () => {
    const foraDoEscopo = await amb.req("GET", "/os/mapa-calor", { como: supervisor, consulta: { equipe_id: outraEquipe } });
    assert.equal(foraDoEscopo.status, 403);

    const tecnicoSemSupervisao = await amb.req("GET", "/os/mapa-calor", { como: tecnico });
    assert.equal(tecnicoSemSupervisao.status, 403);
  });
});
