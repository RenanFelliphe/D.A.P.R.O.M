import { Icon } from "@/components/ui/Icon";
import { LIMITES, letrasDaGrade, tentativasDoTermo, type Fase } from "@/lib/treinamento-servico";

/**
 * Uma fase como o admin precisa conferir: o enunciado, as opções com a certa marcada (ou os itens, os pares, a ordem) e a
 * explicação que aparece depois da resposta. Só leitura: editar é na aba Fases do jogo.
 */
export function GabaritoDaFase({ fase, nomeDoMaterial }: { fase: Fase; nomeDoMaterial: (id: string) => string }) {
  return (
    <div className="ts-gabarito">
      {fase.tipo === "quiz" && (
        <>
          <p className="ts-gabarito-pergunta">{fase.enunciado}</p>
          <ul className="ts-gabarito-opcoes">
            {fase.opcoes.map((o, i) => (
              <li key={i} data-certa={i === fase.correta || undefined}>
                <Icon name={i === fase.correta ? "check" : "x"} size={13} />
                {o}
              </li>
            ))}
          </ul>
        </>
      )}
      {fase.tipo === "decisao" && (
        <>
          <p className="ts-gabarito-pergunta">{fase.situacao}</p>
          <ul className="ts-gabarito-opcoes">
            {fase.opcoes.map((o, i) => (
              <li key={i} data-certa={i === fase.correta || undefined}>
                <Icon name={i === fase.correta ? "check" : "x"} size={13} />
                <span className="stack g4">
                  {o.texto}
                  <span className="small">Consequência: {o.consequencia}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {fase.tipo === "ligar" && (
        <ul className="ts-gabarito-pares">
          {fase.pares.map((p, i) => (
            <li key={i}>
              <span>{p.esquerda}</span>
              <Icon name="link" size={13} />
              <span>{p.direita}</span>
            </li>
          ))}
        </ul>
      )}
      {fase.tipo === "ordem" && (
        <>
          <p className="ts-gabarito-pergunta">{fase.enunciado}</p>
          <ol className="ts-gabarito-etapas">
            {fase.etapas.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ol>
        </>
      )}
      {fase.tipo === "verdadeiro_falso" && (
        <>
          <p className="ts-gabarito-pergunta">{fase.afirmacao}</p>
          <ul className="ts-gabarito-opcoes">
            <li data-certa>
              <Icon name={fase.verdadeira ? "check" : "x"} size={13} />
              {fase.verdadeira ? "Verdadeira" : "Falsa"}
            </li>
          </ul>
        </>
      )}
      {fase.tipo === "caca_palavras" && (
        <>
          <p className="ts-gabarito-pergunta">{fase.enunciado}</p>
          <span className="small">{fase.modo === "pistas" ? "Quem joga vê só as pistas." : "Quem joga vê as palavras."}</span>
          <ul className="ts-gabarito-opcoes">
            {fase.palavras.map((p, i) => (
              <li key={i} data-certa>
                <Icon name="caca" size={13} />
                <span className="stack g4">
                  {p.palavra}
                  {p.pista && <span className="small">Pista: {p.pista}</span>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {fase.tipo === "memoria" && (
        <ul className="ts-gabarito-pares">
          {fase.pares.map((p, i) => (
            <li key={i}>
              <span>{p.termo}</span>
              <Icon name="cartas" size={13} />
              <span>{p.correspondente}</span>
            </li>
          ))}
        </ul>
      )}
      {fase.tipo === "selecione" && fase.materiais && (
        <>
          <p className="ts-gabarito-pergunta">{fase.enunciado}</p>
          <div className="ts-fichas">
            {fase.materiais.material_ids.map((id) => (
              <span key={id} className="ts-ficha" aria-pressed="true">
                <Icon name="check" size={13} />
                {nomeDoMaterial(id)}
              </span>
            ))}
          </div>
          <span className="small">
            Montado com os materiais do serviço: + {fase.materiais.quantidade_errados} {fase.materiais.quantidade_errados === 1 ? "item sorteado" : "itens sorteados"} de outros serviços a
            cada partida.
          </span>
        </>
      )}
      {fase.tipo === "selecione" && !fase.materiais && (
        <>
          <p className="ts-gabarito-pergunta">{fase.enunciado}</p>
          <ul className="ts-gabarito-opcoes">
            {fase.opcoes.map((o, i) => (
              <li key={i} data-certa={o.correta || undefined}>
                <Icon name={o.correta ? "check" : "x"} size={13} />
                {o.texto}
              </li>
            ))}
          </ul>
        </>
      )}
      {(fase.tipo === "termo" || fase.tipo === "desembaralhe") && (
        <>
          <span className="small">
            Banco com {fase.palavras.length} de {LIMITES.palavrasDoBanco} palavras; cada partida sorteia uma.
          </span>
          <ul className="ts-gabarito-opcoes">
            {fase.palavras.map((p, i) => (
              <li key={i} data-certa>
                <Icon name={fase.tipo === "termo" ? "termo" : "embaralhar"} size={13} />
                <span className="stack g4">
                  {fase.tipo === "termo" ? `${p.palavra} · ${letrasDaGrade(p.palavra).length} letras, ${tentativasDoTermo(letrasDaGrade(p.palavra).length)} tentativas` : p.palavra}
                  {p.dica && <span className="small">Dica: {p.dica}</span>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="ts-gabarito-explicacao">
        <strong>Depois da resposta:</strong> {fase.explicacao || "—"}
      </p>
    </div>
  );
}
