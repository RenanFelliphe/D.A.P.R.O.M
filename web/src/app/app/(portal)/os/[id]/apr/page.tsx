import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CabecalhoPagina } from "@/components/app/AppChrome";
import { NovaAprScreen } from "@/components/app/nova-apr/NovaAprScreen";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { api, apiOuNulo, usuarioAtual } from "@/lib/api";
import type { Colega, ModeloCompleto, ModeloResumo } from "@/lib/apr";
import { execucaoAberta, rotuloDaOs, type DetalheDaOs } from "@/lib/os-app";
import { rotas } from "@/lib/rotas";

export const metadata: Metadata = { title: "Nova APR" };

/** Última versão publicada de cada modelo (a lista vem por código e versão decrescente). */
function ultimasVersoes(modelos: ModeloResumo[]) {
  const vistos = new Set<string>();
  return modelos.filter((m) => !vistos.has(m.codigo) && vistos.add(m.codigo));
}

/**
 * Nova APR, etapa 1: modelo, participantes e riscos. O modelo é a versão publicada mais recente do `modelo_apr_codigo`
 * da OS; sem atividade mapeada, o técnico escolhe entre os publicados.
 */
export default async function NovaAprPage({ params }: PageProps<"/app/os/[id]/apr">) {
  const { id } = await params;
  const detalhe = await apiOuNulo<DetalheDaOs>(`/os/${id}`);
  if (!detalhe) notFound();
  const { os, execucoes } = detalhe;
  if (os.status === "encerrada" || os.status === "cancelada") redirect(rotas.app.os(id));

  const cabecalho = (
    <CabecalhoPagina
      trilha={[
        { rotulo: "OS da equipe", href: rotas.app.lista },
        { rotulo: <span className="mono">{rotuloDaOs(os)}</span>, href: rotas.app.os(id) },
        { rotulo: "Nova APR" },
      ]}
    >
      <h1>Nova APR</h1>
      <span className="muted">Etapa 1 de 3 · modelo, participantes e riscos</span>
    </CabecalhoPagina>
  );

  const aberta = execucaoAberta(execucoes);
  if (os.status === "em_execucao" || aberta) {
    return (
      <Screen>
        {cabecalho}
        <Notice tone="info" icon="user">
          <strong>Esta OS já está em execução</strong>
          {aberta ? ` por ${aberta.executor.nome}` : ""}. Só dá para fazer uma APR nova depois que a execução for encerrada, suspensa ou interrompida.{" "}
          <Link href={rotas.app.os(id)}>Voltar à OS</Link>
        </Notice>
      </Screen>
    );
  }

  const { usuario } = await usuarioAtual();
  const codigo = os.modelo_apr_codigo ?? null;
  const [{ usuarios }, modelo] = await Promise.all([
    api<{ usuarios: Colega[] }>("/usuarios", { consulta: { equipe_id: os.equipe_id, tamanho: 200 } }),
    codigo ? apiOuNulo<ModeloCompleto>(`/modelos-apr/${encodeURIComponent(codigo)}/versoes/publicada`) : Promise.resolve(null),
  ]);
  // Sem modelo mapeado (ou sem versão publicada dele), o técnico escolhe entre os publicados.
  const publicados = modelo ? [] : ultimasVersoes((await api<{ modelos: ModeloResumo[] }>("/modelos-apr", { consulta: { publicados: true, tamanho: 200 } })).modelos);

  // O técnico logado sempre participa, mesmo que a lista da equipe não o traga; só o que a tela usa vai ao navegador.
  const resumo = ({ id, nome, matricula, cargo, perfil, assinatura_path }: Colega): Colega => ({ id, nome, matricula, cargo, perfil, assinatura_path });
  const colegas = (usuarios.some((u) => u.id === usuario.id) ? usuarios : [...usuarios, usuario]).map(resumo);

  return (
    <Screen>
      {cabecalho}
      <NovaAprScreen
        os={{ id: os.id, rotulo: rotuloDaOs(os), titulo: os.titulo, local: os.local_instalacao.codigo }}
        usuarioId={usuario.id}
        colegas={colegas}
        modeloDaAtividade={modelo}
        codigoMapeado={codigo}
        modelosPublicados={publicados}
      />
    </Screen>
  );
}
