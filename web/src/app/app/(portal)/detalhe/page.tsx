import type { Metadata } from "next";
import { CabecalhoPagina, Colunas, PainelAcoes } from "@/components/app/AppChrome";
import { AprExigidaCard } from "@/components/app/detalhe/AprExigidaCard";
import { DadosSapCard } from "@/components/app/detalhe/DadosSapCard";
import { InstrucoesCard } from "@/components/app/detalhe/InstrucoesCard";
import { LocalCard } from "@/components/app/detalhe/LocalCard";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { rotas } from "@/lib/telas";

export const metadata: Metadata = { title: "Detalhe da OS" };

export default function DetalhePage() {
  return (
    <Screen>
      <CabecalhoPagina
        trilha={[{ rotulo: "OS da equipe", href: rotas.app.lista }, { rotulo: <span className="mono">OS 4031187</span> }]}
      >
        <div className="row wrap g8">
          <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
            OS 4031187
          </span>
          <Badge tone="lib">Liberada</Badge>
          <Badge tone="neu">Preventiva · YBA2</Badge>
          <Badge tone="neu">Prioridade muito alta</Badge>
          <Badge tone="crit">Local crítico</Badge>
        </div>
        <h1>Inspeção de corrosão em válvulas da ERP</h1>
      </CabecalhoPagina>
      <Colunas
        principal={
          <>
            <LocalCard />
            <DadosSapCard />
            <InstrucoesCard />
          </>
        }
        lateral={
          <>
            <AprExigidaCard />
            <PainelAcoes>
              <div className="row g8 small">
                <Icon name="lock" size={16} />
                A execução só é liberada depois da APR aprovada.
              </div>
              <LinkButton variant="p" block href={rotas.app.novaApr}>
                Iniciar APR
              </LinkButton>
            </PainelAcoes>
          </>
        }
      />
    </Screen>
  );
}
