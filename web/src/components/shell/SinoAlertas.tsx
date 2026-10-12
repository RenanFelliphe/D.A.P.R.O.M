"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { aparenciaDoAlerta, referenciaDoAlerta, rotuloDoAlerta, type Alerta } from "@/components/web/alertas/tipos";
import { diaMes, hora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";

interface SinoAlertasProps {
  naoLidos: number;
  /** Alertas mais recentes (lidos ou não), do mais novo para o mais antigo. */
  recentes: Alerta[];
}

/** Sino da barra superior: abre um menu com os alertas mais recentes e o atalho "Ver todas as notificações". */
export function SinoAlertas({ naoLidos, recentes }: SinoAlertasProps) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!aberto) return;
    const aoClicarFora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  const fechar = () => setAberto(false);

  return (
    <div className="sino" ref={raiz}>
      <button
        type="button"
        className="bell"
        aria-label={naoLidos > 0 ? `Notificações, ${naoLidos} não lidas` : "Notificações"}
        aria-haspopup="true"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((a) => !a)}
      >
        <Icon name="bell" size={18} />
        {naoLidos > 0 && <b>{naoLidos}</b>}
      </button>
      {aberto && (
        <div id={id} className="sino-menu" role="region" aria-label="Notificações recentes">
          <div className="sino-cab">
            <strong>Notificações</strong>
            {naoLidos > 0 && <span className="cnt">{naoLidos} não lidas</span>}
          </div>
          {recentes.length === 0 ? (
            <p className="sino-vazio">Nenhuma notificação por enquanto.</p>
          ) : (
            <ul className="sino-lista">
              {recentes.map((a) => {
                const { icone, urgente } = aparenciaDoAlerta(a);
                const referencia = referenciaDoAlerta(a);
                return (
                  <li key={a.id}>
                    <Link href={`${rotas.web.alertas}?alerta=${a.id}`} className={a.lido_em === null ? "sino-item novo" : "sino-item"} onClick={fechar}>
                      <span className={urgente ? "ic red" : "ic blue"}>
                        <Icon name={icone} size={16} />
                      </span>
                      <span className="sino-txt">
                        <span className="tp">
                          <b style={{ color: urgente ? "var(--blq)" : "var(--brand)" }}>{rotuloDoAlerta(a)}</b>
                          <span>
                            {diaMes(a.criado_em)} {hora(a.criado_em)}
                          </span>
                        </span>
                        <span className="os">
                          {referencia.codigo && (
                            <>
                              <span className="mono">{referencia.codigo}</span> ·{" "}
                            </>
                          )}
                          {referencia.texto}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href={rotas.web.alertas} className="sino-todas" onClick={fechar}>
            Ver todas as notificações
          </Link>
        </div>
      )}
    </div>
  );
}
