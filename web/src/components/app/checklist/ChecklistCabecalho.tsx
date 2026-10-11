import { CabecalhoPagina } from "@/components/app/AppChrome";
import { rotas } from "@/lib/rotas";

interface ChecklistCabecalhoProps {
  os: { id: string; rotulo: string; local: string };
  modelo: { codigo: string; versao: number };
}

/** Cabeçalho do checklist: trilha, local, OS/modelo da APR e etapa. */
export function ChecklistCabecalho({ os, modelo }: ChecklistCabecalhoProps) {
  return (
    <CabecalhoPagina
      trilha={[
        { rotulo: "OS da equipe", href: rotas.app.lista },
        { rotulo: <span className="mono">{os.rotulo}</span>, href: rotas.app.os(os.id) },
        { rotulo: "Nova APR", href: rotas.app.apr(os.id) },
        { rotulo: "Checklist" },
      ]}
    >
      <h1>APR · {os.local}</h1>
      <span className="muted">
        <span className="mono">
          {os.rotulo} · {modelo.codigo} v{modelo.versao}
        </span>{" "}
        · Etapa 2 de 3
      </span>
    </CabecalhoPagina>
  );
}
