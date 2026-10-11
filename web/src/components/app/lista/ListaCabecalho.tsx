import { CabecalhoPagina } from "@/components/app/AppChrome";

/** Título da lista com equipe e data. */
export function ListaCabecalho() {
  return (
    <CabecalhoPagina>
      <h1>OS da equipe</h1>
      <span className="muted">Serviços Especiais · ter, 13 out</span>
    </CabecalhoPagina>
  );
}
