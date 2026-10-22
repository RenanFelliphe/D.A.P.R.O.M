import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { frasePendenteDosConvites, pendenciaDosConvites } from "@shared/api/apr-convite";
import { avisoAoDescartar, continuaNasAssinaturas, doModeloCompleto, estaTravada, MIN_PARTICIPANTES, novoRascunho, riscosEquivalentes, totalDePerguntas, type Funcao, type ModeloCompleto } from "@shared/api/apr";
import { execucaoAberta, reservadaParaOutro, rotuloDaOs } from "@shared/api/os-app";
import { execucaoJaTerminou, type Usuario } from "@shared/api/tipos";
import { ErroDaApi, mensagemDoErro } from "@/api/erros";
import { useAcoesDeConvite, useConvitesDaOs } from "@/convites/consultas";
import { conviteADesfazer, quemConvidar } from "@/convites/regras";
import { useConexao } from "@/estado/conexao";
import { carregarModeloPublicado, useColegasDaEquipe, useEscolhaDoModelo } from "@/apr/consultas";
import { equipeDaApr } from "@/apr/equipe";
import { JanelaDeModelos } from "@/apr/JanelaDeModelos";
import { ParticipantesApr, RiscosApr } from "@/apr/ParticipantesERiscos";
import { useRascunhoApr } from "@/apr/rascunho";
import { TelaSemAcesso } from "@/campo/TelaSemAcesso";
import { useDetalheDaOs } from "@/os/consultas";
import { rotas } from "@/os/rotas";
import { useSessao } from "@/sessao/SessaoProvider";
import { cores, espaco, raio } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { Cartao, TituloDeCartao } from "@/ui/Cartao";
import { Carregando, Vazio } from "@/ui/Estados";
import { JanelaDeConfirmacao } from "@/ui/Janela";
import { Tela } from "@/ui/Tela";
import { useFormulario, useValorDoForm } from "@/ui/useFormulario";

/**
 * Nova APR, etapa 1 de 3: o modelo, os participantes e os riscos. Quem escolhe o modelo é sempre o técnico: a janela de escolha abre
 * ao entrar, com o recomendado em destaque, e o modelo ainda pode ser trocado no checklist. Cada APR nasce vazia; o rascunho fica no
 * aparelho até ela ser concluída.
 */
export default function NovaApr() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { eu } = useSessao();
  const detalhe = useDetalheDaOs(id);
  const equipeId = detalhe.data?.os.equipe_id;
  const colegas = useColegasDaEquipe(equipeId);
  const escolha = useEscolhaDoModelo(id);

  if (detalhe.isPending || !eu) return <Carregando texto="Abrindo a OS…" />;
  if (detalhe.isError) return <Vazio icone="cloud-offline-outline" titulo="Não foi possível abrir a OS" texto={mensagemDoErro(detalhe.error)} acao={{ titulo: "Tentar de novo", aoPressionar: () => void detalhe.refetch() }} />;

  const { os, execucoes } = detalhe.data;
  const usuario = eu.usuario;
  const titulo = <Stack.Screen options={{ title: "Nova APR" }} />;

  // Depois da execução, ou sem ela (cancelada, devolvida), não há mais APR a fazer.
  if (execucaoJaTerminou(os.status) || os.status === "cancelada" || os.status === "devolvida") return <Redirect href={rotas.os(id)} />;

  // O ausente só visualiza: não aplica APR (a `api` também recusa).
  if (eu.ausencia) {
    return (
      <>
        {titulo}
        <TelaSemAcesso tom="al" icone="lock-closed-outline" titulo={`${eu.ausencia.rotulo}.`} texto="Você só visualiza o sistema: não dá para aplicar APR enquanto estiver ausente." />
      </>
    );
  }
  const aberta = execucaoAberta(execucoes);
  if (os.status === "em_execucao" || aberta) {
    return (
      <>
        {titulo}
        <TelaSemAcesso titulo="Esta OS já está em execução" texto={`${aberta ? `por ${aberta.executor.nome}. ` : ""}Só dá para fazer uma APR nova depois que a execução for encerrada, suspensa ou interrompida.`} />
      </>
    );
  }
  // OS reservada a outra pessoa: só o responsável aplica a APR (a `api` também recusa).
  if (reservadaParaOutro(os, usuario.id)) {
    return (
      <>
        {titulo}
        <TelaSemAcesso icone="lock-closed-outline" titulo={`Esta OS está reservada para ${os.responsavel!.nome}.`} texto="Só quem o supervisor designou aplica a APR e inicia a execução." />
      </>
    );
  }
  if (colegas.isPending) return <Carregando texto="Carregando a equipe…" />;
  if (colegas.isError) return <Vazio icone="cloud-offline-outline" titulo="Não foi possível carregar a equipe" texto={mensagemDoErro(colegas.error)} acao={{ titulo: "Tentar de novo", aoPressionar: () => void colegas.refetch() }} />;

  return (
    <>
      {titulo}
      <FormularioDaApr
        osId={os.id}
        rotulo={rotuloDaOs(os)}
        tituloDaOs={os.titulo}
        local={os.local_instalacao.codigo}
        reservada={Boolean(os.responsavel)}
        usuario={usuario}
        equipe={equipeDaApr(colegas.data, usuario)}
        escolha={escolha.data}
        carregandoEscolha={escolha.isPending}
        erroDaEscolha={escolha.isError ? (escolha.error instanceof ErroDaApi ? escolha.error.message : "Não foi possível carregar os modelos.") : null}
      />
    </>
  );
}

interface FormularioDaAprProps {
  osId: string;
  rotulo: string;
  tituloDaOs: string;
  local: string;
  /** `reservada`: o supervisor reservou a OS a quem está aplicando a APR, que é o responsável e não o troca. */
  reservada: boolean;
  usuario: Usuario;
  equipe: ReturnType<typeof equipeDaApr>;
  escolha: ReturnType<typeof useEscolhaDoModelo>["data"];
  carregandoEscolha: boolean;
  erroDaEscolha: string | null;
}

function FormularioDaApr({ osId, rotulo, tituloDaOs, local, reservada, usuario, equipe, escolha, carregandoEscolha, erroDaEscolha }: FormularioDaAprProps) {
  const router = useRouter();
  const usuarioId = usuario.id;
  const { rascunho, gravar, descartar } = useRascunhoApr(osId, usuarioId);
  const [modelo, setModelo] = useState<ModeloCompleto | null>(null);
  /** `auto`: abre sozinha enquanto não há modelo escolhido, uma vez. */
  const [janela, setJanela] = useState<"auto" | "aberta" | "fechada">("auto");
  const [carregandoModelo, setCarregandoModelo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [responsavelId, setResponsavelId] = useState(usuarioId);
  const [riscos, setRiscos] = useState<string[]>([]);
  const [descartando, setDescartando] = useState(false);
  const [convidando, setConvidando] = useState(false);
  // O convite é do servidor: só com sinal. Sem ele vale o presencial de sempre (ninguém é cobrado por convite que não existe).
  const online = useConexao() === "online";
  const convitesDaOs = useConvitesDaOs(osId, rascunho === null);
  const acoesDeConvite = useAcoesDeConvite(osId);
  const convites = online ? convitesDaOs.data : undefined;

  // A APR exige ao menos 2 participantes e um modelo escolhido. O botão não fica parado: faltando algo, a mensagem aparece junto do que falta.
  const esquema = useMemo(
    () =>
      z.object({
        modelo: z.string().min(1, "Escolha o modelo da APR antes de começar o checklist."),
        participantes: z
          .array(z.string())
          .min(
            MIN_PARTICIPANTES,
            equipe.length < MIN_PARTICIPANTES
              ? "Não dá para iniciar a APR: só há 1 pessoa disponível na equipe, e ninguém executa o serviço sozinho."
              : `Marque ao menos mais um colega: a APR precisa de pelo menos ${MIN_PARTICIPANTES} participantes, porque ninguém executa o serviço sozinho.`,
          ),
      }),
    [equipe.length],
  );
  const { form, enviar, enviando, erroEnvio } = useFormulario(esquema, { modelo: "", participantes: [usuarioId] });
  const [marcados, setMarcados] = useValorDoForm(form, "participantes");
  const [, setModeloEscolhido] = useValorDoForm(form, "modelo");
  const erros = form.formState.errors;
  // Aberta sozinha só quando há o que escolher: sem modelo publicado, a pessoa vê o aviso ao tocar em "Escolher o modelo".
  const abreSozinha = janela === "auto" && !modelo && (escolha ? escolha.modelos.length > 0 : carregandoEscolha);
  const janelaAberta = rascunho === null && (janela === "aberta" || abreSozinha);
  // Quem o responsável convidou precisa ter aceitado para o checklist começar; quem não foi convidado não é cobrado.
  const fraseDosConvites = convites ? frasePendenteDosConvites(pendenciaDosConvites(convites, marcados)) : null;
  const paraConvidar = convites ? quemConvidar(marcados, usuarioId, convites) : [];

  if (rascunho === undefined) return <Carregando texto="Abrindo a APR…" />;

  /** Carrega a versão publicada mais recente do modelo escolhido; na troca, os riscos de mesmo nome continuam marcados. */
  async function escolherModelo(codigo: string) {
    setErro(null);
    setCarregandoModelo(codigo);
    try {
      const completo = await carregarModeloPublicado(codigo);
      setRiscos((atuais) => (modelo ? riscosEquivalentes(doModeloCompleto(modelo), atuais, doModeloCompleto(completo)) : []));
      setModelo(completo);
      setModeloEscolhido(completo.codigo);
      setJanela("fechada");
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setCarregandoModelo(null);
    }
  }

  /** Convida as pessoas marcadas que ainda não têm convite em aberto; o erro (uma pessoa ausente, de outra equipe) aparece junto do botão. */
  async function convidar() {
    setErro(null);
    setConvidando(true);
    try {
      await acoesDeConvite.convidar(paraConvidar);
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setConvidando(false);
    }
  }

  function alternarParticipante(id: string) {
    if (id === usuarioId) return;
    // Quem sai da lista com o convite ainda em aberto não fica esperando: o convite é desfeito e a pessoa é avisada.
    const aDesfazer = marcados.includes(id) && convites ? conviteADesfazer(convites, id) : null;
    if (aDesfazer) void acoesDeConvite.desfazer(aDesfazer.id).catch(() => undefined);
    setMarcados((atuais) => (atuais.includes(id) ? atuais.filter((m) => m !== id) : [...atuais, id]));
    if (id === responsavelId) setResponsavelId(usuarioId);
  }

  const alternarRisco = (id: string) => setRiscos((atuais) => (atuais.includes(id) ? atuais.filter((r) => r !== id) : [...atuais, id]));
  const total = modelo ? totalDePerguntas(doModeloCompleto(modelo), riscos) : 0;

  const comecar = enviar(() => {
    if (!modelo || fraseDosConvites) return;
    const participantes = marcados.map((id) => ({ usuarioId: id, funcao: (id === responsavelId ? "responsavel" : "executor") as Funcao }));
    gravar(novoRascunho({ osId, usuarioId, modelo: doModeloCompleto(modelo), participantes, riscos }));
    router.replace(rotas.checklist(osId));
  });

  if (rascunho) {
    const bloqueada = estaTravada(rascunho);
    return (
      <Tela bordas={["bottom"]}>
        <Aviso tom={bloqueada ? "blq" : "info"} icone={bloqueada ? "alert-circle-outline" : "save-outline"} titulo={bloqueada ? "Sua APR desta OS reprovou e já está registrada como bloqueada" : "Você tem uma APR em andamento nesta OS"}>
          {bloqueada
            ? `(${rascunho.modelo.codigo} v${rascunho.modelo.versao}). Falta anexar a evidência dos itens reprovados. Descartar o rascunho não apaga a APR bloqueada: a nova será outra APR.`
            : `(${rascunho.modelo.codigo} v${rascunho.modelo.versao}). Continue de onde parou (o modelo ainda pode ser trocado no checklist) ou descarte o rascunho para começar uma APR nova, sem nenhuma resposta aproveitada.`}
        </Aviso>
        <Botao titulo={bloqueada ? "Registrar a evidência" : "Continuar a APR"} aoPressionar={() => router.replace(continuaNasAssinaturas(rascunho) ? rotas.aprovada(osId) : rotas.checklist(osId))} />
        <Botao titulo="Descartar e começar de novo" variante="secundario" aoPressionar={() => setDescartando(true)} />
        <JanelaDeConfirmacao
          visivel={descartando}
          titulo="Descartar a APR?"
          mensagem={avisoAoDescartar(rascunho)}
          confirmar="Descartar"
          perigo
          aoConfirmar={() => {
            descartar();
            setDescartando(false);
          }}
          aoCancelar={() => setDescartando(false)}
        />
      </Tela>
    );
  }

  const mensagensDeErro = [erros.modelo?.message, erros.participantes?.message, fraseDosConvites].filter((m): m is string => Boolean(m));
  return (
    <Tela bordas={["bottom"]}>
      <Text style={estilos.etapa}>{`Etapa 1 de 3 · modelo, participantes e riscos`}</Text>
      <Cartao>
        <TituloDeCartao>{rotulo}</TituloDeCartao>
        <Text style={estilos.texto}>{tituloDaOs}</Text>
        <Text style={estilos.suave}>{local}</Text>
      </Cartao>

      {modelo ? (
        <Cartao>
          <TituloDeCartao>Modelo da APR</TituloDeCartao>
          <Text style={estilos.destaque}>{`${modelo.codigo} — ${modelo.titulo}`}</Text>
          <Text style={estilos.suave}>{`Versão ${modelo.versao}${escolha?.recomendado === modelo.codigo ? " · era a opção recomendada" : ""}`}</Text>
          <Botao titulo="Trocar o modelo" variante="secundario" aoPressionar={() => setJanela("aberta")} />
        </Cartao>
      ) : (
        <Cartao>
          <TituloDeCartao>Escolha o modelo da APR</TituloDeCartao>
          <Text style={estilos.suave}>Veja o que cada modelo atende e selecione o que cobre o serviço desta OS. O sistema recomenda um, mas a escolha é sua.</Text>
          {erros.modelo?.message ? <Text accessibilityRole="alert" style={estilos.erro}>{erros.modelo.message}</Text> : null}
          <Botao titulo="Escolher o modelo" aoPressionar={() => setJanela("aberta")} />
        </Cartao>
      )}
      {erro && !janelaAberta ? <Aviso tom="blq">{erro}</Aviso> : null}

      <ParticipantesApr
        equipe={equipe}
        usuarioId={usuarioId}
        marcados={marcados}
        responsavelId={responsavelId}
        aoAlternar={alternarParticipante}
        aoTornarResponsavel={reservada ? undefined : setResponsavelId}
        erro={erros.participantes?.message}
        convites={convites}
        aoConvidar={() => void convidar()}
        paraConvidar={paraConvidar.length}
        convidando={convidando}
      />
      {modelo ? <RiscosApr riscos={modelo.riscos} itens={modelo.itens} marcados={riscos} aoAlternar={alternarRisco} /> : null}

      <View style={estilos.rodape}>
        <Text style={estilos.resumo}>{`${rotulo} · ${marcados.length} ${marcados.length === 1 ? "participante" : "participantes"} · ${riscos.length} ${riscos.length === 1 ? "risco marcado" : "riscos marcados"}`}</Text>
        {mensagensDeErro.length > 0 ? <Aviso tom="blq" titulo="Ainda não dá para começar:">{mensagensDeErro.join(" ")}</Aviso> : null}
        {erroEnvio ? <Aviso tom="blq">{erroEnvio}</Aviso> : null}
        <Botao titulo={modelo ? `Começar o checklist · ${total} ${total === 1 ? "item" : "itens"}` : "Começar o checklist"} enviando={enviando || Boolean(carregandoModelo)} aoPressionar={() => void comecar()} />
      </View>

      {janelaAberta ? (
        <JanelaDeModelos escolha={escolha} carregandoEscolha={carregandoEscolha} erro={erro ?? erroDaEscolha} atual={modelo?.codigo ?? null} carregando={carregandoModelo} aoSelecionar={(c) => void escolherModelo(c)} aoFechar={() => setJanela("fechada")} />
      ) : null}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  etapa: { fontSize: 13, fontWeight: "600", color: cores.marca },
  texto: { fontSize: 14, color: cores.tinta2, lineHeight: 20 },
  suave: { fontSize: 13, color: cores.tinta4, lineHeight: 18 },
  destaque: { fontSize: 16, fontWeight: "700", color: cores.tinta },
  erro: { fontSize: 13, color: cores.perigo },
  rodape: { gap: espaco.s, padding: espaco.m, borderRadius: raio.m, backgroundColor: cores.superficie2, borderWidth: 1, borderColor: cores.linha },
  resumo: { fontSize: 13, color: cores.tinta3 },
});
