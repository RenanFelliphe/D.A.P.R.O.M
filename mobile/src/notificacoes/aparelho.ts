import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { NOME_DO_CANAL, type CanalDoPush, type RegistroDeDispositivo } from "@shared/notificacoes/push";
import { cliente } from "@/api/api";
import { MOTIVO_SEM_SERVICOS_DO_GOOGLE, type PreferenciaDePush, type SituacaoDoPush } from "./regras";

const CHAVE_PREFERENCIA = "synqos_push_preferencia";
const CHAVE_TOKEN = "synqos_push_token";

/** A escolha da pessoa neste aparelho; sem escolha, ligado (o aviso que importa não pode depender de a pessoa achar a opção). */
export async function lerPreferencia(): Promise<PreferenciaDePush> {
  try {
    return (await SecureStore.getItemAsync(CHAVE_PREFERENCIA)) === "desligado" ? "desligado" : "ligado";
  } catch {
    return "ligado";
  }
}

async function gravarPreferencia(p: PreferenciaDePush): Promise<void> {
  await SecureStore.setItemAsync(CHAVE_PREFERENCIA, p).catch(() => undefined);
}

/** O token que este aparelho registrou na `api` (para tirá-lo ao desligar ou sair); `null` se nunca registrou. */
async function tokenGuardado(): Promise<string | null> {
  return SecureStore.getItemAsync(CHAVE_TOKEN).catch(() => null);
}

/**
 * Os canais do Android: o urgente (APR para assinar, convite, pedido que vence em 2 minutos, segurança) toca com prioridade máxima; o
 * padrão, em volume normal. O canal é do aparelho: depois de criado, quem muda o som é a pessoa, nas configurações do sistema.
 */
async function criarCanais(): Promise<void> {
  if (Platform.OS !== "android") return;
  const canais: Record<CanalDoPush, AndroidImportance> = { urgente: AndroidImportance.MAX, padrao: AndroidImportance.DEFAULT };
  for (const [id, importancia] of Object.entries(canais)) {
    await Notifications.setNotificationChannelAsync(id, { name: NOME_DO_CANAL[id as CanalDoPush], importance: importancia, vibrationPattern: id === "urgente" ? [0, 300, 150, 300] : undefined, lightColor: "#0F5C78" });
  }
}

/** O id do projeto na Expo, de onde vem o token (`app.config.ts`); sem ele, o app não tem como pedir o token. */
function idDoProjeto(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

/** A permissão do sistema agora, sem perguntar. */
async function permissaoConcedida(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

/**
 * Pede a permissão (se ainda não foi decidida), pega o token do aparelho e o registra na `api` (`POST /me/dispositivos`; repetir só
 * confirma). Devolve em que pé ficou. Nunca lança: qualquer falha vira "indisponível" com o motivo, e o resto do app segue (o aviso
 * continua no sino e, se tem categoria, no e-mail).
 */
export async function registrarAparelho(opcoes: { pedirPermissao: boolean }): Promise<SituacaoDoPush> {
  try {
    let concedida = await permissaoConcedida();
    if (!concedida && opcoes.pedirPermissao) concedida = (await Notifications.requestPermissionsAsync()).granted;
    if (!concedida) return { tipo: "bloqueado" };

    const projectId = idDoProjeto();
    if (!projectId) return { tipo: "indisponivel", motivo: "Este app foi gerado sem o projeto das notificações. Os avisos continuam no sino do app." };
    await criarCanais();
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const corpo: RegistroDeDispositivo = { token, plataforma: Platform.OS === "ios" ? "ios" : "android" };
    await cliente.chamar("/me/dispositivos", { metodo: "POST", corpo });
    await SecureStore.setItemAsync(CHAVE_TOKEN, token).catch(() => undefined);
    return { tipo: "ligado" };
  } catch {
    return { tipo: "indisponivel", motivo: MOTIVO_SEM_SERVICOS_DO_GOOGLE };
  }
}

/** Tira este aparelho da `api` (ao desligar as notificações ou sair). Sem sinal não há como: o token fica até a próxima vez, e a `api` o passa para quem entrar depois. */
export async function removerAparelho(): Promise<void> {
  const token = await tokenGuardado();
  if (!token) return;
  try {
    await cliente.chamar("/me/dispositivos", { metodo: "DELETE", corpo: { token } });
    await SecureStore.deleteItemAsync(CHAVE_TOKEN).catch(() => undefined);
  } catch {
    // Sem sinal: tenta de novo na próxima saída. O token é do aparelho, então o próximo a entrar o toma para si.
  }
}

/** O que a tela de configurações mostra: a escolha da pessoa e, ligada, se o sistema permite. Não registra nada. */
export async function situacaoAtual(): Promise<SituacaoDoPush> {
  if ((await lerPreferencia()) === "desligado") return { tipo: "desligado" };
  return (await permissaoConcedida().catch(() => false)) ? { tipo: "ligado" } : { tipo: "bloqueado" };
}

/** A pessoa liga as notificações: guarda a escolha e registra o aparelho (pedindo a permissão, se preciso). */
export async function ligarNotificacoes(): Promise<SituacaoDoPush> {
  await gravarPreferencia("ligado");
  return registrarAparelho({ pedirPermissao: true });
}

/** A pessoa desliga: guarda a escolha e tira o aparelho da `api`. */
export async function desligarNotificacoes(): Promise<SituacaoDoPush> {
  await gravarPreferencia("desligado");
  await removerAparelho();
  return { tipo: "desligado" };
}
