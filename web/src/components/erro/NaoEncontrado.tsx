import Link from "next/link";
import { Screen } from "@/components/ui/Screen";

/** O que a página pedida não existe, ou a pessoa não pode ver (a `api` responde 404 nos dois casos). */
export function NaoEncontrado({ inicio, rotuloInicio }: { inicio: string; rotuloInicio: string }) {
  return (
    <Screen>
      <div className="stack g4">
        <h1>Página não encontrada</h1>
        <span className="muted">O endereço não existe, o registro foi removido ou você não tem acesso a ele.</span>
      </div>
      <div className="row g8">
        <Link href={inicio} className="btn btn-p">
          {rotuloInicio}
        </Link>
      </div>
    </Screen>
  );
}
