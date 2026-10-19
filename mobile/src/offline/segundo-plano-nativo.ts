import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import { AppState } from "react-native";
import { cliente } from "../api/api";
import { bancoDoAparelho } from "./banco-nativo";
import { atualizarEstadoDaFila, definirPessoaLogada, pessoaDoApp, sincronizador } from "./app";
import { enviarEmSegundoPlano, registrarPassadaEmSegundoPlano } from "./segundo-plano";

/**
 * A tarefa do Android que envia a fila com o app fechado (`expo-background-task`, que usa o WorkManager). Este módulo precisa ser
 * carregado **na abertura do bundle**, não dentro de uma tela: com o app fechado nenhum componente existe, e a tarefa tem de estar
 * definida quando o Android a chamar. Por isso o `index.ts` da raiz o importa antes do Expo Router.
 */

const NOME_DA_TAREFA = "synqos-envio-em-segundo-plano";

/** O Android não aceita menos de 15 minutos e trata o número como o mínimo: o intervalo real varia com a bateria e o uso do aparelho. */
const INTERVALO_MINIMO_MIN = 15;

TaskManager.defineTask(NOME_DA_TAREFA, async () => {
  try {
    const desfecho = await enviarEmSegundoPlano({
      banco: bancoDoAparelho,
      appNaFrente: () => AppState.currentState === "active",
      temSessao: () => cliente.temSessao(),
      pessoaDoApp,
      definirPessoa: definirPessoaLogada,
      sincronizar: () => sincronizador.sincronizar(),
    });
    await registrarPassadaEmSegundoPlano(bancoDoAparelho, desfecho, new Date());
    await atualizarEstadoDaFila();
    return desfecho.ok ? BackgroundTask.BackgroundTaskResult.Success : BackgroundTask.BackgroundTaskResult.Failed;
  } catch {
    // O que não saiu continua na fila do aparelho; a próxima passada tenta de novo.
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Pede ao Android que rode a tarefa de tempos em tempos. O `registerTaskAsync` reinicia a contagem do intervalo a cada chamada, então só
 * registra se ainda não estiver registrada (senão quem abre o app toda hora nunca teria a tarefa rodando).
 */
export async function ligarEnvioEmSegundoPlano(): Promise<void> {
  try {
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (await TaskManager.isTaskRegisteredAsync(NOME_DA_TAREFA)) return;
    await BackgroundTask.registerTaskAsync(NOME_DA_TAREFA, { minimumInterval: INTERVALO_MINIMO_MIN });
  } catch {
    // Sem a tarefa o app segue funcionando: a fila sobe com o app aberto.
  }
}

/** Quem saiu do app não tem fila: a tarefa deixa de acordar o aparelho à toa. */
export async function desligarEnvioEmSegundoPlano(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(NOME_DA_TAREFA)) await BackgroundTask.unregisterTaskAsync(NOME_DA_TAREFA);
  } catch {
    /* já estava desligada */
  }
}
