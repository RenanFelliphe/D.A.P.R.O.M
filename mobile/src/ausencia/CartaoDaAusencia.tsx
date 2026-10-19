import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { descreverPeriodo, detalheDoAto, ROTULO_DO_ATO, rotuloDaForma, rotuloDaSituacao, tomDaSituacao, type Ausencia } from "@shared/api/ausencia";
import { dataDoDia, dataHora } from "@shared/api/formatar";
import { mensagemDoErro } from "@/api/erros";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Cartao } from "@/ui/Cartao";
import { Icone } from "@/ui/Icone";
import { Selo } from "@/ui/Selo";
import { AcoesDaAusencia } from "./AcoesDaAusencia";
import { useAtosDaAusencia } from "./consultas";

const ORIGEM: Record<Ausencia["origem"], string> = {
  pedido: "Pedida por você",
  supervisor: "Registrada pelo supervisor",
  propria: "Registrada por você, como supervisor",
};

/** Uma ausência: o período, o motivo, como está, o que a pessoa pode fazer agora e o histórico (aberto só quando ela quer). */
export function CartaoDaAusencia({ ausencia: a, titular }: { ausencia: Ausencia; titular: boolean }) {
  return (
    <Cartao>
      <View style={estilos.topo}>
        <Text style={estilos.periodo}>{descreverPeriodo(a)}</Text>
        <Selo tom={tomDaSituacao[a.situacao]}>{rotuloDaSituacao[a.situacao]}</Selo>
      </View>
      <Text style={estilos.motivo}>{a.motivo}</Text>
      <Text style={estilos.nota}>
        {ORIGEM[a.origem]}
        {a.supervisor_nome && a.origem !== "propria" ? ` · supervisor ${a.supervisor_nome}` : ""}
        {a.encerrada_em ? ` · ${a.forma_encerramento ? rotuloDaForma[a.forma_encerramento] : rotuloDaSituacao[a.situacao]} em ${dataHora(a.encerrada_em)}` : ""}
      </Text>
      {a.situacao === "vencida" ? (
        <Aviso tom="blq" icone="time-outline">{`A data de retorno chegou (${dataDoDia(a.retorno)}) e o retorno ainda não foi confirmado: confirme o retorno.`}</Aviso>
      ) : null}
      {a.fim_pedido_em && a.fim_pedido_data ? (
        <Aviso tom="al" icone="time-outline">{`Fim antecipado pedido: voltar em ${dataDoDia(a.fim_pedido_data)}. Aguarda a resposta do supervisor.`}</Aviso>
      ) : null}
      <AcoesDaAusencia ausencia={a} titular={titular} />
      <Historico id={a.id} />
    </Cartao>
  );
}

/** A linha do tempo da ausência, buscada só quando a pessoa a abre. */
function Historico({ id }: { id: string }) {
  const [aberto, setAberto] = useState(false);
  const atos = useAtosDaAusencia(id, aberto);
  return (
    <View style={estilos.historico}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: aberto }} onPress={() => setAberto((v) => !v)} style={estilos.alternar} hitSlop={8}>
        <Text style={estilos.alternarTexto}>Histórico</Text>
        <Icone nome={aberto ? "chevron-up" : "chevron-down"} tamanho={16} cor={cores.marca} />
      </Pressable>
      {!aberto ? null : atos.isPending ? (
        <Text style={estilos.nota}>Carregando…</Text>
      ) : atos.isError ? (
        <Text style={estilos.nota}>{`Não foi possível carregar o histórico. ${mensagemDoErro(atos.error)}`}</Text>
      ) : (
        atos.data.map((ato) => {
          const detalhe = detalheDoAto(ato);
          return (
            <View key={ato.id} style={estilos.ato}>
              <Text style={estilos.atoData}>{dataHora(ato.em)}</Text>
              <Text style={estilos.atoTexto}>
                <Text style={estilos.atoTitulo}>{ROTULO_DO_ATO[ato.tipo] ?? ato.tipo}</Text>
                {ato.autor_nome ? ` · ${ato.autor_nome}` : " · sistema"}
                {ato.assinado ? " · assinado" : ""}
                {detalhe ? ` — ${detalhe}` : ""}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  topo: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: espaco.s },
  periodo: { flex: 1, fontSize: 14, fontWeight: "600", color: cores.tinta, lineHeight: 20 },
  motivo: { fontSize: 15, color: cores.tinta2, lineHeight: 21 },
  nota: { fontSize: 12, lineHeight: 17, color: cores.tinta4 },
  historico: { gap: espaco.s, borderTopWidth: 1, borderTopColor: cores.linha2, paddingTop: espaco.s },
  alternar: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 32 },
  alternarTexto: { fontSize: 13, fontWeight: "600", color: cores.marca },
  ato: { gap: 2 },
  atoData: { fontSize: 12, color: cores.tinta4 },
  atoTexto: { fontSize: 13, lineHeight: 18, color: cores.tinta3 },
  atoTitulo: { fontWeight: "600", color: cores.tinta },
});
