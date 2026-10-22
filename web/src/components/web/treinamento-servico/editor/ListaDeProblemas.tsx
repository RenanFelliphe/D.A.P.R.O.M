"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { chamar, ErroCliente } from "@/lib/cliente-api";
import { dataHora } from "@/lib/formatar";
import type { ReporteDeTreinamento } from "@/lib/treinamento-servico";
import { useToast } from "@/state/toast";

type Filtro = "abertos" | "tratados" | "todos";

/**
 * Os problemas que os técnicos reportaram nas fases (seção 8.6 do `docs/gamificacao-e-treinamentos.md`): o texto, a fase, a versão, quem e quando.
 * "Marcar como tratado" (`PATCH /treinamentos/reportes/{id}`) tira o problema da lista dos em aberto.
 */
export function ListaDeProblemas({ reportes: iniciais }: { reportes: ReporteDeTreinamento[] }) {
  const roteador = useRouter();
  const exibirAviso = useToast();
  const [reportes, setReportes] = useState(iniciais);
  const [filtro, setFiltro] = useState<Filtro>("abertos");
  const [tratando, setTratando] = useState<string | null>(null);
  const abertos = reportes.filter((r) => !r.tratado_em).length;
  const visiveis = reportes.filter((r) => filtro === "todos" || (filtro === "abertos" ? !r.tratado_em : r.tratado_em));

  async function tratar(id: string) {
    setTratando(id);
    try {
      const tratado = await chamar<{ tratado_em: string }>("PATCH", `/treinamentos/reportes/${id}`);
      setReportes((atual) => atual.map((r) => (r.id === id ? { ...r, tratado_em: tratado.tratado_em ?? new Date().toISOString() } : r)));
      exibirAviso("Problema marcado como tratado.");
      roteador.refresh();
    } catch (e) {
      exibirAviso(e instanceof ErroCliente ? e.message : "Não foi possível marcar agora.");
    } finally {
      setTratando(null);
    }
  }

  return (
    <section className="ts-secao-lista" aria-labelledby="titulo-problemas">
      <div className="ts-secao-cab">
        <div>
          <h2 id="titulo-problemas">Problemas reportados</h2>
          <p className="muted">O que os técnicos acharam errado nas fases. Corrija no editor e publique uma versão nova; depois marque como tratado.</p>
        </div>
      </div>
      <div className="ts-filtro" role="tablist" aria-label="Filtrar os problemas">
        {(["abertos", "tratados", "todos"] as const).map((f) => (
          <button key={f} type="button" role="tab" aria-selected={filtro === f} onClick={() => setFiltro(f)}>
            {f === "abertos" ? "Em aberto" : f === "tratados" ? "Tratados" : "Todos"}
            {f === "abertos" && <span className="ts-filtro-qtd">{abertos}</span>}
          </button>
        ))}
      </div>
      {visiveis.length === 0 ? (
        <div className="ts-vazio">
          <Icon name="check" size={24} />
          <strong>{filtro === "abertos" ? "Nenhum problema em aberto" : "Nada por aqui"}</strong>
          <span className="small">Quando um técnico reportar algo numa fase, aparece aqui e você recebe um aviso.</span>
        </div>
      ) : (
        <ul className="ts-problemas">
          {visiveis.map((r) => (
            <li key={r.id} className="ts-problema" data-tratado={r.tratado_em ? "" : undefined}>
              <div className="ts-item-cab">
                <span className="ts-problema-icone">
                  <Icon name="flag" size={16} />
                </span>
                <strong className="ts-item-titulo">{r.fase !== null ? `Fase ${r.fase + 1}` : "Geral"}</strong>
                <Badge tone="neu">Versão {r.versao}</Badge>
                {r.tratado_em && <Badge tone="enc">Tratado</Badge>}
              </div>
              <blockquote className="ts-problema-texto">{r.texto}</blockquote>
              <div className="row between wrap g8">
                <span className="small">
                  {r.usuario_nome} · {dataHora(r.criado_em)}
                  {r.tratado_em ? ` · tratado em ${dataHora(r.tratado_em)}` : ""}
                </span>
                {!r.tratado_em && (
                  <Button variant="line" sm onClick={() => tratar(r.id)} disabled={tratando !== null}>
                    <Icon name="check" size={13} />
                    {tratando === r.id ? "Marcando…" : "Marcar como tratado"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
