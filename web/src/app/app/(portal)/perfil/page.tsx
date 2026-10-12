import type { Metadata } from "next";
import { CabecalhoPagina, Colunas } from "@/components/app/AppChrome";
import { LinhaHistorico, type ExecucaoDoHistorico } from "@/components/app/perfil/LinhaHistorico";
import { MinhaAssinatura } from "@/components/app/perfil/MinhaAssinatura";
import { TrocarSenha } from "@/components/app/perfil/TrocarSenha";
import { Screen } from "@/components/ui/Screen";
import { api, usuarioAtual } from "@/lib/api";
import { rotuloDoPerfil } from "@/lib/tipos";

export const metadata: Metadata = { title: "Perfil e histórico" };

export default async function PerfilPage() {
  const [{ usuario, equipe }, { execucoes }] = await Promise.all([usuarioAtual(), api<{ execucoes: ExecucaoDoHistorico[] }>("/me/historico")]);

  const dados: [string, string | null][] = [
    ["Nome", usuario.nome],
    ["E-mail", usuario.email ?? null],
    ["Matrícula", usuario.matricula],
    ["Cargo", usuario.cargo],
    ["Registro profissional", usuario.registro_profissional],
    ["Equipe", equipe?.nome ?? null],
    ["Perfil", rotuloDoPerfil[usuario.perfil]],
  ];

  return (
    <Screen>
      <CabecalhoPagina>
        <h1>Perfil</h1>
        <span className="muted">
          {usuario.nome} · mat. {usuario.matricula}
          {equipe ? ` · ${equipe.nome}` : ""}
        </span>
      </CabecalhoPagina>
      <Colunas
        principal={
          <>
            <section className="stack g8">
              <h2>Meus dados</h2>
              <div className="card">
                <div className="stat-grid">
                  {dados.map(([rotulo, valor]) => (
                    <div key={rotulo} className="stack" style={{ gap: 2 }}>
                      <span className="lbl">{rotulo}</span>
                      <strong>{valor || "—"}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </section>
            <section className="stack g8">
              <h2>OS que encerrei nos últimos 60 dias</h2>
              {execucoes.length === 0 ? (
                <div className="card muted">Nenhuma OS encerrada por você nos últimos 60 dias.</div>
              ) : (
                <div className="list-box">
                  {execucoes.map((execucao) => (
                    <LinhaHistorico key={execucao.id} execucao={execucao} />
                  ))}
                </div>
              )}
            </section>
          </>
        }
        lateral={
          <>
            <MinhaAssinatura assinaturaPath={usuario.assinatura_path} assinaturaEm={usuario.assinatura_em} />
            <TrocarSenha />
          </>
        }
      />
    </Screen>
  );
}
