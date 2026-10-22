import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { telefoneParaLigar, type ContatoDeEmergencia } from "@shared/api/emergencia";
import { cores, espaco, raio } from "@/tema/tema";
import { mostrarAviso } from "@/ui/AvisoRapido";
import { Icone } from "@/ui/Icone";
import { useContatosDeEmergencia } from "./contatos";

/** Abre o discador com o número já digitado: a pessoa só confirma a ligação. Funciona sem sinal de dados. */
function ligar(contato: ContatoDeEmergencia) {
  void Linking.openURL(`tel:${telefoneParaLigar(contato.telefone)}`).catch(() => mostrarAviso(`Não consegui abrir o telefone. Ligue para ${contato.telefone}.`));
}

function Linha({ contato }: { contato: ContatoDeEmergencia }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Ligar para ${contato.nome}, ${contato.telefone}`} onPress={() => ligar(contato)} style={({ pressed }) => [estilos.linha, { opacity: pressed ? 0.85 : 1 }]}>
      <Icone nome="call" tamanho={22} cor={cores.branco} />
      <View style={estilos.texto}>
        <Text style={estilos.nome}>{contato.nome}</Text>
        <Text style={estilos.detalhe}>{[contato.telefone, contato.descricao].filter(Boolean).join(" · ")}</Text>
      </View>
      <Icone nome="chevron-forward" tamanho={18} cor={cores.branco} />
    </Pressable>
  );
}

/**
 * Os contatos para ligar na emergência: o PAE da empresa (cadastrado pelo administrador) e o SAMU e os Bombeiros. Cada linha abre o discador. Mostra o
 * que ficou guardado no aparelho quando não há sinal, e diz quando o PAE ainda não foi cadastrado.
 */
export function ListaDeContatos() {
  const { data } = useContatosDeEmergencia();
  const contatos = data ?? { pae: [], publicos: [] };
  return (
    <View style={estilos.lista}>
      <Text accessibilityRole="header" style={estilos.titulo}>
        Ligue agora
      </Text>
      {contatos.pae.map((c) => (
        <Linha key={`${c.nome}-${c.telefone}`} contato={c} />
      ))}
      {contatos.pae.length === 0 ? <Text style={estilos.aviso}>O PAE da empresa ainda não foi cadastrado: fale com o administrador. Enquanto isso, use os números públicos.</Text> : null}
      {contatos.publicos.map((c) => (
        <Linha key={`${c.nome}-${c.telefone}`} contato={c} />
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  lista: { gap: espaco.s },
  titulo: { fontSize: 16, fontWeight: "700", color: cores.tinta },
  linha: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: espaco.m, paddingHorizontal: espaco.l, paddingVertical: espaco.s, borderRadius: raio.m, backgroundColor: cores.perigo },
  texto: { flex: 1 },
  nome: { fontSize: 16, fontWeight: "700", color: cores.branco },
  detalhe: { fontSize: 13, color: cores.branco },
  aviso: { fontSize: 13, lineHeight: 18, color: cores.tinta4 },
});
