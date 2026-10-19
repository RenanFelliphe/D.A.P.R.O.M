import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { caminhosDaApi, pontos, type MinhaPontuacao } from "@shared/api/gamificacao";
import { cliente } from "@/api/api";
import { useSessao } from "@/sessao/SessaoProvider";
import { cores, espaco } from "@/tema/tema";
import { Botao } from "@/ui/Botao";
import { Icone } from "@/ui/Icone";
import { JanelaDeFormulario } from "@/ui/JanelaDeFormulario";
import { SeloDePatente } from "./SeloDePatente";

/**
 * A janela "Parabéns!" (conquista desbloqueada e nova patente): abre na primeira vez que a pessoa entra no app depois de a conquista ou a
 * patente chegar. Ao fechar, marca os avisos como vistos (`POST /gamificacao/avisos/vistos`) e não volta. Só consulta a pontuação quando
 * o `GET /me` diz que há aviso pendente.
 */
export function AvisoDeConquista() {
  const { eu } = useSessao();
  const consultas = useQueryClient();
  const pendentes = (eu?.gamificacao?.avisos_pendentes ?? 0) > 0;
  const [visto, setVisto] = useState(false);
  const pontuacao = useQuery({ queryKey: ["gamificacao", "eu"], enabled: pendentes && !visto, queryFn: () => cliente.chamar<MinhaPontuacao>(caminhosDaApi.eu) });
  const avisos = pontuacao.data?.avisos;
  if (visto || !pendentes || !avisos || (avisos.conquistas.length === 0 && !avisos.patente)) return null;

  const fechar = async () => {
    setVisto(true);
    try {
      await cliente.chamar(caminhosDaApi.avisosVistos, { metodo: "POST", corpo: {} });
    } catch {
      /* o aviso volta na próxima abertura */
    }
    void consultas.invalidateQueries({ queryKey: ["eu"] });
    void consultas.invalidateQueries({ queryKey: ["gamificacao"] });
  };

  return (
    <JanelaDeFormulario titulo="Parabéns!" aoFechar={() => void fechar()}>
      {avisos.patente ? (
        <View style={estilos.aviso}>
          <Text style={estilos.rotulo}>Nova patente</Text>
          <SeloDePatente patente={avisos.patente} tamanho={96} semNome />
          <Text style={estilos.titulo}>{avisos.patente.nome}</Text>
          <Text style={estilos.texto}>{`Você chegou a ${pontos(avisos.patente.pontos_necessarios)} nesta temporada.`}</Text>
        </View>
      ) : null}
      {avisos.conquistas.map((c) => (
        <View key={c.id} style={estilos.aviso}>
          <Text style={estilos.rotulo}>Conquista desbloqueada</Text>
          {c.imagem_url ? <Image source={{ uri: c.imagem_url }} style={estilos.imagem} resizeMode="contain" accessibilityLabel={`Troféu ${c.titulo}`} /> : <Icone nome="trophy" tamanho={48} cor={cores.alerta} />}
          <Text style={estilos.titulo}>{c.titulo}</Text>
          <Text style={estilos.texto}>{c.descricao}</Text>
          {c.pontos > 0 ? <Text style={estilos.pontos}>{`+${pontos(c.pontos)}`}</Text> : null}
        </View>
      ))}
      <Botao titulo="Continuar" aoPressionar={() => void fechar()} />
    </JanelaDeFormulario>
  );
}

const estilos = StyleSheet.create({
  aviso: { alignItems: "center", gap: espaco.s, paddingVertical: espaco.s },
  rotulo: { fontSize: 12, fontWeight: "700", color: cores.tinta4, textTransform: "uppercase" },
  imagem: { width: 96, height: 96 },
  titulo: { fontSize: 20, fontWeight: "700", color: cores.tinta, textAlign: "center" },
  texto: { fontSize: 14, lineHeight: 20, color: cores.tinta3, textAlign: "center" },
  pontos: { fontSize: 16, fontWeight: "700", color: cores.ok },
});
