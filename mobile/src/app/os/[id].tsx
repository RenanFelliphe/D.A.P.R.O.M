import { useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { rotuloDaOs } from "@shared/api/os-app";
import { ErroDaApi, mensagemDoErro } from "@/api/erros";
import { FaixaDeAusencia } from "@/os/FaixaDeAusencia";
import { FaixaDeAssinaturas } from "@/os/FaixasDaLista";
import { useDetalheDaOs } from "@/os/consultas";
import { AcoesDaOs } from "@/os/detalhe/AcoesDaOs";
import { ChecklistDaOsCard, DadosSapCard, InstrucoesCard, LocalCard, MateriaisCard } from "@/os/detalhe/Blocos";
import { AprExigidaCard, CabecalhoDaOs, FaixasDaOs } from "@/os/detalhe/Cabecalho";
import { CicloDaOs } from "@/os/detalhe/CicloDaOs";
import { HistoricoAprs, HistoricoDoLocal } from "@/os/detalhe/Historicos";
import { useSessao } from "@/sessao/SessaoProvider";
import { Botao } from "@/ui/Botao";
import { Carregando, Vazio } from "@/ui/Estados";
import { Tela } from "@/ui/Tela";

/**
 * O detalhe da OS: tudo o que o técnico precisa saber antes de começar, e o ponto de partida da APR e da execução. O painel de
 * ação vem logo abaixo do cabeçalho (uma ação por tela); os dados, o ciclo da preventiva, as instruções, os materiais e os
 * históricos vêm depois. Reservar, devolver, assinar por último e ver o relatório da execução ficam na web (`mobile/README.md`, decisão D2).
 */
export default function DetalheDaOs() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const consultas = useQueryClient();
  const { eu } = useSessao();
  const detalhe = useDetalheDaOs(id);

  if (detalhe.isPending) return <Carregando texto="Abrindo a OS…" />;
  if (detalhe.isError) {
    const naoExiste = detalhe.error instanceof ErroDaApi && detalhe.error.status === 404;
    return (
      <Tela bordas={["bottom"]} centralizada>
        <Vazio
          icone={naoExiste ? "search-outline" : "cloud-offline-outline"}
          titulo={naoExiste ? "OS não encontrada" : "Não foi possível abrir a OS"}
          texto={naoExiste ? "Ela não existe ou é de outra equipe." : mensagemDoErro(detalhe.error)}
          acao={naoExiste ? undefined : { titulo: "Tentar de novo", aoPressionar: () => void detalhe.refetch() }}
        />
        <Botao titulo="Voltar" variante="texto" aoPressionar={() => router.back()} />
      </Tela>
    );
  }

  const { os, servico, aprs, execucoes, checklist_inspecao, conferencias } = detalhe.data;
  const usuarioId = eu?.usuario.id ?? "";
  const atualizar = () => {
    void detalhe.refetch();
    void consultas.invalidateQueries({ queryKey: ["me"] });
    void consultas.invalidateQueries({ queryKey: ["os", id] });
  };

  return (
    <Tela bordas={["bottom"]} aoAtualizar={atualizar} atualizando={detalhe.isRefetching}>
      <Stack.Screen options={{ title: rotuloDaOs(os) }} />
      <FaixaDeAusencia />
      <CabecalhoDaOs os={os} />
      <FaixasDaOs os={os} usuarioId={usuarioId} />
      <FaixaDeAssinaturas osId={os.id} />
      <AcoesDaOs os={os} usuarioId={usuarioId} aprs={aprs} execucoes={execucoes} conferencias={conferencias} ausencia={eu?.ausencia?.rotulo ?? null} />
      <AprExigidaCard aprs={aprs} status={os.status} />
      <LocalCard local={os.local_instalacao} />
      <DadosSapCard os={os} />
      <CicloDaOs osId={os.id} preventiva={os.tipo === "preventiva"} />
      <ChecklistDaOsCard perguntas={checklist_inspecao ?? []} />
      <InstrucoesCard descricao={os.descricao} titulo={os.titulo} />
      <MateriaisCard servico={servico ?? null} />
      <HistoricoAprs aprs={aprs} execucoes={execucoes} />
      <HistoricoDoLocal os={os} />
    </Tela>
  );
}
