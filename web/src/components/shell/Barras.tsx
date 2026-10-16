import Link from "next/link";
import type { Alerta } from "@/components/web/alertas/tipos";
import { Icon } from "@/components/ui/Icon";
import { SeloPatente } from "@/components/web/gamificacao/SeloPatente";
import { numero, type ResumoDaBarra } from "@/lib/gamificacao";
import { rotas } from "@/lib/rotas";
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
  /** Os alertas de quem está logado (os das equipes, para o admin e o supervisor; os da própria ausência, para o técnico); sem isso o sino não aparece. */
  alertas?: { naoLidos: number; recentes: Alerta[]; /** Quem acompanha os alertas da gestão abre a tela de alertas. */ gestao: boolean };
  /** Campo de treino: troca a situação da conexão pelo selo do treino. */
  treino?: boolean;
  /** Técnico pendente fora do treino: a busca global é da `api` real e ele ainda não pode usá-la. */
  semBusca?: boolean;
  /** A patente e os pontos da temporada de quem joga (técnico, fora do treino): o selo leva a "Minha pontuação". */
  gamificacao?: ResumoDaBarra;
}

/** Barra superior das áreas logadas: marca, busca global e, à direita, o que cada papel usa (alertas, conexão ou treino) e o usuário. */
export function Barra({ usuario, subtitulo, alertas, treino, semBusca, gamificacao }: BarraProps) {
  return (
    <header className="topbar">
      <Marca subtitulo={subtitulo} />
      {semBusca ? <div className="grow" /> : <BuscaBarra />}
      <div className="right">
        {treino ? (
          <SeloTreino />
        ) : alertas ? (
          <>
            {/* O técnico ganha o sino sem perder a situação da conexão (a gestão não a mostra). */}
            {!alertas.gestao && (
              <span className="net on">
                <Icon name="check" size={16} />
                Online
              </span>
            )}
            <SinoAlertas naoLidos={alertas.naoLidos} recentes={alertas.recentes} gestao={alertas.gestao} />
          </>
        ) : (
          <span className="net on">
            <Icon name="check" size={16} />
            Online
          </span>
        )}
        {gamificacao && (
          <Link
            href={rotas.app.gamificacaoMinha}
            className="selo-barra"
            data-treino="selo-gamificacao"
            aria-label={`Minha pontuação: patente ${gamificacao.patente?.nome ?? "nenhuma"}, ${numero(gamificacao.pontos_temporada)} pontos na temporada${gamificacao.avisos_pendentes > 0 ? `, ${gamificacao.avisos_pendentes} aviso(s) novo(s)` : ""}`}
            title={`${gamificacao.temporada.nome}: ${numero(gamificacao.pontos_temporada)} pontos`}
          >
            <SeloPatente patente={gamificacao.patente} tamanho="p" semNome />
            <span className="selo-texto">
              <strong>{numero(gamificacao.pontos_temporada)}</strong> pts
            </span>
            {gamificacao.avisos_pendentes > 0 && <span className="selo-aviso" aria-hidden />}
          </Link>
        )}
        <MenuUsuario {...usuario} comPontuacao={Boolean(gamificacao)} />
      </div>
    </header>
  );
}
