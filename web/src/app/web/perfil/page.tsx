import type { Metadata } from "next";
import { CabecalhoPagina, Colunas } from "@/components/app/AppChrome";
import { MinhaAssinatura } from "@/components/app/perfil/MinhaAssinatura";
import { TrocarSenha } from "@/components/app/perfil/TrocarSenha";
import { Screen } from "@/components/ui/Screen";
import { usuarioAtual } from "@/lib/api";
import { data } from "@/lib/formatar";
import { rotuloDoPerfil } from "@/lib/tipos";

export const metadata: Metadata = { title: "Perfil" };

/** Perfil de quem usa o painel (admin, ou supervisor): os próprios dados, a assinatura e a troca de senha. */
export default async function PerfilGestaoPage() {
  const { usuario, equipe } = await usuarioAtual();
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
        </span>
      </CabecalhoPagina>
      <Colunas
        principal={
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
