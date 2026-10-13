import type { Metadata } from "next";
import Link from "next/link";
import { ColunasLidas } from "@/components/web/importacao/ColunasLidas";
import { EntradasDeOs } from "@/components/web/importacao/EntradasDeOs";
import { ImportacoesAnteriores } from "@/components/web/importacao/ImportacoesAnteriores";
import type { Importacao, Sincronizacao } from "@/components/web/importacao/tipos";
import { AcessoRestrito } from "@/components/web/os/AcessoRestrito";
import { veImportacao } from "@/components/web/os/secao";
import { PainelPreventivas } from "@/components/web/preventivas/PainelPreventivas";
import { api, usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import { ehAdmin, type Paginacao } from "@/lib/tipos";

export const metadata: Metadata = { title: "Importação de OS" };

const TAMANHO_DO_HISTORICO = 20;

/**
 * Aba Importação: os métodos de entrada de OS, o intervalo das preventivas que entraram sem ele, as colunas lidas da
 * planilha e o histórico (os gráficos ficam no dashboard de OS, em Dashboard).
 */
export default async function ImportacaoPage({ searchParams }: PageProps<"/web/os/importacao">) {
  const { usuario } = await usuarioAtual();
  if (!veImportacao(usuario)) return <AcessoRestrito />;

  const pedida = (await searchParams).pagina;
  const pagina = Math.max(1, Number.parseInt((Array.isArray(pedida) ? pedida[0] : pedida) ?? "", 10) || 1);

  const [historico, sincronizacao] = await Promise.all([
    api<{ importacoes: Importacao[] } & Paginacao>("/importacoes", { consulta: { pagina, tamanho: TAMANHO_DO_HISTORICO } }),
    api<Sincronizacao>("/sap/sincronizacao"),
  ]);

  const ultimaPagina = Math.max(1, Math.ceil(historico.total / TAMANHO_DO_HISTORICO));

  // Falha de importação não fica presa na tela: vira alerta no sino de quem a iniciou e linha com erro no histórico.
  return (
    <>
      <span className="muted" style={{ fontSize: 14, maxWidth: 820 }}>
        Três formas de uma OS nova entrar no sistema: pela API, por arquivo ou pela câmera. OS novas entram como liberadas; as que já existem só têm o
        planejamento atualizado. Se uma importação falhar, nenhuma OS muda e o aviso chega nas notificações.
      </span>

      <section className="stack g12" aria-labelledby="metodos-t">
        <h2 id="metodos-t" className="secao-t">
          Métodos
        </h2>
        <EntradasDeOs
          ultimaLeituraEm={sincronizacao.ultima_leitura_sem_erro_em}
          automatica={sincronizacao.automatica}
          intervaloMin={sincronizacao.intervalo_min}
          ehAdmin={ehAdmin(usuario)}
        />
      </section>

      <section className="stack g12" aria-labelledby="preventivas-t">
        <div className="row between wrap g8" style={{ alignItems: "flex-end" }}>
          <div className="stack" style={{ gap: 2, maxWidth: 820 }}>
            <h2 id="preventivas-t" className="secao-t">
              Intervalo das preventivas
            </h2>
            <span className="muted">
              As OS preventivas entram com o plano de manutenção do SAP; o intervalo entre ciclos vem da coluna Intervalo (ou Periodicidade) da planilha, da
              Periodicidade do PDF ou é definido aqui. Com ele, o sistema conta o tempo até o próximo ciclo e avisa quando ele se aproxima ou vence: nenhuma OS é
              criada.
            </span>
          </div>
          <Link href={rotas.app.preventivas} style={{ fontSize: 14, fontWeight: 600 }}>
            Ver todas as preventivas
          </Link>
        </div>
        <PainelPreventivas fixa="sem_intervalo" vazio="Todas as preventivas importadas já têm o intervalo entre ciclos definido." />
      </section>

      <section className="stack g12" aria-labelledby="colunas-t">
        <div className="stack" style={{ gap: 2 }}>
          <h2 id="colunas-t" className="secao-t">
            Colunas lidas
          </h2>
          <span className="muted">O que o sistema lê da planilha exportada do SAP e do PDF da OS.</span>
        </div>
        <ColunasLidas />
      </section>

      <section className="stack g12" aria-labelledby="historico-t">
        <div className="stack" style={{ gap: 2 }}>
          <h2 id="historico-t" className="secao-t">
            Histórico
          </h2>
          <span className="muted">Sincronizações com a API e arquivos importados (planilha e PDF), do mais recente ao mais antigo.</span>
        </div>
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
      </section>
    </>
  );
}
