"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { rotas } from "@/lib/rotas";
import type { ModoDoTreino } from "@/lib/treino-comum";

const opcoes: { modo: ModoDoTreino; icone: IconName; titulo: string; texto: string; tempo: string }[] = [
  {
    modo: "direcionado",
    icone: "pin",
    titulo: "Direcionado",
    texto: "Passo a passo guiado, com dicas na tela: da lista de OS até a APR, a execução e o bloqueio.",
    tempo: "Cerca de 10 minutos",
  },
  {
    modo: "livre",
    icone: "grid",
    titulo: "Livre",
    texto: "Explore sozinho, sem roteiro. O botão “Roteiro” fica à mão se você quiser o passo a passo depois.",
    tempo: "No seu ritmo",
  },
];

/** Os dois cartões grandes "Direcionado" e "Livre". Cada um liga o modo treino (`/app/treino/entrar`) com a modalidade escolhida. */
export function EscolhaDeModalidade({ rotuloDoGrupo = "Como você prefere aprender?" }: { rotuloDoGrupo?: string }) {
  const [escolhida, setEscolhida] = useState<ModoDoTreino | null>(null);

  return (
    <div className="tr-opcoes" role="group" aria-label={rotuloDoGrupo} aria-busy={escolhida !== null}>
      {opcoes.map((opcao) => (
        // Navegação completa (não `Link`): a rota liga o cookie do treino e redireciona.
        <a
          key={opcao.modo}
          className={cx("tr-opcao", escolhida === opcao.modo && "carregando")}
          href={rotas.app.treinoEntrar(opcao.modo)}
          data-foco-inicial={opcao.modo === "direcionado" ? "" : undefined}
          aria-disabled={escolhida !== null && escolhida !== opcao.modo}
          onClick={(evento) => {
            if (escolhida !== null) evento.preventDefault();
            else setEscolhida(opcao.modo);
          }}
        >
          <span className="tr-opcao-icone">
            <Icon name={opcao.icone} size={24} />
          </span>
          <span className="tr-opcao-titulo">{opcao.titulo}</span>
          <span className="tr-opcao-texto">{opcao.texto}</span>
          <span className="tr-opcao-meta">
            <Icon name={escolhida === opcao.modo ? "refresh" : "clock"} size={13} />
            {escolhida === opcao.modo ? "Abrindo o treino…" : opcao.tempo}
          </span>
        </a>
      ))}
    </div>
  );
}
