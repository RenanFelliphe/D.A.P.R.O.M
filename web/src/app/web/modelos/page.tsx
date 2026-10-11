import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { EditorModelo } from "@/components/web/modelos/EditorModelo";
import { ListaModelos, agruparModelos } from "@/components/web/modelos/ListaModelos";
import { TabelaAtividades } from "@/components/web/modelos/TabelaAtividades";
import { VersoesModelo } from "@/components/web/modelos/VersoesModelo";
import { VisaoModelo } from "@/components/web/modelos/VisaoModelo";
import type { Atividade, ModeloCompleto, ResumoModelo } from "@/data/modelos";
import { api, apiOuNulo, usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import type { Paginacao } from "@/lib/tipos";

export const metadata: Metadata = { title: "Modelos de APR" };

const um = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);
const TAMANHO_ATIVIDADES = 50;

/**
 * Modelos de APR (versões, editor do rascunho) e a tabela de atividades → modelo. Todo perfil de gestão lê; só a Segurança do
 * Trabalho edita (a `api` recusa os demais com `403`), então os outros veem tudo em leitura.
 */
export default async function ModelosPage({ searchParams }: PageProps<"/web/modelos">) {
  const params = await searchParams;
  const { usuario } = await usuarioAtual();
  const podeEditar = usuario.perfil === "seguranca";
  const aba = um(params.aba) === "atividades" ? "atividades" : "modelos";

  return (
    <Screen>
      <div className="stack g4">
        <h1>Modelos de APR</h1>
        <span className="muted" style={{ fontSize: 14, maxWidth: 820 }}>
          Cada publicação gera uma versão nova. As APRs já preenchidas continuam ligadas à versão que usaram, inclusive as feitas sem sinal.
          {podeEditar ? "" : " Só a Segurança do Trabalho edita os modelos e a tabela de atividades."}
        </span>
      </div>
      <nav className="abas" aria-label="Modelos e atividades">
        <Link href={rotas.web.modelos} aria-current={aba === "modelos" ? "page" : undefined}>
          Modelos
        </Link>
        <Link href={`${rotas.web.modelos}?aba=atividades`} aria-current={aba === "atividades" ? "page" : undefined}>
          Tabela de atividades
        </Link>
      </nav>
      {aba === "modelos" ? <AbaModelos codigo={um(params.codigo)} versao={um(params.versao)} podeEditar={podeEditar} /> : <AbaAtividades params={params} podeEditar={podeEditar} />}
    </Screen>
  );
}

async function AbaModelos({ codigo, versao, podeEditar }: { codigo?: string; versao?: string; podeEditar: boolean }) {
  const { modelos } = await api<{ modelos: ResumoModelo[] }>("/modelos-apr", { consulta: { tamanho: 200 } });
  const grupos = agruparModelos(modelos);
  const grupo = grupos.find((g) => g.codigo === codigo) ?? grupos[0];
  if (!grupo) return <p className="muted">Nenhum modelo de APR cadastrado.</p>;

  const rascunho = grupo.versoes.find((v) => v.rascunho);
  const emUso = grupo.versoes.find((v) => !v.rascunho);
  const escolhida = grupo.versoes.find((v) => String(v.versao) === versao) ?? rascunho ?? emUso ?? grupo.versoes[0]!;
  const modelo = await apiOuNulo<ModeloCompleto>(`/modelos-apr/${encodeURIComponent(grupo.codigo)}/versoes/${escolhida.versao}`);

  return (
    <div className="two" style={{ gridTemplateColumns: "270px 1fr" }}>
      <div className="stack g16">
        <ListaModelos grupos={grupos} atual={grupo.codigo} />
        <VersoesModelo codigo={grupo.codigo} versoes={grupo.versoes} atual={escolhida.versao} />
      </div>
      <div className="stack g16">
        {podeEditar && (
          <Notice tone="al" icon="info">
            O critério de bloqueio da carga inicial (quais itens são eliminatórios e qual resposta bloqueia) é provisório até a Segurança do Trabalho validar. Ajuste
            criando uma nova versão e publicando.
          </Notice>
        )}
        {!modelo ? (
          <Notice tone="blq" icon="alert">
            Modelo ou versão não encontrado.
          </Notice>
        ) : podeEditar && modelo.rascunho ? (
          <EditorModelo key={modelo.id} modelo={modelo} />
        ) : (
          <VisaoModelo modelo={modelo} podeEditar={podeEditar} rascunho={rascunho?.versao} emUso={emUso?.versao === modelo.versao} />
        )}
      </div>
    </div>
  );
}

async function AbaAtividades({ params, podeEditar }: { params: Record<string, string | string[] | undefined>; podeEditar: boolean }) {
  const busca = um(params.busca)?.trim() || undefined;
  const semModelo = um(params.sem_modelo) === "true";
  const pagina = Math.max(1, Number.parseInt(um(params.pagina) ?? "1", 10) || 1);

  const [lista, publicados] = await Promise.all([
    api<{ atividades: Atividade[] } & Paginacao>("/atividades", {
      consulta: { busca, sem_modelo: semModelo ? true : undefined, pagina, tamanho: TAMANHO_ATIVIDADES },
    }),
    api<{ modelos: ResumoModelo[] }>("/modelos-apr", { consulta: { publicados: true, tamanho: 200 } }),
  ]);
  const codigos = [...new Set(publicados.modelos.map((m) => m.codigo))].sort();

  return (
    <TabelaAtividades
      atividades={lista.atividades}
      pagina={lista.pagina}
      tamanho={lista.tamanho}
      total={lista.total}
      busca={busca}
      semModelo={semModelo}
      modelos={codigos}
      podeEditar={podeEditar}
    />
  );
}
