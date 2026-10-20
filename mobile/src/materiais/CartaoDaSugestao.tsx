import { useRouter, type Href } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { dataHora } from "@shared/api/formatar";
import { rotuloDoEstadoDeSugestao, type EstadoDeSugestao, type SugestaoResumo, type TipoDeSugestao } from "@shared/api/sugestao-materiais";
import type { TomDoSelo } from "@shared/api/tipos";
import { cores, espaco } from "@/tema/tema";
import { Cartao } from "@/ui/Cartao";
import { Selo } from "@/ui/Selo";

const ROTULO_DO_TIPO: Record<TipoDeSugestao, string> = { sugestao: "Sugestão", contestacao: "Contestação" };
const TOM_DO_TIPO: Record<TipoDeSugestao, TomDoSelo> = { sugestao: "lib", contestacao: "exe" };
const TOM_DO_ESTADO: Record<EstadoDeSugestao, TomDoSelo> = { pendente: "al", aceita: "enc", recusada: "blq", cancelada: "neu" };

/** O tipo (sugestão ou contestação) e o estado da sugestão, lado a lado. */
export function SelosDaSugestao({ tipo, estado }: { tipo: TipoDeSugestao; estado: EstadoDeSugestao }) {
  return (
    <View style={estilos.selos}>
      <Selo tom={TOM_DO_TIPO[tipo]}>{ROTULO_DO_TIPO[tipo]}</Selo>
      <Selo tom={TOM_DO_ESTADO[estado]}>{rotuloDoEstadoDeSugestao[estado]}</Selo>
    </View>
  );
}

/** Uma sugestão na lista: o serviço, o tipo e o estado, quem enviou e quando. Tocar abre o detalhe. */
export function CartaoDaSugestao({ sugestao: s }: { sugestao: SugestaoResumo }) {
  const router = useRouter();
  return (
    <Cartao aoPressionar={() => router.push(`/materiais/${s.id}` as Href)} rotulo={`${ROTULO_DO_TIPO[s.tipo]} do serviço ${s.atividade_codigo}, ${rotuloDoEstadoDeSugestao[s.estado]}`}>
      <SelosDaSugestao tipo={s.tipo} estado={s.estado} />
      <Text style={estilos.servico}>{`${s.atividade_codigo} — ${s.atividade_descricao}`}</Text>
      <Text style={estilos.nota}>{`${s.autor_nome} · ${dataHora(s.criada_em)}`}</Text>
      {s.posso_avaliar ? <Text style={estilos.avaliar}>Espera a sua avaliação</Text> : null}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  selos: { flexDirection: "row", flexWrap: "wrap", gap: espaco.s },
  servico: { fontSize: 15, fontWeight: "600", color: cores.tinta, lineHeight: 21 },
  nota: { fontSize: 13, color: cores.tinta4 },
  avaliar: { fontSize: 13, fontWeight: "600", color: cores.marca },
});
