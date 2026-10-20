import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { rotuloDoTipoDeSugestao } from "@shared/api/sugestao-materiais";
import { ErroDaApi, mensagemDoErro } from "@/api/erros";
import { useSugestao } from "@/materiais/consultas";
import { DetalheDaSugestao } from "@/materiais/DetalheDaSugestao";
import { Botao } from "@/ui/Botao";
import { Carregando, Vazio } from "@/ui/Estados";
import { Tela } from "@/ui/Tela";

/** A sugestão ou contestação da lista de materiais de um serviço: o detalhe e, para quem avalia, as ações. */
export default function SugestaoDeMateriais() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const sugestao = useSugestao(id);

  if (sugestao.isPending) return <Carregando texto="Abrindo a sugestão…" />;
  if (sugestao.isError) {
    const naoExiste = sugestao.error instanceof ErroDaApi && sugestao.error.status === 404;
    return (
      <Tela bordas={["bottom"]} centralizada>
        <Vazio
          icone={naoExiste ? "search-outline" : "cloud-offline-outline"}
          titulo={naoExiste ? "Sugestão não encontrada" : "Não foi possível abrir a sugestão"}
          texto={naoExiste ? "Ela não existe mais." : mensagemDoErro(sugestao.error)}
          acao={naoExiste ? undefined : { titulo: "Tentar de novo", aoPressionar: () => void sugestao.refetch() }}
        />
        <Botao titulo="Voltar" variante="texto" aoPressionar={() => (router.canGoBack() ? router.back() : router.replace("/materiais"))} />
      </Tela>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: rotuloDoTipoDeSugestao[sugestao.data.tipo] }} />
      <DetalheDaSugestao sugestao={sugestao.data} aoAtualizar={() => void sugestao.refetch()} atualizando={sugestao.isRefetching} />
    </>
  );
}
