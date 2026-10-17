import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { rotas } from "@/lib/rotas";
import { AbasSecao, type AbaDaSecao } from "@/components/web/AbasSecao";

/** As telas dos sistemas simulados: o registro de funcionários (RH) e as ordens do SAP. */
export const abasDoSimulador: AbaDaSecao[] = [
  { href: rotas.simulador.funcionarios, rotulo: "Funcionários", icone: "users" },
  { href: rotas.simulador.ordens, rotulo: "Ordens do SAP", icone: "list" },
];

/**
 * Cabeçalho próprio da área dos sistemas simulados, fora da casca do SYNC OS: é o que a empresa teria do lado dela (o RH e o
 * SAP), com o visual de outro sistema e um link de volta ao SYNC OS.
 */
export function CabecalhoSimulador({ abas = abasDoSimulador }: { abas?: AbaDaSecao[] }) {
  return (
    <header className="sim-cab">
      <div className="sim-cab-topo">
        <span className="sim-marca">
          <Icon name="grid" size={18} />
          Sistemas da empresa · simulados
        </span>
        <Link className="sim-voltar" href={rotas.app.lista}>
          <Icon name="left" size={16} />
          Voltar ao SYNC OS
        </Link>
      </div>
      <div className="sim-cab-abas">
        <AbasSecao rotulo="Sistemas simulados" abas={abas} />
      </div>
    </header>
  );
}
