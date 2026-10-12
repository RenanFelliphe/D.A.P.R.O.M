import type { Alerta } from "@/components/web/alertas/tipos";
import { Icon } from "@/components/ui/Icon";
import { BuscaBarra } from "./BuscaBarra";
import { SeloTreino } from "@/components/treino/SeloTreino";
import { MenuUsuario } from "./MenuUsuario";
import { SinoAlertas } from "./SinoAlertas";

export interface UsuarioDaBarra {
  iniciais: string;
  nome: string;
  cargo: string;
}

function Marca({ subtitulo }: { subtitulo: string }) {
  return (
    <div className="brand">
      <span className="logo">
        <Icon name="shield" size={18} />
      </span>
      <span className="brand-txt">
        D.A.P.R.O.M
        <small>{subtitulo}</small>
      </span>
    </div>
  );
}

interface BarraProps {
  usuario: UsuarioDaBarra;
  /** Texto abaixo da marca: o papel de quem está usando. */
  subtitulo: string;
  /** Alertas das equipes (admin e supervisor); sem isso o sino não aparece. */
  alertas?: { naoLidos: number; recentes: Alerta[] };
  /** Campo de treino: troca a situação da conexão pelo selo do treino. */
  treino?: boolean;
  /** Técnico pendente fora do treino: a busca global é da `api` real e ele ainda não pode usá-la. */
  semBusca?: boolean;
}

/** Barra superior das áreas logadas: marca, busca global e, à direita, o que cada papel usa (alertas, conexão ou treino) e o usuário. */
export function Barra({ usuario, subtitulo, alertas, treino, semBusca }: BarraProps) {
  return (
    <header className="topbar">
      <Marca subtitulo={subtitulo} />
      {semBusca ? <div className="grow" /> : <BuscaBarra />}
      <div className="right">
        {treino ? (
          <SeloTreino />
        ) : alertas ? (
          <SinoAlertas naoLidos={alertas.naoLidos} recentes={alertas.recentes} />
        ) : (
          <span className="net on">
            <Icon name="check" size={16} />
            Online
          </span>
        )}
        <MenuUsuario {...usuario} />
      </div>
    </header>
  );
}
