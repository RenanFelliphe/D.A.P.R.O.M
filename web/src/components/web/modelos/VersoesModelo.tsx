import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Panel } from "@/components/web/Panel";
import type { ResumoModelo } from "@/data/modelos";
import { data, dataDoDia } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";

/** Histórico de versões do modelo aberto; cada uma abre na mesma tela. */
export function VersoesModelo({ codigo, versoes, atual }: { codigo: string; versoes: ResumoModelo[]; atual?: number }) {
  const emUso = versoes.find((v) => !v.rascunho)?.versao;
  return (
    <Panel style={{ padding: 16, gap: 10 }}>
      <h2 style={{ fontSize: 15 }}>{`Versões da ${codigo}`}</h2>
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
        {versoes.map((v) => (
          <li key={v.id} className="stack" style={{ lineHeight: 1.35 }}>
            <Link
              href={`${rotas.web.modelos}?codigo=${encodeURIComponent(codigo)}&versao=${v.versao}`}
              style={{ fontSize: 13.5, fontWeight: v.versao === atual ? 700 : 600, color: "var(--ink)" }}
              aria-current={v.versao === atual ? "true" : undefined}
            >
              {`v${v.versao}`}{" "}
              {v.rascunho ? (
                <Badge tone="al">Rascunho</Badge>
              ) : v.versao === emUso ? (
                <Badge tone="enc">Em uso</Badge>
              ) : (
                <Badge tone="neu">Anterior</Badge>
              )}
            </Link>
            <span className="small">
              {v.rascunho
                ? `${v.itens_total} itens · ainda não publicada`
                : `Publicada em ${data(v.publicado_em)} · documento de ${dataDoDia(v.data_documento)} · ${v.itens_total} itens`}
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
