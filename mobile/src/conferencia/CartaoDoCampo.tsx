import { StyleSheet, Text, View } from "react-native";
import type { CampoDaConferencia, ConferenciaDaApi } from "@shared/api/conferencia-execucao";
import { descreverEscolha, descreverOpcao, quemDecideOCampo } from "@shared/api/conferencia-texto";
import { cores, espaco, raio } from "@/tema/tema";
import { Cartao } from "@/ui/Cartao";
import { ListaDeOpcoes, Opcao } from "@/ui/Opcao";
import { Selo } from "@/ui/Selo";
import { escolhaFeita, nomeDoAutor, opcoesParaEscolher, situacaoDoCampo } from "./regras";

interface CartaoDoCampoProps {
  c: ConferenciaDaApi;
  campo: CampoDaConferencia;
  /** A versão marcada agora (só quando a pessoa escolhe este campo). */
  escolha?: string;
  aoEscolher: (valor: string) => void;
}

/**
 * Um campo da conferência (início, fim, resultado ou uma pausa): o que cada aparelho registrou, o padrão sugerido e o que vale agora. Para
 * quem decide o campo, vira a escolha (uma opção por versão, a sugerida já marcada); depois de decidido, mostra o que foi escolhido.
 */
export function CartaoDoCampo({ c, campo, escolha, aoEscolher }: CartaoDoCampoProps) {
  const situacao = situacaoDoCampo(c, campo);
  const feita = escolhaFeita(c, campo.campo);
  return (
    <Cartao>
      <View style={estilos.topo}>
        <Text style={estilos.titulo}>{campo.rotulo}</Text>
        {situacao === "sem_divergencia" ? (
          <Selo tom="enc">Todos concordam</Selo>
        ) : situacao === "decidido" ? (
          <Selo tom="enc">Escolhido</Selo>
        ) : (
          <Selo tom="al">{situacao === "para_mim" ? "Escolha a sua" : "Com diferença"}</Selo>
        )}
      </View>

      {situacao === "sem_divergencia" ? (
        <Text style={estilos.texto}>{campo.opcoes[0] ? descreverOpcao(campo.campo, campo.opcoes[0]) : "—"}</Text>
      ) : situacao === "para_mim" ? (
        <>
          <Text style={estilos.suave}>Escolha a versão que vale. O padrão sugerido já vem marcado.</Text>
          <ListaDeOpcoes>
            {opcoesParaEscolher(c, campo).map((o) => (
              <Opcao
                key={o.valor}
                tipo="radio"
                rotulo={o.rotulo}
                detalhe={[o.detalhe, o.sugerida ? "padrão sugerido" : null, o.valendo ? "valendo agora" : null].filter(Boolean).join(" · ")}
                marcada={escolha === o.valor}
                aoPressionar={() => aoEscolher(o.valor)}
              />
            ))}
          </ListaDeOpcoes>
        </>
      ) : (
        <>
          {campo.opcoes.map((o) => (
            <View key={o.autor_id} style={estilos.versao}>
              <Text style={estilos.nome}>{o.autor_nome}</Text>
              <Text style={estilos.texto}>{descreverOpcao(campo.campo, o)}</Text>
              {campo.valendo_de === o.autor_id ? <Text style={estilos.marca}>valendo agora</Text> : null}
            </View>
          ))}
          {feita ? (
            <View style={estilos.feita}>
              <Text style={estilos.feitaTexto}>{feita.descartada ? "A pausa foi descartada" : campo.so_um ? "A pausa foi aceita" : `Vale a versão de ${descreverEscolha(c, feita.escolha)}`}</Text>
              {feita.porNome ? <Text style={estilos.feitaPor}>{`Escolha de ${feita.porNome}`}</Text> : null}
            </View>
          ) : (
            <Text style={estilos.suave}>{`Escolha ${quemDecideOCampo(campo)}. Padrão sugerido: ${campo.so_um ? "aceitar a pausa" : (nomeDoAutor(c, campo.sugerido) ?? "—")}.`}</Text>
          )}
        </>
      )}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  topo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: espaco.s },
  titulo: { flex: 1, fontSize: 15, fontWeight: "700", color: cores.tinta },
  texto: { fontSize: 14, lineHeight: 20, color: cores.tinta2 },
  suave: { fontSize: 13, lineHeight: 19, color: cores.tinta4 },
  versao: { gap: 2, padding: espaco.s, borderRadius: raio.s, backgroundColor: cores.superficie2 },
  nome: { fontSize: 13, fontWeight: "700", color: cores.tinta },
  marca: { fontSize: 12, fontWeight: "600", color: cores.marca },
  feita: { gap: 2, padding: espaco.s, borderRadius: raio.s, backgroundColor: cores.okFundo },
  feitaTexto: { fontSize: 14, fontWeight: "600", color: cores.okTinta },
  feitaPor: { fontSize: 12, color: cores.okTinta },
});
