"use client";

import { JogoTreinamentoServico } from "@/components/web/treinamento-servico/JogoTreinamentoServico";
import { chamar } from "@/lib/cliente-api";
import type { TentativaAberta, TreinamentoParaJogador } from "@/lib/treinamento-servico";

/** A tela `/app/catalogo/servicos/{codigo}/treinar`: liga o motor do jogo à rota de verdade, que pontua. */
export function TreinarServico({ treinamento, jaConcluiu }: { treinamento: TreinamentoParaJogador; jaConcluiu: boolean }) {
  return (
    <JogoTreinamentoServico
      atividadeCodigo={treinamento.atividade_codigo}
      descricao={treinamento.descricao}
      explicacao={treinamento.explicacao}
      cenarioPath={treinamento.cenario_path}
      assinadoPor={treinamento.publicada_por_nome}
      assinadoEm={treinamento.publicada_em}
      jaConcluiu={jaConcluiu}
      pontua
      abrirTentativa={() => chamar<TentativaAberta>("POST", `/treinamentos/${encodeURIComponent(treinamento.atividade_codigo)}/tentativas`)}
    />
  );
}
