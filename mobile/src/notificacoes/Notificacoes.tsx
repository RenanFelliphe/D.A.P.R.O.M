import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { useRouter, type Href } from "expo-router";
import { useEffect, useRef } from "react";
import { useMarcarAvisoComoLido } from "@/avisos/consultas";
import { useSessao } from "@/sessao/SessaoProvider";
import { lerPreferencia, registrarAparelho } from "./aparelho";
import { destinoDoPush, lerDadosDoPush } from "./regras";

/**
 * Com o app em primeiro plano a notificação aparece como banner, como no resto do sistema (o pedido que vence em 2 minutos, o convite):
 * quem está com o app aberto também precisa saber na hora.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/**
 * Liga o app às notificações push (`docs/pessoas-e-equipes.md`, seção 8.6). Não desenha nada. Ao abrir o app com a conta pronta: registra o
 * aparelho na `api` (a primeira vez pede a permissão; as seguintes só confirmam o token), a menos que a pessoa tenha desligado. Quando
 * uma notificação chega, atualiza o que ela muda na tela (avisos, convites, pedidos). Ao tocar numa, marca o aviso como lido e abre a
 * tela dele; vale também para o toque que abriu o app do zero (`useLastNotificationResponse`).
 */
export function Notificacoes() {
  const router = useRouter();
  const consultas = useQueryClient();
  const { eu } = useSessao();
  const marcarComoLido = useMarcarAvisoComoLido();
  const usuarioId = eu?.usuario.id ?? null;

  useEffect(() => {
    if (!usuarioId) return;
    let cancelado = false;
    void (async () => {
      if ((await lerPreferencia()) === "desligado" || cancelado) return;
      await registrarAparelho({ pedirPermissao: true });
    })();
    return () => {
      cancelado = true;
    };
  }, [usuarioId]);

  useEffect(() => {
    const assinatura = Notifications.addNotificationReceivedListener(() => {
      // O que a notificação avisa já está no servidor: a lista, o contador e as filas de espera se atualizam.
      void consultas.invalidateQueries({ queryKey: ["avisos"] });
      void consultas.invalidateQueries({ queryKey: ["me"] });
      void consultas.invalidateQueries({ queryKey: ["os"] });
    });
    return () => assinatura.remove();
  }, [consultas]);

  const resposta = Notifications.useLastNotificationResponse();
  const tratada = useRef<string | null>(null);
  useEffect(() => {
    if (!resposta || !usuarioId) return;
    const id = resposta.notification.request.identifier;
    if (tratada.current === id) return;
    tratada.current = id;
    const dados = lerDadosDoPush(resposta.notification.request.content.data);
    if (!dados) return;
    void marcarComoLido(dados.alerta_id).catch(() => undefined);
    const destino = destinoDoPush(dados, usuarioId);
    if (destino) router.push(destino as Href);
  }, [resposta, usuarioId, marcarComoLido, router]);

  return null;
}
