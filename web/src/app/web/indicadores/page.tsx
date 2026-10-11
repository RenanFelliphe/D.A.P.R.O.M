import type { Metadata } from "next";
import { Screen } from "@/components/ui/Screen";
import { CabecalhoIndicadores } from "@/components/web/indicadores/CabecalhoIndicadores";
import { ExportacaoSap } from "@/components/web/indicadores/ExportacaoSap";
import { KpisIndicadores } from "@/components/web/indicadores/KpisIndicadores";
import { SituacaoPorEquipe } from "@/components/web/indicadores/SituacaoPorEquipe";
import { TempoExecucao } from "@/components/web/indicadores/TempoExecucao";
import { carregarIndicadores, carregarPreviaDaExportacao } from "@/data/indicadores-carga";
import { listarEquipes, mesesDoSeletor, rotuloDoMes } from "@/data/quadro";
import { usuarioAtual } from "@/lib/api";
import { hoje, hora } from "@/lib/formatar";

export const metadata: Metadata = { title: "Indicadores e exportação" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function IndicadoresPage({ searchParams }: PageProps<"/web/indicadores">) {
  const sp = await searchParams;
  const um = (chave: string) => {
    const v = sp[chave];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  const mesAtual = hoje().slice(0, 7);
  const mesPedido = um("mes");
  const mes = mesPedido && /^\d{4}-(0[1-9]|1[0-2])$/.test(mesPedido) ? mesPedido : mesAtual;
  const equipePedida = um("equipe_id");

  const { usuario, equipe } = await usuarioAtual();
  const ehSupervisor = usuario.perfil === "supervisor";
  const podeExportar = usuario.perfil === "analista" || usuario.perfil === "admin";
  const equipeId = !ehSupervisor && equipePedida && UUID.test(equipePedida) ? equipePedida : undefined;

  const [equipes, [indicadoresDoMes, tempo], previa] = await Promise.all([
    ehSupervisor ? Promise.resolve(null) : listarEquipes(),
    carregarIndicadores(mes, equipeId),
    podeExportar ? carregarPreviaDaExportacao() : Promise.resolve(null),
  ]);

  const nomeDaEquipe = ehSupervisor ? equipe?.nome : equipes?.find((e) => e.id === equipeId)?.nome;
  const rotulo = rotuloDoMes(mes);
  const subtitulo = [rotulo, nomeDaEquipe ?? "todas as equipes", `atualizado às ${hora(new Date())}`].join(" · ");

  return (
    <Screen>
      <CabecalhoIndicadores subtitulo={subtitulo} mes={mes} meses={mesesDoSeletor(mesAtual, mes)} equipeId={equipeId} equipes={equipes} />
      <KpisIndicadores mes={indicadoresDoMes} tempo={tempo} />
      <SituacaoPorEquipe mes={indicadoresDoMes} rotuloDoMes={rotulo} />
      <TempoExecucao tempo={tempo} rotuloDoMes={rotulo} />
      {previa && <ExportacaoSap total={previa.total} os={previa.os} />}
    </Screen>
  );
}
