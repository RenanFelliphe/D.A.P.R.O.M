"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { BotaoTestar } from "./BotaoTestar";
import type { Rascunho } from "./useRascunho";

interface BarraDoRascunhoProps {
  codigo: string;
  descricao: string;
  rascunho: Rascunho;
  /** O próximo passo do caminho ("Fases do jogo", "Revisão"): salva antes de seguir. */
  proximo?: { rotulo: string; href: string };
}

/**
 * A barra fixa no pé das telas que editam o rascunho: se está tudo salvo, o erro do último salvamento, "Testar o jogo",
 * "Salvar" e o próximo passo. No celular ela fica logo acima da barra de navegação.
 */
export function BarraDoRascunho({ codigo, descricao, rascunho, proximo }: BarraDoRascunhoProps) {
  const roteador = useRouter();
  const { sujo, salvando, erro } = rascunho;

  async function seguir() {
    if (proximo && (await rascunho.garantirSalvo())) roteador.push(proximo.href);
  }

  return (
    <div className={cx("ts-barra", sujo && "ts-barra-suja", erro && "ts-barra-erro")} role="region" aria-label="Salvar o rascunho">
      <div className="ts-barra-estado" aria-live="polite">
        <span className="ts-barra-luz" aria-hidden="true" />
        <span className="stack">
          <strong>{salvando ? "Salvando…" : sujo ? "Alterações não salvas" : "Tudo salvo"}</strong>
          {erro ? <span className="ts-barra-msg">{erro}</span> : <span className="ts-barra-msg">{sujo ? "Salve antes de sair desta tela." : "O rascunho não aparece para os técnicos até ser publicado."}</span>}
        </span>
      </div>
      <div className="ts-barra-acoes">
        {sujo && (
          <Button variant="ghost" sm onClick={rascunho.descartar} disabled={salvando}>
            Descartar
          </Button>
        )}
        <BotaoTestar codigo={codigo} descricao={descricao} conteudo={rascunho.conteudo} salvarAntes={rascunho.garantirSalvo} desabilitado={salvando} sm />
        {sujo ? (
          <Button variant="p" sm onClick={() => rascunho.salvar()} disabled={salvando}>
            <Icon name="save" size={13} />
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        ) : (
          proximo && (
            <Button variant="p" sm onClick={seguir} disabled={salvando}>
              {proximo.rotulo}
              <Icon name="right" size={13} />
            </Button>
          )
        )}
      </div>
    </div>
  );
}
