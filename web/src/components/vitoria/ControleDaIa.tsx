"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEFINICOES_DE_IA, type DefinicaoDaFuncaoDeIA, type FuncaoDeIA, type GrupoDeIA } from "../../../../shared/ia/funcoes";
import { mensagemDoErro } from "@/components/app/execucao/useAcao";
import { JanelaDeAssinatura } from "@/components/ausencia/JanelaDeAssinatura";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Interruptor } from "@/components/ui/Interruptor";
import { Notice } from "@/components/ui/Notice";
import { chamar } from "@/lib/cliente-api";
import { dataHora } from "@/lib/formatar";
import { NOME_DO_PROVEDOR, type EstadoDaFuncaoDeIa, type PainelDaIa } from "@/lib/vitoria-ia";
import { useMinhaAssinatura } from "@/state/minha-assinatura";

const GRUPOS: { id: GrupoDeIA; nome: string; dica: string }[] = [
  { id: "sem_dados", nome: "Sem dados", dica: "Funcionam sem receber dado real da operação. A leitura de dados é opcional e rende mais." },
  { id: "com_dados", nome: "Com dados", dica: "Só funcionam lendo dado real: ligar já é autorizar essa leitura." },
];

const ROTULO_DO_ESTADO = { desligada: "desligada", ligada: "ligada", "com-dados": "lendo dados" } as const;

/** Em qual de três situações a função está, para a bolinha do seletor e para o texto de quem usa leitor de tela. */
function situacaoDe(e: EstadoDaFuncaoDeIa): keyof typeof ROTULO_DO_ESTADO {
  return !e.ligada ? "desligada" : e.com_dados ? "com-dados" : "ligada";
}

const quem = (e: EstadoDaFuncaoDeIa) => (e.autorizado_por && e.autorizado_em ? `${e.autorizado_por.nome}, em ${dataHora(e.autorizado_em)}` : null);

/**
 * O controle da IA na página da Vitória (só o admin; `controle-da-ia.md`): um seletor com as quatro funções, agrupadas em
 * "Sem dados" e "Com dados", e para cada uma o que ela é, o que recebe e um interruptor. Passar a ler dado real pede a assinatura
 * do perfil na janela que lista, função por função, o que será lido; desligar não pede nada e revoga a autorização. Quem decide
 * é a `api` (o módulo de IA recusa a chamada de função desligada): a tela só mostra o estado e envia o pedido.
 */
export function ControleDaIa({ painel }: { painel: PainelDaIa }) {
  const router = useRouter();
  const assinaturaPath = useMinhaAssinatura();
  const [selecionada, setSelecionada] = useState<FuncaoDeIA>("chatbot");
  const [assinando, setAssinando] = useState<FuncaoDeIA | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const estados = new Map(painel.funcoes.map((f) => [f.funcao, f]));
  const def = DEFINICOES_DE_IA.find((d) => d.id === selecionada)!;
  const estado = estados.get(selecionada);
  const fornecedor = NOME_DO_PROVEDOR[painel.provedor];

  async function salvar(funcao: FuncaoDeIA, corpo: { ligada: boolean; com_dados?: boolean }) {
    setOcupado(true);
    setErro(null);
    try {
      await chamar("PUT", `/vitoria/ia/${funcao}`, corpo);
      router.refresh();
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="panel ci" aria-labelledby="ci-titulo">
      <div className="stack g4">
        <h2 id="ci-titulo">
          <Icon name="shield" size={16} /> Controle da IA
        </h2>
        <p className="small muted">
          Só o administrador vê e muda isto. Cada função liga e desliga sozinha; ler dado real da operação é uma autorização assinada. Com a função desligada, nada
          sai para o fornecedor ({fornecedor}) e o sistema segue sem IA.
        </p>
      </div>

      {!painel.chave_configurada && (
        <Notice tone="al" icon="alert">
          Não há chave de IA configurada na api: nenhuma função chama a IA, mesmo ligada. Você já pode escolher o que fica ligado; vale quando a chave existir.
        </Notice>
      )}

      <div className="ci-seletor">
        {GRUPOS.map((g) => (
          <div key={g.id} className="ci-grupo" role="group" aria-labelledby={`ci-grupo-${g.id}`}>
            <div className="ci-grupo-cab">
              <span id={`ci-grupo-${g.id}`} className="ci-grupo-nome">
                {g.nome}
              </span>
              <span className="ci-grupo-dica">{g.dica}</span>
            </div>
            <div className="ci-abas" role="tablist" aria-label={g.nome}>
              {DEFINICOES_DE_IA.filter((d) => d.grupo === g.id).map((d) => {
                const e = estados.get(d.id);
                const situacao = e ? situacaoDe(e) : "desligada";
                return (
                  <button
                    key={d.id}
                    type="button"
                    role="tab"
                    id={`ci-aba-${d.id}`}
                    aria-selected={selecionada === d.id}
                    aria-controls="ci-detalhe"
                    className="ci-aba"
                    data-estado={situacao}
                    onClick={() => setSelecionada(d.id)}
                  >
                    <span className="ci-ponto" aria-hidden="true" />
                    {d.titulo}
                    <span className="sr"> ({ROTULO_DO_ESTADO[situacao]})</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {estado && (
        <div id="ci-detalhe" key={def.id} className="ci-detalhe" role="tabpanel" aria-labelledby={`ci-aba-${def.id}`}>
          <div className="ci-cab">
            <div className="ci-titulo">
              <h3>{def.titulo}</h3>
              <Badge tone={def.grupo === "com_dados" ? "exe" : "enc"}>{def.grupo === "com_dados" ? "Com dados" : "Sem dados"}</Badge>
            </div>
            <Interruptor
              ligado={estado.ligada}
              disabled={ocupado}
              rotulo={`Função ${def.titulo}`}
              aoAlternar={(ligar) => {
                if (ligar && def.grupo === "com_dados") setAssinando(def.id);
                else void salvar(def.id, { ligada: ligar });
              }}
            >
              {estado.ligada ? "Ligada" : "Desligada"}
            </Interruptor>
          </div>

          <p className="ci-explicacao">{def.explicacao}</p>

          {estado.texto_desatualizado && (
            <Notice tone="al" icon="alert">
              O texto do que esta função lê mudou depois da sua última assinatura, então ela está parada. Ligue de novo, leia o que mudou e assine.
            </Notice>
          )}

          {def.grupo === "sem_dados" ? <BlocosSemDados def={def} estado={estado} ocupado={ocupado} aoLigarDados={() => setAssinando(def.id)} aoDesligarDados={() => void salvar(def.id, { ligada: true, com_dados: false })} /> : <BlocosComDados def={def} estado={estado} />}

          <p className="small muted ci-rodape">
            <strong>Desligada:</strong> {def.semIa} · <strong>Modelo:</strong> <span className="mono">{estado.modelo}</span>
          </p>

          {erro && (
            <Notice tone="blq" icon="alert" role="alert">
              {erro}
            </Notice>
          )}
        </div>
      )}

      {assinando && (
        <JanelaDeAutorizacao
          def={DEFINICOES_DE_IA.find((d) => d.id === assinando)!}
          fornecedor={fornecedor}
          assinaturaPath={assinaturaPath}
          aoFechar={() => setAssinando(null)}
        />
      )}
    </section>
  );
}

/** O que as funções "Sem dados" recebem hoje e o que a leitura de dados reais acrescenta, com o botão que liga e desliga essa leitura. */
function BlocosSemDados({ def, estado, ocupado, aoLigarDados, aoDesligarDados }: { def: DefinicaoDaFuncaoDeIA; estado: EstadoDaFuncaoDeIa; ocupado: boolean; aoLigarDados: () => void; aoDesligarDados: () => void }) {
  const autorizacao = quem(estado);
  return (
    <div className="ci-blocos">
      <div className="ci-bloco">
        <h4>Sem dados reais, ela recebe</h4>
        <ul className="ci-lista">
          {def.semDados.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <span className="small muted">Procedimentos técnicos e o manual não são sigilosos: não é dado da operação.</span>
      </div>
      <div className="ci-bloco ci-bloco-dados" data-ligado={estado.com_dados}>
        <h4>
          <Icon name="eye" size={16} /> Leitura de dados reais
        </h4>
        <p className="small">{def.melhoraComDados}</p>
        {estado.com_dados ? (
          <>
            <span className="small">Ligada: ela lê, além do acima,</span>
            <ul className="ci-lista">
              {def.le.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {autorizacao && <span className="small muted">Autorizada por {autorizacao}.</span>}
            <Button sm variant="line" onClick={aoDesligarDados} disabled={ocupado}>
              Desligar a leitura de dados
            </Button>
          </>
        ) : (
          <>
            <span className="small muted">Desligada: ela não recebe nenhum dado real.</span>
            <Button sm variant="p" onClick={aoLigarDados} disabled={ocupado || !estado.ligada} title={estado.ligada ? undefined : "Ligue a função antes"}>
              Ligar a leitura de dados
            </Button>
            {!estado.ligada && <span className="small muted">Ligue a função antes de liberar a leitura de dados.</span>}
          </>
        )}
      </div>
    </div>
  );
}

/** O que as funções "Com dados" leem, e quem autorizou e quando. */
function BlocosComDados({ def, estado }: { def: DefinicaoDaFuncaoDeIA; estado: EstadoDaFuncaoDeIa }) {
  const autorizacao = quem(estado);
  return (
    <div className="ci-blocos">
      <div className="ci-bloco ci-bloco-dados" data-ligado={estado.ligada}>
        <h4>
          <Icon name="eye" size={16} /> O que ela lê
        </h4>
        <ul className="ci-lista">
          {def.le.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="ci-bloco">
        <h4>Autorização</h4>
        {estado.ligada && autorizacao ? (
          <span className="small">Autorizada por {autorizacao}. Desligar revoga a autorização; para ligar de novo é preciso assinar outra vez.</span>
        ) : (
          <span className="small">Ao ligar, você assina a autorização dessa leitura. Antes de assinar, a janela mostra tudo o que será lido.</span>
        )}
      </div>
    </div>
  );
}

/** A janela da autorização: lista o que a função vai ler, diz para onde os dados vão e pede a assinatura do perfil. */
function JanelaDeAutorizacao({ def, fornecedor, assinaturaPath, aoFechar }: { def: DefinicaoDaFuncaoDeIA; fornecedor: string; assinaturaPath: string | null; aoFechar: () => void }) {
  return (
    <JanelaDeAssinatura
      titulo={`Autorizar a leitura de dados: ${def.titulo}`}
      resumo={`Ao assinar, você autoriza a Vitória a ler os dados abaixo para realizar esta função. Eles são enviados ao fornecedor de IA (${fornecedor}) a cada uso.`}
      rotuloConfirmar="Assinar e autorizar"
      assinaturaPath={assinaturaPath}
      aoConfirmar={async () => {
        await chamar("PUT", `/vitoria/ia/${def.id}`, { ligada: true, com_dados: true, versao_do_texto: def.versaoDoTexto });
      }}
      aoFechar={aoFechar}
    >
      <div className="stack g8 ci-autoriza">
        <strong>{def.titulo} vai ler:</strong>
        <ul className="ci-lista">
          {def.le.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {def.semDados.length > 0 && <span className="small muted">Continua recebendo também: {def.semDados.join("; ")}.</span>}
        <span className="small muted">A autorização fica registrada com o seu nome e a data. Você pode desligar quando quiser; ligar de novo pede nova assinatura.</span>
      </div>
    </JanelaDeAssinatura>
  );
}
