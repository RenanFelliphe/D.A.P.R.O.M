import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { AtualizacaoAutomatica } from "@/components/ui/AtualizacaoAutomatica";
import { Icon } from "@/components/ui/Icon";
import { LinkButton } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { VitoriaNaCena } from "@/components/web/treinamento-servico/vitoria/VitoriaNaCena";
import { usuarioAtual } from "@/lib/api";
import { dataHora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import { ehSupervisor } from "@/lib/tipos";
import { emTreino } from "@/lib/treino-modo";
import { enderecoDaValidacao, iconeDoTipo, ROTULO_DO_TIPO, rotuloDaAcaoDeValidacao, tipoDaConsulta, TIPOS_DE_VALIDACAO } from "@/lib/validacoes";
import { minhasValidacoes } from "@/lib/validacoes-servidor";

export const metadata: Metadata = { title: "Validações" };

/**
 * Validações: tudo o que espera a decisão ou a assinatura do supervisor, numa fila só (`docs/pessoas-e-equipes.md`, seção 5): a OS
 * que espera a ciência, o treinamento de serviço, a sugestão de materiais, a conferência da execução e os pedidos de ausência.
 * A página não decide nada: cada item leva à tela onde a decisão já existia, com a janela de assinatura de sempre. Os urgentes
 * vêm primeiro; `?tipo=` filtra por um dos cinco tipos.
 */
export default async function ValidacoesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { usuario } = await usuarioAtual();
  // Só quem supervisiona tem fila; o admin e o técnico têm as telas próprias de cada coisa.
  if (!ehSupervisor(usuario) || (await emTreino())) redirect(rotas.app.lista);

  const filtro = tipoDaConsulta((await searchParams).tipo);
  const fila = await minhasValidacoes();
  const itens = filtro ? fila.itens.filter((i) => i.tipo === filtro) : fila.itens;
  const caminho = (tipo: string | null) => (tipo ? `${rotas.app.validacoes}?tipo=${tipo}` : rotas.app.validacoes);

  return (
    <Screen className="ts-pagina">
      <header className="ts-cabecalho">
        <div className="ts-cabecalho-texto">
          <span className="lbl">Supervisão</span>
          <h1>Validações</h1>
          <span className="muted small">O que espera a sua decisão ou a sua assinatura: cada item abre na tela onde você decide.</span>
        </div>
        <div className="ts-cabecalho-selos">
          <Badge tone={fila.total > 0 ? "exe" : "neu"}>{fila.total === 0 ? "Nada esperando" : fila.total === 1 ? "1 esperando você" : `${fila.total} esperando você`}</Badge>
        </div>
      </header>

      {fila.total > 0 && (
        <nav className="sg-filtro vl-filtro" aria-label="Tipo de validação">
          <Link href={caminho(null)} aria-current={filtro === null ? "page" : undefined}>
            Tudo
            <span className="vl-contagem">{fila.total}</span>
          </Link>
          {TIPOS_DE_VALIDACAO.filter((t) => fila.por_tipo[t] > 0 || t === filtro).map((t) => (
            <Link key={t} href={caminho(t)} aria-current={filtro === t ? "page" : undefined}>
              {ROTULO_DO_TIPO[t]}
              <span className="vl-contagem">{fila.por_tipo[t]}</span>
            </Link>
          ))}
        </nav>
      )}

      {itens.length === 0 ? (
        <section className="panel ts-sem-rascunho">
          <VitoriaNaCena chave="nada-a-validar" reacao="certo" tamanho={96}>
            <strong className="ts-balao-titulo">{filtro ? "Nada deste tipo esperando" : "Nada para validar agora"}</strong>
            <p>
              {filtro
                ? "Quando houver algo deste tipo para você, ele aparece aqui."
                : "A OS concluída pela equipe, o treinamento de um serviço que ela faz, a sugestão de materiais, a conferência e o pedido de ausência aparecem aqui quando esperarem por você, e você recebe um aviso."}
            </p>
          </VitoriaNaCena>
          <div className="row g8 wrap">
            <LinkButton variant="line" href={rotas.app.lista}>
              Ir ao quadro de OS
            </LinkButton>
          </div>
        </section>
      ) : (
        <ul className="vl-lista">
          {itens.map((i) => (
            <li key={i.chave} className="panel vl-item" data-urgente={i.urgente || undefined}>
              <div className="row wrap g8 vl-selos">
                <Badge tone="brand">
                  <Icon name={iconeDoTipo[i.tipo]} size={13} /> {ROTULO_DO_TIPO[i.tipo]}
                </Badge>
                {i.urgente && <Badge tone="blq">Urgente</Badge>}
                {i.acao === "aguardar_conferencia" && <Badge tone="al">Espera a conferência</Badge>}
                {i.equipe_nome && <Badge tone="neu">{i.equipe_nome}</Badge>}
              </div>
              <div className="stack g4">
                <h2 className="vl-titulo">{i.titulo}</h2>
                <span className="small">{i.detalhe}</span>
                <span className="small vl-meta">
                  Esperando desde {dataHora(i.desde)}
                  {i.tipo === "os_ciencia" && i.prazo_em ? ` · prazo para pontuar: ${dataHora(i.prazo_em)}` : ""}
                </span>
              </div>
              <LinkButton variant={i.acao === "aguardar_conferencia" ? "line" : "p"} href={enderecoDaValidacao(i)}>
                {rotuloDaAcaoDeValidacao(i)}
                <Icon name="right" size={16} />
              </LinkButton>
            </li>
          ))}
        </ul>
      )}
      <AtualizacaoAutomatica />
    </Screen>
  );
}
