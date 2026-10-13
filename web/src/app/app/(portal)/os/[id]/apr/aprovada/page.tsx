import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AprovadaScreen } from "@/components/app/aprovada/AprovadaScreen";
import { api, apiOuNulo, usuarioAtual } from "@/lib/api";
import type { Colega } from "@/lib/apr";
import { aprAprovadaDisponivel, rotuloDaOs, type DetalheDaOs } from "@/lib/os-app";

export const metadata: Metadata = { title: "APR aprovada" };

/**
 * APR aprovada: confirmação das assinaturas do perfil e, só depois de todas, o registro da APR e a liberação da
 * execução. O rascunho validado está no navegador; se a APR já foi registrada (e ainda não amparou uma execução), a
 * `api` a devolve e a tela mostra o resultado.
 */
export default async function AprovadaPage({ params }: PageProps<"/app/os/[id]/apr/aprovada">) {
  const { id } = await params;
  const detalhe = await apiOuNulo<DetalheDaOs>(`/os/${id}`);
  if (!detalhe) notFound();
  const { os, aprs, execucoes } = detalhe;

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

  // Só a APR de que o técnico participou: é ela que ele usa para iniciar a execução.
  const registrada = aprAprovadaDisponivel(aprs, execucoes, usuario.id);

  return (
    <AprovadaScreen
      os={{ id: os.id, rotulo: rotuloDaOs(os), titulo: os.titulo, local: os.local_instalacao.codigo, status: os.status }}
      usuarioId={usuario.id}
      colegas={colegas}
      registrada={
        registrada && {
          modelo: registrada.modelo,
          concluidaEm: registrada.concluida_em,
          itens: registrada.respostas.length,
          participantes: registrada.participantes.map((p) => ({
            usuarioId: p.usuario_id,
            nome: p.nome,
            funcao: p.funcao,
            assinaturaPath: p.assinatura_path,
            assinadaEm: p.assinada_em,
          })),
        }
      }
    />
  );
}
