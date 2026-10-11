import type { Metadata } from "next";
import { CabecalhoPagina, Colunas, PainelAcoes } from "@/components/app/AppChrome";
import { EtapasApr } from "@/components/app/nova-apr/EtapasApr";
import { IniciarChecklist } from "@/components/app/nova-apr/IniciarChecklist";
import { ModeloAprCard } from "@/components/app/nova-apr/ModeloAprCard";
import { OsDaAprCard } from "@/components/app/nova-apr/OsDaAprCard";
import { ParticipantesApr } from "@/components/app/nova-apr/ParticipantesApr";
import { Icon } from "@/components/ui/Icon";
import { Screen } from "@/components/ui/Screen";
import { rotas } from "@/lib/telas";

export const metadata: Metadata = { title: "Nova APR" };

export default function NovaAprPage() {
  return (
    <Screen>
      <CabecalhoPagina
        trilha={[
          { rotulo: "OS da equipe", href: rotas.app.lista },
          { rotulo: <span className="mono">OS 4031187</span>, href: rotas.app.detalhe },
          { rotulo: "Nova APR" },
        ]}
      >
        <h1>Nova APR</h1>
        <span className="muted">Etapa 1 de 3 · modelo, OS e participantes</span>
      </CabecalhoPagina>
      <EtapasApr />
      <Colunas
        principal={<ParticipantesApr />}
        lateral={
          <>
            <ModeloAprCard />
            <OsDaAprCard />
            <PainelAcoes>
              <div className="row g8" style={{ fontSize: 13, color: "var(--enc)" }}>
                <Icon name="check" size={16} />
                OS 4031187 · 2 participantes definidos
              </div>
              <IniciarChecklist />
            </PainelAcoes>
          </>
        }
      />
    </Screen>
  );
}
