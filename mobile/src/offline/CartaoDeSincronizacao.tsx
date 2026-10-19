import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { hora } from "@shared/api/formatar";
import { useConexao } from "@/estado/conexao";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { Cartao, TituloDeCartao } from "@/ui/Cartao";
import { LinhaDeNavegacao } from "@/ui/LinhaDeNavegacao";
import { useEstadoDaSincronizacao } from "./estado";
import { textoDoSegundoPlano } from "./faixa";
import { useSincronizar } from "./SincronizacaoProvider";

/** O texto de quantos registros esperam para subir: "Nada pendente", "1 registro" ou "3 registros". */
export const textoDosPendentes = (n: number) => (n === 0 ? "Nada esperando para subir" : n === 1 ? "1 registro esperando para subir" : `${n} registros esperando para subir`);

/**
 * A sincronização, no perfil: o que espera para subir, quando a cópia da equipe foi baixada, o botão "Sincronizar" e o caminho para os
 * registros que o servidor recusou. É o que o técnico confere antes de sair do campo.
 */
export function CartaoDeSincronizacao() {
  const router = useRouter();
  const sincronizar = useSincronizar();
  const estado = useEstadoDaSincronizacao();
  const online = useConexao() === "online";

  return (
    <>
      <Cartao>
        <TituloDeCartao>Sincronização</TituloDeCartao>
        <View style={estilos.linhas}>
          <Text style={estilos.texto}>{textoDosPendentes(estado.pendentes)}</Text>
          <Text style={estilos.suave}>{estado.copiaEm ? `Cópia da equipe baixada às ${hora(estado.copiaEm)}` : "Ainda não há cópia da equipe neste aparelho"}</Text>
          {estado.sincronizadoEm ? <Text style={estilos.suave}>{`Última sincronização às ${hora(estado.sincronizadoEm)}`}</Text> : null}
          {estado.segundoPlanoEm ? <Text style={estilos.suave}>{textoDoSegundoPlano(estado.segundoPlanoEm, estado.segundoPlanoEnviados)}</Text> : null}
        </View>
        {estado.erro ? <Aviso tom="blq">{estado.erro}</Aviso> : null}
        {!estado.erro && estado.semSinal ? <Aviso tom="al">Sem conexão com o servidor. O que você fizer fica guardado e sobe quando o sinal voltar.</Aviso> : null}
        {!online && !estado.semSinal ? <Aviso tom="al">Sem conexão. O que você fizer fica guardado neste aparelho.</Aviso> : null}
        <Botao titulo={estado.sincronizando ? "Sincronizando…" : "Sincronizar"} icone="sync-outline" variante="secundario" enviando={estado.sincronizando} aoPressionar={() => void sincronizar()} />
      </Cartao>
      {estado.recusados > 0 ? (
        <LinhaDeNavegacao
          icone="alert-circle-outline"
          titulo="Registros recusados"
          detalhe={estado.recusados === 1 ? "1 registro que o servidor não aceitou" : `${estado.recusados} registros que o servidor não aceitou`}
          aoPressionar={() => router.push("/recusados")}
        />
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  linhas: { gap: 2 },
  texto: { fontSize: 15, fontWeight: "600", color: cores.tinta },
  suave: { fontSize: 13, color: cores.tinta4, marginBottom: espaco.xs },
});
