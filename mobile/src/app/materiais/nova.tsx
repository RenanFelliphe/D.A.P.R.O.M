import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { TIPOS_DE_SUGESTAO, type TipoDeSugestao } from "@shared/api/sugestao-materiais";
import { ErroDaApi, mensagemDoErro } from "@/api/erros";
import { AssistenteDeEnvio } from "@/materiais/AssistenteDeEnvio";
import { useServicoDoCatalogo } from "@/materiais/consultas";
import { Botao } from "@/ui/Botao";
import { Carregando, Vazio } from "@/ui/Estados";
import { Tela } from "@/ui/Tela";

/**
 * Sugerir ou contestar a lista de materiais de um serviço (`?atividade=<codigo>&tipo=sugestao|contestacao`). Carrega a lista de agora do
 * serviço, que é a base da sugestão, e entrega ao assistente de etapas.
 */
export default function NovaSugestaoDeMateriais() {
  const router = useRouter();
  const { atividade, tipo: tipoDoLink } = useLocalSearchParams<{ atividade?: string; tipo?: string }>();
  const codigo = atividade ?? "";
  const tipo: TipoDeSugestao = TIPOS_DE_SUGESTAO.find((t) => t === tipoDoLink) ?? "sugestao";
  const servico = useServicoDoCatalogo(codigo);
  const titulo = tipo === "sugestao" ? "Sugerir lista" : "Contestar lista";

  if (!codigo) {
    return (
      <Tela bordas={["bottom"]} centralizada>
        <Stack.Screen options={{ title: titulo }} />
        <Vazio icone="search-outline" titulo="Serviço não informado" texto="Abra esta tela pelo detalhe de uma OS que tenha serviço." />
        <Botao titulo="Voltar" variante="texto" aoPressionar={() => router.back()} />
      </Tela>
    );
  }
  if (servico.isPending) return <Carregando texto="Abrindo o serviço…" />;
  if (servico.isError) {
    const naoExiste = servico.error instanceof ErroDaApi && servico.error.status === 404;
    return (
      <Tela bordas={["bottom"]} centralizada>
        <Stack.Screen options={{ title: titulo }} />
        <Vazio
          icone={naoExiste ? "search-outline" : "cloud-offline-outline"}
          titulo={naoExiste ? "Serviço não encontrado" : "Não foi possível abrir o serviço"}
          texto={naoExiste ? "Ele não está no catálogo." : mensagemDoErro(servico.error)}
          acao={naoExiste ? undefined : { titulo: "Tentar de novo", aoPressionar: () => void servico.refetch() }}
        />
        <Botao titulo="Voltar" variante="texto" aoPressionar={() => router.back()} />
      </Tela>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: titulo }} />
      <AssistenteDeEnvio servico={servico.data} tipo={tipo} />
    </>
  );
}
