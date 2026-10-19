import { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { numero, ordinal, pontos, rotuloDaTemporada, type MinhaPontuacao as Pontuacao } from "@shared/api/gamificacao";
import { data, dataHora } from "@shared/api/formatar";
import { mensagemDoErro } from "@/api/erros";
import { cores, espaco, raio } from "@/tema/tema";
import { Botao } from "@/ui/Botao";
import { Cartao, TituloDeCartao } from "@/ui/Cartao";
import { Carregando, Vazio } from "@/ui/Estados";
import { Icone } from "@/ui/Icone";
import { Segmentos } from "@/ui/Segmentos";
import { useExtrato, useMinhaPontuacao, useTemporadas } from "./consultas";
import { percentualDaBarra, ultimasConquistas } from "./regras";
import { SeloDePatente } from "./SeloDePatente";

const ULTIMAS_CONQUISTAS = 6;

/**
 * Minha pontuação: a patente da temporada com a barra até a próxima, os pontos da temporada e os gerais, a maior patente, a posição, as
 * últimas conquistas e o extrato (com filtro por temporada). Os cadastros de pontos, patentes e conquistas ficam só na web.
 */
export function MinhaPontuacao() {
  const eu = useMinhaPontuacao();
  if (eu.isPending) return <Carregando texto="Buscando a sua pontuação…" />;
  if (eu.isError) return <Vazio icone="cloud-offline-outline" titulo="Não foi possível carregar a pontuação" texto={mensagemDoErro(eu.error)} acao={{ titulo: "Tentar de novo", aoPressionar: () => void eu.refetch() }} />;
  const p = eu.data;
  const ultimas = ultimasConquistas(p.conquistas, ULTIMAS_CONQUISTAS);
  return (
    <>
      <CartaoDaPatente p={p} />
      <View style={estilos.grade}>
        <Dado rotulo="Pontos na temporada" valor={numero(p.pontos_temporada)} nota={p.temporada.nome} />
        <Dado rotulo="Pontos gerais" valor={numero(p.pontos_gerais)} nota="desde a criação da conta" />
        <Dado
          rotulo="Posição"
          valor={p.posicao_temporada ? ordinal(p.posicao_temporada) : "—"}
          nota={p.posicao_temporada ? `de ${p.participantes_temporada} na temporada · ${p.posicao_geral ? `${ordinal(p.posicao_geral)} no geral` : "sem posição no geral"}` : "fora do ranking"}
        />
        <Cartao estilo={estilos.dado}>
          <Text style={estilos.rotuloDoDado}>Maior patente</Text>
          {p.maior_patente ? <SeloDePatente patente={p.maior_patente} /> : <Text style={estilos.valorDoDado}>—</Text>}
          <Text style={estilos.notaDoDado}>a mais alta já alcançada</Text>
        </Cartao>
      </View>
      <Cartao>
        <TituloDeCartao>Últimas conquistas</TituloDeCartao>
        {ultimas.length === 0 ? (
          <Text style={estilos.nota}>Nenhuma conquista ainda. A primeira vem com a primeira APR completa.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.conquistas}>
            {ultimas.map((c) => (
              <View key={c.id} style={estilos.conquista}>
                {c.imagem_url ? <Image source={{ uri: c.imagem_url }} style={estilos.imagemDaConquista} resizeMode="contain" accessibilityLabel={`Troféu ${c.titulo}`} /> : <Icone nome="trophy" tamanho={32} cor={cores.alerta} />}
                <Text style={estilos.tituloDaConquista} numberOfLines={2}>
                  {c.titulo}
                </Text>
                <Text style={estilos.nota}>{data(c.obtida_em)}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </Cartao>
      <Extrato />
    </>
  );
}

function CartaoDaPatente({ p }: { p: Pontuacao }) {
  const percentual = percentualDaBarra(p.pontos_temporada, p.barra);
  return (
    <Cartao estilo={estilos.patente}>
      {p.patente?.imagem_url ? <Image source={{ uri: p.patente.imagem_url }} style={estilos.imagemDaPatente} resizeMode="contain" accessibilityLabel={`Patente ${p.patente.nome}`} /> : <SeloDePatente patente={p.patente} tamanho={96} semNome />}
      <Text style={estilos.rotuloDoDado}>{`Minha patente · ${p.temporada.nome}`}</Text>
      <Text style={estilos.nomeDaPatente}>{p.patente?.nome ?? "Sem patente"}</Text>
      <Text style={estilos.pontosDaPatente}>
        <Text style={estilos.forte}>{numero(p.pontos_temporada)}</Text>
        {` ${p.pontos_temporada === 1 ? "ponto" : "pontos"} na temporada`}
      </Text>
      <View style={estilos.barra} accessibilityRole="progressbar" accessibilityValue={{ min: p.barra.de, max: p.barra.ate ?? p.pontos_temporada, now: p.pontos_temporada }}>
        <View style={[estilos.preenchimento, { width: `${percentual}%`, backgroundColor: p.patente?.cor ?? cores.marca }]} />
      </View>
      <View style={estilos.rotulosDaBarra}>
        <Text style={estilos.nota}>{numero(p.barra.de)}</Text>
        <Text style={[estilos.nota, estilos.centro]}>{p.proxima_patente ? `Faltam ${pontos(p.proxima_patente.faltam)} para ${p.proxima_patente.nome}` : "Você está na maior patente"}</Text>
        {p.barra.ate !== null ? <Text style={estilos.nota}>{numero(p.barra.ate)}</Text> : null}
      </View>
    </Cartao>
  );
}

function Dado({ rotulo, valor, nota }: { rotulo: string; valor: string; nota: string }) {
  return (
    <Cartao estilo={estilos.dado}>
      <Text style={estilos.rotuloDoDado}>{rotulo}</Text>
      <Text style={estilos.valorDoDado}>{valor}</Text>
      <Text style={estilos.notaDoDado}>{nota}</Text>
    </Cartao>
  );
}

/** O extrato de pontos da pessoa, com o filtro por temporada: cada linha diz de onde veio o ponto ("APR completa da OS 4019821"). */
function Extrato() {
  const [temporada, setTemporada] = useState<string | undefined>(undefined);
  const temporadas = useTemporadas();
  const extrato = useExtrato(temporada);
  const codigoDaAtual = temporadas.data?.find((t) => t.atual)?.codigo;
  const opcoes = [...(temporadas.data ?? []).map((t) => ({ id: t.codigo, rotulo: rotuloDaTemporada(t) })), { id: "geral", rotulo: "Geral" }];
  const lancamentos = extrato.data?.pages.flatMap((pg) => pg.lancamentos) ?? [];
  const primeira = extrato.data?.pages[0];
  return (
    <Cartao>
      <TituloDeCartao>Extrato de pontos</TituloDeCartao>
      {temporadas.data ? <Segmentos rolavel opcoes={opcoes} valor={temporada ?? codigoDaAtual ?? "geral"} aoMudar={(id) => setTemporada(id === codigoDaAtual ? undefined : id)} /> : null}
      {extrato.isPending ? (
        <Carregando texto="Buscando o extrato…" />
      ) : extrato.isError ? (
        <Text style={estilos.nota}>{`Não foi possível carregar o extrato. ${mensagemDoErro(extrato.error)}`}</Text>
      ) : (
        <>
          <Text style={estilos.nota}>{`${numero(primeira?.pontos ?? 0)} ${(primeira?.pontos ?? 0) === 1 ? "ponto" : "pontos"} · ${numero(primeira?.total ?? 0)} ${(primeira?.total ?? 0) === 1 ? "lançamento" : "lançamentos"}`}</Text>
          {lancamentos.length === 0 ? <Text style={estilos.nota}>Nenhum ponto nesta temporada ainda.</Text> : null}
          {lancamentos.map((l) => (
            <View key={l.id} style={estilos.lancamento}>
              <View style={estilos.lancamentoTexto}>
                <Text style={estilos.descricao}>{l.descricao}</Text>
                <Text style={estilos.nota}>{dataHora(l.ocorrido_em)}</Text>
              </View>
              <Text style={[estilos.pontosDoLancamento, l.pontos < 0 && { color: cores.perigo }]}>{`${l.pontos > 0 ? "+" : ""}${numero(l.pontos)}`}</Text>
            </View>
          ))}
          {extrato.hasNextPage ? <Botao titulo="Ver mais" variante="secundario" enviando={extrato.isFetchingNextPage} aoPressionar={() => void extrato.fetchNextPage()} /> : null}
        </>
      )}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  patente: { alignItems: "center", gap: espaco.s },
  imagemDaPatente: { width: 112, height: 112 },
  nomeDaPatente: { fontSize: 22, fontWeight: "700", color: cores.tinta },
  pontosDaPatente: { fontSize: 15, color: cores.tinta3 },
  forte: { fontWeight: "700", color: cores.tinta },
  barra: { alignSelf: "stretch", height: 10, borderRadius: raio.pilula, backgroundColor: cores.chip, overflow: "hidden" },
  preenchimento: { height: "100%", borderRadius: raio.pilula },
  rotulosDaBarra: { alignSelf: "stretch", flexDirection: "row", justifyContent: "space-between", gap: espaco.s },
  centro: { flex: 1, textAlign: "center" },
  grade: { flexDirection: "row", flexWrap: "wrap", gap: espaco.m },
  dado: { flexBasis: "47%", flexGrow: 1 },
  rotuloDoDado: { fontSize: 12, fontWeight: "600", color: cores.tinta4, textTransform: "uppercase" },
  valorDoDado: { fontSize: 24, fontWeight: "700", color: cores.tinta },
  notaDoDado: { fontSize: 12, color: cores.tinta4 },
  nota: { fontSize: 12, lineHeight: 17, color: cores.tinta4 },
  conquistas: { gap: espaco.m },
  conquista: { width: 96, alignItems: "center", gap: 4 },
  imagemDaConquista: { width: 64, height: 64 },
  tituloDaConquista: { fontSize: 13, fontWeight: "600", color: cores.tinta, textAlign: "center" },
  lancamento: { flexDirection: "row", alignItems: "center", gap: espaco.m, paddingVertical: espaco.s, borderTopWidth: 1, borderTopColor: cores.linha2 },
  lancamentoTexto: { flex: 1, gap: 2 },
  descricao: { fontSize: 14, color: cores.tinta },
  pontosDoLancamento: { fontSize: 15, fontWeight: "700", color: cores.ok },
});
