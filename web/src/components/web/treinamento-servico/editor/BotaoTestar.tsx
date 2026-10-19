"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { chamar } from "@/lib/cliente-api";
import type { ConteudoDoRascunho, TentativaAberta } from "@/lib/treinamento-servico";
import { JanelaDoJogo } from "../jogo/JanelaDoJogo";

interface BotaoTestarProps {
  codigo: string;
  descricao: string;
  conteudo: Pick<ConteudoDoRascunho, "explicacao" | "fases" | "cenario_path">;
  /** Grava o que está na tela antes: o teste abre a tentativa pela `api`, que lê o rascunho gravado. */
  salvarAntes?: () => Promise<boolean>;
  desabilitado?: boolean;
  variant?: "p" | "line";
  sm?: boolean;
  block?: boolean;
  rotulo?: string;
}

/** "Testar o jogo": o rascunho na mesma janela do técnico, do começo ao resultado, sem pontuar e sem reportar. */
export function BotaoTestar({ codigo, descricao, conteudo, salvarAntes, desabilitado, variant = "line", sm, block, rotulo = "Testar o jogo" }: BotaoTestarProps) {
  const [aberto, setAberto] = useState(false);
  const [preparando, setPreparando] = useState(false);
  const semFases = conteudo.fases.length === 0;

  async function abrir() {
    setPreparando(true);
    try {
      if (!salvarAntes || (await salvarAntes())) setAberto(true);
    } finally {
      setPreparando(false);
    }
  }

  return (
    <>
      <Button
        variant={variant}
        sm={sm}
        block={block}
        onClick={abrir}
        disabled={semFases || desabilitado || preparando}
        title={semFases ? "Adicione ao menos uma fase para testar" : "Jogue o rascunho como o técnico vai jogar, sem pontuar"}
      >
        <Icon name="play" size={sm ? 13 : 16} fill />
        {preparando ? "Abrindo…" : rotulo}
      </Button>
      {aberto && (
        <JanelaDoJogo
          atividadeCodigo={codigo}
          descricao={descricao}
          explicacao={conteudo.explicacao}
          totalFases={conteudo.fases.length}
          cenarioPath={conteudo.cenario_path}
          pontua={false}
          abrirTentativa={() => chamar<TentativaAberta>("POST", `/treinamentos/${encodeURIComponent(codigo)}/rascunho/pre-visualizar/tentativas`)}
          aoFechar={() => setAberto(false)}
        />
      )}
    </>
  );
}
