import Link from "next/link";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/web/Panel";
import { rotas } from "@/lib/rotas";
import { ArquivoProcessado } from "./ArquivoProcessado";
import { LinhasIgnoradas } from "./LinhasIgnoradas";
import type { ResultadoDaDigitalizacao } from "./tipos-digitalizacao";

interface ResultadoDigitalizacaoProps {
  nome: string;
  dados: ResultadoDaDigitalizacao;
  podeCadastrarEquipe: boolean;
}

/** O que o registro da digitalização fez: as OS encerradas de histórico (com o atalho para cada uma) e as que ficaram de fora. */
export function ResultadoDigitalizacao({ nome, dados, podeCadastrarEquipe }: ResultadoDigitalizacaoProps) {
  return (
    <>
      <ArquivoProcessado
        nome={nome}
        formato="pdf"
        detalhe="digitalizado e registrado agora"
        criadas={dados.criadas}
        atualizadas={dados.atualizadas}
        ignoradas={dados.ignoradas.length}
        legenda={{ criadas: "entraram encerradas, de histórico", atualizadas: "já existiam, liberadas: a folha as encerrou" }}
      />
      {dados.registradas.length === 0 ? (
        <Notice tone="al" icon="alert" role="status">
          <strong>Nenhuma OS foi registrada.</strong> A digitalização continua em aberto: corrija o que está abaixo e registre de novo, ou descarte.
        </Notice>
      ) : (
        <Panel>
          <h2>OS registradas · {dados.registradas.length}</h2>
          <p className="muted">Entraram encerradas, com o PDF das folhas anexado. Não pontuam na gamificação nem entram nos indicadores de tempo.</p>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            {dados.registradas.map((r) => (
              <li key={r.os_id}>
                <span className="mono">OS {r.numero_ordem}</span> · <Link href={rotas.app.os(r.os_id)}>Abrir a OS</Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {dados.ignoradas.length > 0 && <LinhasIgnoradas ignoradas={dados.ignoradas} podeCadastrarEquipe={podeCadastrarEquipe} titulo="OS ignoradas" />}
    </>
  );
}
