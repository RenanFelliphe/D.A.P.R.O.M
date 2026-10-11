import type { Metadata } from "next";
import { CabecalhoPagina, Colunas } from "@/components/app/AppChrome";
import { LinhaHistorico } from "@/components/app/perfil/LinhaHistorico";
import { MinhaAssinatura } from "@/components/app/perfil/MinhaAssinatura";
import { Screen } from "@/components/ui/Screen";
import { historicoOs } from "@/data/perfil";

export const metadata: Metadata = { title: "Perfil e histórico" };

export default function PerfilPage() {
  return (
    <Screen>
      <CabecalhoPagina>
        <h1>Perfil</h1>
        <span className="muted">Carlos Menezes · mat. 10482 · Serviços Especiais</span>
      </CabecalhoPagina>
      <Colunas
        principal={
          <section className="stack g8">
            <h2>Histórico de OS</h2>
            <div className="list-box">
              {historicoOs.map((os) => (
                <LinhaHistorico key={os.numero} os={os} />
              ))}
            </div>
          </section>
        }
        lateral={<MinhaAssinatura />}
      />
    </Screen>
  );
}
