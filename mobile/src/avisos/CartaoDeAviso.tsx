import { StyleSheet, Text, View } from "react-native";
import { alertaUrgente, referenciaDoAlerta, rotuloDoAlerta, type Alerta } from "@shared/api/alertas";
import { dataHora } from "@shared/api/formatar";
import { cores, espaco, raio } from "@/tema/tema";
import { Cartao } from "@/ui/Cartao";
import { Icone } from "@/ui/Icone";
import { destinoDoAvisoNoApp } from "./destino";

/**
 * Um aviso do sino: o tipo, a que ele se refere (a OS, a ausência), o detalhe e quando chegou. O não lido vem em destaque, com um ponto;
 * o que pede atenção (impedimento, segurança, falhas) vem em vermelho. Tocar o abre e, quando o aviso tem tela no app, leva a ela.
 */
export function CartaoDeAviso({ aviso, aoAbrir }: { aviso: Alerta; aoAbrir: () => void }) {
  const urgente = alertaUrgente(aviso);
  const naoLido = aviso.lido_em === null;
  const referencia = referenciaDoAlerta(aviso);
  const leva = destinoDoAvisoNoApp(aviso) !== null;
  return (
    <Cartao aoPressionar={aoAbrir} rotulo={`${naoLido ? "Não lido: " : ""}${rotuloDoAlerta(aviso)}`} estilo={[urgente && estilos.urgente, naoLido && estilos.naoLido]}>
      <View style={estilos.topo}>
        <Icone nome={urgente ? "warning-outline" : "notifications-outline"} tamanho={20} cor={urgente ? cores.perigo : cores.marca} />
        <Text style={[estilos.tipo, naoLido && estilos.forte, urgente && { color: cores.perigo }]}>{rotuloDoAlerta(aviso)}</Text>
        {naoLido ? <View accessibilityLabel="Não lido" style={estilos.ponto} /> : null}
      </View>
      {referencia.codigo || referencia.texto ? (
        <Text style={estilos.referencia}>
          {referencia.codigo ? <Text style={estilos.codigo}>{`${referencia.codigo}  `}</Text> : null}
          {referencia.texto}
        </Text>
      ) : null}
      <Text style={estilos.detalhe}>{aviso.detalhe}</Text>
      <View style={estilos.rodape}>
        <Text style={estilos.data}>{dataHora(aviso.criado_em)}</Text>
        {leva ? (
          <View style={estilos.abrir}>
            <Text style={estilos.abrirTexto}>Abrir</Text>
            <Icone nome="chevron-forward" tamanho={14} cor={cores.marca} />
          </View>
        ) : null}
      </View>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  urgente: { borderColor: cores.perigoBorda },
  naoLido: { backgroundColor: cores.marcaFundo },
  topo: { flexDirection: "row", alignItems: "center", gap: espaco.s },
  tipo: { flex: 1, fontSize: 14, fontWeight: "600", color: cores.tinta2 },
  forte: { fontWeight: "700", color: cores.tinta },
  ponto: { width: 10, height: 10, borderRadius: raio.pilula, backgroundColor: cores.marca },
  referencia: { fontSize: 14, color: cores.tinta },
  codigo: { fontWeight: "700", fontVariant: ["tabular-nums"] },
  detalhe: { fontSize: 14, lineHeight: 20, color: cores.tinta3 },
  rodape: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  data: { fontSize: 12, color: cores.tinta4 },
  abrir: { flexDirection: "row", alignItems: "center", gap: 2 },
  abrirTexto: { fontSize: 13, fontWeight: "600", color: cores.marca },
});
