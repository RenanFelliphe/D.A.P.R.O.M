import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { diferencaDeListas, MAX_CARACTERES_DO_MOTIVO, type Sugestao } from "@shared/api/sugestao-materiais";
import { useConexao } from "@/estado/conexao";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { mostrarAviso } from "@/ui/AvisoRapido";
import { Botao } from "@/ui/Botao";
import { CampoDeFormulario } from "@/ui/Campo";
import { Cartao, TituloDeCartao } from "@/ui/Cartao";
import { Tela } from "@/ui/Tela";
import { useFormulario, useValorDoForm } from "@/ui/useFormulario";
import { avaliarSugestao, useAtualizarDepoisDaSugestao, type RespostaDaAvaliacao } from "./consultas";
import { DiferencaDeListas } from "./Diferenca";
import { MENSAGEM_SEM_SINAL } from "./erros";
import { EditorDaLista } from "./EditorDaLista";
import { corpoDoAceite, esquemaDoAjuste, itemDaListaDoServico, listaDoAjuste, paraComparar, type Resolucoes, type ValoresDoAjuste } from "./lista";

interface AjusteDoAvaliadorProps {
  sugestao: Sugestao;
  resolucoes: Resolucoes;
  aoCancelar: () => void;
  aoAceitar: (resposta: RespostaDaAvaliacao) => void;
}

/**
 * "Ajustar e aceitar": o mesmo editor da lista, com a proposta do autor (os itens digitados já ligados ou marcados para cadastro) como
 * ponto de partida. A contestação sem lista parte da lista de agora: quem avalia informa a lista que passa a valer. A sugestão
 * ajustada conta como aceita e fica marcada "com ajustes".
 */
export function AjusteDoAvaliador({ sugestao: s, resolucoes, aoCancelar, aoAceitar }: AjusteDoAvaliadorProps) {
  const atualizarDepois = useAtualizarDepoisDaSugestao();
  const semSinal = useConexao() === "offline";
  const [inicial] = useState(() => (s.tem_lista ? listaDoAjuste(s.itens, resolucoes) : s.lista_atual.map(itemDaListaDoServico)));
  const { form, enviar, enviando, erroEnvio } = useFormulario<ValoresDoAjuste>(esquemaDoAjuste, { resposta: "", lista: inicial });
  const [lista, setLista] = useValorDoForm(form, "lista");
  const erroDaLista = (form.formState.errors.lista as { message?: string } | undefined)?.message;

  const aceitar = enviar(async (v) => {
    const resposta = await avaliarSugestao(s.id, "aceitar", corpoDoAceite({ itens: s.itens, resolucoes, lista: v.lista, resposta: v.resposta }));
    await atualizarDepois();
    aoAceitar(resposta);
  });

  return (
    <Tela bordas={["bottom"]}>
      <Aviso tom="info" titulo="Ajustar e aceitar.">
        {s.tem_lista ? "Mude o que for preciso na lista do autor. A lista que ficar aqui passa a ser a do serviço." : "A contestação não trouxe uma lista nova. Informe a lista que passa a valer para o serviço."}
      </Aviso>
      <EditorDaLista lista={lista} aoMudar={setLista} permitirDigitar={false} erro={erroDaLista} />
      <Cartao>
        <TituloDeCartao>O que a lista do serviço vai mudar</TituloDeCartao>
        <DiferencaDeListas mudancas={diferencaDeListas(s.lista_atual, paraComparar(lista))} />
      </Cartao>
      <CampoDeFormulario
        control={form.control}
        nome="resposta"
        rotulo="Resposta ao autor (opcional)"
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        maxLength={MAX_CARACTERES_DO_MOTIVO}
        style={estilos.areaDeTexto}
      />
      {erroEnvio ? <Aviso tom="blq">{erroEnvio}</Aviso> : null}
      <Botao titulo="Aceitar com ajustes" icone="checkmark" enviando={enviando} aoPressionar={() => (semSinal ? mostrarAviso(MENSAGEM_SEM_SINAL) : aceitar())} />
      <Botao titulo="Cancelar o ajuste" variante="texto" aoPressionar={enviando ? () => undefined : aoCancelar} />
      <Text style={estilos.nota}>O autor e todos os que fazem o serviço são avisados da mudança.</Text>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  areaDeTexto: { minHeight: 84, paddingTop: espaco.m },
  nota: { fontSize: 12, color: cores.tinta4, textAlign: "center" },
});
