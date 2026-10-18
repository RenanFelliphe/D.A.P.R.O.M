import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/web/Panel";
import { dataHora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import type { Usuario } from "@/lib/tipos";
import { MarcarLidoAoAbrir } from "./MarcarLidoAoAbrir";
import { ehDoUsuario, perfilAgeSobreAlertas, rotuloDaLeitura, rotuloDoAlerta, type Alerta } from "./tipos";

/**
 * Detalhe do aviso de que o representante assumiu a equipe (o supervisor está ausente ou parado, ou a equipe está sem supervisor)
 * ou de que a supervisão voltou para o supervisor. Não tem OS: leva à equipe.
 */
export function DetalheRepresentacao({ alerta, usuario, marcarAoAbrir }: { alerta: Alerta; usuario: Usuario; marcarAoAbrir: boolean }) {
  const naoLido = alerta.lido_em === null;
  const iniciada = alerta.tipo === "representacao_iniciada";
  return (
    <Panel style={{ padding: "20px 22px", gap: 16 }}>
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack g6" style={{ minWidth: 0 }}>
          <div className="row wrap g8">
            <Badge tone="lib">
              <Icon name="users" size={13} />
              {rotuloDoAlerta(alerta)}
            </Badge>
            <Badge tone="neu">{rotuloDaLeitura(alerta, usuario)}</Badge>
          </div>
          <h2 style={{ fontSize: 21, lineHeight: 1.25 }}>{iniciada ? "O representante assumiu a equipe" : "A supervisão voltou para o supervisor"}</h2>
        </div>
        {alerta.equipe_alvo_id && (
          <Link href={`${rotas.app.equipe(alerta.equipe_alvo_id)}#representante`} style={{ fontSize: 14, fontWeight: 600 }}>
            Abrir a equipe
          </Link>
        )}
      </div>

      <Notice tone="info" icon="info" style={{ fontSize: 14.5 }}>
        {alerta.detalhe}
      </Notice>

      <dl className="dl d2">
        <div>
          <dt>Quando</dt>
          <dd>{dataHora(alerta.criado_em)}</dd>
        </div>
        <div>
          <dt>Como funciona</dt>
          <dd>
            O representante faz o que o supervisor faz pela equipe enquanto ele está ausente ou parado há 3 dias, ou enquanto a equipe está sem supervisor, e a devolve quando ele volta a usar o
            sistema ou quando a equipe ganha um supervisor.
          </dd>
        </div>
      </dl>

      {perfilAgeSobreAlertas(usuario) && naoLido && marcarAoAbrir && ehDoUsuario(alerta, usuario) && <MarcarLidoAoAbrir alertaId={alerta.id} />}
    </Panel>
  );
}
