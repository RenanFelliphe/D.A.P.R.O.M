import type { Alerta } from "@/components/web/alertas/tipos";
import { Icon } from "@/components/ui/Icon";
import { sair } from "@/lib/acoes-sessao";
import { BuscaBarra } from "./BuscaBarra";
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

function Usuario({ iniciais, nome, cargo }: UsuarioDaBarra) {
  return (
    <div className="who-u">
      <span className="av">{iniciais}</span>
      <span>
        <strong>{nome}</strong>
        <small>{cargo}</small>
      </span>
      <form action={sair}>
        <button className="btn btn-ghost btn-sm" type="submit" title="Sair deste navegador">
          Sair
        </button>
      </form>
    </div>
  );
}

/** Barra superior do painel de gestão: marca, busca global, alertas e usuário. */
export function BarraGestao({
  usuario,
  naoLidos,
  recentes,
}: {
  usuario: UsuarioDaBarra;
  naoLidos: number;
  recentes: Alerta[];
}) {
  return (
    <header className="topbar">
      <Marca subtitulo="Painel de gestão" />
      <BuscaBarra area="web" />
      <div className="right">
        <SinoAlertas naoLidos={naoLidos} recentes={recentes} />
        <MenuUsuario {...usuario} />
      </div>
    </header>
  );
}

/** Barra superior da área do técnico: marca, busca global, situação da conexão e usuário. */
export function BarraTecnico({ usuario }: { usuario: UsuarioDaBarra }) {
  return (
    <header className="topbar">
      <Marca subtitulo="Técnico em campo" />
      <BuscaBarra area="app" />
      <div className="right">
        <span className="net on">
          <Icon name="check" size={16} />
          Online
        </span>
        <Usuario {...usuario} />
      </div>
    </header>
  );
}
