import { StyleSheet, Text, View } from "react-native";
import type { EscolhaDoModelo, ModeloParaEscolher } from "@shared/api/apr";
import { cores, espaco, raio } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { JanelaDeFormulario } from "@/ui/JanelaDeFormulario";
import { Selo } from "@/ui/Selo";

interface JanelaDeModelosProps {
  /** `undefined` enquanto carrega. */
  escolha: EscolhaDoModelo | undefined;
  carregandoEscolha?: boolean;
  erro?: string | null;
  /** Código do modelo em uso (na troca), que não se seleciona de novo. */
  atual?: string | null;
  /** Código que está sendo carregado depois de selecionado. */
  carregando?: string | null;
  aoSelecionar: (codigo: string) => void;
  aoFechar: () => void;
}

/** O aviso do topo: a recomendação é só uma orientação, e quem confere e escolhe é o técnico. */
function AvisoDaRecomendacao({ escolha }: { escolha: EscolhaDoModelo }) {
  if (escolha.recomendado) return <Aviso tom="al" titulo="Sempre confira se a opção recomendada é a certa." />;
  const combinam = escolha.modelos.filter((m) => m.encontradas.length > 0).length;
  return (
    <Aviso tom="info">
      {combinam > 1
        ? "Mais de um modelo combina com esta OS. Leia a descrição de cada um e escolha o que atende ao serviço que você vai executar."
        : "Nenhum modelo se destacou na leitura desta OS. Escolha pela descrição o que atende ao serviço que você vai executar."}
    </Aviso>
  );
}

function OpcaoDeModelo({ modelo, recomendado, motivo, atual, carregando, bloqueado, aoSelecionar }: { modelo: ModeloParaEscolher; recomendado: boolean; motivo: string | null; atual: boolean; carregando: boolean; bloqueado: boolean; aoSelecionar: () => void }) {
  return (
    <View style={[estilos.opcao, recomendado && estilos.recomendada]}>
      {atual ? <Selo>Em uso nesta APR</Selo> : null}
      <Text style={estilos.titulo}>{`${modelo.codigo} — ${modelo.titulo}`}</Text>
      {modelo.descricao ? <Text style={estilos.descricao}>{modelo.descricao}</Text> : <Text style={estilos.suave}>O admin ainda não descreveu os serviços deste modelo.</Text>}
      {recomendado && motivo ? <Text style={estilos.achado}>{`Vitória: ${motivo}`}</Text> : null}
      {modelo.encontradas.length > 0 ? <Text style={estilos.achado}>{`Encontrado nesta OS: ${modelo.encontradas.join(", ")}`}</Text> : null}
      <Botao
        titulo={atual ? "Em uso" : `Selecionar ${modelo.codigo}`}
        variante={recomendado ? "primario" : "secundario"}
        enviando={carregando}
        aoPressionar={atual || bloqueado ? () => undefined : aoSelecionar}
      />
    </View>
  );
}

/**
 * A janela de escolha do modelo da APR: todos os modelos publicados, com título, descrição e o botão de selecionar. O recomendado
 * pela leitura da OS vem sozinho no topo, em destaque (com o aviso para conferir), e os demais embaixo, na ordem do código. Nunca
 * escolhe sozinha.
 */
export function JanelaDeModelos({ escolha, carregandoEscolha, erro, atual, carregando, aoSelecionar, aoFechar }: JanelaDeModelosProps) {
  const recomendado = escolha?.modelos.find((m) => m.codigo === escolha.recomendado);
  const outros = escolha?.modelos.filter((m) => m !== recomendado) ?? [];
  const opcao = (m: ModeloParaEscolher) => (
    <OpcaoDeModelo key={m.codigo} modelo={m} recomendado={m === recomendado} motivo={m === recomendado ? (escolha?.motivo ?? null) : null} atual={m.codigo === atual} carregando={m.codigo === carregando} bloqueado={Boolean(carregando)} aoSelecionar={() => aoSelecionar(m.codigo)} />
  );

  return (
    <JanelaDeFormulario titulo="Escolha o modelo da APR" aoFechar={aoFechar}>
      {erro ? <Aviso tom="blq">{erro}</Aviso> : null}
      {!escolha ? (
        carregandoEscolha ? <Text style={estilos.suave}>Carregando os modelos…</Text> : null
      ) : escolha.modelos.length === 0 ? (
        <Aviso tom="blq">Não há modelo de APR publicado. Avise o admin.</Aviso>
      ) : (
        <>
          <AvisoDaRecomendacao escolha={escolha} />
          {recomendado ? (
            <View style={estilos.grupo}>
              <Text style={estilos.grupoTitulo}>Opção recomendada</Text>
              {opcao(recomendado)}
            </View>
          ) : null}
          {outros.length > 0 ? (
            <View style={estilos.grupo}>
              <Text style={estilos.grupoTitulo}>{recomendado ? "Outros modelos de APR" : "Modelos de APR"}</Text>
              {outros.map(opcao)}
            </View>
          ) : null}
        </>
      )}
    </JanelaDeFormulario>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: espaco.s },
  grupoTitulo: { fontSize: 13, fontWeight: "700", color: cores.tinta3, textTransform: "uppercase" },
  opcao: { gap: espaco.s, padding: espaco.m, borderRadius: raio.m, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.superficie },
  recomendada: { borderColor: cores.marca, backgroundColor: cores.marcaFundo },
  titulo: { fontSize: 16, fontWeight: "700", color: cores.tinta },
  descricao: { fontSize: 14, lineHeight: 20, color: cores.tinta2 },
  suave: { fontSize: 14, lineHeight: 20, color: cores.tinta4 },
  achado: { fontSize: 13, fontWeight: "600", color: cores.marcaTinta },
});
