import type { Metadata } from "next";
import Link from "next/link";
import { ColunasLidas } from "@/components/web/importacao/ColunasLidas";
import { EntradasDeOs } from "@/components/web/importacao/EntradasDeOs";
import { ImportacoesAnteriores } from "@/components/web/importacao/ImportacoesAnteriores";
import type { Importacao, Sincronizacao } from "@/components/web/importacao/tipos";
import { AcessoRestrito } from "@/components/web/os/AcessoRestrito";
import { veImportacao } from "@/components/web/os/secao";
import { api, usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import type { Paginacao } from "@/lib/tipos";

export const metadata: Metadata = { title: "Importação de OS" };

const TAMANHO_DO_HISTORICO = 20;

/** Aba Importação: só os métodos de entrada de OS, as colunas lidas da planilha e o histórico (os gráficos ficam no dashboard de OS, em Indicadores e exportação). */
export default async function ImportacaoPage({ searchParams }: PageProps<"/web/os/importacao">) {
  const { usuario } = await usuarioAtual();
  if (!veImportacao(usuario.perfil)) return <AcessoRestrito />;

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
          ehAdmin={usuario.perfil === "admin"}
        />
      </section>

      <section className="stack g12" aria-labelledby="colunas-t">
        <div className="stack" style={{ gap: 2 }}>
          <h2 id="colunas-t" className="secao-t">
            Colunas lidas
          </h2>
          <span className="muted">O que o sistema lê da planilha exportada do SAP.</span>
        </div>
        <ColunasLidas />
      </section>

      <section className="stack g12" aria-labelledby="historico-t">
        <div className="stack" style={{ gap: 2 }}>
          <h2 id="historico-t" className="secao-t">
            Histórico
          </h2>
          <span className="muted">Sincronizações com a API e planilhas importadas, da mais recente à mais antiga.</span>
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
