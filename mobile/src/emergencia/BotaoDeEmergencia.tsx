import { useRef, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { LIMITE_DA_OBSERVACAO_DA_EMERGENCIA } from "@shared/api/emergencia";
import { comPosicao } from "@shared/api/localizacao";
import { novoUuid } from "@shared/api/uuid";
import { obterPosicao } from "@/campo/localizacao";
import { useAcao, useAtualizarDepoisDoEvento } from "@/campo/useAcao";
import { enviarEvento } from "@/offline/app";
import { cores } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { Campo } from "@/ui/Campo";
import { JanelaDeFormulario } from "@/ui/JanelaDeFormulario";
import { ListaDeContatos } from "./ListaDeContatos";

interface BotaoDeEmergenciaProps {
  osId: string;
  /** A execução aberta, quando há (fica registrada no acionamento). */
  execucaoId?: string;
}

type Etapa = "fechada" | "confirmar" | "enviada" | "guardada";

/**
 * O botão de emergência (`docs/operacao-de-campo.md`, seção 5.9), sempre à vista na execução. Abre uma janela que, antes de qualquer coisa, tem
 * os contatos para ligar (o PAE e os números públicos): ligar não depende de avisar o sistema. "Acionar a emergência" avisa na hora o
 * supervisor e os administradores (sino, push e e-mail), com o nome e a posição do aparelho; a observação é opcional. O acionamento passa
 * pela fila de campo: sem sinal fica guardado e sobe sozinho quando o sinal voltar, e a janela diz isso. O id do acionamento é um só por
 * abertura da janela, então tocar duas vezes não avisa duas vezes.
 */
export function BotaoDeEmergencia({ osId, execucaoId }: BotaoDeEmergenciaProps) {
  const atualizarDepois = useAtualizarDepoisDoEvento();
  const { ocupado, erro, limparErro, executar } = useAcao();
  const [etapa, setEtapa] = useState<Etapa>("fechada");
  const [observacao, setObservacao] = useState("");
  const idDoAcionamento = useRef<string | null>(null);

  function abrir() {
    limparErro();
    setObservacao("");
    idDoAcionamento.current = novoUuid();
    setEtapa("confirmar");
  }

  const acionar = () =>
    executar(async () => {
      const posicao = await obterPosicao();
      const resposta = await enviarEvento({
        id: idDoAcionamento.current ?? novoUuid(),
        tipo: "emergencia_acionada",
        os_id: osId,
        payload: { id: idDoAcionamento.current, ...(execucaoId ? { execucao_id: execucaoId } : {}), ...(observacao.trim() ? { observacao: observacao.trim() } : {}), ...comPosicao(posicao) },
      });
      setEtapa(resposta.naFila ? "guardada" : "enviada");
      void atualizarDepois();
    });

  return (
    <>
      <Botao titulo="Emergência" icone="warning" variante="perigo" aoPressionar={abrir} />
      {etapa !== "fechada" ? (
        <JanelaDeFormulario titulo="Emergência" aoFechar={ocupado ? () => undefined : () => setEtapa("fechada")}>
          {etapa === "confirmar" ? (
            <>
              <ListaDeContatos />
              <Aviso tom="blq" icone="warning-outline" titulo="Avisar o supervisor e o administrador agora?">
                Eles recebem o seu nome, a OS e a sua posição, por notificação e por e-mail. Use só em emergência de verdade.
              </Aviso>
              <Campo
                rotulo="O que está acontecendo? (opcional)"
                value={observacao}
                onChangeText={setObservacao}
                maxLength={LIMITE_DA_OBSERVACAO_DA_EMERGENCIA}
                multiline
                placeholder="Ex.: vazamento na rua, uma pessoa passando mal"
              />
              {erro ? <Aviso tom="blq">{erro.mensagem}</Aviso> : null}
              <Botao titulo="Avisar o supervisor e o administrador" icone="megaphone" variante="perigo" enviando={ocupado} aoPressionar={() => void acionar()} />
              <Botao titulo="Voltar" variante="texto" aoPressionar={ocupado ? () => undefined : () => setEtapa("fechada")} />
            </>
          ) : (
            <>
              {etapa === "enviada" ? (
                <Aviso tom="ok" icone="checkmark-circle-outline" titulo="Avisamos o supervisor e o administrador.">
                  Eles já receberam o seu nome e a sua posição. Se precisar de socorro agora, ligue.
                </Aviso>
              ) : (
                <Aviso tom="al" icone="cloud-offline-outline" titulo="Sem sinal: o aviso ficou guardado.">
                  Ele é enviado sozinho assim que o sinal voltar. Não espere: LIGUE agora, a ligação não depende do sinal de dados.
                </Aviso>
              )}
              <ListaDeContatos />
              <Text style={estilos.nota}>Mantenha-se em local seguro e siga o plano de atendimento a emergências.</Text>
              <Botao titulo="Fechar" variante="secundario" aoPressionar={() => setEtapa("fechada")} />
            </>
          )}
        </JanelaDeFormulario>
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  nota: { fontSize: 13, lineHeight: 18, color: cores.tinta4 },
});
