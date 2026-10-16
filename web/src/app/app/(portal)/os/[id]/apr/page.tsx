import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CabecalhoPagina } from "@/components/app/AppChrome";
import { NovaAprScreen } from "@/components/app/nova-apr/NovaAprScreen";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { api, apiOuNulo, usuarioAtual } from "@/lib/api";
import type { Colega, EscolhaDoModelo } from "@/lib/apr";
import { execucaoAberta, reservadaParaOutro, rotuloDaOs, type DetalheDaOs } from "@/lib/os-app";
import { MOTIVO_DO_AUSENTE } from "@/lib/ausencia";
import { rotas } from "@/lib/rotas";

export const metadata: Metadata = { title: "Nova APR" };

/**
 * Nova APR, etapa 1: modelo, participantes e riscos. O técnico escolhe o modelo entre os publicados (vale a versão
 * publicada mais recente), numa janela que mostra o que cada um atende e o recomendado pela leitura da OS.
 */
export default async function NovaAprPage({ params }: PageProps<"/app/os/[id]/apr">) {
  const { id } = await params;
  const detalhe = await apiOuNulo<DetalheDaOs>(`/os/${id}`);
  if (!detalhe) notFound();
  const { os, execucoes } = detalhe;
  if (os.status === "encerrada" || os.status === "cancelada" || os.status === "devolvida") redirect(rotas.app.os(id));
  const { usuario, ausencia } = await usuarioAtual();

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

  // O ausente só visualiza: não aplica APR (a `api` também recusa).
  if (ausencia) {
    return (
      <Screen>
        {cabecalho}
        <Notice tone="al" icon="lock">
          <strong>{ausencia.rotulo}.</strong> {MOTIVO_DO_AUSENTE.replace("Você está ausente: ", "")} <Link href={rotas.app.os(id)}>Voltar à OS</Link>
        </Notice>
      </Screen>
    );
  }

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

  // OS reservada pelo supervisor a outra pessoa: só o responsável aplica a APR (a `api` também recusa).
  if (reservadaParaOutro(os, usuario.id)) {
    return (
      <Screen>
        {cabecalho}
        <Notice tone="info" icon="lock">
          <strong>Esta OS está reservada para {os.responsavel!.nome}.</strong> Só quem o supervisor designou aplica a APR e inicia a execução.{" "}
          <Link href={rotas.app.os(id)}>Voltar à OS</Link>
        </Notice>
      </Screen>
    );
  }

  const [{ usuarios }, escolha] = await Promise.all([
    api<{ usuarios: (Colega & { ausencia?: unknown })[] }>("/usuarios", { consulta: { equipe_id: os.equipe_id, tamanho: 200 } }),
    api<EscolhaDoModelo>(`/os/${id}/modelos-apr`),
  ]);

  // O técnico logado sempre participa, mesmo que a lista da equipe não o traga; só o que a tela usa vai ao navegador.
  const resumo = ({ id, nome, matricula, cargo, perfil, assinatura_path }: Colega): Colega => ({ id, nome, matricula, cargo, perfil, assinatura_path });
  // O ausente não entra em APR: some da escolha dos participantes (a `api` também o recusa).
  const presentes = usuarios.filter((u) => !u.ausencia);
  const colegas = (presentes.some((u) => u.id === usuario.id) ? presentes : [...presentes, usuario]).map(resumo);

  return (
    <Screen>
      {cabecalho}
      <NovaAprScreen
        os={{ id: os.id, rotulo: rotuloDaOs(os), titulo: os.titulo, local: os.local_instalacao.codigo, reservada: Boolean(os.responsavel) }}
        usuarioId={usuario.id}
        colegas={colegas}
        escolha={escolha}
      />
    </Screen>
  );
}
