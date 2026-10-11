import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CabecalhoPagina, Colunas } from "@/components/app/AppChrome";
import { AcoesDaOs } from "@/components/app/detalhe/AcoesDaOs";
import { AprExigidaCard } from "@/components/app/detalhe/AprExigidaCard";
import { DadosSapCard } from "@/components/app/detalhe/DadosSapCard";
import { HistoricoAprs } from "@/components/app/detalhe/HistoricoAprs";
import { InstrucoesCard } from "@/components/app/detalhe/InstrucoesCard";
import { LocalCard } from "@/components/app/detalhe/LocalCard";
import { Badge } from "@/components/ui/Badge";
import { Screen } from "@/components/ui/Screen";
import { api, apiOuNulo, usuarioAtual } from "@/lib/api";
import type { ModeloResumo } from "@/lib/apr";
import { aprAprovadaDisponivel, execucaoAberta, rotuloDaOs, rotuloDoTipo, statusDaOs, type DetalheDaOs } from "@/lib/os-app";
import { rotas } from "@/lib/rotas";

export const metadata: Metadata = { title: "Detalhe da OS" };

/** Detalhe da OS para o técnico: dados do SAP, local, instruções, a APR exigida e as ações que o estado da OS permite. */
export default async function DetalhePage({ params }: PageProps<"/app/os/[id]">) {
  const { id } = await params;
  const detalhe = await apiOuNulo<DetalheDaOs>(`/os/${id}`);
  if (!detalhe) notFound();
  const { os, aprs, execucoes } = detalhe;
  const { usuario } = await usuarioAtual();

  // Versão publicada mais recente do modelo da atividade (a lista vem por código e versão decrescente).
  const codigoDoModelo = os.modelo_apr_codigo ?? null;
  const modelo = codigoDoModelo
    ? ((await api<{ modelos: ModeloResumo[] }>("/modelos-apr", { consulta: { codigo: codigoDoModelo, publicados: true } })).modelos[0] ?? null)
    : null;

  const aberta = execucaoAberta(execucoes);
  const status = statusDaOs[os.status];

  return (
    <Screen>
      <CabecalhoPagina trilha={[{ rotulo: "OS da equipe", href: rotas.app.lista }, { rotulo: <span className="mono">{rotuloDaOs(os)}</span> }]}>
        <div className="row wrap g8">
          <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
            {rotuloDaOs(os)}
          </span>
          <Badge tone={status.tone}>{status.rotulo}</Badge>
          <Badge tone="neu">{rotuloDoTipo[os.tipo]}</Badge>
          {os.prioridade && <Badge tone="neu">Prioridade {os.prioridade.toLowerCase()}</Badge>}
          {os.local_instalacao.critico && <Badge tone="crit">Local crítico</Badge>}
        </div>
        <h1>{os.titulo}</h1>
      </CabecalhoPagina>
      <Colunas
        principal={
          <>
            <LocalCard local={os.local_instalacao} />
            <DadosSapCard os={os} />
            <InstrucoesCard descricao={os.descricao} titulo={os.titulo} />
            <HistoricoAprs aprs={aprs} execucoes={execucoes} osId={os.id} />
          </>
        }
        lateral={
          <>
            <AprExigidaCard modelo={modelo} codigoDoModelo={codigoDoModelo} aprs={aprs} status={os.status} />
            <AcoesDaOs
              os={os}
              usuarioId={usuario.id}
              execucaoAberta={aberta}
              aprDisponivel={aprAprovadaDisponivel(aprs, execucoes)}
            />
          </>
        }
      />
    </Screen>
  );
}
