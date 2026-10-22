import { Linking, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { dataHora } from "@shared/api/formatar";
import { ROTULO_DO_TIPO, rotuloDaAcaoDeValidacao, type ItemDeValidacao } from "@shared/api/validacoes";
import { URL_DA_WEB } from "@/config";
import { cores, espaco } from "@/tema/tema";
import { mostrarAviso } from "@/ui/AvisoRapido";
import { Botao } from "@/ui/Botao";
import { Cartao } from "@/ui/Cartao";
import { Selo } from "@/ui/Selo";
import { destinoDaValidacao, iconeDoTipo } from "./regras";

/**
 * Um item da fila: o tipo, a urgência e a equipe; o título e o detalhe; desde quando espera (e, na OS, até quando a assinatura ainda
 * pontua); e o botão do passo. O botão abre a tela do app quando ela existe e, quando só a web tem a tela, abre a web no navegador.
 */
export function CartaoDeValidacao({ item }: { item: ItemDeValidacao }) {
  const router = useRouter();
  const destino = destinoDaValidacao(item);
  const naWeb = destino.onde === "web";

  const abrir = () => {
    if (destino.onde === "app") return router.push(destino.rota as Href);
    if (!URL_DA_WEB) return mostrarAviso("Essa tela só existe na versão web do SYNQ OS. Abra-a no navegador.");
    void Linking.openURL(`${URL_DA_WEB}${destino.caminho}`).catch(() => mostrarAviso("Não consegui abrir a web neste aparelho."));
  };

  return (
    <Cartao estilo={item.urgente ? estilos.urgente : undefined}>
      <View style={estilos.selos}>
        <Selo tom="brand" icone={iconeDoTipo[item.tipo]}>
          {ROTULO_DO_TIPO[item.tipo]}
        </Selo>
        {item.urgente ? <Selo tom="blq">Urgente</Selo> : null}
        {item.acao === "aguardar_conferencia" ? <Selo tom="al">Espera a conferência</Selo> : null}
        {item.equipe_nome ? <Selo>{item.equipe_nome}</Selo> : null}
      </View>
      <Text style={estilos.titulo}>{item.titulo}</Text>
      <Text style={estilos.detalhe}>{item.detalhe}</Text>
      <Text style={estilos.meta}>
        {`Esperando desde ${dataHora(item.desde)}`}
        {item.tipo === "os_ciencia" && item.prazo_em ? ` · prazo para pontuar: ${dataHora(item.prazo_em)}` : ""}
      </Text>
      <Botao titulo={rotuloDaAcaoDeValidacao(item)} icone={naWeb ? "open-outline" : "chevron-forward"} variante={item.acao === "aguardar_conferencia" ? "secundario" : "primario"} aoPressionar={abrir} />
      {naWeb ? <Text style={estilos.nota}>Abre na versão web, onde esta decisão é tomada.</Text> : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  urgente: { borderColor: cores.perigoBorda, borderLeftWidth: 4, borderLeftColor: cores.perigo },
  selos: { flexDirection: "row", flexWrap: "wrap", gap: espaco.s },
  titulo: { fontSize: 16, fontWeight: "700", color: cores.tinta, lineHeight: 22 },
  detalhe: { fontSize: 14, lineHeight: 20, color: cores.tinta3 },
  meta: { fontSize: 12, lineHeight: 17, color: cores.tinta4 },
  nota: { fontSize: 12, color: cores.tinta4, textAlign: "center" },
});
