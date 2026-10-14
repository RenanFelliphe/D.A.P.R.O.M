import { redirect } from "next/navigation";
import { CabecalhoSimulador } from "@/components/simulador/CabecalhoSimulador";
import { usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import { ehAdmin } from "@/lib/tipos";

/**
 * Os sistemas da empresa que o DAPROM só lê e que são simulados (registro de funcionários e, em seguida, as ordens do SAP): fora da
 * casca do DAPROM, com cabeçalho próprio, e só para o administrador. Quem não é admin volta para a lista de OS.
 */
export default async function SimuladorLayout({ children }: LayoutProps<"/simulador">) {
  const { usuario } = await usuarioAtual();
  if (!ehAdmin(usuario)) redirect(rotas.app.lista);
  return (
    <div className="sim-raiz">
      <CabecalhoSimulador />
      <main className="sim-main">{children}</main>
    </div>
  );
}
