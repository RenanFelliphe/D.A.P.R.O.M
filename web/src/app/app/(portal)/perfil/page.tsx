import type { Metadata } from "next";
import { CabecalhoPagina, Colunas } from "@/components/app/AppChrome";
import { LinhaHistorico, type ExecucaoDoHistorico } from "@/components/app/perfil/LinhaHistorico";
import { MinhaAssinatura } from "@/components/app/perfil/MinhaAssinatura";
import { TrocarSenha } from "@/components/app/perfil/TrocarSenha";
import { Screen } from "@/components/ui/Screen";
import { CartaoDaMinhaPontuacao } from "@/components/web/gamificacao/BlocosDoPerfil";
import { api, usuarioAtual } from "@/lib/api";
import { data } from "@/lib/formatar";
import { ehAdmin, rotuloDoPerfil } from "@/lib/tipos";

export const metadata: Metadata = { title: "Perfil" };

/**
 * Perfil de quem está logado: um endereço só para admin, supervisor e técnico. Todos veem os próprios dados, a assinatura e a
 * troca de senha; quem executa OS (técnico e supervisor) vê também as OS que encerrou nos últimos 60 dias, que o admin não tem.
 */
export default async function PerfilPage() {
  const { usuario, equipe } = await usuarioAtual();
  const executa = !ehAdmin(usuario);
  const historico = executa ? (await api<{ execucoes: ExecucaoDoHistorico[] }>("/me/historico")).execucoes : null;
  const supervisao = usuario.equipes_supervisionadas?.map((e) => e.nome).join(", ");

  const dados: [string, string | null][] = [
    ["Nome", usuario.nome],
    ["E-mail", usuario.email ?? null],
    ["Matrícula", usuario.matricula],
    ["Cargo", usuario.cargo],
    ["Registro profissional", usuario.registro_profissional],
    ["Perfil", rotuloDoPerfil[usuario.perfil]],
    ["Equipe", equipe?.nome ?? null],
    ["Supervisiona", supervisao || null],
    ["Cadastro", usuario.criado_em ? data(usuario.criado_em) : null],
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
              <span className="muted small">Para alterar nome, e-mail ou cargo, peça a um administrador.</span>
            </section>
            {historico && (
              <section className="stack g8" data-treino="perfil-historico">
                <h2>OS que encerrei nos últimos 60 dias</h2>
                {historico.length === 0 ? (
                  <div className="card muted">Nenhuma OS encerrada por você nos últimos 60 dias.</div>
                ) : (
                  <div className="list-box">
                    {historico.map((execucao) => (
                      <LinhaHistorico key={execucao.id} execucao={execucao} />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        }
        lateral={
          <>
            {executa && usuario.gamificacao && <CartaoDaMinhaPontuacao resumo={usuario.gamificacao} anonimo={usuario.ranking_anonimo ?? false} />}
            <MinhaAssinatura assinaturaPath={usuario.assinatura_path} assinaturaEm={usuario.assinatura_em} />
            <TrocarSenha />
          </>
        }
      />
    </Screen>
  );
}
