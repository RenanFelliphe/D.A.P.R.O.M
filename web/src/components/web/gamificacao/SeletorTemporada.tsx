import { rotuloDaTemporada, type TemporadaDaLista } from "@/lib/gamificacao";

interface SeletorTemporadaProps {
  /** Endereço da página (o formulário envia `?temporada=` para ele). */
  caminho: string;
  temporadas: TemporadaDaLista[];
  /** O que está escolhido: o código de uma temporada ou `geral`. */
  valor: string;
  /** Inclui a opção "Geral" (todas as temporadas somadas). */
  comGeral?: boolean;
  /** Outros parâmetros que o formulário preserva (por exemplo `tipo=equipes`). */
  preservar?: Record<string, string | undefined>;
  id?: string;
}

/** Escolhe a temporada (a de hoje, uma fechada ou o geral); um formulário `GET`, como os filtros das outras listas. */
export function SeletorTemporada({ caminho, temporadas, valor, comGeral = true, preservar = {}, id = "temporada-gam" }: SeletorTemporadaProps) {
  return (
    <form method="get" action={caminho} className="filtros-lista">
      {Object.entries(preservar).map(([chave, v]) => (v ? <input key={chave} type="hidden" name={chave} value={v} /> : null))}
      <div className="field">
        <label htmlFor={id}>Temporada</label>
        <select id={id} name="temporada" className="select" defaultValue={valor}>
          {temporadas.map((t) => (
            <option key={t.codigo} value={t.codigo}>
              {rotuloDaTemporada(t)}
            </option>
          ))}
          {comGeral && <option value="geral">Geral (todas as temporadas)</option>}
        </select>
      </div>
      <button type="submit" className="btn btn-line btn-sm" style={{ height: 36 }}>
        Ver
      </button>
    </form>
  );
}
