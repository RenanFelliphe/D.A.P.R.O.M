import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { definirSituacao } from "@shared/api/execucao-situacao";
import type { RespostaComPontos } from "@shared/api/gamificacao";
import { mensagemDoErro } from "@/api/erros";
import { EmAndamento } from "@/execucao/EmAndamento";
import { ExecucaoEncerrada } from "@/execucao/ExecucaoEncerrada";
import { FormularioEncerrar } from "@/execucao/FormularioEncerrar";
import { IniciarExecucao } from "@/execucao/IniciarExecucao";
import { SuspenderEsquecida } from "@/execucao/SuspenderEsquecida";
import { useDetalheParaExecutar } from "@/execucao/consultas";
import { useExecucoesAbertas } from "@/os/consultas";
import { rotas } from "@/os/rotas";
import { useSessao } from "@/sessao/SessaoProvider";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { Carregando, Vazio } from "@/ui/Estados";
import { Selo } from "@/ui/Selo";
import { Tela } from "@/ui/Tela";

/**
 * A execução da OS: escolhe o que mostrar conforme a situação que a `api` informa (`definirSituacao`, a mesma regra da web): iniciar,
 * em andamento, encerrando (o preenchimento e a assinatura), à espera das assinaturas da APR, de outra pessoa, terminada e as demais.
 */
export default function Execucao() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { eu } = useSessao();
  const detalhe = useDetalheParaExecutar(id);
  const abertas = useExecucoesAbertas();
  /** O responsável acabou de assinar o encerramento: a tela final, com os pontos, vale até a OS atualizar. */
  const [assinada, setAssinada] = useState(false);
  const [pontos, setPontos] = useState<RespostaComPontos | null>(null);

  const situacao = useMemo(
    () =>
      detalhe.data && abertas.data && eu
        ? definirSituacao({
            osStatus: detalhe.data.os.status,
            usuarioId: eu.usuario.id,
            execucoes: detalhe.data.execucoes,
            aprs: detalhe.data.aprs,
            abertas: abertas.data,
            agora: new Date(),
            reservadaPara: detalhe.data.os.responsavel ?? null,
          })
        : null,
    [detalhe.data, abertas.data, eu],
  );

  if (detalhe.isPending || abertas.isPending || !eu) return <Carregando texto="Abrindo a execução…" />;
  const falha = detalhe.error ?? abertas.error;
  if (falha || !detalhe.data || !situacao) {
    return (
      <Vazio
        icone="cloud-offline-outline"
        titulo="Não foi possível abrir a execução"
        texto={mensagemDoErro(falha)}
        acao={{ titulo: "Tentar de novo", aoPressionar: () => void Promise.all([detalhe.refetch(), abertas.refetch()]) }}
      />
    );
  }

  const { os } = detalhe.data;
  const emPausa = situacao.tipo === "em_andamento" && situacao.execucao.pausas.some((p) => !p.fim);
  const voltarParaALista = <Botao titulo="Voltar à lista" variante="secundario" aoPressionar={() => router.dismissTo("/lista")} />;
  const voltarParaAOs = <Botao titulo="Voltar à OS" variante="secundario" aoPressionar={() => router.replace(rotas.os(id))} />;

  let corpo: React.ReactNode;
  if (assinada) corpo = <ExecucaoEncerrada osId={id} status="aguardando_supervisor" pontos={pontos} />;
  else if (situacao.tipo === "esquecida") corpo = <SuspenderEsquecida execucao={situacao.execucao} />;
  else if (situacao.tipo === "em_andamento") corpo = <EmAndamento osId={id} numeroOrdem={os.numero_ordem} titulo={os.titulo} local={os.local_instalacao.codigo} situacao={situacao} />;
  else if (situacao.tipo === "encerrando") {
    corpo = (
      <FormularioEncerrar
        execucao={situacao.execucao}
        osId={id}
        checklist={detalhe.data.checklist_inspecao ?? []}
        aoConcluir={(resposta) => {
          setPontos(resposta);
          setAssinada(true);
        }}
      />
    );
  } else if (situacao.tipo === "iniciar") corpo = <IniciarExecucao osId={id} apr={situacao.apr} />;
  else if (situacao.tipo === "aguardando_assinaturas") {
    corpo = (
      <>
        <Text style={estilos.titulo}>A APR ainda não foi assinada por todos</Text>
        <Aviso tom="al" icone="create-outline">
          {`A execução só começa quando todos os participantes da APR assinaram, cada um na própria conta. Falta a assinatura de ${situacao.faltam.join(", ")}.`}
        </Aviso>
        <Botao titulo={situacao.euFalto ? "Assinar a APR" : "Acompanhar as assinaturas"} aoPressionar={() => router.replace(rotas.aprovada(id))} />
      </>
    );
  } else if (situacao.tipo === "outra_pessoa") {
    corpo = (
      <>
        <Aviso tom="al" icone="people-outline">
          {situacao.encerrando
            ? `${situacao.executor} encerrou esta OS e está preenchendo e assinando o encerramento. Só o responsável pela execução assina.`
            : `Esta OS está em execução por ${situacao.executor}. Só quem iniciou a execução pode pausar, suspender ou encerrar.`}
        </Aviso>
        {voltarParaALista}
      </>
    );
  } else if (situacao.tipo === "terminada") corpo = <ExecucaoEncerrada osId={id} status={situacao.status} />;
  else if (situacao.tipo === "fechada") {
    corpo = (
      <>
        <Aviso tom="info" icone="lock-closed-outline">
          Esta OS foi cancelada e não pode ser executada.
        </Aviso>
        {voltarParaALista}
      </>
    );
  } else if (situacao.tipo === "devolvida" || situacao.tipo === "reservada") {
    corpo = (
      <>
        <Aviso tom="info" icone="lock-closed-outline">
          {situacao.tipo === "devolvida" ? "Esta OS foi devolvida ao SAP pelo supervisor e não pode ser executada." : `Esta OS está reservada para ${situacao.responsavel}. Só quem o supervisor designou inicia a execução.`}
        </Aviso>
        {voltarParaALista}
      </>
    );
  } else {
    corpo = (
      <>
        <Text style={estilos.titulo}>Preencha a APR antes de iniciar</Text>
        <Aviso tom="al" icone="clipboard-outline">
          Para iniciar a execução é preciso uma APR aprovada hoje para esta OS, assinada por todos os participantes e ainda não usada. Se a anterior deixou de servir (alguém recusou), preencha uma APR nova e volte aqui.
        </Aviso>
        <Botao titulo="Preencher a APR" aoPressionar={() => router.replace(rotas.apr(id))} />
        {voltarParaAOs}
      </>
    );
  }

  return (
    <Tela bordas={["bottom"]}>
      <Stack.Screen options={{ title: "Execução" }} />
      <View style={estilos.cabecalho}>
        <Text style={estilos.ordem}>{`OS ${os.numero_ordem ?? "—"}`}</Text>
        {situacao.tipo === "em_andamento" && !assinada ? <Selo tom={emPausa ? "al" : "exe"}>{emPausa ? "Em pausa" : "Em execução"}</Selo> : null}
        {!assinada && situacao.tipo === "encerrando" ? <Selo tom="al">Encerrando</Selo> : null}
        {assinada ? <Selo tom="al">Aguardando o supervisor</Selo> : null}
        {!assinada && situacao.tipo === "terminada" ? <Selo tom={situacao.status === "encerrada" ? "enc" : "al"}>{situacao.status === "encerrada" ? "Encerrada" : "Aguardando o supervisor"}</Selo> : null}
      </View>
      <Text style={estilos.suave}>{`${os.titulo} · ${os.local_instalacao.codigo}`}</Text>
      {corpo}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: espaco.s },
  ordem: { fontSize: 16, fontWeight: "700", color: cores.tinta },
  suave: { fontSize: 13, color: cores.tinta4 },
  titulo: { fontSize: 18, fontWeight: "700", color: cores.tinta },
});
