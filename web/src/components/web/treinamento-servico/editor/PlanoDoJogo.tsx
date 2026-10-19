"use client";

import { useId, type CSSProperties } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { LIMITES, TIPOS_DE_FASE, infoDoTipo, umDeCada, type PedidoDoPlano } from "@/lib/treinamento-servico";

/** O minijogo de cada fase, na ordem; `null` deixa a Vitória escolher aquela. */
export type Plano = (PedidoDoPlano | null)[];

export const FASES_DO_PLANO_PADRAO = 5;
export const planoPadrao = (): Plano => Array<PedidoDoPlano | null>(FASES_DO_PLANO_PADRAO).fill(null);

const VITORIA_ESCOLHE = "";
const FRASE_COM_MATERIAIS = "Marque o que o serviço usa, entre itens de outros serviços.";

interface PlanoDoJogoProps {
  plano: Plano;
  aoMudar: (plano: Plano) => void;
  /** O Selecione com os materiais do serviço precisa de material do serviço no catálogo. */
  temMateriais: boolean;
  desativado?: boolean;
}

/**
 * As fases do jogo que a Vitória vai montar: quantas (ao menos 3, sem máximo) e o minijogo de cada uma, na ordem. Cada fase
 * pode ficar com "A Vitória escolhe"; "Todas como" preenche o plano inteiro de uma vez (ex.: 7 fases, todas quiz), e "1 de
 * cada" monta uma fase de cada minijogo, em ordem aleatória.
 */
export function PlanoDoJogo({ plano, aoMudar, temMateriais, desativado }: PlanoDoJogoProps) {
  const id = useId();
  const total = plano.length;

  function mudarTotal(novo: number) {
    const n = Math.min(LIMITES.fases, Math.max(LIMITES.fasesParaPublicar, novo));
    aoMudar(n > total ? [...plano, ...Array<PedidoDoPlano | null>(n - total).fill(null)] : plano.slice(0, n));
  }

  const opcoes = (
    <>
      <option value={VITORIA_ESCOLHE}>A Vitória escolhe</option>
      {TIPOS_DE_FASE.map((t) => [
        <option key={t.tipo} value={t.tipo}>
          {t.rotulo}
        </option>,
        t.tipo === "selecione" && temMateriais && (
          <option key="selecione_materiais" value="selecione_materiais">
            Selecione com os materiais do serviço
          </option>
        ),
      ])}
    </>
  );
  const valorDe = (v: string): PedidoDoPlano | null => (v === VITORIA_ESCOLHE ? null : (v as PedidoDoPlano));
  const iguais = plano.every((t) => t === plano[0]);
  const ehUmDeCada = total === TIPOS_DE_FASE.length && TIPOS_DE_FASE.every((t) => plano.includes(t.tipo));

  return (
    <div className="ts-plano">
      <div className="ts-plano-topo">
        <div className="field ts-plano-total">
          <span className="ts-rotulo-campo" id={`${id}-total`}>
            Quantas fases
          </span>
          <div className="ts-contador-passo" role="group" aria-labelledby={`${id}-total`}>
            <Button variant="line" sm onClick={() => mudarTotal(total - 1)} disabled={desativado || total <= LIMITES.fasesParaPublicar} aria-label="Uma fase a menos">
              −
            </Button>
            <output aria-live="polite">{total}</output>
            <Button variant="line" sm onClick={() => mudarTotal(total + 1)} disabled={desativado || total >= LIMITES.fases} aria-label="Uma fase a mais">
              +
            </Button>
          </div>
        </div>
        <div className="field ts-plano-todas">
          <label htmlFor={`${id}-todas`} className="ts-rotulo-campo">
            Todas como
          </label>
          <select
            id={`${id}-todas`}
            className="input"
            value={iguais ? (plano[0] ?? VITORIA_ESCOLHE) : "misto"}
            disabled={desativado}
            onChange={(e) => e.target.value !== "misto" && aoMudar(plano.map(() => valorDe(e.target.value)))}
          >
            {!iguais && <option value="misto">Minijogos variados</option>}
            {opcoes}
          </select>
        </div>
        <Button variant={ehUmDeCada ? "p" : "line"} sm className="ts-plano-um-de-cada" onClick={() => aoMudar(umDeCada())} disabled={desativado} aria-pressed={ehUmDeCada}>
          <Icon name="embaralhar" size={13} />1 de cada
        </Button>
      </div>
      <span className="small">“1 de cada” monta {TIPOS_DE_FASE.length} fases, uma de cada minijogo, em ordem aleatória (tocar de novo sorteia outra ordem).</span>

      <ol className="ts-plano-fases">
        {plano.map((pedido, i) => {
          const tipo = pedido === "selecione_materiais" ? "selecione" : pedido;
          const info = tipo ? infoDoTipo(tipo) : null;
          return (
            <li key={i} style={{ "--i": i } as CSSProperties}>
              <span className="ts-item-num">{i + 1}</span>
              <span className="ts-tipo-icone" data-jogo={tipo ?? undefined} aria-hidden="true">
                <Icon name={info?.icone ?? "sparkle"} size={16} />
              </span>
              <span className="ts-plano-fase">
                <select
                  className="input"
                  aria-label={`Minijogo da fase ${i + 1}`}
                  aria-describedby={`${id}-frase-${i}`}
                  value={pedido ?? VITORIA_ESCOLHE}
                  disabled={desativado}
                  onChange={(e) => aoMudar(plano.map((t, k) => (k === i ? valorDe(e.target.value) : t)))}
                >
                  {opcoes}
                </select>
                <span id={`${id}-frase-${i}`} className="ts-tipo-frase" data-jogo={tipo ?? undefined}>
                  {pedido === "selecione_materiais" ? FRASE_COM_MATERIAIS : (info?.frase ?? "Ela escolhe o minijogo que combina com o texto.")}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      {!temMateriais && <span className="small">O Selecione com os materiais do serviço fica de fora: o serviço não tem materiais no catálogo.</span>}
    </div>
  );
}
