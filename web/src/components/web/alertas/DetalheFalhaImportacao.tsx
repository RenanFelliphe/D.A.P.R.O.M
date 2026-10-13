import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/web/Panel";
import { veImportacao } from "@/components/web/os/secao";
import { dataHora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import type { Usuario } from "@/lib/tipos";
import { MarcarLidoAoAbrir } from "./MarcarLidoAoAbrir";
import { ehDoUsuario, metodoDaFalha, perfilAgeSobreAlertas, rotuloDaLeitura, rotuloDoAlerta, type Alerta } from "./tipos";

/**
 * Detalhe do alerta de falha de importação: o método, o motivo e o que fazer. Nenhuma OS mudou, então não há OS para
 * abrir; o atalho leva à aba Importação, onde está o histórico e onde se tenta de novo.
 */
export function DetalheFalhaImportacao({ alerta, usuario, marcarAoAbrir }: { alerta: Alerta; usuario: Usuario; marcarAoAbrir: boolean }) {
  const podeAgir = perfilAgeSobreAlertas(usuario);
  const naoLido = alerta.lido_em === null;
  const api = alerta.importacao_origem === "api";
  return (
    <Panel style={{ padding: "20px 22px", gap: 16 }}>
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack g6" style={{ minWidth: 0 }}>
          <div className="row wrap g8">
            <Badge tone="blq">
              <Icon name="alert" size={13} />
              {rotuloDoAlerta(alerta)}
            </Badge>
            <Badge tone="neu">{rotuloDaLeitura(alerta, usuario)}</Badge>
          </div>
          <h2 style={{ fontSize: 21, lineHeight: 1.25 }}>{metodoDaFalha(alerta.importacao_origem)}</h2>
        </div>
        {veImportacao(usuario) && (
          <Link href={rotas.web.importacao} style={{ fontSize: 14, fontWeight: 600 }}>
            Abrir a Importação
          </Link>
        )}
      </div>

      <Notice tone="blq" icon="alert" style={{ fontSize: 14.5 }}>
        {alerta.detalhe}
      </Notice>

      <dl className="dl d2">
        <div>
          <dt>Quando</dt>
          <dd>{dataHora(alerta.criado_em)}</dd>
        </div>
        <div>
          <dt>Como seguir</dt>
          <dd>
            {api
              ? "Confira a configuração da API do SAP e sincronize de novo na aba Importação."
              : alerta.importacao_origem === "pdf"
                ? "Confira o PDF (o gerado pelo SAP, com texto) e envie de novo na aba Importação; a tentativa que falhou fica no histórico."
                : "Corrija a planilha e envie de novo na aba Importação; a tentativa que falhou fica no histórico."}
          </dd>
        </div>
      </dl>

      {!podeAgir && (
        <div className="row between wrap" style={{ paddingTop: 4, borderTop: "1px solid var(--line2)" }}>
          <span className="muted">Você acompanha os alertas em modo de leitura.</span>
        </div>
      )}

      {podeAgir && naoLido && marcarAoAbrir && ehDoUsuario(alerta, usuario) && <MarcarLidoAoAbrir alertaId={alerta.id} />}
    </Panel>
  );
}
