import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { dataDoDia } from "@shared/api/formatar";
import { aparenciaDaSituacao, contagemRegressiva, rotuloDaBase, rotuloDoPlano } from "@shared/api/preventivas";
import { cores, espaco } from "@/tema/tema";
import { Botao } from "@/ui/Botao";
import { Cartao, TituloDeCartao } from "@/ui/Cartao";
import { Selo } from "@/ui/Selo";
import { usePlanoDaOs } from "../consultas";
import { rotaDaOs } from "../rotas";

/**
 * O ciclo da preventiva no detalhe da OS: o intervalo do plano, a contagem até o próximo ciclo e, se esta não é a última OS do
 * plano, qual é. Some quando a OS não é preventiva de plano (ou enquanto o ciclo carrega: é informação de apoio).
 */
export function CicloDaOs({ osId, preventiva }: { osId: string; preventiva: boolean }) {
  const router = useRouter();
  const { data: plano } = usePlanoDaOs(osId, preventiva);
  if (!preventiva || !plano) return null;
  const aparencia = aparenciaDaSituacao[plano.situacao];
  const ultima = plano.ultima_os;
  return (
    <Cartao>
      <View style={estilos.entre}>
        <TituloDeCartao>Ciclo da preventiva</TituloDeCartao>
        <Selo tom={aparencia.tom}>{aparencia.rotulo}</Selo>
      </View>
      <Dado rotulo="Plano" valor={rotuloDoPlano(plano)} />
      <Dado rotulo="Intervalo entre ciclos" valor={plano.intervalo_descricao ? `${plano.intervalo_descricao}, contado ${rotuloDaBase[plano.base_do_ciclo]}` : "Não definido"} />
      <Dado rotulo="Próximo ciclo" valor={`${contagemRegressiva(plano)}${plano.proximo_ciclo ? ` · ${dataDoDia(plano.proximo_ciclo)}` : ""}`} destaque />
      <Dado rotulo="Ciclos registrados" valor={String(plano.total_ciclos)} />
      {!plano.eh_ultima_do_plano && ultima ? (
        <View style={estilos.ultima}>
          <Text style={estilos.pequeno}>{`Esta OS é de um ciclo anterior. A última do plano é a ${ultima.numero_ordem ?? "OS"}, programada para ${dataDoDia(ultima.data_inicio_prog)}.`}</Text>
          <Botao titulo={`Abrir a ${ultima.numero_ordem ?? "última OS do plano"}`} variante="secundario" aoPressionar={() => router.push(rotaDaOs(ultima.id))} />
        </View>
      ) : null}
    </Cartao>
  );
}

function Dado({ rotulo, valor, destaque = false }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <View style={estilos.dado}>
      <Text style={estilos.pequeno}>{rotulo}</Text>
      <Text style={[estilos.valor, destaque && estilos.destaque]}>{valor}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  entre: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: espaco.m },
  dado: { gap: 2 },
  pequeno: { fontSize: 12, color: cores.tinta4, lineHeight: 17 },
  valor: { fontSize: 14, color: cores.tinta },
  destaque: { fontWeight: "700" },
  ultima: { gap: espaco.s, marginTop: espaco.s },
});
