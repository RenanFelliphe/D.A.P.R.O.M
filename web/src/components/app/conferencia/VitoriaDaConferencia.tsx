"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { VitoriaNaCena } from "@/components/web/treinamento-servico/vitoria/VitoriaNaCena";
import { EXPLICACAO_DA_CONFERENCIA, EXPLICACAO_DA_TOLERANCIA } from "@/lib/conferencia";

/** Onde o navegador guarda que a pessoa já leu a explicação da Vitória. */
const CHAVE = "synqos:vitoria:conferencia-explicada";

/**
 * Vale para o navegador, não só para a tela: a explicação aparece na primeira vez que a pessoa chega na conferência. Sem `localStorage`
 * (bloqueado, janela privada) ela some até a página ser fechada, e nunca quebra a tela.
 */
let dispensada = false;
const ouvintes = new Set<() => void>();

function jaExplicou(): boolean {
  if (dispensada) return true;
  try {
    return window.localStorage.getItem(CHAVE) === "1";
  } catch {
    return false;
  }
}

function assinar(aviso: () => void) {
  ouvintes.add(aviso);
  return () => {
    ouvintes.delete(aviso);
  };
}

function dispensar() {
  dispensada = true;
  try {
    window.localStorage.setItem(CHAVE, "1");
  } catch {
    /* sem armazenamento: a Vitória só deixa de aparecer nesta página */
  }
  ouvintes.forEach((aviso) => aviso());
}

/** A Vitória explica a conferência em duas frases, uma vez. No servidor e na hidratação ela não aparece (evita divergir do HTML). */
export function VitoriaDaConferencia() {
  const explicou = useSyncExternalStore(assinar, jaExplicou, () => true);
  if (explicou) return null;
  return (
    <div className="cf-vitoria" data-treino="conferencia-vitoria">
      <VitoriaNaCena chave="conferencia" tamanho={72} falando>
        <span className="ts-balao-titulo">Vitória explica</span>
        <p>{EXPLICACAO_DA_CONFERENCIA}</p>
        <p>{EXPLICACAO_DA_TOLERANCIA}</p>
        <div className="row g8" style={{ marginTop: 10 }}>
          <Button variant="p" sm onClick={dispensar}>
            Entendi
          </Button>
        </div>
      </VitoriaNaCena>
    </div>
  );
}
