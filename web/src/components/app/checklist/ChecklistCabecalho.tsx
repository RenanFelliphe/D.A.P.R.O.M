import { CabecalhoPagina } from "@/components/app/AppChrome";
import { rotas } from "@/lib/telas";

/** Cabeçalho do checklist: trilha, local, OS/modelo da APR e etapa. */
export function ChecklistCabecalho() {
  return (
    <CabecalhoPagina
      trilha={[
        { rotulo: "OS da equipe", href: rotas.app.lista },
        { rotulo: <span className="mono">OS 4031187</span>, href: rotas.app.detalhe },
        { rotulo: "Nova APR", href: rotas.app.novaApr },
        { rotulo: "Checklist" },
      ]}
    >
      <h1>APR · ERP Serra</h1>
      <span className="muted">
        <span className="mono">OS 4031187 · APR 03 v4</span> · Etapa 2 de 3
      </span>
    </CabecalhoPagina>
  );
}
