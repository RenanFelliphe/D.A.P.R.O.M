"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { perfisWeb, rotas, tecnicoLogado, telaPorPathname } from "@/lib/telas";
import { useAlertas } from "@/state/alertas";
import { useSincronizacao } from "@/state/sincronizacao";

function Marca({ subtitulo }: { subtitulo: string }) {
  return (
    <div className="brand">
      <span className="logo">
        <Icon name="shield" size={18} />
      </span>
      D.A.P.R.O.M <small>{subtitulo}</small>
    </div>
  );
}

function Usuario({ iniciais, nome, cargo }: { iniciais: string; nome: string; cargo: string }) {
  return (
    <div className="who-u">
      <span className="av">{iniciais}</span>
      <span>
        <strong>{nome}</strong>
        <small>{cargo}</small>
      </span>
    </div>
  );
}

/** Barra superior do painel de gestão: marca, busca por ordem, alertas e usuário. */
export function BarraGestao() {
  const perfil = perfisWeb[telaPorPathname(usePathname())?.perfil ?? "sup"];
  const { naoLidos } = useAlertas();
  return (
    <header className="topbar">
      <Marca subtitulo="Painel de gestão" />
      <div className="searchbox">
        <Icon name="search" />
        <label className="sr" htmlFor="busca">
          Buscar pelo número da ordem
        </label>
        <input id="busca" type="search" placeholder="Buscar nº da ordem" />
      </div>
      <div className="right">
        <Link className="bell" href={rotas.web.alertas} aria-label="Alertas">
          <Icon name="bell" size={18} />
          {naoLidos > 0 && <b>{naoLidos}</b>}
        </Link>
        <Usuario {...perfil} />
      </div>
    </header>
  );
}

/** Barra superior da área do técnico: marca, situação do sinal e usuário. */
export function BarraTecnico() {
  const { estado } = useSincronizacao();
  const sincronizado = estado.situacao === "concluida";
  return (
    <header className="topbar">
      <Marca subtitulo="Técnico em campo" />
      <div className="right">
        <Link className={sincronizado ? "net on" : "net off"} href={rotas.app.sync}>
          <Icon name={sincronizado ? "check" : "wifioff"} size={16} />
          {sincronizado ? "Sincronizado" : "Offline"}
        </Link>
        <Usuario {...tecnicoLogado} />
      </div>
    </header>
  );
}
