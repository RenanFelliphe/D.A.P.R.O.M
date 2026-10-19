import { Image, StyleSheet, Text, View } from "react-native";
import { numero, raridadeEmTexto, type Conquista } from "@shared/api/gamificacao";
import { data } from "@shared/api/formatar";
import { mensagemDoErro } from "@/api/erros";
import { cores, espaco, raio } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Cartao } from "@/ui/Cartao";
import { Carregando, Vazio } from "@/ui/Estados";
import { Icone } from "@/ui/Icone";
import { Selo } from "@/ui/Selo";
import { useConquistas } from "./consultas";
import { progressoDaConquista } from "./regras";

/** Os troféus: colorido, com a data, quando obtido; em cinza, com a meta e o progresso, quando falta. As obtidas vêm primeiro. */
export function Conquistas() {
  const lista = useConquistas();
  if (lista.isPending) return <Carregando texto="Buscando as conquistas…" />;
  if (lista.isError) return <Vazio icone="cloud-offline-outline" titulo="Não foi possível carregar as conquistas" texto={mensagemDoErro(lista.error)} acao={{ titulo: "Tentar de novo", aoPressionar: () => void lista.refetch() }} />;
  const todas = lista.data.conquistas.filter((c) => c.ativa);
  const obtidas = todas.filter((c) => c.obtida_em);
  const faltam = todas.filter((c) => !c.obtida_em);
  if (todas.length === 0) return <Vazio icone="trophy-outline" titulo="Nenhuma conquista cadastrada" />;
  return (
    <>
      <Text style={estilos.resumo}>{`${obtidas.length} de ${todas.length} conquistas`}</Text>
      {lista.data.pontos_ligados ? null : <Aviso tom="info">Os pontos das conquistas estão desligados no momento: elas contam só como troféu.</Aviso>}
      {obtidas.map((c) => (
        <CartaoDaConquista key={c.id} conquista={c} />
      ))}
      {faltam.map((c) => (
        <CartaoDaConquista key={c.id} conquista={c} />
      ))}
    </>
  );
}

function CartaoDaConquista({ conquista: c }: { conquista: Conquista }) {
  const obtida = c.obtida_em !== null;
  const progresso = obtida ? null : progressoDaConquista(c);
  return (
    <Cartao estilo={!obtida ? estilos.falta : undefined} rotulo={`${c.titulo}${obtida ? " (obtida)" : ""}`}>
      <View style={estilos.linha}>
        {c.imagem_url ? (
          <Image source={{ uri: c.imagem_url }} style={[estilos.imagem, !obtida && estilos.apagada]} resizeMode="contain" accessibilityLabel={`Troféu ${c.titulo}`} />
        ) : (
          <View style={estilos.imagem}>
            <Icone nome="trophy" tamanho={32} cor={obtida ? cores.alerta : cores.tinta4} />
          </View>
        )}
        <View style={estilos.corpo}>
          <Text style={estilos.titulo}>{c.titulo}</Text>
          <Text style={estilos.meta}>{c.meta}</Text>
          <Text style={estilos.descricao}>{c.descricao}</Text>
        </View>
      </View>
      {obtida ? (
        <View style={estilos.obtida}>
          <Icone nome="checkmark-circle" tamanho={16} cor={cores.ok} />
          <Text style={estilos.obtidaTexto}>{`Obtida em ${data(c.obtida_em)}`}</Text>
        </View>
      ) : progresso ? (
        <View style={estilos.progresso}>
          <Text style={estilos.nota}>{progresso.texto}</Text>
          {progresso.percentual !== null ? (
            <View style={estilos.barra} accessibilityRole="progressbar" accessibilityLabel={`Progresso: ${c.titulo}`}>
              <View style={[estilos.preenchimento, { width: `${progresso.percentual}%` }]} />
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={estilos.rodape}>
        <Text style={[estilos.nota, estilos.raridade]}>{`${raridadeEmTexto(c.raridade)} ${c.tipo === "equipe" ? "das equipes" : "dos técnicos"} ${c.obtidas === 1 ? "tem" : "têm"}`}</Text>
        {c.pontos > 0 ? <Selo tom="al">{`+${numero(c.pontos)} pontos`}</Selo> : null}
      </View>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  resumo: { fontSize: 14, fontWeight: "600", color: cores.tinta3 },
  falta: { backgroundColor: cores.superficie2 },
  linha: { flexDirection: "row", gap: espaco.m },
  imagem: { width: 64, height: 64, alignItems: "center", justifyContent: "center" },
  apagada: { opacity: 0.35 },
  corpo: { flex: 1, gap: 2 },
  titulo: { fontSize: 16, fontWeight: "700", color: cores.tinta },
  meta: { fontSize: 13, fontWeight: "600", color: cores.marca },
  descricao: { fontSize: 13, lineHeight: 18, color: cores.tinta3 },
  obtida: { flexDirection: "row", alignItems: "center", gap: 6 },
  obtidaTexto: { fontSize: 13, fontWeight: "700", color: cores.ok },
  progresso: { gap: 6 },
  barra: { height: 8, borderRadius: raio.pilula, backgroundColor: cores.chip, overflow: "hidden" },
  preenchimento: { height: "100%", borderRadius: raio.pilula, backgroundColor: cores.marca },
  rodape: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: espaco.s },
  nota: { fontSize: 12, lineHeight: 17, color: cores.tinta4 },
  raridade: { flex: 1 },
});
