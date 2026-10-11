import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ChecklistScreen } from "@/components/app/checklist/ChecklistScreen";
import { api, apiOuNulo, usuarioAtual } from "@/lib/api";
import type { Colega } from "@/lib/apr";
import { rotuloDaOs, type DetalheDaOs } from "@/lib/os-app";
import { rotas } from "@/lib/rotas";

export const metadata: Metadata = { title: "Checklist da APR" };

/** Checklist da APR. O rascunho (modelo, participantes, riscos e respostas) está no navegador; daqui vêm a OS e a equipe. */
export default async function ChecklistPage({ params }: PageProps<"/app/os/[id]/apr/checklist">) {
  const { id } = await params;
  const detalhe = await apiOuNulo<DetalheDaOs>(`/os/${id}`);
  if (!detalhe) notFound();
  const { os } = detalhe;
  if (os.status !== "liberada" && os.status !== "pendente") redirect(rotas.app.os(id));

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

  return <ChecklistScreen os={{ id: os.id, rotulo: rotuloDaOs(os), titulo: os.titulo, local: os.local_instalacao.codigo }} usuarioId={usuario.id} colegas={colegas} />;
}
