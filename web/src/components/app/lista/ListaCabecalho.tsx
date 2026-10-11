import { CabecalhoPagina } from "@/components/app/AppChrome";
import { diaPorExtenso } from "@/lib/os-app";

/** Título da lista com a equipe do técnico e o dia de hoje. */
export function ListaCabecalho({ equipe }: { equipe: string | null }) {
  return (
    <CabecalhoPagina>
      <h1>OS da equipe</h1>
      <span className="muted">
        {equipe ? `${equipe} · ` : ""}
        {diaPorExtenso()}
      </span>
    </CabecalhoPagina>
  );
}
