import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Panel } from "@/components/web/Panel";
import type { DashboardOs as Dados } from "@/data/dashboards";
import { rotas } from "@/lib/rotas";
import { Secao } from "./blocos";

interface ItemDeAtencao {
  icone: IconName;
  total: number;
  /** No singular e no plural. */
  texto: [string, string];
  href: string;
  acao: string;
}

/** Cada linha é uma contagem de agora com o atalho para resolver; zerada, fica apagada. */
function ListaDeAtencao({ itens }: { itens: ItemDeAtencao[] }) {
  return (
    <ul className="atencao">
      {itens.map((i) => (
        <li key={i.texto[1]} data-zerado={i.total === 0 || undefined}>
          <Icon name={i.total === 0 ? "check" : i.icone} size={16} />
          <span className="grow">
            <strong>{i.total}</strong> {i.total === 1 ? i.texto[0] : i.texto[1]}
          </span>
          {i.total > 0 && (
            <Link href={i.href} className="small" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
              {i.acao}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

interface PrecisaDeAtencaoProps {
  dados: Dados;
  /** Alertas não lidos de quem está vendo (os mesmos do sino); `null` para o técnico, que não os recebe. */
  alertasNaoLidos: number | null;
  /** O admin faz a baixa no SAP: só ele vê a pendência. */
  verExportacao: boolean;
  /** Admin e supervisor: as pendências de gestão (assinatura do supervisor e alertas). O técnico vê só as da equipe. */
  acompanha: boolean;
}

/** "Precisa de atenção", no topo do dashboard de OS: contagens de agora, cada uma com o atalho para resolver. */
export function PrecisaDeAtencao({ dados, alertasNaoLidos, verExportacao, acompanha }: PrecisaDeAtencaoProps) {
  const { carteira: c, preventivas: p, pendencias: pend } = dados;

  const itens: ItemDeAtencao[] = [
    { icone: "octagon", total: c.pendentes, texto: ["OS pendente, à espera de uma APR nova", "OS pendentes, à espera de uma APR nova"], href: `${rotas.app.lista}?status=pendente`, acao: "Ver no quadro" },
    {
      icone: "alert",
      total: p.atrasadas_sem_justificativa,
      texto: ["preventiva atrasada sem justificativa no período", "preventivas atrasadas sem justificativa no período"],
      href: "#os-preventivas-t",
      acao: "Ver as preventivas",
    },
    { icone: "clock", total: pend.execucoes_esquecidas, texto: ["execução aberta há mais de 12 h", "execuções abertas há mais de 12 h"], href: `${rotas.app.lista}?status=em_execucao`, acao: "Ver no quadro" },
    ...(acompanha
      ? [
          {
            icone: "user",
            total: pend.sem_ciencia ?? 0,
            texto: ["OS aguardando a assinatura do supervisor", "OS aguardando a assinatura do supervisor"],
            // O supervisor assina na página Validações (com o resto do que espera por ele); o admin só consulta, no quadro.
            href: verExportacao ? `${rotas.app.lista}?status=aguardando_supervisor` : `${rotas.app.validacoes}?tipo=os_ciencia`,
            acao: verExportacao ? "Ver no quadro" : "Assinar",
          } satisfies ItemDeAtencao,
        ]
      : []),
    ...(verExportacao
      ? [{ icone: "download", total: pend.a_exportar ?? 0, texto: ["OS encerrada à espera da baixa no SAP", "OS encerradas à espera da baixa no SAP"], href: "#exportacao", acao: "Exportar" } satisfies ItemDeAtencao]
      : []),
    ...(acompanha
      ? [{ icone: "bell", total: alertasNaoLidos ?? 0, texto: ["alerta não lido", "alertas não lidos"], href: rotas.web.alertas, acao: "Abrir alertas" } satisfies ItemDeAtencao]
      : []),
  ];

  return (
    <Secao id="os-atencao-t" titulo="Precisa de atenção" descricao="Contagens de agora, cada uma com o atalho para resolver.">
      <Panel>
        <ListaDeAtencao itens={itens} />
      </Panel>
    </Secao>
  );
}
