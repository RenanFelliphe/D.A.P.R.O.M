import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ErroDaApi, mensagemDoErro } from "@/api/erros";
import { TelaDaConferencia } from "@/conferencia/TelaDaConferencia";
import { useConferencia } from "@/conferencia/consultas";
import { conferenciaPadrao } from "@/conferencia/regras";
import { useConexao } from "@/estado/conexao";
import { useDetalheDaOs } from "@/os/consultas";
import { Botao } from "@/ui/Botao";
import { Carregando, Vazio } from "@/ui/Estados";
import { Tela } from "@/ui/Tela";

/**
 * A conferência da execução que a equipe registrou sem sinal, em aparelhos diferentes (`funcionalidades/execucao-compartilhada.md`, etapa
 * 3). O id da rota é o da OS; `c` diz qual conferência (a OS pode ter uma por execução) e, sem ele, abre a mais recente que ainda anda. É uma
 * tela só com sinal: a comparação e as escolhas vivem na `api`, e não há o que mostrar da cópia do aparelho.
 */
export default function Conferencia() {
  const { id, c } = useLocalSearchParams<{ id: string; c?: string }>();
  const router = useRouter();
  const online = useConexao() === "online";
  const detalhe = useDetalheDaOs(id);
  const conferenciaId = c ?? conferenciaPadrao(detalhe.data?.conferencias)?.id ?? null;
  const conferencia = useConferencia(conferenciaId);
  const voltar = <Botao titulo="Voltar" variante="texto" aoPressionar={() => (router.canGoBack() ? router.back() : router.replace("/"))} />;

  if (!online) {
    return (
      <Tela bordas={["bottom"]} centralizada>
        <Stack.Screen options={{ title: "Conferência da execução" }} />
        <Vazio
          icone="cloud-offline-outline"
          titulo="Conecte-se para conferir"
          texto="A conferência compara o que cada aparelho da equipe registrou e precisa do servidor. O que você registrou sem sinal continua guardado e sobe sozinho quando a conexão voltar."
        />
        {voltar}
      </Tela>
    );
  }

  // Sem `c`, a conferência vem da OS; com `c`, a tela não espera por ela.
  if (conferenciaId === null && detalhe.isPending) return <Carregando texto="Abrindo a conferência…" />;
  if (conferenciaId === null) {
    return (
      <Tela bordas={["bottom"]} centralizada>
        <Stack.Screen options={{ title: "Conferência da execução" }} />
        <Vazio
          icone={detalhe.isError ? "cloud-offline-outline" : "git-compare-outline"}
          titulo={detalhe.isError ? "Não foi possível abrir a OS" : "Esta OS não tem conferência"}
          texto={detalhe.isError ? mensagemDoErro(detalhe.error) : "A conferência existe só quando a equipe registra a execução sem sinal, em aparelhos diferentes. Quando todos sincronizarem, ela aparece aqui."}
          acao={detalhe.isError ? { titulo: "Tentar de novo", aoPressionar: () => void detalhe.refetch() } : undefined}
        />
        {voltar}
      </Tela>
    );
  }

  if (conferencia.isPending) return <Carregando texto="Abrindo a conferência…" />;
  if (conferencia.isError || !conferencia.data) {
    const naoExiste = conferencia.error instanceof ErroDaApi && conferencia.error.status === 404;
    return (
      <Tela bordas={["bottom"]} centralizada>
        <Stack.Screen options={{ title: "Conferência da execução" }} />
        <Vazio
          icone={naoExiste ? "search-outline" : "cloud-offline-outline"}
          titulo={naoExiste ? "Conferência não encontrada" : "Não foi possível abrir a conferência"}
          texto={naoExiste ? "Ela não existe ou é de uma execução de que você não participa." : mensagemDoErro(conferencia.error)}
          acao={naoExiste ? undefined : { titulo: "Tentar de novo", aoPressionar: () => void conferencia.refetch() }}
        />
        {voltar}
      </Tela>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Conferência da execução" }} />
      <TelaDaConferencia c={conferencia.data} aoAtualizar={() => void conferencia.refetch()} atualizando={conferencia.isRefetching} />
    </>
  );
}
