"use client";

import { Icon, type IconName } from "@/components/ui/Icon";
import { JanelaModal } from "@/components/web/JanelaModal";

/** O que o arquivo é: uma OS para liberar no sistema, ou uma OS que a equipe já executou no papel (histórico). */
export type CaminhoDaImportacao = "liberar" | "papel";

interface CaminhoProps {
  tom: "arq" | "cam";
  icone: IconName;
  titulo: string;
  descricao: string;
  detalhes: string[];
  aoEscolher: () => void;
}

function Caminho({ tom, icone, titulo, descricao, detalhes, aoEscolher }: CaminhoProps) {
  return (
    <button type="button" className={`caminho t-${tom}`} onClick={aoEscolher}>
      <span className="entrada-ic" aria-hidden="true">
        <Icon name={icone} size={22} />
      </span>
      <span className="stack" style={{ gap: 4, textAlign: "left" }}>
        <strong style={{ fontSize: 16 }}>{titulo}</strong>
        <span className="small">{descricao}</span>
      </span>
      <ul className="caminho-detalhes">
        {detalhes.map((d) => (
          <li key={d}>
            <Icon name="check" size={13} />
            {d}
          </li>
        ))}
      </ul>
      <span className="caminho-acao">
        Escolher este caminho
        <Icon name="right" size={16} />
      </span>
    </button>
  );
}

interface PerguntaDaImportacaoProps {
  /** O arquivo que já foi solto sobre o cartão, se foi; sem ele, o seletor de arquivos abre depois da escolha. */
  arquivo: File | null;
  aoEscolher: (caminho: CaminhoDaImportacao) => void;
  aoFechar: () => void;
}

/**
 * A pergunta antes da importação: a OS "já foi concluída no papel" ou "é para liberar no sistema"? São dois caminhos bem
 * diferentes (uma entra como encerrada, de histórico; a outra entra liberada para a equipe executar), e o seletor de
 * arquivos só abre depois da escolha.
 */
export function PerguntaDaImportacao({ arquivo, aoEscolher, aoFechar }: PerguntaDaImportacaoProps) {
  return (
    <JanelaModal titulo="O que você vai importar?" aoFechar={aoFechar} className="dlg-larga">
      <div className="stack g16">
        <p className="muted" style={{ fontSize: 14.5 }}>
          {arquivo ? (
            <>
              Arquivo escolhido: <span className="mono">{arquivo.name}</span>. Diga o que ele é para o sistema tratar do jeito certo.
            </>
          ) : (
            "Antes de escolher o arquivo, diga o que ele é para o sistema tratar do jeito certo."
          )}
        </p>
        <div className="caminhos">
          <Caminho
            tom="arq"
            icone="upload"
            titulo="Para liberar no sistema"
            descricao="A OS ainda vai ser executada: a equipe a vê no quadro, faz a APR e executa."
            detalhes={["Planilha .xlsx exportada do SAP", "PDF gerado pelo SAP (com texto)", "Você confere cada OS antes de registrar"]}
            aoEscolher={() => aoEscolher("liberar")}
          />
          <Caminho
            tom="cam"
            icone="camera"
            titulo="Já foi concluída no papel"
            descricao="A OS foi executada antes do sistema e a folha foi escaneada: ela entra encerrada, só como histórico."
            detalhes={["PDF digitalizado (imagem) das folhas", "O sistema lê o impresso e, com IA, o que foi escrito à mão", "Você confere tudo com a folha ao lado"]}
            aoEscolher={() => aoEscolher("papel")}
          />
        </div>
        <p className="small">As OS digitalizadas não pontuam na gamificação e não entram nos indicadores de tempo de execução.</p>
      </div>
    </JanelaModal>
  );
}
