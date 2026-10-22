import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { dataHora } from "@shared/api/formatar";
import { useSessao } from "@/sessao/SessaoProvider";
import { cores, espaco, raio } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { Icone } from "@/ui/Icone";
import { Tela } from "@/ui/Tela";

/**
 * O técnico cadastrado por um supervisor espera a liberação de um administrador. Nesse tempo o app não abre as telas de campo
 * (`mobile/README.md`, decisão D3): o Campo de treino é feito na web. Quando o admin libera, "Verificar de novo" leva à lista de OS.
 */
export default function Aguardando() {
  const { eu, recarregarEu, sair } = useSessao();
  const [verificando, setVerificando] = useState(false);
  const usuario = eu?.usuario;

  const verificar = async () => {
    setVerificando(true);
    try {
      await recarregarEu();
    } finally {
      setVerificando(false);
    }
  };

  return (
    <Tela centralizada aoAtualizar={verificar} atualizando={verificando}>
      <View style={estilos.cartao}>
        <Icone nome="hourglass-outline" tamanho={40} cor={cores.marca} />
        <Text style={estilos.titulo}>Seu acesso aguarda a liberação</Text>
        <Text style={estilos.texto}>
          {usuario?.criado_por_nome ? `${usuario.criado_por_nome} cadastrou você` : "Seu cadastro foi feito"}
          {usuario?.criado_em ? ` em ${dataHora(usuario.criado_em)}` : ""}
          {eu?.equipe ? ` na equipe ${eu.equipe.nome}` : ""}, e um administrador ainda precisa liberar o seu acesso.
        </Text>
        <Aviso tom="info">Enquanto isso, faça o Campo de treino pela web. Quando o acesso for liberado, puxe esta tela para baixo ou toque em “Verificar de novo”.</Aviso>
        <Botao titulo="Verificar de novo" enviando={verificando} aoPressionar={() => void verificar()} />
        <Botao titulo="Sair" variante="texto" aoPressionar={() => void sair()} />
      </View>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  cartao: { backgroundColor: cores.superficie, borderRadius: raio.l, borderWidth: 1, borderColor: cores.linha, padding: espaco.xl, gap: espaco.l, alignItems: "center" },
  titulo: { fontSize: 20, fontWeight: "700", color: cores.tinta, textAlign: "center" },
  texto: { fontSize: 15, lineHeight: 22, color: cores.tinta3, textAlign: "center" },
});
