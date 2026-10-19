import { StyleSheet, View } from "react-native";
import { useConexao } from "@/estado/conexao";
import { espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { useEstadoDaSincronizacao } from "./estado";
import { faixaDaSincronizacao } from "./faixa";

/**
 * A faixa no alto de toda tela de campo: "Sem conexão — N registros pendentes" sem sinal, "N registros pendentes" enquanto a fila sobe e
 * o erro que a pessoa precisa resolver. Some quando está tudo em dia (o "Sincronizado hh:mm" fica no indicador do cabeçalho).
 */
export function FaixaDeSincronizacao() {
  const online = useConexao() === "online";
  const estado = useEstadoDaSincronizacao();
  const faixa = faixaDaSincronizacao(estado, online);
  if (!faixa) return null;
  return (
    <View style={estilos.faixa}>
      <Aviso tom={faixa.tom} icone={faixa.tom === "info" ? "sync-outline" : faixa.tom === "al" ? "cloud-offline-outline" : "alert-circle-outline"}>
        {faixa.texto}
      </Aviso>
    </View>
  );
}

const estilos = StyleSheet.create({
  faixa: { paddingHorizontal: espaco.l, paddingTop: espaco.m },
});
