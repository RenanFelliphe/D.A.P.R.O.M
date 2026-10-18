import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AprovadaScreen } from "@/components/app/aprovada/AprovadaScreen";
import { api, apiOuNulo, usuarioAtual } from "@/lib/api";
import type { Colega } from "@/lib/apr";
import { aprDeHoje, rotuloDaOs, type DetalheDaOs } from "@/lib/os-app";
import { rotas } from "@/lib/rotas";
import { execucaoJaTerminou } from "@/lib/tipos";

export const metadata: Metadata = { title: "APR aprovada" };

/**
 * APR aprovada: a APR já foi registrada pela `api` (sem assinaturas) e a tela mostra o estado de cada participante, que assina
 * na própria conta; a execução é liberada quando todos que ficaram na APR assinaram. A APR é a mais recente de hoje de que o
 * técnico participa e que ainda não amparou uma execução, mesmo a que deixou de servir (recusa), para a tela explicar. Se o
 * registro falhou, o rascunho validado, que está no navegador, ainda pode ser enviado.
 */
export default async function AprovadaPage({ params }: PageProps<"/app/os/[id]/apr/aprovada">) {
  const { id } = await params;
  const detalhe = await apiOuNulo<DetalheDaOs>(`/os/${id}`);
  if (!detalhe) notFound();
  const { os, aprs, execucoes } = detalhe;
  // Depois da execução (ou sem ela, cancelada ou devolvida) não há mais o que assinar.
  if (execucaoJaTerminou(os.status) || os.status === "cancelada" || os.status === "devolvida") redirect(rotas.app.os(id));

  const [{ usuario }, { usuarios }] = await Promise.all([
    usuarioAtual(),
    api<{ usuarios: Colega[] }>("/usuarios", { consulta: { equipe_id: os.equipe_id, tamanho: 200 } }),
  ]);
  const colegas = (usuarios.some((u) => u.id === usuario.id) ? usuarios : [...usuarios, usuario]).map(({ id, nome, matricula, cargo, perfil, assinatura_path }) => ({
    id,
    nome,
    matricula,
    cargo,
    perfil,
    assinatura_path,
  }));

  // Só a APR de que o técnico participou: é ela que ele assina e usa para iniciar a execução.
  const registrada = aprDeHoje(aprs, execucoes, usuario.id);

  return (
    <AprovadaScreen
      os={{ id: os.id, rotulo: rotuloDaOs(os), titulo: os.titulo, local: os.local_instalacao.codigo }}
      usuarioId={usuario.id}
      colegas={colegas}
      registrada={
        registrada && { id: registrada.id, concluida_em: registrada.concluida_em, modelo: registrada.modelo, participantes: registrada.participantes, itens: registrada.respostas.length }
      }
    />
  );
}
