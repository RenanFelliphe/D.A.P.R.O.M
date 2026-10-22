import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MOTIVOS_DA_PAUSA, MOTIVOS_DA_SUSPENSAO } from "@shared/api/execucao-motivos";
import type { Situacao } from "@shared/api/execucao-situacao";
import { pedidoAberto } from "@shared/api/execucao-pedidos";
import { participantesAtivos } from "@shared/api/execucao-tempo";
import { comPosicao } from "@shared/api/localizacao";
import { novoUuid } from "@shared/api/uuid";
import { BotaoDeEmergencia } from "@/emergencia/BotaoDeEmergencia";
import { enviarEvento } from "@/offline/app";
import { JanelaDeAssinatura } from "@/campo/JanelaDeAssinatura";
import { obterPosicao } from "@/campo/localizacao";
import { useAcao, useAtualizarDepoisDoEvento } from "@/campo/useAcao";
import { rotas } from "@/os/rotas";
import { cores, espaco, raio } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { mostrarAviso } from "@/ui/AvisoRapido";
import { Botao } from "@/ui/Botao";
import { Cartao, TituloDeCartao } from "@/ui/Cartao";
import { JanelaDeFormulario } from "@/ui/JanelaDeFormulario";
import { AvisoDeLocalizacao } from "./AvisoDeLocalizacao";
import { FormularioInterromper } from "./FormularioInterromper";
import { JanelaDeMotivo } from "./JanelaDeMotivo";
import { PedidoParaResponder } from "./PedidoParaResponder";
import { ResumoDoTempo } from "./ResumoDoTempo";
import { useAgora } from "./useAgora";

const CANCELAR_ATE_MS = 10 * 60_000;

type Janela = "pausar" | "suspender" | "encerrar" | "cancelar" | null;

interface EmAndamentoProps {
  osId: string;
  numeroOrdem: string | null;
  titulo: string;
  local: string;
  situacao: Extract<Situacao, { tipo: "em_andamento" }>;
  /** Quando a tela leu a execução pela última vez (ms): é daqui que a contagem do pedido de um participante desconta o tempo. */
  atualizadoEm: number;
}

/** As quatro ações da execução, com o que cada uma faz (a explicação que o técnico vê junto dos botões). */
const ACOES = [
  { nome: "Pausar", quando: "Parada curta; a equipe volta ao mesmo serviço no mesmo dia.", efeito: "Pede o motivo. Só o tempo líquido para; “Continuar” retoma com a mesma APR." },
  { nome: "Suspender", quando: "O serviço não continua hoje.", efeito: "Pede o motivo. Encerra esta execução; a OS fica pendente e a retomada pede APR nova." },
  { nome: "Interromper por risco", quando: "Apareceu um risco ou impedimento.", efeito: "Pede motivo, ao menos 1 foto e assinatura; a OS fica pendente e o supervisor é avisado." },
  { nome: "Encerrar OS", quando: "O serviço terminou.", efeito: "Pede a confirmação e o tempo para; depois vêm a assinatura do responsável e, por último, a do supervisor." },
];

/**
 * A execução rodando: o cronômetro calculado do início e das pausas que vêm da `api`, pausar/continuar, suspender, interromper por risco,
 * cancelar por engano e encerrar. Pausar não é interromper: a pausa só para o relógio líquido. Pausar e suspender abrem a janela do motivo
 * (obrigatório); encerrar abre a confirmação (o tempo para ali) e segue para o preenchimento e a assinatura. A localização é registrada ao
 * pausar, suspender, interromper e encerrar, sem bloquear o serviço se não houver.
 */
export function EmAndamento({ osId, numeroOrdem, titulo, local, situacao, atualizadoEm }: EmAndamentoProps) {
  const router = useRouter();
  const atualizarDepois = useAtualizarDepoisDoEvento();
  const { execucao, participantes } = situacao;
  // Só a janela de 10 minutos do cancelamento depende da hora aqui; o cronômetro tem o próprio relógio.
  const agora = useAgora(15_000);
  const { ocupado, erro, limparErro, executar } = useAcao();
  const [interrompendo, setInterrompendo] = useState(false);
  const [janela, setJanela] = useState<Janela>(null);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);

  const pausaAberta = execucao.pausas.find((p) => !p.fim);
  // Um participante pediu para encerrar ou suspender: o responsável tem 2 minutos para responder (sem resposta, é aprovado sozinho).
  const pedido = pedidoAberto(execucao);
  const passouDoPrazo = agora - new Date(execucao.inicio).getTime() >= CANCELAR_ATE_MS;
  const podeCancelar = !passouDoPrazo && execucao.pausas.length === 0;
  const retomarInvalido = erro?.codigo === "continuar_invalido";
  const [semContinuar, setSemContinuar] = useState(false);

  async function pausar(escolha: { motivo: string; complemento?: string }) {
    const posicao = await obterPosicao();
    await enviarEvento({ tipo: "pausa_iniciada", os_id: osId, payload: { id: novoUuid(), execucao_id: execucao.id, inicio: new Date().toISOString(), ...escolha, ...comPosicao(posicao) } });
    setJanela(null);
    await atualizarDepois();
  }

  const continuar = () =>
    executar(async () => {
      await enviarEvento({ tipo: "pausa_encerrada", os_id: osId, payload: { pausa_id: pausaAberta!.id, fim: new Date().toISOString() } });
      await atualizarDepois();
    });

  async function suspender(escolha: { motivo: string; complemento?: string }) {
    const posicao = await obterPosicao();
    await enviarEvento({ tipo: "execucao_suspensa", os_id: osId, payload: { execucao_id: execucao.id, fim: new Date().toISOString(), ...escolha, ...comPosicao(posicao) } });
    mostrarAviso("OS pendente — retome com APR nova");
    void atualizarDepois();
    router.dismissTo("/lista");
  }

  async function cancelar() {
    await enviarEvento({ tipo: "execucao_cancelada", os_id: osId, payload: { execucao_id: execucao.id } });
    mostrarAviso("Execução cancelada");
    void atualizarDepois();
    router.replace(rotas.os(osId));
  }

  if (interrompendo) return <FormularioInterromper osId={osId} execucaoId={execucao.id} aoVoltar={() => setInterrompendo(false)} />;

  return (
    <View style={estilos.tela}>
      <ResumoDoTempo inicio={execucao.inicio} pausas={execucao.pausas} numeroPessoas={execucao.numero_pessoas} />
      {pedido ? <PedidoParaResponder osId={osId} pedido={pedido} recebidoEm={atualizadoEm} /> : null}

      <View style={estilos.acoes}>
        {erro ? <Aviso tom="blq">{retomarInvalido ? "Faça uma APR nova para retomar. Suspenda esta execução e abra uma APR nova." : erro.mensagem}</Aviso> : null}
        {semContinuar && pausaAberta ? <Aviso tom="al">Continue a execução para poder encerrá-la.</Aviso> : null}
        <Botao
          titulo="Encerrar OS"
          icone="checkmark"
          aoPressionar={() => {
            if (pausaAberta) return setSemContinuar(true);
            limparErro();
            setJanela("encerrar");
          }}
        />
        <View style={estilos.linha}>
          {pausaAberta ? (
            <Botao titulo="Continuar" icone="play" variante="secundario" bloco={false} estilo={estilos.metade} enviando={ocupado} aoPressionar={() => void continuar()} />
          ) : (
            <Botao
              titulo="Pausar"
              icone="pause"
              variante="secundario"
              bloco={false}
              estilo={estilos.metade}
              aoPressionar={() => {
                limparErro();
                setSemContinuar(false);
                setJanela("pausar");
              }}
            />
          )}
          <Botao
            titulo="Interromper por risco"
            variante="perigo"
            bloco={false}
            estilo={estilos.metade}
            aoPressionar={() => {
              limparErro();
              setInterrompendo(true);
            }}
          />
        </View>
        <Botao
          titulo="Suspender"
          variante="secundario"
          aoPressionar={() => {
            limparErro();
            setJanela("suspender");
          }}
        />
        <BotaoDeEmergencia osId={osId} execucaoId={execucao.id} />
        {podeCancelar ? (
          <Botao
            titulo="Cancelar por engano"
            variante="texto"
            aoPressionar={() => {
              limparErro();
              setConfirmandoCancelar(true);
            }}
          />
        ) : null}
      </View>

      {confirmandoCancelar ? (
        <Aviso tom="al" titulo="Cancelar por engano?" rodape={<Botao titulo="Assinar e cancelar a execução" variante="perigo" aoPressionar={() => setJanela("cancelar")} />}>
          Isso apaga esta execução e devolve a APR para uso. Só vale até 10 minutos depois do início, sem pausa nem foto.
        </Aviso>
      ) : null}

      <Cartao>
        <TituloDeCartao>Atividade em andamento</TituloDeCartao>
        <Text style={estilos.texto}>{`${numeroOrdem ?? "—"} · ${titulo}`}</Text>
        <Text style={estilos.suave}>{`Local: ${local}`}</Text>
        <Text style={estilos.suave}>{`Participantes da APR: ${participantesAtivos(participantes).map((p) => p.nome).join(", ") || "—"}`}</Text>
        <Text style={estilos.suave}>Os participantes também podem pausar, interromper e pedir para encerrar ou suspender: você é avisado e tem 2 minutos para responder um pedido.</Text>
      </Cartao>

      <Cartao>
        <TituloDeCartao>O que cada botão faz</TituloDeCartao>
        {ACOES.map((a) => (
          <View key={a.nome} style={estilos.explicacao}>
            <Text style={estilos.nome}>{a.nome}</Text>
            <Text style={estilos.suave}>
              <Text style={estilos.negrito}>Quando: </Text>
              {`${a.quando} `}
              <Text style={estilos.negrito}>O que acontece: </Text>
              {a.efeito}
            </Text>
          </View>
        ))}
        <Text style={estilos.suave}>Use Pausar para almoço, descanso ou uma espera: a pausa não entra no tempo líquido. Ao concluir a atividade, encerre: o tempo para na confirmação, e só quem encerrou assina o encerramento.</Text>
      </Cartao>
      <AvisoDeLocalizacao />

      {janela === "pausar" ? (
        <JanelaDeMotivo
          titulo="Pausar a execução"
          deQue="da pausa"
          resumo="Pausa curta: só o tempo líquido para, e “Continuar” retoma com a mesma APR. Diga o motivo."
          opcoes={MOTIVOS_DA_PAUSA}
          rotuloConfirmar="Pausar"
          rotuloEnviando="Pausando…"
          aoConfirmar={pausar}
          aoFechar={() => setJanela(null)}
        />
      ) : null}
      {janela === "suspender" ? (
        <JanelaDeMotivo
          titulo="Suspender a execução"
          deQue="da suspensão"
          resumo="Suspender termina esta execução agora. A OS fica pendente e a retomada exige uma APR nova. Diga o motivo."
          opcoes={MOTIVOS_DA_SUSPENSAO}
          rotuloConfirmar="Suspender"
          rotuloEnviando="Suspendendo…"
          aoConfirmar={suspender}
          aoFechar={() => setJanela(null)}
        />
      ) : null}
      {janela === "encerrar" ? <JanelaDeConfirmarEncerramento osId={osId} execucaoId={execucao.id} aoFechar={() => setJanela(null)} /> : null}
      {janela === "cancelar" ? (
        <JanelaDeAssinatura
          titulo="Cancelar a execução por engano"
          osId={osId}
          tom="perigo"
          resumo="A execução é apagada e a APR volta para uso."
          rotuloConfirmar="Assinar e cancelar"
          aoConfirmar={cancelar}
          aoFechar={() => setJanela(null)}
        />
      ) : null}
    </View>
  );
}

/**
 * O primeiro passo do encerramento: a confirmação. Avisa que o tempo para ali e que a execução não pode ser retomada. Ao confirmar, grava o
 * fim e a localização (`execucao_encerrada`); a tela segue sozinha para o preenchimento e a assinatura do responsável.
 */
function JanelaDeConfirmarEncerramento({ osId, execucaoId, aoFechar }: { osId: string; execucaoId: string; aoFechar: () => void }) {
  const atualizarDepois = useAtualizarDepoisDoEvento();
  const { ocupado, erro, executar } = useAcao();
  const [parou, setParou] = useState(false);

  const confirmar = () =>
    executar(async () => {
      const posicao = await obterPosicao();
      await enviarEvento({ tipo: "execucao_encerrada", os_id: osId, payload: { execucao_id: execucaoId, fim: new Date().toISOString(), ...comPosicao(posicao) } });
      setParou(true);
      await atualizarDepois();
    });

  return (
    <JanelaDeFormulario titulo="Encerrar a OS?" aoFechar={ocupado || parou ? () => undefined : aoFechar}>
      <Aviso tom="al" icone="time-outline" titulo="O tempo para agora e a execução não pode ser retomada.">
        Depois da confirmação, você responde o que falta (checklist, descrição e fotos, se houver) e assina o encerramento. Esse preenchimento não conta no tempo.
      </Aviso>
      <AvisoDeLocalizacao />
      {erro ? <Aviso tom="blq">{erro.mensagem}</Aviso> : null}
      <Botao titulo={parou ? "Tempo parado…" : ocupado ? "Encerrando…" : "Encerrar e parar o tempo"} icone="checkmark" enviando={ocupado || parou} aoPressionar={() => void confirmar()} />
      <Botao titulo="Voltar à execução" variante="texto" aoPressionar={ocupado || parou ? () => undefined : aoFechar} />
    </JanelaDeFormulario>
  );
}

const estilos = StyleSheet.create({
  tela: { gap: espaco.m },
  acoes: { gap: espaco.s },
  linha: { flexDirection: "row", gap: espaco.s },
  metade: { flex: 1 },
  texto: { fontSize: 14, lineHeight: 20, color: cores.tinta2 },
  suave: { fontSize: 13, lineHeight: 19, color: cores.tinta4 },
  nome: { fontSize: 14, fontWeight: "700", color: cores.tinta },
  negrito: { fontWeight: "700", color: cores.tinta3 },
  explicacao: { gap: 2, padding: espaco.s, borderRadius: raio.s, backgroundColor: cores.superficie2 },
});
