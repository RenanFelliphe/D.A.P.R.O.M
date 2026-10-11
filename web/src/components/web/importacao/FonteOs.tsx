"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/web/Panel";
import { chamar } from "@/lib/cliente-api";
import { dataHora } from "@/lib/formatar";

/** Esperas (ms) até atualizar o histórico depois de "Ler agora": a leitura roda em segundo plano. */
const ATUALIZAR_DEPOIS_DE = [3000, 8000];

interface FonteOsProps {
  /** Início da última leitura pela API que terminou sem erro. */
  ultimaLeituraEm: string | null;
  /** A leitura mais recente pela API falhou. */
  comErro: boolean;
}

/** Painel com a fonte das OS (API do SAP) e o botão "Ler agora" (`POST /sap/leituras`). */
export function FonteOs({ ultimaLeituraEm, comErro }: FonteOsProps) {
  const roteador = useRouter();
  const temporizadores = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [lendo, setLendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => () => temporizadores.current.forEach(clearTimeout), []);

  async function lerAgora() {
    setLendo(true);
    setErro(null);
    setAviso(null);
    try {
      await chamar("POST", "/sap/leituras");
      setAviso("Leitura iniciada. O histórico é atualizado em instantes.");
      temporizadores.current.forEach(clearTimeout);
      temporizadores.current = ATUALIZAR_DEPOIS_DE.map((ms, i) =>
        setTimeout(() => {
          roteador.refresh();
          if (i === ATUALIZAR_DEPOIS_DE.length - 1) {
            setLendo(false);
            setAviso("Leitura concluída. Confira o histórico abaixo.");
          }
        }, ms),
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível iniciar a leitura.");
      setLendo(false);
    }
  }

  return (
    <Panel>
      <div className="row between wrap">
        <h2>Fonte das OS</h2>
        {comErro ? (
          <Badge tone="blq">
            <Icon name="alert" size={13} />
            Com falha
          </Badge>
        ) : (
          <Badge tone="enc">
            <Icon name="check" size={13} />
            Conectada
          </Badge>
        )}
      </div>
      <div className="row g12" style={{ padding: 12, borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--line2)" }}>
        <Icon name="refresh" size={22} style={{ color: "var(--brand)", flex: "none" }} />
        <span className="stack" style={{ lineHeight: 1.35, flex: 1 }}>
          <strong style={{ fontSize: 14 }}>API do SAP</strong>
          <span className="small">{ultimaLeituraEm ? `Última leitura sem erro: ${dataHora(ultimaLeituraEm)}` : "Nenhuma leitura concluída ainda"}</span>
        </span>
        <Button variant="line" sm onClick={lerAgora} disabled={lendo}>
          {lendo ? "Lendo…" : "Ler agora"}
        </Button>
      </div>
      {aviso && (
        <span className="small" role="status">
          {aviso}
        </span>
      )}
      {erro && (
        <span className="small" role="alert" style={{ color: "var(--blq)" }}>
          {erro}
        </span>
      )}
      <p className="muted">A planilha abaixo continua como alternativa, para trabalhar sem a API.</p>
    </Panel>
  );
}
