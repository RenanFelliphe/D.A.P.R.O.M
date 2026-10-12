"use client";

import { useId, useSyncExternalStore, type ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { OsStatus } from "@/lib/tipos";

/** Onde o navegador guarda quais colunas a pessoa fechou (status separados por vírgula). */
const CHAVE = "daprom:quadro:colunas-fechadas";

/**
 * As colunas fechadas valem para o navegador, não só para a tela: o filtro recarrega o quadro e as colunas não podem reabrir.
 * Lê-se do `localStorage` uma vez; sem ele (bloqueado, janela privada) a escolha dura até a página ser fechada.
 */
let fechadas: string | null = null;
const ouvintes = new Set<() => void>();

function lerFechadas(): string {
  if (fechadas === null) {
    try {
      fechadas = window.localStorage.getItem(CHAVE) ?? "";
    } catch {
      fechadas = "";
    }
  }
  return fechadas;
}

function assinar(aviso: () => void) {
  ouvintes.add(aviso);
  // Outra aba do mesmo navegador mexeu na escolha: relê.
  const outraAba = (e: StorageEvent) => {
    if (e.key !== CHAVE) return;
    fechadas = null;
    aviso();
  };
  window.addEventListener("storage", outraAba);
  return () => {
    ouvintes.delete(aviso);
    window.removeEventListener("storage", outraAba);
  };
}

function alternar(status: OsStatus) {
  const atuais = new Set(lerFechadas().split(",").filter(Boolean));
  if (!atuais.delete(status)) atuais.add(status);
  fechadas = [...atuais].join(",");
  try {
    window.localStorage.setItem(CHAVE, fechadas);
  } catch {
    /* sem armazenamento: a escolha fica só na memória desta página */
  }
  ouvintes.forEach((aviso) => aviso());
}

interface ColunaRecolhivelProps {
  status: OsStatus;
  titulo: string;
  icone: IconName;
  /** Ícone preenchido (play). */
  cheio?: boolean;
  /** Cor do ícone da situação. */
  cor: string;
  tom: BadgeTone;
  /** Total real de OS da coluna (não só as exibidas). */
  total: number;
  children: ReactNode;
}

/**
 * Coluna do quadro que fecha: o cabeçalho (situação e total) é um botão que esconde ou mostra os cartões. No desktop, a
 * coluna fechada vira uma faixa estreita e as outras ocupam o espaço; em telas menores ela fica só com o cabeçalho. A
 * primeira renderização sempre vem aberta (o servidor não sabe o que a pessoa escolheu); a escolha guardada é aplicada
 * logo ao carregar.
 */
export function ColunaRecolhivel({ status, titulo, icone, cheio, cor, tom, total, children }: ColunaRecolhivelProps) {
  const fechada = useSyncExternalStore(assinar, lerFechadas, () => "").split(",").includes(status);
  const id = useId();
  return (
    <div className="bcol" data-fechada={fechada}>
      <h2 className="bcol-h">
        <button
          type="button"
          className="bcol-toggle"
          aria-expanded={!fechada}
          aria-controls={id}
          title={fechada ? `Abrir ${titulo}` : `Fechar ${titulo}`}
          onClick={() => alternar(status)}
        >
          <Icon name={icone} size={16} fill={cheio} style={{ color: cor }} />
          <span className="bcol-titulo">{titulo}</span>
          <Badge tone={tom}>{total}</Badge>
          <Icon name="down" size={16} className="bcol-seta" />
        </button>
      </h2>
      <div id={id} className="bcol-corpo" hidden={fechada}>
        {children}
      </div>
    </div>
  );
}
