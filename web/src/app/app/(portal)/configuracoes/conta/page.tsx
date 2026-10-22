import type { Metadata } from "next";
import { Colunas } from "@/components/app/AppChrome";
import { MinhaAssinatura } from "@/components/app/perfil/MinhaAssinatura";
import { PreferenciasDeEmail } from "@/components/app/perfil/PreferenciasDeEmail";
import { TrocarSenha } from "@/components/app/perfil/TrocarSenha";
import { OpcaoAnonimato } from "@/components/web/gamificacao/OpcaoAnonimato";
import { usuarioAtual } from "@/lib/api";
import { ehAdmin } from "@/lib/tipos";

export const metadata: Metadata = { title: "Configurações" };

/**
 * Minha conta: o que cada pessoa configura de si, o mesmo para todos os perfis. Antes ficava na coluna lateral do Perfil. A assinatura
 * (refazê-la vale só para as próximas ações), os e-mails que também vão para o e-mail institucional, a troca de senha e, para quem
 * executa e joga (o admin não joga), aparecer como anônimo no ranking.
 */
export default async function ConfiguracoesContaPage() {
  const { usuario, emails } = await usuarioAtual();
  const joga = !ehAdmin(usuario) && Boolean(usuario.gamificacao);
  return (
    <Colunas
      principal={
        <>
          {emails && <PreferenciasDeEmail perfil={usuario.perfil} inicial={emails} />}
          {joga && (
            <section className="stack g8" aria-labelledby="titulo-ranking" data-treino="cfg-ranking">
              <h2 id="titulo-ranking" style={{ fontSize: 16, fontWeight: 600 }}>
                Ranking
              </h2>
              <div className="card">
                <OpcaoAnonimato anonimo={usuario.ranking_anonimo ?? false} />
              </div>
            </section>
          )}
        </>
      }
      lateral={
        <>
          <MinhaAssinatura assinaturaPath={usuario.assinatura_path} assinaturaEm={usuario.assinatura_em} />
          <TrocarSenha />
        </>
      }
    />
  );
}
