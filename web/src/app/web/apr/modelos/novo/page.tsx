import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { FormularioNovoModelo } from "@/components/web/apr/FormularioNovoModelo";
import { editaModelos } from "@/components/web/apr/secao";
import { agruparModelos, proximoCodigo, type ResumoModelo } from "@/data/modelos";
import { api, usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";

export const metadata: Metadata = { title: "Novo modelo de APR" };

/** Cadastro de um modelo de APR novo (Segurança do Trabalho e admin): nasce como rascunho e segue para o editor. */
export default async function NovoModeloPage() {
  const { usuario } = await usuarioAtual();
  const cabecalho = (
    <>
      <div className="crumb">
        <Link href={rotas.web.modelos} style={{ fontWeight: 500 }}>
          APR
        </Link>{" "}
        / <span>Novo modelo</span>
      </div>
      <div className="stack g4">
        <h1>Novo modelo de APR</h1>
        <span className="muted" style={{ fontSize: 14, maxWidth: 760 }}>
          Para um documento de APR que a Segurança do Trabalho criou. Se o documento só mudou de revisão, abra o modelo e crie uma nova versão.
        </span>
      </div>
    </>
  );

  if (!editaModelos(usuario.perfil)) {
    return (
      <Screen>
        {cabecalho}
        <Notice tone="al" icon="lock" style={{ fontSize: 14.5 }}>
          Só a Segurança do Trabalho e o administrador cadastram modelos. Você pode consultar os existentes na <Link href={rotas.web.modelos}>aba Modelos</Link>.
        </Notice>
      </Screen>
    );
  }

  // Todos os códigos, inclusive rascunhos e excluídos: nenhum deles pode ser reaproveitado.
  const [ativos, arquivados] = await Promise.all([
    api<{ modelos: ResumoModelo[] }>("/modelos-apr", { consulta: { tamanho: 200 } }),
    api<{ modelos: ResumoModelo[] }>("/modelos-apr", { consulta: { arquivados: true, tamanho: 200 } }),
  ]);
  const grupos = agruparModelos(ativos.modelos);
  const existentes = [
    ...grupos.map((g) => ({ codigo: g.codigo, excluido: false })),
    ...agruparModelos(arquivados.modelos).map((g) => ({ codigo: g.codigo, excluido: true })),
  ];
  const publicados = grupos.filter((g) => g.emUso).map((g) => ({ codigo: g.codigo, titulo: g.titulo }));

  return (
    <Screen>
      {cabecalho}
      <FormularioNovoModelo sugestao={proximoCodigo(existentes.map((e) => e.codigo))} existentes={existentes} modelos={publicados} />
    </Screen>
  );
}
