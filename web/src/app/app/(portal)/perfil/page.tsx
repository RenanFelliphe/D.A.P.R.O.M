import type { Metadata } from "next";
import { CabecalhoPagina, Colunas } from "@/components/app/AppChrome";
import { MinhasAusencias } from "@/components/ausencia/MinhasAusencias";
import { LinhaHistorico, type ExecucaoDoHistorico } from "@/components/app/perfil/LinhaHistorico";
import { MinhaAssinatura } from "@/components/app/perfil/MinhaAssinatura";
import { TrocarSenha } from "@/components/app/perfil/TrocarSenha";
import { Screen } from "@/components/ui/Screen";
import { CartaoDaMinhaPontuacao } from "@/components/web/gamificacao/BlocosDoPerfil";
import { api, apiOuNulo, usuarioAtual } from "@/lib/api";
import type { Ausencia } from "@/lib/ausencia";
import { data } from "@/lib/formatar";
import { ehAdmin, ehSupervisor, rotuloDoPerfil } from "@/lib/tipos";

export const metadata: Metadata = { title: "Perfil" };

/**
 * Perfil de quem está logado: um endereço só para admin, supervisor e técnico. Todos veem os próprios dados, a assinatura e a
 * troca de senha; quem executa OS (técnico e supervisor) vê também as ausências (pedir, confirmar, pedir o fim antecipado) e as OS que
 * encerrou nos últimos 60 dias, que o admin não tem.
 */
export default async function PerfilPage() {
  const { usuario, equipe, ausencia } = await usuarioAtual();
  const executa = !ehAdmin(usuario);
  const historico = executa ? (await api<{ execucoes: ExecucaoDoHistorico[] }>("/me/historico")).execucoes : null;
  // As minhas ausências; no campo de treino a rota não existe (404) e a seção não aparece.
  const ausencias = executa ? (await apiOuNulo<{ ausencias: Ausencia[] }>("/ausencias", { consulta: { usuario_id: usuario.id, tamanho: 50 } }))?.ausencias ?? null : null;
  const supervisor = ehSupervisor(usuario);
  // O técnico pede ao supervisor da equipe: sem equipe, ou numa equipe sem supervisor, não há a quem pedir.
  const motivoSemPedido = supervisor ? null : !equipe ? "Você não está em uma equipe: não há supervisor para responder ao pedido." : !equipe.supervisor_id ? "A sua equipe está sem supervisor: não há quem responda ao pedido de ausência." : null;
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
            {ausencias && (
              <MinhasAusencias
                ausencias={ausencias}
                eu={{ id: usuario.id, nome: usuario.nome, assinaturaPath: usuario.assinatura_path, ausente: Boolean(ausencia) }}
                modo={supervisor ? "registrar" : "pedir"}
                motivoSemPedido={motivoSemPedido}
              />
            )}
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
