"use client";

import { useEffect, useState } from "react";
import { JanelaDeModelos } from "@/components/app/nova-apr/JanelaDeModelos";
import { RiscosApr } from "@/components/app/nova-apr/RiscosApr";
import { Button } from "@/components/ui/Button";
import { JanelaSobreposta } from "@/components/ui/JanelaSobreposta";
import { Notice } from "@/components/ui/Notice";
import { doModeloCompleto, riscosEquivalentes, trocarModelo, type EscolhaDoModelo, type ModeloCompleto, type ModeloDoRascunho, type RascunhoApr } from "@/lib/apr";
import { chamar, ErroCliente } from "@/lib/cliente-api";

interface TrocaDeModeloProps {
  osId: string;
  rascunho: RascunhoApr;
  /** Aplica a troca: o modelo novo e os riscos marcados nele. */
  aoTrocar: (novo: ModeloDoRascunho, riscos: string[]) => void;
  aoFechar: () => void;
}

const mensagem = (e: unknown, padrao: string) => (e instanceof ErroCliente ? e.message : padrao);
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * Troca do modelo no meio do preenchimento: a mesma janela de escolha da Nova APR e, escolhido o modelo novo, a
 * conferência dos riscos (os de mesmo nome já vêm marcados) com o que acontece com as respostas: as perguntas iguais
 * guardam a resposta, as demais ficam em branco.
 */
export function TrocaDeModelo({ osId, rascunho, aoTrocar, aoFechar }: TrocaDeModeloProps) {
  const [escolha, setEscolha] = useState<EscolhaDoModelo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState<string | null>(null);
  const [novo, setNovo] = useState<ModeloDoRascunho | null>(null);
  const [riscos, setRiscos] = useState<string[]>([]);

  useEffect(() => {
    let ativo = true;
    chamar<EscolhaDoModelo>("GET", `/os/${osId}/modelos-apr`)
      .then((e) => ativo && setEscolha(e))
      .catch((e) => ativo && setErro(mensagem(e, "Não foi possível carregar os modelos.")));
    return () => {
      ativo = false;
    };
  }, [osId]);

  async function selecionar(codigo: string) {
    setErro(null);
    setCarregando(codigo);
    try {
      const completo = doModeloCompleto(await chamar<ModeloCompleto>("GET", `/modelos-apr/${encodeURIComponent(codigo)}/versoes/publicada`));
      setRiscos(riscosEquivalentes(rascunho.modelo, rascunho.riscos, completo));
      setNovo(completo);
    } catch (e) {
      setErro(mensagem(e, "Não foi possível carregar o modelo."));
    } finally {
      setCarregando(null);
    }
  }

  if (!novo) {
    return <JanelaDeModelos escolha={escolha} erro={erro} atual={rascunho.modelo.codigo} carregando={carregando} aoSelecionar={selecionar} aoFechar={aoFechar} />;
  }

  const { mantidas, perdidas, emBranco } = trocarModelo(rascunho, novo, riscos);
  const alternar = (id: string) => setRiscos((atuais) => (atuais.includes(id) ? atuais.filter((r) => r !== id) : [...atuais, id]));

  return (
    <JanelaSobreposta titulo={`Trocar para ${novo.codigo} — ${novo.titulo}`} aoFechar={aoFechar} className="dlg-modelos">
      <Notice tone={perdidas > 0 ? "al" : "info"} icon="info">
        <strong>{plural(mantidas, "resposta continua", "respostas continuam")}</strong> (as perguntas iguais nos dois modelos) e{" "}
        <strong>{plural(emBranco, "pergunta fica", "perguntas ficam")} em branco</strong>.
        {perdidas === 1 && " 1 resposta do modelo atual não existe no novo e será apagada."}
        {perdidas > 1 && ` ${perdidas} respostas do modelo atual não existem no novo e serão apagadas.`}
      </Notice>
      <RiscosApr riscos={novo.riscos} itens={novo.itens} marcados={riscos} aoAlternar={alternar} />
      <div className="row g8 wrap" style={{ justifyContent: "flex-end" }}>
        <Button variant="line" onClick={() => setNovo(null)}>
          Voltar aos modelos
        </Button>
        <Button variant="p" onClick={() => aoTrocar(novo, riscos)} data-treino="apr-confirmar-troca">
          Trocar para {novo.codigo}
        </Button>
      </div>
    </JanelaSobreposta>
  );
}
