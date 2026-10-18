/**
 * Atalhos dos testes para o fluxo da execução depois da Reunião 3: cada participante assina a APR na própria conta, o
 * encerramento tem dois passos (o clique em "Encerrar OS" e o preenchimento assinado pelo responsável) e a OS só está concluída
 * quando o supervisor assina por último. Os testes que só precisam de uma OS executada usam `executarAteOFim`; os que testam uma
 * etapa chamam a etapa.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Ambiente, UsuarioDeTeste } from "./ajuda";

/** Uma posição qualquer (Vitória, ES) para os eventos que registram a localização. */
export const POSICAO = { latitude: -20.3155, longitude: -40.3128 };

export function ajudaDeExecucao(amb: Ambiente) {
  const agora = () => amb.relogio.agora.toISOString();
  const evento = (tipo: string, payload: object, osId?: string | null, ocorrido = agora()) => ({ id: randomUUID(), tipo, os_id: osId ?? null, payload, ocorrido_em: ocorrido });
  const enviar = (como: UsuarioDeTeste, ...eventos: unknown[]) => amb.esperar(200, "POST", "/eventos", { como, json: { eventos } });
  const foto = async () => {
    const id = randomUUID();
    await amb.armazenamento.gravar("fotos", id, new Uint8Array([1]), "image/png");
    return id;
  };

  /** Cada participante assina a APR na própria conta (`apr_assinada`), um a um, como a tela faz. */
  async function assinarApr(aprId: string, osId: string, quem: UsuarioDeTeste[]) {
    for (const pessoa of quem) {
      const r = await enviar(pessoa, evento("apr_assinada", { apr_id: aprId }, osId));
      assert.deepEqual(r.rejeitados, [], `apr_assinada de ${pessoa.id} recusada: ${JSON.stringify(r.rejeitados)}`);
    }
  }

  /** Inicia a execução com a APR já assinada; devolve o id da execução. */
  async function iniciar(como: UsuarioDeTeste, osId: string, aprId: string, extra: Record<string, unknown> = {}) {
    const id = randomUUID();
    const r = await enviar(como, evento("execucao_iniciada", { id, apr_id: aprId, inicio: agora(), ...extra }, osId));
    assert.deepEqual(r.rejeitados, [], `execucao_iniciada recusada: ${JSON.stringify(r.rejeitados)}`);
    return id;
  }

  /** O clique em "Encerrar OS": o tempo para (a OS fica `encerrando`). */
  const clicarEncerrar = (como: UsuarioDeTeste, osId: string, execucaoId: string, extra: Record<string, unknown> = {}) =>
    enviar(como, evento("execucao_encerrada", { execucao_id: execucaoId, fim: agora(), ...POSICAO, ...extra }, osId));

  /** O preenchimento do encerramento, assinado pelo responsável (a OS fica `aguardando_supervisor`); descrição e fotos são opcionais. */
  const assinarEncerramento = (como: UsuarioDeTeste, osId: string, execucaoId: string, extra: Record<string, unknown> = {}) =>
    enviar(como, evento("encerramento_assinado", { execucao_id: execucaoId, descricao_atividade: "Serviço executado conforme a OS", ...extra }, osId));

  /** Os dois passos do encerramento, um depois do outro. */
  async function encerrar(como: UsuarioDeTeste, osId: string, execucaoId: string, extra: { fim?: Record<string, unknown>; assinatura?: Record<string, unknown> } = {}) {
    await clicarEncerrar(como, osId, execucaoId, extra.fim);
    return assinarEncerramento(como, osId, execucaoId, extra.assinatura);
  }

  /** A assinatura final do supervisor (a "ciência"): a OS fica `encerrada` (concluída). */
  const concluir = (supervisor: UsuarioDeTeste, osId: string) => amb.req("POST", `/os/${osId}/ciencia`, { como: supervisor });

  /**
   * APR → assinaturas → execução → encerramento (os dois passos) em uma só chamada, para o teste que só precisa de uma OS
   * executada; o primeiro participante é o responsável e quem executa. Devolve os ids.
   */
  async function executarAteOFim(osId: string, aprId: string, participantes: UsuarioDeTeste[]) {
    await assinarApr(aprId, osId, participantes);
    const execId = await iniciar(participantes[0]!, osId, aprId);
    await encerrar(participantes[0]!, osId, execId);
    return execId;
  }

  return { agora, evento, enviar, foto, assinarApr, iniciar, clicarEncerrar, assinarEncerramento, encerrar, concluir, executarAteOFim };
}
