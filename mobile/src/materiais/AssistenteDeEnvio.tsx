import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import type { ServicoDoCatalogo } from "@shared/api/catalogo";
import { diferencaDeListas, MAX_CARACTERES_DO_MOTIVO, MIN_CARACTERES_DO_MOTIVO, rotuloDoTipoDeSugestao, type Sugestao, type TipoDeSugestao } from "@shared/api/sugestao-materiais";
import { cliente } from "@/api/api";
import { useConexao } from "@/estado/conexao";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { mostrarAviso } from "@/ui/AvisoRapido";
import { Botao } from "@/ui/Botao";
import { CampoDeFormulario } from "@/ui/Campo";
import { Cartao, TituloDeCartao } from "@/ui/Cartao";
import { Opcao } from "@/ui/Opcao";
import { Tela } from "@/ui/Tela";
import { useFormulario, useValorDoForm } from "@/ui/useFormulario";
import { useAtualizarDepoisDaSugestao, useEquipesDoServico } from "./consultas";
import { DestinoDaSugestao } from "./DestinoDaSugestao";
import { DiferencaDeListas } from "./Diferenca";
import { EditorDaLista } from "./EditorDaLista";
import { Etapas } from "./Etapas";
import { MENSAGEM_SEM_SINAL, traduzindoErros } from "./erros";
import { corpoDoEnvio, esquemaDoEnvio, faltaNaLista, faltaNoMotivoDoEnvio, itemDaListaDoServico, listaVaiNoEnvio, paraComparar, type ValoresDoEnvio } from "./lista";

type IdDaEtapa = "lista" | "motivo" | "revisao";

/** A sugestão começa pela lista; a contestação, pelo motivo (obrigatório), e a lista certa é um passo opcional. */
const ETAPAS: Record<TipoDeSugestao, { id: IdDaEtapa; titulo: string }[]> = {
  sugestao: [
    { id: "lista", titulo: "Monte a lista" },
    { id: "motivo", titulo: "Por que mudar?" },
    { id: "revisao", titulo: "Confira e envie" },
  ],
  contestacao: [
    { id: "motivo", titulo: "Por que a lista está errada?" },
    { id: "lista", titulo: "Quer sugerir a lista certa?" },
    { id: "revisao", titulo: "Confira e envie" },
  ],
};

/**
 * Sugerir ou contestar a lista de materiais de um serviço, em etapas: a lista (a atual, para a pessoa corrigir), o motivo e a
 * revisão com a diferença. Nada vai para a `api` antes do "Enviar", e a sugestão não entra na fila do aparelho (sem sinal, o envio
 * avisa e espera). O formulário é o React Hook Form com o esquema Zod de `lista.ts`.
 */
export function AssistenteDeEnvio({ servico, tipo }: { servico: ServicoDoCatalogo; tipo: TipoDeSugestao }) {
  const router = useRouter();
  const semSinal = useConexao() === "offline";
  const atualizarDepois = useAtualizarDepoisDaSugestao();
  const equipes = useEquipesDoServico(servico.codigo);
  const etapas = ETAPAS[tipo];
  const [indice, setIndice] = useState(0);
  const [enviada, setEnviada] = useState<Sugestao | null>(null);

  const base = useMemo(() => paraComparar(servico.materiais.map(itemDaListaDoServico)), [servico.materiais]);
  const esquema = useMemo(() => esquemaDoEnvio(tipo, base), [tipo, base]);
  const [listaInicial] = useState(() => servico.materiais.map(itemDaListaDoServico));
  const { form, enviar, enviando, erroEnvio, limparErroEnvio } = useFormulario<ValoresDoEnvio>(esquema, { motivo: "", comLista: tipo === "sugestao", lista: listaInicial });
  const [lista, setLista] = useValorDoForm(form, "lista");
  const [comLista, setComLista] = useValorDoForm(form, "comLista");
  const motivo = form.watch("motivo");

  const etapa = etapas[indice]!;
  const nome = `${servico.codigo} — ${servico.descricao}`;
  const erroDaLista = (form.formState.errors.lista as { message?: string } | undefined)?.message;
  const levaLista = listaVaiNoEnvio(tipo, comLista);

  const irPara = (id: IdDaEtapa) => {
    limparErroEnvio();
    setIndice(etapas.findIndex((e) => e.id === id));
  };

  // O botão voltar do Android volta uma etapa (e só na primeira sai da tela), sem perder o que a pessoa montou.
  useEffect(() => {
    if (indice === 0 || enviada) return;
    const ouvinte = BackHandler.addEventListener("hardwareBackPress", () => {
      if (enviando) return true;
      limparErroEnvio();
      setIndice(indice - 1);
      return true;
    });
    return () => ouvinte.remove();
  }, [indice, enviada, enviando, limparErroEnvio]);

  const continuar = async () => {
    if (etapa.id === "lista" && !levaLista) return setIndice(indice + 1);
    if (etapa.id !== "revisao") {
      const campo = etapa.id === "lista" ? "lista" : "motivo";
      await form.trigger(campo);
      if (form.getFieldState(campo).error) return;
      setIndice(indice + 1);
    }
  };

  const mandar = enviar(async (v) => {
    const resposta = await traduzindoErros(() =>
      cliente.chamar<Sugestao>("/sugestoes-materiais", { metodo: "POST", corpo: corpoDoEnvio({ atividade: servico.codigo, tipo, motivo: v.motivo, lista: listaVaiNoEnvio(tipo, v.comLista) ? v.lista : null }) }),
    );
    await atualizarDepois();
    setEnviada(resposta);
  });

  const confirmar = () => {
    if (semSinal) return mostrarAviso(MENSAGEM_SEM_SINAL);
    // O esquema já foi conferido a cada etapa; se algo ficou errado (a lista mudou no caminho), volta à etapa certa.
    const v = form.getValues();
    if (faltaNoMotivoDoEnvio(tipo, v.motivo)) {
      irPara("motivo");
      return void form.trigger("motivo");
    }
    if (listaVaiNoEnvio(tipo, v.comLista) && (faltaNaLista(v.lista) || form.formState.errors.lista)) {
      irPara("lista");
      return void form.trigger("lista");
    }
    void mandar();
  };

  if (enviada) {
    const responsavel = equipes.data?.find((e) => e.responsavel);
    return (
      <Tela bordas={["bottom"]}>
        <Aviso tom="ok" titulo={`${rotuloDoTipoDeSugestao[tipo]} enviada.`}>
          {responsavel ? `A equipe ${responsavel.nome} foi avisada e vai avaliar.` : "A administração foi avisada e vai avaliar."} Você será avisado da resposta e acompanha tudo em Sugestões de materiais.
        </Aviso>
        <Botao titulo="Ver as minhas sugestões" icone="list-outline" aoPressionar={() => router.replace("/materiais")} />
        <Botao titulo="Voltar" variante="texto" aoPressionar={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
      </Tela>
    );
  }

  return (
    <Tela bordas={["bottom"]} voltarAoTopoQuando={indice}>
      <Etapas atual={indice} titulos={etapas.map((e) => e.titulo)} />
      <Text style={estilos.servico}>{nome}</Text>

      {etapa.id === "lista" ? (
        <>
          {tipo === "sugestao" ? (
            <Text style={estilos.texto}>Começa pela lista de hoje. Tire o que sobra, ajuste as quantidades e acrescente o que falta. Quem avalia vê só o que você mudou.</Text>
          ) : (
            <>
              <Text style={estilos.texto}>É opcional. Você pode só contestar e deixar a lista para quem avalia, ou já propor a lista que acha certa.</Text>
              <Opcao
                tipo="radio"
                rotulo="Só contestar"
                detalhe="Quem avalia informa a lista que passa a valer"
                marcada={!comLista}
                aoPressionar={() => {
                  setComLista(false);
                  form.clearErrors("lista");
                }}
              />
              <Opcao tipo="radio" rotulo="Contestar e sugerir a lista certa" marcada={comLista} aoPressionar={() => setComLista(true)} />
            </>
          )}
          {levaLista ? <EditorDaLista lista={lista} aoMudar={setLista} erro={erroDaLista} /> : null}
          {tipo === "sugestao" ? <DestinoDaSugestao codigo={servico.codigo} /> : null}
        </>
      ) : null}

      {etapa.id === "motivo" ? (
        <>
          <Text style={estilos.texto}>
            {tipo === "sugestao" ? "Dizer por que a lista deve mudar ajuda quem avalia a decidir. É opcional." : "Explique o que está errado na lista recomendada. É obrigatório: sem o motivo, quem avalia não tem o que analisar."}
          </Text>
          <CampoDeFormulario
            control={form.control}
            nome="motivo"
            rotulo={tipo === "sugestao" ? "Motivo (opcional)" : "Motivo da contestação"}
            placeholder={tipo === "sugestao" ? "Ex.: o serviço leva dois pares de luva, não um" : "Ex.: falta o detector de gás e a fita veda-rosca não é usada"}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={MAX_CARACTERES_DO_MOTIVO}
            ajuda={tipo === "contestacao" ? `Pelo menos ${MIN_CARACTERES_DO_MOTIVO} caracteres.` : undefined}
            style={estilos.areaDeTexto}
          />
          {tipo === "contestacao" ? <DestinoDaSugestao codigo={servico.codigo} /> : null}
        </>
      ) : null}

      {etapa.id === "revisao" ? (
        <>
          <DestinoDaSugestao codigo={servico.codigo} />
          <Cartao>
            <TituloDeCartao>{rotuloDoTipoDeSugestao[tipo]}</TituloDeCartao>
            <Text style={estilos.texto}>{nome}</Text>
          </Cartao>
          <Cartao>
            <TituloDeCartao>Motivo</TituloDeCartao>
            <Text style={estilos.texto}>{motivo.trim() || "Sem motivo informado."}</Text>
          </Cartao>
          <Cartao>
            <TituloDeCartao>{levaLista ? "O que a sua lista muda" : "Lista"}</TituloDeCartao>
            {levaLista ? <DiferencaDeListas mudancas={diferencaDeListas(base, paraComparar(lista))} /> : <Text style={estilos.texto}>Você não está sugerindo uma lista. Quem avalia vai informar a lista que passa a valer, se concordar.</Text>}
          </Cartao>
          {semSinal ? <Aviso tom="al" icone="cloud-offline-outline">{`${MENSAGEM_SEM_SINAL}. A sugestão não fica guardada no aparelho para enviar depois.`}</Aviso> : null}
          {erroEnvio ? <Aviso tom="blq">{erroEnvio}</Aviso> : null}
        </>
      ) : null}

      <View style={estilos.botoes}>
        {etapa.id === "revisao" ? <Botao titulo={tipo === "sugestao" ? "Enviar a sugestão" : "Enviar a contestação"} icone="send-outline" enviando={enviando} aoPressionar={confirmar} /> : <Botao titulo="Continuar" aoPressionar={() => void continuar()} />}
        <Botao titulo="Voltar" variante="texto" aoPressionar={enviando ? () => undefined : () => (indice === 0 ? router.back() : irPara(etapas[indice - 1]!.id))} />
      </View>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  servico: { fontSize: 14, color: cores.tinta3, lineHeight: 20 },
  texto: { fontSize: 14, color: cores.tinta2, lineHeight: 21 },
  areaDeTexto: { minHeight: 110, paddingTop: espaco.m },
  botoes: { gap: espaco.s, marginTop: espaco.s },
});
