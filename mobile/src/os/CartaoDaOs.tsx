import { StyleSheet, Text, View } from "react-native";
import { dataDoDia } from "@shared/api/formatar";
import { rotuloDoTipo, tomDaPrioridade, type OsResumo } from "@shared/api/os-app";
import { cores, espaco } from "@/tema/tema";
import { Cartao } from "@/ui/Cartao";
import { Icone } from "@/ui/Icone";
import { Selo } from "@/ui/Selo";

/**
 * Cartão de OS da lista: número, tipo, criticidade e prioridade; título; local; data programada; e as marcas que mudam o que a pessoa
 * faz (reservada, aguardando nova APR, aguardando assinaturas). Leva ao detalhe da OS.
 */
export function CartaoDaOs({ os, usuarioId, aoAbrir }: { os: OsResumo; usuarioId: string; aoAbrir: () => void }) {
  const programada = dataDoDia(os.data_fim_prog ?? os.data_inicio_prog).slice(0, 5);
  const reservada = os.responsavel && (os.status === "liberada" || os.status === "pendente");
  return (
    <Cartao aoPressionar={aoAbrir} rotulo={`OS ${os.numero_ordem ?? "sem número"}: ${os.titulo}`}>
      <View style={estilos.topo}>
        <Text style={estilos.numero}>{os.numero_ordem ?? "Sem nº"}</Text>
        <Text style={estilos.tipo}>{rotuloDoTipo[os.tipo]}</Text>
        {os.local_instalacao.critico ? <Selo tom="crit">Crítico</Selo> : null}
        {os.prioridade ? <Selo tom={tomDaPrioridade(os.prioridade)}>{os.prioridade}</Selo> : null}
      </View>
      <Text style={estilos.titulo}>{os.titulo}</Text>
      <Linha icone="location-outline">{os.local_instalacao.codigo}</Linha>
      <Linha icone="time-outline" cor={os.atrasada ? cores.perigo : undefined}>
        {`Prog. até ${programada}${os.atrasada ? " · atrasada" : ""}`}
      </Linha>
      {os.execucao_aberta_ha_horas ? (
        <Linha icone="alert-circle-outline" cor={cores.alerta} forte>
          {`Execução aberta há ${os.execucao_aberta_ha_horas} h`}
        </Linha>
      ) : null}
      {os.status === "pendente" ? <Selo tom="blq">Aguardando nova APR</Selo> : null}
      {reservada ? (
        <Selo tom="brand" icone="person-outline">
          {os.responsavel!.id === usuarioId ? "Reservada para você" : `Reservada para ${os.responsavel!.nome.split(" ")[0]}`}
        </Selo>
      ) : null}
      {os.status === "encerrando" ? (
        <Selo tom="exe" icone="time-outline">
          Aguardando o responsável assinar
        </Selo>
      ) : null}
      {os.status === "aguardando_supervisor" ? (
        <Selo tom="al" icone="document-text-outline">
          Aguardando a assinatura do supervisor
        </Selo>
      ) : null}
    </Cartao>
  );
}

function Linha({ icone, children, cor = cores.tinta3, forte = false }: { icone: "location-outline" | "time-outline" | "alert-circle-outline"; children: string; cor?: string; forte?: boolean }) {
  return (
    <View style={estilos.linha}>
      <Icone nome={icone} tamanho={14} cor={cor} />
      <Text style={[estilos.linhaTexto, { color: cor }, forte && { fontWeight: "600" }]}>{children}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  topo: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: espaco.s },
  numero: { fontSize: 14, fontWeight: "700", color: cores.tinta, fontVariant: ["tabular-nums"] },
  tipo: { fontSize: 12, color: cores.tinta4 },
  titulo: { fontSize: 15, fontWeight: "600", color: cores.tinta, lineHeight: 21 },
  linha: { flexDirection: "row", alignItems: "center", gap: 6 },
  linhaTexto: { fontSize: 13, flexShrink: 1 },
});
