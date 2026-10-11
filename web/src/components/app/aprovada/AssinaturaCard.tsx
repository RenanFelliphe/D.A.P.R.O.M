import { CadastrarAssinatura } from "@/components/app/aprovada/CadastrarAssinatura";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ImagemArquivo } from "@/components/ui/ImagemArquivo";
import { cx } from "@/lib/cx";
import { hora } from "@/lib/formatar";

export interface LinhaDeAssinatura {
  usuarioId: string;
  nome: string;
  funcao: "responsavel" | "executor";
  /** Id do arquivo da assinatura do perfil; `null` = ainda não cadastrou. */
  assinaturaPath: string | null;
  /** Instante da confirmação; `null` = pendente. */
  assinadaEm: string | null;
  eu: boolean;
}

interface AssinaturaCardProps {
  linha: LinhaDeAssinatura;
  /** Está registrando a APR: ninguém mexe nas confirmações. */
  ocupado: boolean;
  /** A APR já foi registrada: só mostra. */
  somenteLeitura: boolean;
  aoConfirmar: () => void;
  aoRetirar: () => void;
  aoCadastrar: (arquivoId: string) => void;
}

/** Card de assinatura do perfil: pendente até a pessoa confirmar a rubrica que cadastrou no perfil. */
export function AssinaturaCard({ linha, ocupado, somenteLeitura, aoConfirmar, aoRetirar, aoCadastrar }: AssinaturaCardProps) {
  const confirmada = linha.assinadaEm !== null;
  return (
    <div className="card stack g6">
      <div className="row between">
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {linha.nome} <span style={{ fontWeight: 400, color: "var(--ink3)" }}>· {linha.funcao === "responsavel" ? "Responsável" : "Executor"}</span>
        </span>
        {confirmada && (
          <span className="ans-ok" style={{ fontSize: 12.5 }}>
            <Icon name="check" size={13} />
            Confirmada {hora(linha.assinadaEm)}
          </span>
        )}
      </div>
      {linha.assinaturaPath ? (
        <>
          <div className={cx("sig-box", !confirmada && "pend")}>
            <ImagemArquivo id={linha.assinaturaPath} alt={`Assinatura de ${linha.nome}`} style={{ height: 56, maxWidth: "100%", objectFit: "contain" }} />
          </div>
          {!confirmada && !somenteLeitura && (
            <Button variant="line" sm onClick={aoConfirmar} disabled={ocupado}>
              Confirmar assinatura do perfil
            </Button>
          )}
        </>
      ) : linha.eu ? (
        <CadastrarAssinatura aoSalvar={aoCadastrar} />
      ) : (
        <div className="stack g6">
          <p className="muted">
            {linha.nome} ainda não cadastrou a assinatura no perfil. Peça que cadastre em Perfil e atualize esta página, ou retire a pessoa da APR.
          </p>
          {!somenteLeitura && (
            <div>
              <Button variant="line" sm onClick={aoRetirar} disabled={ocupado}>
                Retirar da APR
              </Button>
            </div>
          )}
        </div>
      )}
      {!somenteLeitura && !confirmada && !linha.eu && linha.assinaturaPath && (
        <Button variant="ghost" sm onClick={aoRetirar} disabled={ocupado}>
          Retirar da APR
        </Button>
      )}
    </div>
  );
}
