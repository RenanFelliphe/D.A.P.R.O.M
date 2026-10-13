import { CadastrarAssinatura } from "@/components/app/aprovada/CadastrarAssinatura";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import type { Colega } from "@/lib/apr";

interface AssinaturasFaltandoProps {
  /** Participantes sem assinatura no perfil, o técnico logado incluso. */
  semAssinatura: Colega[];
  usuarioId: string;
  aoAssinaturaSalva: (arquivoId: string) => void;
  aoRetirar: (usuarioId: string) => void;
}

/**
 * Antes de validar, todo participante precisa ter a assinatura no perfil: a `api` confere isso junto com o resto, antes
 * de dizer o resultado. Quem está logado desenha a sua aqui; quem não está presente para cadastrar pode sair da APR.
 */
export function AssinaturasFaltando({ semAssinatura, usuarioId, aoAssinaturaSalva, aoRetirar }: AssinaturasFaltandoProps) {
  const euSem = semAssinatura.some((c) => c.id === usuarioId);
  const outros = semAssinatura.filter((c) => c.id !== usuarioId);
  if (!euSem && outros.length === 0) return null;

  return (
    <>
      {euSem && (
        <div className="card stack g8">
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Sua assinatura</h2>
          <CadastrarAssinatura aoSalvar={aoAssinaturaSalva} />
        </div>
      )}
      {outros.length > 0 && (
        <>
          <Notice tone="al" icon="alert">
            <strong>
              {outros.map((c) => c.nome).join(", ")} {outros.length > 1 ? "ainda não cadastraram" : "ainda não cadastrou"} a assinatura no perfil.
            </strong>{" "}
            Peça que cadastrem em Perfil e recarregue esta página, ou retire da APR quem não está presente.
          </Notice>
          <div className="answered">
            {outros.map((c) => (
              <div key={c.id} className="ans-row">
                <span className="t">{c.nome}</span>
                <Button variant="line" sm style={{ height: 36, fontSize: 13 }} onClick={() => aoRetirar(c.id)}>
                  Retirar da APR
                </Button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
