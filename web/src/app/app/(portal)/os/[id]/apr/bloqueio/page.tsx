import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CabecalhoPagina, Colunas, PainelAcoes } from "@/components/app/AppChrome";
import { ItemReprovadoCard } from "@/components/app/bloqueio/ItemReprovadoCard";
import { NotasBloqueio } from "@/components/app/bloqueio/NotasBloqueio";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { apiOuNulo } from "@/lib/api";
import { dataHora } from "@/lib/formatar";
import { rotuloDaOs, type DetalheDaOs } from "@/lib/os-app";
import { rotas } from "@/lib/rotas";

export const metadata: Metadata = { title: "APR bloqueada" };

/**
 * APR bloqueada: só leitura, lida da `api` (a APR registrada com todos os itens reprovados, observações e fotos). Sem
 * `?apr=`, mostra a APR mais recente da OS, se ela estiver bloqueada.
 */
export default async function BloqueioPage({ params, searchParams }: PageProps<"/app/os/[id]/apr/bloqueio">) {
  const { id } = await params;
  const consulta = await searchParams;
  const pedida = Array.isArray(consulta.apr) ? consulta.apr[0] : consulta.apr;

  const detalhe = await apiOuNulo<DetalheDaOs>(`/os/${id}`);
  if (!detalhe) notFound();
  const { os, aprs } = detalhe;
  const apr = pedida ? aprs.find((a) => a.id === pedida) : aprs[aprs.length - 1];
  if (pedida && !apr) notFound();
  if (!apr || apr.resultado !== "bloqueada") redirect(rotas.app.os(id));

  const itens = apr.itens_reprovados;
  const varios = itens.length > 1;

  return (
    <Screen>
      <CabecalhoPagina
        trilha={[
          { rotulo: "OS da equipe", href: rotas.app.lista },
          { rotulo: <span className="mono">{rotuloDaOs(os)}</span>, href: rotas.app.os(id) },
          { rotulo: "Impedimento" },
        ]}
      >
        <h1>APR · {os.local_instalacao.codigo}</h1>
        <span className="muted mono">
          {rotuloDaOs(os)} · {apr.modelo.codigo} v{apr.modelo.versao} · {dataHora(apr.concluida_em)}
        </span>
      </CabecalhoPagina>
      <div className="res-banner rb-blq" data-treino="bloqueio-banner">
        <span className="ic">
          <Icon name="octagon" size={24} />
        </span>
        <div className="stack g4">
          <h2>Atividade impedida</h2>
          <p>
            Supervisor será avisado. {itens.length} {varios ? "itens eliminatórios tiveram resposta bloqueante." : "item eliminatório teve resposta bloqueante."}{" "}
            {os.status === "pendente"
              ? "A OS fica pendente e a execução não pode começar. Uma nova APR, de qualquer pessoa da equipe, pode liberá-la."
              : "Uma nova APR, de qualquer pessoa da equipe, é necessária para executar."}
          </p>
        </div>
      </div>
      <Colunas
        principal={
          <>
            <div className="stack g8" data-treino="bloqueio-itens">
              {itens.map((item, i) => (
                <ItemReprovadoCard key={item.item_id} item={item} numero={i + 1} />
              ))}
            </div>
            {apr.observacao_geral && (
              <div className="card stack g6">
                <span className="lbl">Observações</span>
                <p style={{ fontSize: 14 }}>{apr.observacao_geral}</p>
              </div>
            )}
          </>
        }
        lateral={
          <PainelAcoes>
            <NotasBloqueio />
            <LinkButton variant="p" block href={rotas.app.lista} data-treino="bloqueio-voltar">
              Voltar à lista de OS
            </LinkButton>
            <LinkButton variant="line" block href={rotas.app.os(id)}>
              Ver a OS
            </LinkButton>
          </PainelAcoes>
        }
      />
    </Screen>
  );
}
