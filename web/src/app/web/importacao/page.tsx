import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { AreaUpload } from "@/components/web/importacao/AreaUpload";
import { ColunasLidas } from "@/components/web/importacao/ColunasLidas";
import { FonteOs } from "@/components/web/importacao/FonteOs";
import { ImportacoesAnteriores } from "@/components/web/importacao/ImportacoesAnteriores";
import { OsManual } from "@/components/web/importacao/OsManual";
import type { Importacao } from "@/components/web/importacao/tipos";
import type { Atividade } from "@/components/web/os-nova/tipos";
import { api, usuarioAtual } from "@/lib/api";
import { dataHora, hoje } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import type { Equipe, Paginacao } from "@/lib/tipos";

export const metadata: Metadata = { title: "Importação SAP" };

const TAMANHO_DO_HISTORICO = 20;

export default async function ImportacaoPage({ searchParams }: PageProps<"/web/importacao">) {
  const { usuario } = await usuarioAtual();

  // A importação é do analista e do administrador; a `api` também recusa (403) os outros perfis.
  if (usuario.perfil !== "analista" && usuario.perfil !== "admin") {
    return (
      <Screen>
        <h1>Importação SAP</h1>
        <Notice tone="al" icon="lock" style={{ fontSize: 14.5 }}>
          Esta tela é do analista e do administrador. Você pode acompanhar as OS no <Link href={rotas.web.quadro}>quadro</Link>.
        </Notice>
      </Screen>
    );
  }

  const consulta = await searchParams;
  const paginaPedida = consulta.pagina;
  const pagina = Math.max(1, Number.parseInt((Array.isArray(paginaPedida) ? paginaPedida[0] : paginaPedida) ?? "", 10) || 1);

  const [historico, equipes, atividades] = await Promise.all([
    api<{ importacoes: Importacao[]; ultima_leitura_com_erro: boolean } & Paginacao>("/importacoes", { consulta: { pagina, tamanho: TAMANHO_DO_HISTORICO } }),
    api<{ equipes: Equipe[] }>("/equipes", { consulta: { tamanho: 200 } }),
    api<{ atividades: Atividade[] }>("/atividades", { consulta: { tamanho: 200 } }),
  ]);

  // A leitura mais recente pela API e a última que terminou sem erro (o histórico vem do mais novo ao mais antigo).
  const leiturasDaApi = historico.importacoes.filter((i) => i.origem === "api");
  const falha = historico.ultima_leitura_com_erro ? leiturasDaApi[0] : undefined;
  const ultimaSemErro = leiturasDaApi.find((i) => i.erro === null);
  const ultimaPagina = Math.max(1, Math.ceil(historico.total / TAMANHO_DO_HISTORICO));

  return (
    <Screen>
      <div className="stack g4">
        <h1>Importação SAP</h1>
        <span className="muted" style={{ fontSize: 14, maxWidth: 760 }}>
          As OS chegam pela API do SAP, lida a cada poucos minutos. Se preferir, envie a planilha exportada. OS novas entram como liberadas; as que já existem só têm o planejamento atualizado.
        </span>
      </div>
      {historico.ultima_leitura_com_erro && (
        <Notice tone="blq" icon="alert" style={{ fontSize: 14.5 }}>
          <strong>Falha na leitura do SAP.</strong>{" "}
          {falha?.erro ? `${falha.erro} ` : ""}
          {falha ? `(${dataHora(falha.criada_em)}) ` : ""}
          As OS não foram atualizadas por essa leitura: tente &ldquo;Ler agora&rdquo; ou envie a planilha.
        </Notice>
      )}
      <div className="two">
        <div className="stack g16">
          <FonteOs ultimaLeituraEm={ultimaSemErro?.criada_em ?? null} comErro={historico.ultima_leitura_com_erro} />
          <AreaUpload podeCadastrarEquipe={usuario.perfil === "admin"} />
          <ImportacoesAnteriores importacoes={historico.importacoes} />
          {ultimaPagina > 1 && (
            <div className="row between small">
              {pagina > 1 ? <Link href={`${rotas.web.importacao}?pagina=${pagina - 1}`}>Anteriores</Link> : <span />}
              <span>
                Página {pagina} de {ultimaPagina}
              </span>
              {pagina < ultimaPagina ? <Link href={`${rotas.web.importacao}?pagina=${pagina + 1}`}>Próximas</Link> : <span />}
            </div>
          )}
        </div>
        <aside className="stack g16">
          <ColunasLidas />
          <OsManual equipes={equipes.equipes} atividades={atividades.atividades} hoje={hoje()} />
        </aside>
      </div>
    </Screen>
  );
}
