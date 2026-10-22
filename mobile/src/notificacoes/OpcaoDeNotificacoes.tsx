import * as Linking from "expo-linking";
import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { Opcao } from "@/ui/Opcao";
import { desligarNotificacoes, ligarNotificacoes, situacaoAtual } from "./aparelho";
import type { SituacaoDoPush } from "./regras";

/**
 * "Notificações neste aparelho" nas Configurações: liga e desliga o aviso no celular (o push) para este aparelho. Desligar tira o aparelho
 * da `api`; ligar pede a permissão do sistema, se preciso. Os avisos seguem todos no sino e, por categoria, no e-mail. Se o sistema
 * negou a permissão, a opção leva às configurações do aparelho (só a pessoa pode mudar lá).
 */
export function OpcaoDeNotificacoes() {
  const [situacao, setSituacao] = useState<SituacaoDoPush | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);

  const ler = useCallback(() => void situacaoAtual().then(setSituacao), []);
  useEffect(() => {
    ler();
    // Quem volta das configurações do aparelho (onde liberou a permissão) vê a opção já certa.
    const assinatura = AppState.addEventListener("change", (estado) => estado === "active" && ler());
    return () => assinatura.remove();
  }, [ler]);

  if (!situacao) return null;
  const ligado = situacao.tipo === "ligado";

  const alternar = async () => {
    setTrabalhando(true);
    try {
      setSituacao(ligado || situacao.tipo === "indisponivel" ? await desligarNotificacoes() : await ligarNotificacoes());
    } finally {
      setTrabalhando(false);
    }
  };

  return (
    <>
      <Opcao
        rotulo="Notificações neste aparelho"
        detalhe="Avisa na hora, com o app fechado: a APR para assinar, o convite para uma APR, o pedido na execução, a OS reservada e o que for de segurança. Tudo continua no sino."
        marcada={ligado}
        desabilitada={trabalhando}
        aoPressionar={() => void alternar()}
      />
      {situacao.tipo === "bloqueado" ? (
        <Aviso tom="al" titulo="O aparelho não deixa o SYNQ OS notificar">
          Libere as notificações do SYNQ OS nas configurações do aparelho para receber os avisos com o app fechado.
        </Aviso>
      ) : null}
      {situacao.tipo === "bloqueado" ? <Botao titulo="Abrir as configurações do aparelho" variante="secundario" aoPressionar={() => void Linking.openSettings()} /> : null}
      {situacao.tipo === "indisponivel" ? <Aviso tom="info">{situacao.motivo}</Aviso> : null}
    </>
  );
}
