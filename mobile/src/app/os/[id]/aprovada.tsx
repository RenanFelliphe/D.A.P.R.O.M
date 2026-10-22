import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { estaTravada, resumoDe } from "@shared/api/apr";
import { dataHora } from "@shared/api/formatar";
import type { RespostaComPontos } from "@shared/api/gamificacao";
import { aprDeHoje, rotuloDaOs, situacaoDaApr, type AprDaOs } from "@shared/api/os-app";
import { execucaoJaTerminou, type Usuario } from "@shared/api/tipos";
import { enviarEvento } from "@/offline/app";
import { mensagemDoErro } from "@/api/erros";
import { montarPayloadComClima } from "@/apr/clima-da-apr";
import { useColegasDaEquipe } from "@/apr/consultas";
import { equipeDaApr } from "@/apr/equipe";
import { CartaoDeAssinatura, JanelaDeRecusa, type LinhaDeAssinatura } from "@/apr/AssinaturasDaApr";
import { useRascunhoApr } from "@/apr/rascunho";
import { AvisoDePontos } from "@/campo/AvisoDePontos";
import { JanelaDeAssinatura } from "@/campo/JanelaDeAssinatura";
import { useAcao, useAtualizarDepoisDoEvento } from "@/campo/useAcao";
import { useDetalheDaOs } from "@/os/consultas";
import { rotas } from "@/os/rotas";
import { useSessao } from "@/sessao/SessaoProvider";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { Cartao, TituloDeCartao } from "@/ui/Cartao";
import { Carregando, Vazio } from "@/ui/Estados";
import { Tela } from "@/ui/Tela";

/**
 * A APR aprovada, etapa 3 de 3. Depois de "Concluir e validar", a APR é registrada na hora (sem assinaturas) e esta tela mostra o
 * estado de cada participante: assinou (com a hora), pendente ou recusou (com o motivo). Cada um assina na própria conta; a pessoa
 * logada, se ainda não assinou, assina ("Assinar a APR") ou recusa (o direito de recusa, com motivo). A tela se atualiza sozinha para
 * ver os colegas assinando. A execução só começa quando todos que ficaram na APR assinaram; se a APR deixou de servir (o responsável
 * recusou, ou restaram menos de 2), a tela diz por quê e leva a uma APR nova.
 */
export default function Aprovada() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { eu } = useSessao();
  const detalhe = useDetalheDaOs(id, { atualizarACadaMs: 10_000 });
  const colegas = useColegasDaEquipe(detalhe.data?.os.equipe_id);

  if (detalhe.isPending || !eu) return <Carregando texto="Abrindo a APR…" />;
  if (detalhe.isError) return <Vazio icone="cloud-offline-outline" titulo="Não foi possível abrir a OS" texto={mensagemDoErro(detalhe.error)} acao={{ titulo: "Tentar de novo", aoPressionar: () => void detalhe.refetch() }} />;
  const { os, aprs, execucoes } = detalhe.data;
  // Depois da execução (ou sem ela, cancelada ou devolvida) não há mais o que assinar.
  if (execucaoJaTerminou(os.status) || os.status === "cancelada" || os.status === "devolvida") return <Redirect href={rotas.os(id)} />;

  return (
    <>
      <Stack.Screen options={{ title: "APR aprovada" }} />
      <TelaDasAssinaturas
        osId={os.id}
        rotulo={rotuloDaOs(os)}
        local={os.local_instalacao.codigo}
        usuario={eu.usuario}
        equipe={colegas.data ? equipeDaApr(colegas.data, eu.usuario) : []}
        // Só a APR de que a pessoa participou: é ela que assina e usa para iniciar a execução.
        registrada={aprDeHoje(aprs, execucoes, eu.usuario.id)}
      />
    </>
  );
}

interface TelaDasAssinaturasProps {
  osId: string;
  rotulo: string;
  local: string;
  usuario: Usuario;
  /** A equipe da OS: só para dar nome aos participantes enquanto a APR validada ainda não foi registrada. */
  equipe: ReturnType<typeof equipeDaApr>;
  registrada: AprDaOs | null;
}

function TelaDasAssinaturas({ osId, rotulo, local, usuario, equipe, registrada }: TelaDasAssinaturasProps) {
  const router = useRouter();
  const usuarioId = usuario.id;
  const atualizarDepois = useAtualizarDepoisDoEvento();
  const { rascunho, descartar } = useRascunhoApr(osId, usuarioId);
  const { ocupado: registrando, erro: erroDoRegistro, executar } = useAcao();
  const [pontos, setPontos] = useState<RespostaComPontos | null>(null);
  const [janela, setJanela] = useState<"assinar" | "recusar" | null>(null);

  if (rascunho === undefined) return <Carregando texto="Abrindo a APR…" />;

  // O rascunho aprovado cujo registro já chegou à `api` (o envio deu certo, mas a limpeza não): não é mais pendente.
  const jaRegistrado = Boolean(rascunho && registrada && registrada.id === rascunho.aprId);
  // Aprovada pela `api`, mas ainda não registrada (a conexão falhou ao registrar): falta só enviar.
  const pendente = rascunho && !jaRegistrado && rascunho.concluidaEm && rascunho.avaliacao?.resultado === "aprovada" ? rascunho : null;
  const apr = pendente ? null : registrada;

  if (!apr && !pendente) {
    return (
      <Tela bordas={["bottom"]}>
        <Cartao>
          <TituloDeCartao>{!rascunho ? "Não há APR aprovada aguardando assinaturas para esta OS." : estaTravada(rascunho) ? "Esta APR reprovou e já está registrada como bloqueada." : "Esta APR ainda não foi concluída."}</TituloDeCartao>
          <Text style={estilos.suave}>
            {!rascunho
              ? "Volte à OS para fazer uma APR nova ou ver as anteriores."
              : estaTravada(rascunho)
                ? "Falta anexar a evidência dos itens reprovados, no checklist."
                : "Termine o checklist e use “Concluir e validar” para registrar a APR."}
          </Text>
          <Botao titulo={rascunho ? "Continuar a APR" : "Voltar à OS"} aoPressionar={() => router.replace(rascunho ? rotas.checklist(osId) : rotas.os(osId))} />
        </Cartao>
      </Tela>
    );
  }

  const linhas: LinhaDeAssinatura[] = apr
    ? apr.participantes.map((p) => ({
        usuarioId: p.usuario_id,
        nome: p.nome,
        funcao: p.funcao,
        assinaturaPath: p.assinatura_path,
        assinadaEm: p.assinada_em,
        presencial: p.assinatura_presencial,
        recusouEm: p.recusou_em,
        recusaMotivo: p.recusa_motivo,
        eu: p.usuario_id === usuarioId,
      }))
    : pendente!.participantes.map((p) => ({
        usuarioId: p.usuarioId,
        nome: equipe.find((c) => c.id === p.usuarioId)?.nome ?? "Participante",
        funcao: p.funcao,
        assinaturaPath: null,
        assinadaEm: null,
        eu: p.usuarioId === usuarioId,
      }));

  const itens = apr ? (apr.itens_respondidos ?? apr.respostas.length) : resumoDe(pendente!).perguntas.length;
  const semValidar = Boolean(apr?.aguardando_validacao);
  const modelo = apr ? apr.modelo : pendente!.modelo;
  const situacao = apr ? situacaoDaApr(apr) : null;
  const minha = apr?.participantes.find((p) => p.usuario_id === usuarioId);
  const euAssinei = Boolean(minha?.assinada_em);
  const euRecusei = Boolean(minha?.recusou_em);
  const faltam = situacao?.faltam.map((p) => p.nome) ?? [];

  /** Só falta enviar: a APR validada vai para a `api`, que a registra sem assinaturas. */
  const registrar = () =>
    executar(async () => {
      const r = pendente!;
      const resposta = await enviarEvento({ id: r.eventoId, tipo: "apr_concluida", os_id: osId, payload: montarPayloadComClima(r) });
      const resultado = (resposta.aprs.find((a) => a.id === r.aprId) ?? resposta.aprs[0])?.resultado;
      descartar();
      void atualizarDepois();
      // A `api` é quem decide: se ela bloqueou, vale o impedimento.
      if (resultado === "bloqueada") router.replace(rotas.bloqueio(osId));
    });

  async function assinar() {
    const resposta = await enviarEvento({ tipo: "apr_assinada", os_id: osId, payload: { apr_id: apr!.id, assinada_em: new Date().toISOString() } });
    setPontos(resposta);
    void atualizarDepois();
  }

  async function recusar(motivo: string) {
    await enviarEvento({ tipo: "apr_recusada", os_id: osId, payload: { apr_id: apr!.id, motivo, recusada_em: new Date().toISOString() } });
    setJanela(null);
    void atualizarDepois();
  }

  return (
    <Tela bordas={["bottom"]}>
      <Text style={estilos.etapa}>{`${rotulo} · ${local} · Etapa 3 de 3`}</Text>
      {semValidar ? (
        <Aviso tom="al" icone="cloud-offline-outline" titulo="APR registrada sem sinal, aguardando validação.">
          {`${modelo.codigo} v${modelo.versao} · registrada em ${dataHora(apr!.concluida_em)}. Os participantes presentes assinaram por este aparelho. O servidor valida a APR quando o sinal voltar; se ela reprovar, o supervisor é avisado.`}
        </Aviso>
      ) : (
        <Aviso tom="ok" icone="checkmark-circle-outline" titulo="APR aprovada.">
          {`${itens > 0 ? `${itens} de ${itens} itens respondidos · ` : ""}${modelo.codigo} v${modelo.versao}${apr ? ` · registrada em ${dataHora(apr.concluida_em)}` : ""}.`}
        </Aviso>
      )}

      {pendente && erroDoRegistro ? <Aviso tom="blq">{erroDoRegistro.mensagem}</Aviso> : null}

      {situacao?.inviavel ? (
        <Aviso tom="blq" icone="stop-circle-outline" titulo="Esta APR não serve mais.">{`${situacao.motivoInviavel} Faça uma APR nova para executar a OS.`}</Aviso>
      ) : null}

      <View style={estilos.acoes}>
        {pendente ? (
          <>
            <Aviso tom="al" titulo="A APR foi aprovada, mas ainda não foi registrada no sistema (a conexão falhou).">Registre para que cada participante receba o aviso e assine.</Aviso>
            <Botao titulo={registrando ? "Registrando…" : "Registrar a APR"} enviando={registrando} aoPressionar={() => void registrar()} />
            <Botao
              titulo="Descartar e fazer uma APR nova"
              variante="texto"
              aoPressionar={() => {
                descartar();
                router.replace(rotas.apr(osId));
              }}
            />
          </>
        ) : situacao!.inviavel ? (
          <>
            <Botao titulo="Fazer uma APR nova" aoPressionar={() => router.replace(rotas.apr(osId))} />
            <Botao titulo="Voltar à OS" variante="secundario" aoPressionar={() => router.replace(rotas.os(osId))} />
          </>
        ) : euRecusei ? (
          <>
            <Aviso tom="info" icone="person-outline" titulo="Você recusou esta APR e saiu dela.">
              O supervisor foi avisado. Os demais participantes seguem; se o responsável também recusar ou restarem menos de 2, será preciso uma APR nova.
            </Aviso>
            <Botao titulo="Voltar à OS" variante="secundario" aoPressionar={() => router.replace(rotas.os(osId))} />
          </>
        ) : (
          <>
            {!euAssinei ? (
              <>
                <Aviso tom="info" icone="create-outline" titulo="Falta a sua assinatura.">
                  Você assina com a assinatura do seu perfil. Se não concorda com a APR, use o direito de recusa.
                </Aviso>
                <Botao titulo="Assinar a APR" icone="checkmark" aoPressionar={() => setJanela("assinar")} />
                <Botao titulo="Recusar a APR (direito de recusa)" variante="perigo" aoPressionar={() => setJanela("recusar")} />
              </>
            ) : (
              <AvisoDePontos resposta={pontos} />
            )}
            {situacao!.pronta ? (
              <>
                <Aviso tom="ok" icone="lock-open-outline" titulo={`${rotulo} liberada para execução.`}>
                  Todos assinaram. A APR vale só para esta OS e para hoje. Para outra OS, outra APR.
                </Aviso>
                <Botao titulo={`Iniciar a execução · ${rotulo}`} icone="play" aoPressionar={() => router.replace(rotas.execucao(osId))} />
              </>
            ) : euAssinei ? (
              <Aviso tom="info" icone="time-outline" titulo="Você assinou.">
                {`Falta a assinatura de ${faltam.join(", ")}. A execução só pode ser iniciada quando todos assinarem; esta tela se atualiza sozinha.`}
              </Aviso>
            ) : null}
          </>
        )}
      </View>

      <Text accessibilityRole="header" style={estilos.titulo}>
        Assinaturas
      </Text>
      <Text style={estilos.suave}>
        {semValidar
          ? "Sem sinal, os participantes presentes assinaram juntos, por este aparelho. A execução já pode começar."
          : "Todos os participantes assinam a APR, cada um na própria conta, só agora, no começo. A execução começa quando todos que ficaram na APR tiverem assinado."}
      </Text>
      {linhas.map((linha) => (
        <CartaoDeAssinatura key={linha.usuarioId} linha={linha} />
      ))}

      {janela === "assinar" && apr ? (
        <JanelaDeAssinatura
          titulo="Assinar a APR"
          resumo={`Você assina a APR da ${rotulo} (${modelo.codigo} v${modelo.versao}), declarando que concorda com ela e está em condições de executar o serviço.`}
          rotuloConfirmar="Assinar a APR"
          aoConfirmar={assinar}
          aoFechar={() => setJanela(null)}
        />
      ) : null}
      {janela === "recusar" && apr ? <JanelaDeRecusa aoRecusar={recusar} aoFechar={() => setJanela(null)} /> : null}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  etapa: { fontSize: 13, fontWeight: "600", color: cores.marca },
  acoes: { gap: espaco.s },
  titulo: { fontSize: 16, fontWeight: "700", color: cores.tinta, marginTop: espaco.s },
  suave: { fontSize: 13, lineHeight: 19, color: cores.tinta4 },
});
