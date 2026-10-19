import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { mediaDeEquipe, numero, rotuloDaTemporada, type LinhaDeEquipe, type LinhaDePessoa } from "@shared/api/gamificacao";
import { dataDoDia } from "@shared/api/formatar";
import { mensagemDoErro } from "@/api/erros";
import { cores, espaco, raio } from "@/tema/tema";
import { Carregando, Vazio } from "@/ui/Estados";
import { Segmentos } from "@/ui/Segmentos";
import { useRanking, useTemporadas } from "./consultas";
import { SeloDePatente } from "./SeloDePatente";

const MEDALHAS = ["#C9A227", "#9AA5AD", "#B0703C"];

/**
 * O ranking de pessoas ou de equipes, na temporada de hoje, numa fechada (como ficou no fechamento) ou no geral. Quem está anônimo aparece
 * como "Participante anônimo" (a própria pessoa vê o nome), e a própria linha vem em destaque. Só pontos e patente, nunca os indicadores.
 */
export function Ranking() {
  const [tipo, setTipo] = useState<"pessoas" | "equipes">("pessoas");
  const [temporada, setTemporada] = useState<string | undefined>(undefined);
  const temporadas = useTemporadas();
  const ranking = useRanking(tipo, temporada);
  const codigoDaAtual = temporadas.data?.find((t) => t.atual)?.codigo;
  const opcoes = [...(temporadas.data ?? []).map((t) => ({ id: t.codigo, rotulo: rotuloDaTemporada(t) })), { id: "geral", rotulo: "Geral" }];

  const dados = ranking.data;
  const geral = dados?.escopo === "geral";
  const t = dados?.temporada;

  return (
    <>
      <Segmentos opcoes={[{ id: "pessoas", rotulo: "Pessoas" }, { id: "equipes", rotulo: "Equipes" }]} valor={tipo} aoMudar={setTipo} />
      {temporadas.data ? <Segmentos rolavel opcoes={opcoes} valor={temporada ?? codigoDaAtual ?? "geral"} aoMudar={(id) => setTemporada(id === codigoDaAtual ? undefined : id)} /> : null}
      {dados ? (
        <Text style={estilos.nota}>
          {geral
            ? "Ranking geral: todos os pontos desde a criação das contas."
            : t
              ? `${t.nome} (${dataDoDia(t.inicio)} a ${dataDoDia(t.fim)})${t.fechada ? " · temporada fechada: o resultado como ficou no fechamento" : t.atual ? " · temporada atual" : " · aguardando o fechamento"}`
              : ""}
        </Text>
      ) : null}
      {ranking.isPending ? (
        <Carregando texto="Buscando o ranking…" />
      ) : ranking.isError ? (
        <Vazio icone="cloud-offline-outline" titulo="Não foi possível carregar o ranking" texto={mensagemDoErro(ranking.error)} acao={{ titulo: "Tentar de novo", aoPressionar: () => void ranking.refetch() }} />
      ) : dados && dados.linhas.length === 0 ? (
        <Vazio icone="podium-outline" titulo={tipo === "equipes" ? "Nenhuma equipe no ranking ainda" : "Ninguém no ranking ainda"} />
      ) : dados?.tipo === "equipes" ? (
        dados.linhas.map((l) => <LinhaDaEquipe key={l.equipe_id} linha={l} geral={geral} />)
      ) : dados ? (
        dados.linhas.map((l, i) => <LinhaDaPessoa key={l.usuario_id ?? `anonimo-${i}`} linha={l} geral={geral} />)
      ) : null}
      <Text style={estilos.nota}>
        {tipo === "equipes"
          ? "As equipes são ordenadas pela média por membro (a soma dividida pelas pessoas da equipe), para a equipe maior não ganhar só por ser maior. Equipe sem ninguém fica fora."
          : "No empate, fica na frente quem chegou primeiro àquela pontuação. Entram os técnicos ativos e liberados, supervisores inclusos."}
      </Text>
    </>
  );
}

/** A posição, com a medalha dos três primeiros. */
function Posicao({ n }: { n: number }) {
  const medalha = n <= 3 ? MEDALHAS[n - 1] : undefined;
  return (
    <View style={[estilos.posicao, medalha ? { backgroundColor: medalha } : null]}>
      <Text style={[estilos.posicaoTexto, medalha ? { color: cores.branco } : null]}>{n}</Text>
    </View>
  );
}

function LinhaDaPessoa({ linha: l, geral }: { linha: LinhaDePessoa; geral: boolean }) {
  return (
    <View style={[estilos.linha, l.voce && estilos.voce]} accessibilityLabel={`${l.posicao}º, ${l.nome}, ${numero(l.pontos)} pontos${l.voce ? ", você" : ""}`}>
      <Posicao n={l.posicao} />
      <View style={estilos.corpo}>
        <Text style={[estilos.nome, !l.usuario_id && estilos.anonimo]} numberOfLines={1}>
          {l.nome}
          {l.voce ? "  · você" : ""}
        </Text>
        <Text style={estilos.nota} numberOfLines={1}>
          {[l.equipe_nome, l.voce && l.anonimo ? "anônimo para os outros" : null, geral ? "maior patente" : null].filter(Boolean).join(" · ")}
        </Text>
        <SeloDePatente patente={l.patente} tamanho={24} />
      </View>
      <Text style={estilos.pontos}>{numero(l.pontos)}</Text>
    </View>
  );
}

function LinhaDaEquipe({ linha: l, geral }: { linha: LinhaDeEquipe; geral: boolean }) {
  return (
    <View style={[estilos.linha, l.voce && estilos.voce]} accessibilityLabel={`${l.posicao}º, ${l.nome}, média ${mediaDeEquipe(l.media)}${l.voce ? ", sua equipe" : ""}`}>
      <Posicao n={l.posicao} />
      <View style={estilos.corpo}>
        <Text style={estilos.nome} numberOfLines={1}>
          {l.nome}
          {l.voce ? "  · sua equipe" : ""}
        </Text>
        <Text style={estilos.nota} numberOfLines={1}>{`${l.membros} ${l.membros === 1 ? "pessoa" : "pessoas"} · soma ${numero(l.pontos)}${geral ? " · maior patente" : ""}`}</Text>
        <SeloDePatente patente={l.patente} tamanho={24} />
      </View>
      <View style={estilos.media}>
        <Text style={estilos.pontos}>{mediaDeEquipe(l.media)}</Text>
        <Text style={estilos.nota}>média</Text>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  nota: { fontSize: 12, lineHeight: 17, color: cores.tinta4 },
  linha: { flexDirection: "row", alignItems: "center", gap: espaco.m, padding: espaco.m, borderRadius: raio.m, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.superficie },
  voce: { borderColor: cores.marca, backgroundColor: cores.marcaFundo },
  posicao: { width: 32, height: 32, borderRadius: raio.pilula, backgroundColor: cores.chip, alignItems: "center", justifyContent: "center" },
  posicaoTexto: { fontSize: 14, fontWeight: "700", color: cores.tinta3 },
  corpo: { flex: 1, gap: 2 },
  nome: { fontSize: 15, fontWeight: "600", color: cores.tinta },
  anonimo: { fontStyle: "italic", color: cores.tinta3 },
  pontos: { fontSize: 18, fontWeight: "700", color: cores.tinta },
  media: { alignItems: "flex-end" },
});
