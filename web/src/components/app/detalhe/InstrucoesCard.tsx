/** Card com as instruções (descrição) da OS; sem descrição, mostra o título. */
export function InstrucoesCard({ descricao, titulo }: { descricao: string | null; titulo: string }) {
  return (
    <div className="card stack g8">
      <h2 style={{ fontSize: 15, fontWeight: 600 }}>Instruções</h2>
      <p style={{ fontSize: 14, color: "var(--ink2)", whiteSpace: "pre-line" }}>{descricao?.trim() || titulo}</p>
    </div>
  );
}
