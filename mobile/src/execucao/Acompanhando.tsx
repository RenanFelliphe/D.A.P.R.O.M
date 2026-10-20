import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MOTIVOS_DA_PAUSA, MOTIVOS_DA_SUSPENSAO, rotuloDoMotivo } from "@shared/api/execucao-motivos";
import { pedeAprovacaoDoResponsavel, pedidoAberto } from "@shared/api/execucao-pedidos";
import type { Situacao } from "@shared/api/execucao-situacao";
import { participantesAtivos } from "@shared/api/execucao-tempo";
import { hora } from "@shared/api/formatar";
import { comPosicao } from "@shared/api/localizacao";
import { ehMotivoDeSaude } from "@shared/api/motivos-de-parada";
import { novoUuid } from "@shared/api/uuid";
import { useConexao } from "@/estado/conexao";
import { enviarEvento } from "@/offline/app";
import { obterPosicao } from "@/campo/localizacao";
import { useAcao, useAtualizarDepoisDoEvento } from "@/campo/useAcao";
import { cores, espaco, raio } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { mostrarAviso } from "@/ui/AvisoRapido";
import { Botao } from "@/ui/Botao";
import { Cartao, TituloDeCartao } from "@/ui/Cartao";
import { JanelaDeFormulario } from "@/ui/JanelaDeFormulario";
import { Selo } from "@/ui/Selo";
import { AvisoDeLocalizacao } from "./AvisoDeLocalizacao";
import { FormularioInterromper } from "./FormularioInterromper";
import { JanelaDeMotivo } from "./JanelaDeMotivo";
import { PedidoDoParticipante } from "./PedidoDoParticipante";
import { ResumoDoTempo } from "./ResumoDoTempo";

interface AcompanhandoProps {
  usuarioId: string;
  osId: string;
  numeroOrdem: string | null;
  titulo: string;
  local: string;
  situacao: Extract<Situacao, { tipo: "acompanhando" }>;
  /** Quando a tela leu a execução pela última vez (ms): a hora dos dados, para quem está sem sinal, e o ponto de partida da contagem do pedido. */
  atualizadoEm: number;
}

type Janela = "pausar" | "suspender" | "encerrar" | "continuar_saude" | null;

/**
 * A execução vista por quem participa da APR e não a iniciou (execução compartilhada): o mesmo cronômetro do responsável, as pausas com
 * o motivo, quem está na equipe e as ações. Pausar, continuar, interromper por risco e suspender por lesão ou enfermidade valem na hora
 * (o responsável é avisado); encerrar e suspender por outro motivo, com sinal, são um pedido ao responsável, que tem 2 minutos para
 * responder (sem resposta, é aprovado sozinho). Sem sinal nada é pedido: a ação vale na hora no aparelho e a conferência resolve depois.
 * A tela que a contém relê a execução sozinha.
 */
export function Acompanhando({ usuarioId, osId, numeroOrdem, titulo, local, situacao, atualizadoEm }: AcompanhandoProps) {
  const router = useRouter();
  const online = useConexao() === "online";
  const atualizarDepois = useAtualizarDepoisDoEvento();
  const { ocupado, erro, limparErro, executar } = useAcao();
  const [janela, setJanela] = useState<Janela>(null);
  const [interrompendo, setInterrompendo] = useState(false);
  const [semContinuar, setSemContinuar] = useState(false);
  const { execucao, participantes } = situacao;
  const responsavel = execucao.executor.nome;
  const pausaAberta = execucao.pausas.find((p) => !p.fim);
  const pedido = pedidoAberto(execucao);

  async function pausar(escolha: { motivo: string; complemento?: string }) {
    const posicao = await obterPosicao();
    await enviarEvento({ tipo: "pausa_iniciada", os_id: osId, payload: { id: novoUuid(), execucao_id: execucao.id, inicio: new Date().toISOString(), ...escolha, ...comPosicao(posicao) } });
    setJanela(null);
    await atualizarDepois();
  }

  const continuar = () =>
    executar(async () => {
      await enviarEvento({ tipo: "pausa_encerrada", os_id: osId, payload: { pausa_id: pausaAberta!.id, fim: new Date().toISOString() } });
      setJanela(null);
      await atualizarDepois();
    });

  async function suspender(escolha: { motivo: string; complemento?: string }) {
    const posicao = await obterPosicao();
    const agora = new Date().toISOString();
    if (online && pedeAprovacaoDoResponsavel("suspender", escolha.motivo)) {
      await enviarEvento({ tipo: "pedido_aberto", os_id: osId, payload: { id: novoUuid(), execucao_id: execucao.id, tipo: "suspender", instante: agora, ...escolha, ...comPosicao(posicao) } });
      mostrarAviso(`Pedido enviado — aguardando ${responsavel}`);
      setJanela(null);
      await atualizarDepois();
      return;
    }
    await enviarEvento({ tipo: "execucao_suspensa", os_id: osId, payload: { execucao_id: execucao.id, fim: agora, ...escolha, ...comPosicao(posicao) } });
    mostrarAviso("OS pendente — retome com APR nova");
    void atualizarDepois();
    router.dismissTo("/lista");
  }

  const encerrar = () =>
    executar(async () => {
      const posicao = await obterPosicao();
      const agora = new Date().toISOString();
      if (online && pedeAprovacaoDoResponsavel("encerrar")) {
        await enviarEvento({ tipo: "pedido_aberto", os_id: osId, payload: { id: novoUuid(), execucao_id: execucao.id, tipo: "encerrar", instante: agora, ...comPosicao(posicao) } });
        mostrarAviso(`Pedido enviado — aguardando ${responsavel}`);
      } else {
        // Sem sinal: o tempo para aqui e o preenchimento do encerramento é de quem encerrou.
        await enviarEvento({ tipo: "execucao_encerrada", os_id: osId, payload: { execucao_id: execucao.id, fim: agora, ...comPosicao(posicao) } });
      }
      setJanela(null);
      await atualizarDepois();
    });

  if (interrompendo) return <FormularioInterromper osId={osId} execucaoId={execucao.id} aoVoltar={() => setInterrompendo(false)} />;

  const jaHaPedido = () => {
    limparErro();
    return pedido !== null;
  };

  return (
    <View style={estilos.tela}>
      <ResumoDoTempo inicio={execucao.inicio} pausas={execucao.pausas} numeroPessoas={execucao.numero_pessoas} />

      {pedido ? (
        <PedidoDoParticipante osId={osId} usuarioId={usuarioId} responsavel={responsavel} pedido={pedido} recebidoEm={atualizadoEm} />
      ) : (
        <Aviso tom="info" icone="people-outline" titulo={`Você participa da execução de ${responsavel}.`}>
          {`Pausar, continuar e interromper por risco valem na hora, e ${responsavel} é avisado. Encerrar e suspender${online ? " pedem a resposta dele em até 2 minutos" : " valem na hora, porque você está sem sinal"}.`}
        </Aviso>
      )}

      <View style={estilos.acoes}>
        {erro ? <Aviso tom="blq">{erro.mensagem}</Aviso> : null}
        {semContinuar && pausaAberta ? <Aviso tom="al">Continue a execução para poder encerrá-la.</Aviso> : null}
        <Botao
          titulo={online ? "Pedir para encerrar a OS" : "Encerrar OS"}
          icone="checkmark"
          aoPressionar={() => {
            if (pausaAberta) return setSemContinuar(true);
            if (jaHaPedido()) return;
            setJanela("encerrar");
          }}
        />
        <View style={estilos.linha}>
          {pausaAberta ? (
            <Botao
              titulo="Continuar"
              icone="play"
              variante="secundario"
              bloco={false}
              estilo={estilos.metade}
              enviando={ocupado}
              aoPressionar={() => {
                limparErro();
                if (ehMotivoDeSaude(pausaAberta.motivo)) setJanela("continuar_saude");
                else void continuar();
              }}
            />
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
            if (jaHaPedido()) return;
            setJanela("suspender");
          }}
        />
      </View>

      <Cartao>
        <TituloDeCartao>Quem está na execução</TituloDeCartao>
        {participantesAtivos(participantes).map((p) => (
          <View key={p.usuario_id} style={estilos.pessoa}>
            <Text style={estilos.nome}>{p.usuario_id === usuarioId ? `${p.nome} (você)` : p.nome}</Text>
            {p.usuario_id === execucao.executor.id ? <Selo tom="exe">Responsável pela execução</Selo> : null}
          </View>
        ))}
      </Cartao>

      <Cartao>
        <TituloDeCartao>Pausas</TituloDeCartao>
        {execucao.pausas.length === 0 ? <Text style={estilos.suave}>Nenhuma pausa até agora.</Text> : null}
        {execucao.pausas.map((p) => (
          <View key={p.id} style={estilos.pausa}>
            <Text style={estilos.nome}>{p.complemento ? `${rotuloDoMotivo(p.motivo)} — ${p.complemento}` : rotuloDoMotivo(p.motivo)}</Text>
            <Text style={estilos.suave}>
              {`${p.fim ? `${hora(p.inicio)} às ${hora(p.fim)}` : `Desde ${hora(p.inicio)} (em andamento)`}${p.iniciada_por && p.iniciada_por.id !== execucao.executor.id ? ` · por ${p.iniciada_por.nome}` : ""}`}
            </Text>
          </View>
        ))}
        {pausaAberta ? <Text style={estilos.suave}>O tempo de pausa não entra no tempo líquido.</Text> : null}
      </Cartao>

      <Cartao>
        <TituloDeCartao>Atividade em andamento</TituloDeCartao>
        <Text style={estilos.texto}>{`${numeroOrdem ?? "—"} · ${titulo}`}</Text>
        <Text style={estilos.suave}>{`Local: ${local}`}</Text>
        <Text style={estilos.suave}>{`Atualizado às ${hora(new Date(atualizadoEm))}`}</Text>
      </Cartao>
      <AvisoDeLocalizacao />

      {janela === "pausar" ? (
        <JanelaDeMotivo
          titulo="Pausar a execução"
          deQue="da pausa"
          resumo={`Pausa curta: só o tempo líquido para, e “Continuar” retoma com a mesma APR. ${responsavel} é avisado. Diga o motivo.`}
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
          resumo={`Suspender termina a execução. Por lesão ou enfermidade vale na hora; por outro motivo${online ? `, você pede a ${responsavel}, que tem 2 minutos para responder` : " vale na hora, porque você está sem sinal"}. Diga o motivo.`}
          opcoes={MOTIVOS_DA_SUSPENSAO}
          rotuloConfirmar={online ? "Suspender ou pedir" : "Suspender"}
          rotuloEnviando="Enviando…"
          aoConfirmar={suspender}
          aoFechar={() => setJanela(null)}
        />
      ) : null}
      {janela === "encerrar" ? (
        <JanelaDeFormulario titulo={online ? "Pedir para encerrar a OS?" : "Encerrar a OS?"} aoFechar={ocupado ? () => undefined : () => setJanela(null)}>
          <Aviso tom="al" icone="time-outline" titulo={online ? `O tempo para no instante do seu pedido, se ${responsavel} aprovar.` : "O tempo para agora e a execução não pode ser retomada."}>
            {online
              ? `${responsavel} tem 2 minutos para aprovar ou recusar; sem resposta, o pedido é aprovado sozinho. Aprovado, quem assina o encerramento é você.`
              : "Você está sem sinal: o encerramento vale na hora, e quem encerra assina o encerramento. A equipe confere o que cada aparelho registrou quando todos sincronizarem."}
          </Aviso>
          <AvisoDeLocalizacao />
          {erro ? <Aviso tom="blq">{erro.mensagem}</Aviso> : null}
          <Botao titulo={ocupado ? "Enviando…" : online ? "Pedir para encerrar" : "Encerrar e parar o tempo"} icone="checkmark" enviando={ocupado} aoPressionar={() => void encerrar()} />
          <Botao titulo="Voltar à execução" variante="texto" aoPressionar={ocupado ? () => undefined : () => setJanela(null)} />
        </JanelaDeFormulario>
      ) : null}
      {janela === "continuar_saude" && pausaAberta ? (
        <JanelaDeFormulario titulo="Retomar a execução?" aoFechar={ocupado ? () => undefined : () => setJanela(null)}>
          <Aviso tom="blq" icone="medkit-outline" titulo={`A execução está pausada por ${rotuloDoMotivo(pausaAberta.motivo).toLowerCase()}.`}>
            Só continue se a pessoa está bem e o serviço pode voltar com segurança. O responsável é avisado.
          </Aviso>
          {erro ? <Aviso tom="blq">{erro.mensagem}</Aviso> : null}
          <Botao titulo="Está tudo bem: continuar" icone="play" enviando={ocupado} aoPressionar={() => void continuar()} />
          <Botao titulo="Voltar" variante="texto" aoPressionar={ocupado ? () => undefined : () => setJanela(null)} />
        </JanelaDeFormulario>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { gap: espaco.m },
  acoes: { gap: espaco.s },
  linha: { flexDirection: "row", gap: espaco.s },
  metade: { flex: 1 },
  pessoa: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: espaco.s },
  pausa: { gap: 2, padding: espaco.s, borderRadius: raio.s, backgroundColor: cores.superficie2 },
  texto: { fontSize: 14, lineHeight: 20, color: cores.tinta2 },
  suave: { fontSize: 13, lineHeight: 19, color: cores.tinta4 },
  nome: { fontSize: 14, fontWeight: "700", color: cores.tinta },
});
