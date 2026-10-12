import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TelaAguardando } from "@/components/aguardando/TelaAguardando";
import { Screen } from "@/components/ui/Screen";
import { inicioDoUsuario } from "@/lib/inicio";
import { rotas } from "@/lib/rotas";
import { usuarioRealAgora } from "@/lib/situacao-real";
import { estaPendente, foiRecusado } from "@/lib/tipos";
import { emTreino } from "@/lib/treino-modo";

export const metadata: Metadata = { title: "Aguardando liberação" };

/**
 * Tela de espera do técnico cadastrado por supervisor. Lê só o `/me` real (liberado para o pendente) e não chama mais nada, então
 * nunca esbarra em `403 aguardando_liberacao`; é também o destino que a casca do técnico usa para quem ainda está pendente.
 */
export default async function AguardandoPage() {
  const [{ usuario, equipe }, treino] = await Promise.all([usuarioRealAgora(), emTreino()]);
  if (foiRecusado(usuario)) redirect(rotas.app.entrar);
  const liberado = !estaPendente(usuario);
  // Fora do treino quem já foi liberado segue para o início do papel; no treino a pessoa decide quando sair.
  if (liberado && !treino) redirect(inicioDoUsuario(usuario));

  return (
    <Screen>
      <TelaAguardando liberado={liberado} emTreino={treino} equipe={equipe?.nome ?? null} criadoPor={usuario.criado_por_nome ?? null} criadoEm={usuario.criado_em ?? null} />
    </Screen>
  );
}
