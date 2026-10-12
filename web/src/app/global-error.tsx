"use client";

/** Falha no layout raiz: a tela precisa do próprio `<html>` e dos próprios estilos (substitui o layout enquanto estiver ativa). */
export default function ErroGlobal({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <main style={{ maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 20 }}>O sistema não conseguiu carregar</h1>
          <p>Algo deu errado. Tente de novo; se continuar, avise o administrador.</p>
          <button type="button" onClick={() => retry()} style={{ padding: "8px 16px", fontSize: 14 }}>
            Tentar de novo
          </button>
        </main>
      </body>
    </html>
  );
}
