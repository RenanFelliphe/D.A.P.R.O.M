import Link from "next/link";
import type { Alerta } from "@/components/web/alertas/tipos";
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
      <span className="brand-txt">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-logo" src="/marca/synq.png" alt="SYNQ OS" width={1000} height={308} />
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
  /** Campo de treino: mostra o selo do treino no lugar do sino. */
  treino?: boolean;
  /** Técnico pendente fora do treino: a busca global é da `api` real e ele ainda não pode usá-la. */
  semBusca?: boolean;
  /** A patente e os pontos da temporada de quem joga (técnico, fora do treino): o selo leva a "Minha pontuação". */
  gamificacao?: ResumoDaBarra;
}

/** Barra superior das áreas logadas: marca, busca global e, à direita, o que cada papel usa (alertas ou treino) e o usuário. O selo "Online" é só do app mobile: na web só se acessa pela internet. */
export function Barra({ usuario, subtitulo, alertas, treino, semBusca, gamificacao }: BarraProps) {
  return (
    <header className="topbar">
      <Marca subtitulo={subtitulo} />
      {semBusca ? <div className="grow" /> : <BuscaBarra />}
      <div className="right">
        {treino ? (
          <SeloTreino />
        ) : (
          alertas && <SinoAlertas naoLidos={alertas.naoLidos} recentes={alertas.recentes} gestao={alertas.gestao} />
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
