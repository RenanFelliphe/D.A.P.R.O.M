import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/web/Panel";
import { dataHora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import type { Usuario } from "@/lib/tipos";
import { MarcarLidoAoAbrir } from "./MarcarLidoAoAbrir";
import { aparenciaDoAlerta, ehDoUsuario, perfilAgeSobreAlertas, rotuloDaLeitura, rotuloDoAlerta, type Alerta } from "./tipos";

/**
 * Detalhe do alerta da ausência de um usuário (pedido a responder, fim antecipado, ausência vencida, pedido cancelado…): o que
 * aconteceu e o atalho para a equipe, onde o supervisor responde. Não tem OS.
 */
export function DetalheAusencia({ alerta, usuario, marcarAoAbrir }: { alerta: Alerta; usuario: Usuario; marcarAoAbrir: boolean }) {
  const podeAgir = perfilAgeSobreAlertas(usuario);
  const naoLido = alerta.lido_em === null;
  const { icone, urgente } = aparenciaDoAlerta(alerta);
  return (
    <Panel style={{ padding: "20px 22px", gap: 16 }}>
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack g6" style={{ minWidth: 0 }}>
          <div className="row wrap g8">
            <Badge tone={urgente ? "blq" : "lib"}>
              <Icon name={icone} size={13} />
              {rotuloDoAlerta(alerta)}
            </Badge>
            <Badge tone="neu">{rotuloDaLeitura(alerta, usuario)}</Badge>
          </div>
          <h2 style={{ fontSize: 21, lineHeight: 1.25 }}>{alerta.usuario_alvo_nome ?? "Ausência"}</h2>
        </div>
        {alerta.ausencia_equipe_id && (
          <Link href={`${rotas.app.equipe(alerta.ausencia_equipe_id)}#ausencias`} style={{ fontSize: 14, fontWeight: 600 }}>
            Abrir as ausências da equipe
          </Link>
        )}
      </div>

      <Notice tone={urgente ? "blq" : "info"} icon={urgente ? "clock" : "info"} style={{ fontSize: 14.5 }}>
        {alerta.detalhe}
      </Notice>

      <dl className="dl d2">
        <div>
          <dt>Quando</dt>
          <dd>{dataHora(alerta.criado_em)}</dd>
        </div>
        <div>
          <dt>Como seguir</dt>
          <dd>Os pedidos, os fins antecipados e as ausências vencidas se respondem na seção Ausências da equipe, com a sua assinatura.</dd>
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
