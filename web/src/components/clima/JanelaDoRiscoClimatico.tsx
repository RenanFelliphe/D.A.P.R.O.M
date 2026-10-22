"use client";

import { AdicionarFoto } from "@/components/ui/AdicionarFoto";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { JanelaSobreposta } from "@/components/ui/JanelaSobreposta";
import { Notice } from "@/components/ui/Notice";
import type { FotoDoRascunho } from "@/lib/apr";
import { classeDoNivel, ROTULO_DO_NIVEL, type ExigenciaDoClima, type PrevisaoDoTempo } from "@/lib/clima-comum";
import { cx } from "@/lib/cx";
import { CartaoDaPrevisao } from "./CartaoDaPrevisao";

interface JanelaDoRiscoClimaticoProps {
  previsao: PrevisaoDoTempo;
  exigencia: Exclude<ExigenciaDoClima, "nada">;
  /** As fotos do local que já foram anexadas à pergunta (só o risco extremo pede). */
  fotos: FotoDoRascunho[];
  aoFotoEnviada: (foto: { arquivoId: string; previa: string }) => void;
  aoRemoverFoto: (fotoId: string) => void;
  aoErroDeFoto: (mensagem: string) => void;
  /** A falha ao enviar a foto, mostrada dentro da janela. */
  erro?: string | null;
  /** "Confirmar e continuar": a resposta "Sim" vale. */
  aoConfirmar: () => void;
  /** "Revisar a minha resposta" (ou fechar a janela): a pergunta volta a ficar em branco. */
  aoRevisar: () => void;
}

/**
 * A janela que abre quando a pessoa responde "Sim" (condições climáticas favoráveis) e a previsão aponta risco: diz o que a
 * previsão aponta e o que fazer, e deixa seguir. A previsão é regional e é só uma probabilidade, por isso a pessoa decide; no risco
 * extremo, para seguir, ela fotografa o local (a foto fica na APR e o supervisor é avisado na hora).
 */
export function JanelaDoRiscoClimatico({ previsao, exigencia, fotos, aoFotoEnviada, aoRemoverFoto, aoErroDeFoto, erro, aoConfirmar, aoRevisar }: JanelaDoRiscoClimaticoProps) {
  const extremo = exigencia === "confirmar_com_foto";
  const nivel = previsao.nivel ?? "atencao";
  const faltaFoto = extremo && fotos.length === 0;
  return (
    <JanelaSobreposta titulo={ROTULO_DO_NIVEL[nivel]} aoFechar={aoRevisar} className="clima-janela-dlg" dataTreino="clima-janela">
      <div className={cx("clima-janela", classeDoNivel(nivel))}>
        <p>
          Você respondeu que as condições climáticas estão favoráveis, mas a previsão para as próximas horas aponta {extremo ? "risco extremo" : "risco"}. Confira antes de
          continuar.
        </p>
        <CartaoDaPrevisao previsao={previsao} cabecalho="O que a previsão aponta" />
        <p className="muted">
          {extremo
            ? "A previsão é da região e é só uma probabilidade: se, olhando o tempo no local, você concluir que dá para trabalhar, pode continuar. Antes, fotografe o local (o céu e o ambiente de trabalho). A foto fica registrada na APR e o seu supervisor é avisado na hora."
            : "A previsão é da região e é só uma probabilidade: se, olhando o tempo no local, você concluir que dá para trabalhar, pode continuar. O aviso fica registrado na APR."}
        </p>
        {extremo && (
          <div className="clima-foto-local">
            <strong style={{ fontSize: 14 }}>
              Foto do local <span style={{ color: "var(--blq)" }}>· obrigatória para continuar</span>
            </strong>
            <div className="photo-grid">
              {fotos.map((foto, i) => (
                <div key={foto.id} className="photo sq" style={{ position: "relative", overflow: "hidden", padding: 0 }}>
                  {foto.miniatura ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={foto.miniatura} alt={`Foto ${i + 1} do local`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ padding: 8 }}>Foto {i + 1}</span>
                  )}
                  <button
                    type="button"
                    className="btn btn-line btn-sm"
                    aria-label={`Remover a foto ${i + 1}`}
                    onClick={() => aoRemoverFoto(foto.id)}
                    style={{ position: "absolute", top: 4, right: 4, height: 28, padding: "0 8px" }}
                  >
                    <Icon name="x" size={13} />
                  </button>
                </div>
              ))}
              <AdicionarFoto onEnviada={aoFotoEnviada} onErro={aoErroDeFoto} rotulo={fotos.length > 0 ? "Outra foto" : "Fotografar o local"} />
            </div>
          </div>
        )}
        {erro && (
          <Notice tone="blq" icon="alert" role="alert">
            {erro}
          </Notice>
        )}
        <div className="clima-acoes">
          <Button variant="line" onClick={aoRevisar}>
            Revisar a minha resposta
          </Button>
          <Button variant="p" onClick={aoConfirmar} disabled={faltaFoto} aria-describedby={faltaFoto ? "clima-falta-foto" : undefined}>
            Confirmar e continuar
          </Button>
        </div>
        {faltaFoto && (
          <span id="clima-falta-foto" className="small muted" style={{ textAlign: "right" }}>
            Anexe a foto do local para continuar.
          </span>
        )}
      </div>
    </JanelaSobreposta>
  );
}
