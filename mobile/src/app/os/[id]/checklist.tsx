import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  abrirRevisao,
  adicionarDocumento,
  adicionarFoto,
  avancar,
  avisoAoDescartar,
  estaTravada,
  faltaObservacaoNa,
  irPara,
  montarAvaliacao,
  montarPayload,
  observar,
  removerDocumento,
  removerFoto,
  resumoDe,
  responder,
  retirarParticipante,
  trocarModelo,
  voltar,
  voltarDaRevisao,
  type Avaliacao,
  type EvidenciaDoItem,
  type RascunhoApr,
  type Resposta,
} from "@shared/api/apr";
import type { ServicoDaOs } from "@shared/api/catalogo";
import { textoDosPontosGanhos } from "@shared/api/gamificacao";
import { rotuloDaOs } from "@shared/api/os-app";
import { cliente } from "@/api/api";
import { conexaoDoAparelho, enviarEvento } from "@/offline/app";
import { ErroDeRede, mensagemDoErro } from "@/api/erros";
import { useColegasDaEquipe } from "@/apr/consultas";
import { equipeDaApr } from "@/apr/equipe";
import { AssinaturasFaltando } from "@/apr/AssinaturasFaltando";
import { EvidenciaDosReprovados } from "@/apr/EvidenciaDosReprovados";
import { GradeDePerguntas, NavegacaoDoChecklist, ObservacaoDoNa, PerguntaDaApr, Progresso } from "@/apr/PecasDoChecklist";
import { useRascunhoApr } from "@/apr/rascunho";
import { Revisao } from "@/apr/Revisao";
import { TrocaDeModelo } from "@/apr/TrocaDeModelo";
import { useAtualizarDepoisDoEvento } from "@/campo/useAcao";
import { useConexao } from "@/estado/conexao";
import { useDetalheDaOs } from "@/os/consultas";
import { MateriaisCard } from "@/os/detalhe/Blocos";
import { rotas } from "@/os/rotas";
import { useSessao } from "@/sessao/SessaoProvider";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { mostrarAviso } from "@/ui/AvisoRapido";
import { Botao } from "@/ui/Botao";
import { Cartao, TituloDeCartao } from "@/ui/Cartao";
import { Carregando, Vazio } from "@/ui/Estados";
import { JanelaDeConfirmacao } from "@/ui/Janela";
import { Tela } from "@/ui/Tela";

/** A resposta de `POST /aprs/avaliar`. */
interface RespostaDaAvaliacao {
  resultado: Avaliacao["resultado"];
  reprovados: { item_id: string; texto: string; evidencia: EvidenciaDoItem }[];
}

/**
 * O checklist da APR, etapa 2 de 3: responde-se tudo, em qualquer ordem, e só se valida no fim. Todas as perguntas têm a mesma cara:
 * o técnico não sabe quais são eliminatórias. Ao validar, a `api` diz o resultado: aprovada é registrada na hora (sem assinaturas) e
 * segue para a tela em que cada participante assina na própria conta; reprovada (item eliminatório) já fica registrada como
 * bloqueada, trava as respostas e pede a evidência dos itens que reprovaram.
 */
export default function Checklist() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { eu } = useSessao();
  const detalhe = useDetalheDaOs(id);
  const colegas = useColegasDaEquipe(detalhe.data?.os.equipe_id);

  if (detalhe.isPending || !eu) return <Carregando texto="Abrindo a APR…" />;
  if (detalhe.isError) return <Vazio icone="cloud-offline-outline" titulo="Não foi possível abrir a OS" texto={mensagemDoErro(detalhe.error)} acao={{ titulo: "Tentar de novo", aoPressionar: () => void detalhe.refetch() }} />;
  const { os, servico } = detalhe.data;
  if (os.status !== "liberada" && os.status !== "pendente") return <Redirect href={rotas.os(id)} />;
  if (colegas.isPending) return <Carregando texto="Carregando a equipe…" />;
  if (colegas.isError) return <Vazio icone="cloud-offline-outline" titulo="Não foi possível carregar a equipe" texto={mensagemDoErro(colegas.error)} acao={{ titulo: "Tentar de novo", aoPressionar: () => void colegas.refetch() }} />;

  return (
    <>
      <Stack.Screen options={{ title: `APR · ${os.local_instalacao.codigo}` }} />
      <ChecklistDaApr osId={os.id} rotulo={rotuloDaOs(os)} usuario={eu.usuario} equipe={equipeDaApr(colegas.data, eu.usuario)} servico={servico ?? null} />
    </>
  );
}

interface ChecklistDaAprProps {
  osId: string;
  rotulo: string;
  usuario: NonNullable<ReturnType<typeof useSessao>["eu"]>["usuario"];
  equipe: ReturnType<typeof equipeDaApr>;
  servico: ServicoDaOs | null;
}

function ChecklistDaApr({ osId, rotulo, usuario, equipe, servico }: ChecklistDaAprProps) {
  const router = useRouter();
  const atualizarDepois = useAtualizarDepoisDoEvento();
  const usuarioId = usuario.id;
  const semSinal = useConexao() === "offline";
  const { rascunho, atualizar, descartar } = useRascunhoApr(osId, usuarioId);
  const [concluindo, setConcluindo] = useState(false);
  const [trocando, setTrocando] = useState(false);
  const [descartando, setDescartando] = useState(false);
  const [falta, setFalta] = useState<string | null>(null);

  const resumo = useMemo(() => (rascunho ? resumoDe(rascunho) : null), [rascunho]);

  if (rascunho === undefined) return <Carregando texto="Abrindo a APR…" />;
  if (rascunho === null || !resumo) {
    return (
      <Tela bordas={["bottom"]}>
        {concluindo ? (
          <Carregando texto="Enviando a APR…" />
        ) : (
          <Cartao>
            <TituloDeCartao>Não há APR em andamento para esta OS.</TituloDeCartao>
            <Text style={estilos.suave}>Comece uma APR nova: escolha o modelo, os participantes e os riscos da atividade.</Text>
            <Botao titulo="Nova APR" aoPressionar={() => router.replace(rotas.apr(osId))} />
          </Cartao>
        )}
      </Tela>
    );
  }

  const r: RascunhoApr = rascunho;
  const travada = estaTravada(r);
  const total = resumo.perguntas.length;
  const indice = Math.min(r.indice, Math.max(0, total - 1));
  const item = resumo.perguntas[indice];
  const revisando = r.modo === "revisao" || !item;
  const resposta = item ? r.respostas[item.id] : undefined;
  const risco = item?.risco_id ? r.modelo.riscos.find((x) => x.id === item.risco_id) : undefined;

  /** Qualquer mudança nas respostas invalida uma validação anterior. */
  const alterar = (funcao: (atual: RascunhoApr) => RascunhoApr) => atualizar((atual) => ({ ...funcao(atual), concluidaEm: null, avaliacao: null }));
  /** Navegar não muda a APR. */
  const navegar = atualizar;

  const meuCadastro = usuario.assinatura_path;
  const assinaturaDe = (c: (typeof equipe)[number]) => (c.id === usuarioId ? (meuCadastro ?? c.assinatura_path) : c.assinatura_path);
  const participantes = r.participantes.map((p) => equipe.find((c) => c.id === p.usuarioId)).filter((c): c is (typeof equipe)[number] => Boolean(c));
  const semAssinatura = participantes.filter((c) => !assinaturaDe(c));

  function aoResponder(valor: Resposta) {
    if (!item) return;
    setFalta(null);
    // "NA" pede observação e fica na pergunta; as demais seguem adiante.
    alterar((atual) => {
      const novo = responder(atual, item, valor);
      return valor === "na" ? novo : avancar(novo);
    });
  }

  /**
   * "Concluir e validar": a `api` diz se a APR passa. Aprovada é registrada na hora (`apr_concluida`, sem assinaturas; o mesmo
   * `eventoId` do rascunho garante que reenviar não duplica) e a tela segue para as assinaturas. Reprovada já fica registrada como
   * bloqueada (a OS fica pendente e o supervisor é avisado) e trava as respostas até a evidência ser enviada. A falha é lançada: o
   * formulário da revisão a mostra acima do botão. Se só o registro falhar, a validação fica guardada no rascunho e a tela das
   * assinaturas oferece enviar de novo.
   */
  async function validar() {
    const concluidaEm = new Date().toISOString();
    let resultado: RespostaDaAvaliacao | null = null;
    if (conexaoDoAparelho() === "online") {
      try {
        resultado = await cliente.chamar<RespostaDaAvaliacao>("/aprs/avaliar", { corpo: montarAvaliacao({ ...r, concluidaEm }) });
      } catch (e) {
        // O sinal caiu antes de a `api` responder: segue como sem sinal. Qualquer outra recusa da `api` é lançada e aparece acima do botão.
        if (!(e instanceof ErroDeRede)) throw e;
      }
    }
    if (!resultado) return registrarSemSinal(concluidaEm);
    const avaliacao: Avaliacao = { resultado: resultado.resultado, reprovados: resultado.reprovados.map((x) => ({ itemId: x.item_id, texto: x.texto, evidencia: x.evidencia })) };
    atualizar((atual) => ({ ...atual, concluidaEm, avaliacao }));
    if (avaliacao.resultado !== "aprovada") return;
    const resp = await enviarEvento({ id: r.eventoId, tipo: "apr_concluida", os_id: osId, payload: montarPayload({ ...r, concluidaEm, avaliacao }) });
    const registrada = (resp.aprs.find((a) => a.id === r.aprId) ?? resp.aprs[0])?.resultado;
    setConcluindo(true);
    descartar();
    void atualizarDepois();
    // A `api` é quem decide: se ela bloqueou ao registrar, vale o impedimento.
    router.replace(registrada === "bloqueada" ? rotas.bloqueio(osId) : rotas.aprovada(osId));
  }

  /**
   * Sem sinal o aparelho não valida a APR (só o servidor sabe o que bloqueia): ela é registrada na fila como concluída, com todos os
   * participantes presentes assinando por este aparelho (`assinatura_presencial`), e vale para começar a execução. Quando o sinal voltar,
   * o servidor a valida; se reprovar, o supervisor é avisado (e a execução feita não se perde). Sem a evidência dos itens reprovados: o
   * aparelho não pôde perguntar.
   */
  async function registrarSemSinal(concluidaEm: string) {
    const resp = await enviarEvento({ id: r.eventoId, tipo: "apr_concluida", os_id: osId, payload: { ...montarPayload({ ...r, concluidaEm, avaliacao: null }), assinatura_presencial: true } });
    const registrada = (resp.aprs.find((a) => a.id === r.aprId) ?? resp.aprs[0])?.resultado;
    setConcluindo(true);
    descartar();
    void atualizarDepois();
    router.replace(registrada === "bloqueada" ? rotas.bloqueio(osId) : rotas.aprovada(osId));
  }

  /** Reprovada e já registrada: o evento da mesma APR leva a evidência dos itens que reprovaram. */
  async function registrarImpedimento() {
    setConcluindo(true);
    try {
      const resp = await enviarEvento({ id: r.eventoId, tipo: "apr_concluida", os_id: osId, payload: montarPayload(r) });
      const resultado = (resp.aprs.find((a) => a.id === r.aprId) ?? resp.aprs[0])?.resultado;
      // A APR bloqueada pontua quando chega a evidência (a segurança não custa pontos): "+N pontos".
      const pontos = textoDosPontosGanhos(resp);
      if (pontos) mostrarAviso(pontos);
      descartar();
      void atualizarDepois();
      router.replace(resultado === "aprovada" ? rotas.os(osId) : rotas.bloqueio(osId));
    } catch (e) {
      setConcluindo(false);
      throw e;
    }
  }

  const titulo = travada ? "APR validada" : revisando ? `Revisão · ${resumo.respondidas} de ${total}` : `Pergunta ${indice + 1} de ${total}`;
  const secao = travada ? "Evidência" : revisando ? "Antes de validar" : risco ? `Medida preventiva · ${risco.nome}` : "Verificação";

  return (
    <Tela bordas={["bottom"]} voltarAoTopoQuando={`${r.modo}-${travada}`}>
      <Text style={estilos.etapa}>{`${rotulo} · ${r.modelo.codigo} v${r.modelo.versao} · Etapa 2 de 3`}</Text>
      <Progresso titulo={titulo} secao={secao} respondidas={resumo.respondidas} total={total} />

      {travada ? (
        <EvidenciaDosReprovados
          rascunho={r}
          aoObservar={(itemId, texto) => atualizar((atual) => observar(atual, itemId, texto))}
          // Evidência não muda as respostas: não invalida a validação.
          aoFotoEnviada={(itemId, foto) =>
            atualizar((atual) => adicionarFoto(atual, itemId, { id: foto.id, arquivoId: foto.arquivoId, capturadaEm: foto.capturadaEm, miniatura: foto.uri, ...(foto.latitude !== undefined && foto.longitude !== undefined ? { latitude: foto.latitude, longitude: foto.longitude } : {}) }))
          }
          aoRemoverFoto={(itemId, fotoId) => atualizar((atual) => removerFoto(atual, itemId, fotoId))}
          aoPdfEnviado={(itemId, pdf) => atualizar((atual) => adicionarDocumento(atual, itemId, { id: pdf.id, arquivoId: pdf.arquivoId, nome: pdf.nome, capturadaEm: pdf.capturadaEm }))}
          aoRemoverPdf={(itemId, documentoId) => atualizar((atual) => removerDocumento(atual, itemId, documentoId))}
          aoRegistrar={registrarImpedimento}
        />
      ) : revisando ? (
        <Revisao
          rascunho={r}
          resumo={resumo}
          aoAbrir={(i) => navegar((atual) => irPara(atual, i))}
          aoVoltar={() => navegar(voltarDaRevisao)}
          aoObservarGeral={(texto) => alterar((atual) => ({ ...atual, observacaoGeral: texto }))}
          aoValidar={validar}
          semAssinatura={semAssinatura.length}
          semSinal={semSinal}
          materiais={servico && servico.materiais.length > 0 ? <MateriaisCard servico={servico} /> : null}
          assinaturas={<AssinaturasFaltando semAssinatura={semAssinatura} usuarioId={usuarioId} aoRetirar={(retirado) => atualizar((atual) => retirarParticipante(atual, retirado))} />}
        />
      ) : (
        <>
          <PerguntaDaApr numero={indice + 1} item={item} resposta={resposta?.resposta} aoResponder={aoResponder} />
          {resposta?.resposta === "na" ? <ObservacaoDoNa observacao={resposta.observacao} aoObservar={(texto) => alterar((atual) => observar(atual, item.id, texto))} /> : null}
          {falta ? <Aviso tom="al">{falta}</Aviso> : null}
          <NavegacaoDoChecklist
            indice={indice}
            total={total}
            respondida={resposta !== undefined}
            aoVoltar={() => {
              setFalta(null);
              navegar(voltar);
            }}
            aoAvancar={() => {
              setFalta(null);
              navegar(avancar);
            }}
            aoFaltarResposta={() => setFalta("Responda esta pergunta para continuar.")}
          />
          <GradeDePerguntas
            total={total}
            atual={indice}
            respondida={(i) => r.respostas[resumo.perguntas[i]!.id] !== undefined}
            pendente={(i) => faltaObservacaoNa(r, resumo.perguntas[i]!)}
            aoSelecionar={(i) => {
              setFalta(null);
              navegar((atual) => irPara(atual, i));
            }}
          />
        </>
      )}

      <View style={estilos.acoes}>
        <Text style={estilos.suave}>{travada ? "A APR já está registrada como bloqueada. A evidência fica salva neste aparelho até você registrá-la." : "Rascunho salvo neste aparelho. Se o app fechar, você continua daqui; nada é enviado até validar."}</Text>
        {!revisando && !travada ? <Botao titulo="Ir para a revisão" variante="secundario" aoPressionar={() => navegar(abrirRevisao)} /> : null}
        {!travada ? <Botao titulo={`Trocar o modelo (${r.modelo.codigo})`} variante="secundario" aoPressionar={() => setTrocando(true)} /> : null}
        <Botao titulo="Sair e continuar depois" variante="secundario" aoPressionar={() => router.replace(rotas.os(osId))} />
        {!travada ? <Botao titulo="Descartar esta APR" variante="texto" aoPressionar={() => setDescartando(true)} /> : null}
      </View>

      {trocando && !travada ? (
        <TrocaDeModelo
          osId={osId}
          rascunho={r}
          aoTrocar={(novo, riscos) => {
            atualizar((atual) => trocarModelo(atual, novo, riscos).rascunho);
            setTrocando(false);
          }}
          aoFechar={() => setTrocando(false)}
        />
      ) : null}
      <JanelaDeConfirmacao
        visivel={descartando}
        titulo="Descartar a APR?"
        mensagem={avisoAoDescartar(r)}
        confirmar="Descartar"
        perigo
        aoConfirmar={() => {
          setDescartando(false);
          descartar();
          router.replace(rotas.os(osId));
        }}
        aoCancelar={() => setDescartando(false)}
      />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  etapa: { fontSize: 13, fontWeight: "600", color: cores.marca },
  suave: { fontSize: 13, lineHeight: 19, color: cores.tinta4 },
  acoes: { gap: espaco.s, marginTop: espaco.s },
});
