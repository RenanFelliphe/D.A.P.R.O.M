import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { dataHora } from "@shared/api/formatar";
import { ImagemDeArquivo } from "@/campo/ImagemDeArquivo";
import { useSessao } from "@/sessao/SessaoProvider";
import { cores } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { Cartao, TituloDeCartao } from "@/ui/Cartao";
import { JanelaDeFormulario } from "@/ui/JanelaDeFormulario";
import { mostrarAviso } from "@/ui/AvisoRapido";
import { CadastrarAssinatura } from "./CadastrarAssinatura";

/** "Minha assinatura" do perfil: mostra a atual e deixa refazê-la. Vale só para as próximas: as ações já assinadas guardam a imagem que usaram. */
export function MinhaAssinatura() {
  const { eu } = useSessao();
  const [refazendo, setRefazendo] = useState(false);
  const usuario = eu?.usuario;
  if (!usuario) return null;

  return (
    <Cartao>
      <TituloDeCartao>Minha assinatura</TituloDeCartao>
      {usuario.assinatura_path ? (
        <ImagemDeArquivo id={usuario.assinatura_path} alt="Minha assinatura" altura={84} />
      ) : (
        <Aviso tom="al">Você ainda não cadastrou a assinatura. Sem ela, não dá para assinar a APR nem o encerramento.</Aviso>
      )}
      <Text style={estilos.nota}>{usuario.assinatura_em ? `Cadastrada em ${dataHora(usuario.assinatura_em)}. ` : ""}Refazer vale só para as próximas: as já feitas guardam a imagem que usaram.</Text>
      <Botao titulo={usuario.assinatura_path ? "Refazer a assinatura" : "Cadastrar a assinatura"} variante="secundario" icone="create-outline" aoPressionar={() => setRefazendo(true)} />
      {refazendo ? (
        <JanelaDeFormulario titulo={usuario.assinatura_path ? "Refazer a assinatura" : "Cadastrar a assinatura"} aoFechar={() => setRefazendo(false)}>
          <Text style={estilos.nota}>Desenhe com o dedo. Você poderá refazê-la quando quiser.</Text>
          <CadastrarAssinatura
            aoSalvar={() => {
              setRefazendo(false);
              mostrarAviso("Assinatura salva");
            }}
          />
        </JanelaDeFormulario>
      ) : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  nota: { fontSize: 13, lineHeight: 18, color: cores.tinta4 },
});
