import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import type { ItemDoModelo, RascunhoApr, ResumoDoRascunho } from "@shared/api/apr";
import { cores, espaco, raio } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { Campo } from "@/ui/Campo";
import { Cartao, TituloDeCartao } from "@/ui/Cartao";
import { useFormulario, useRevalidarQuando } from "@/ui/useFormulario";

interface RevisaoProps {
  rascunho: RascunhoApr;
  resumo: ResumoDoRascunho;
  /** Reabre a pergunta (base 0) para responder ou corrigir a resposta. */
  aoAbrir: (indice: number) => void;
  aoVoltar: () => void;
  aoObservarGeral: (texto: string) => void;
  /** Valida na `api` e registra a APR; uma falha é lançada e aparece acima do botão. */
  aoValidar: () => Promise<void>;
  /** O que falta de assinatura dos participantes (`AssinaturasFaltando`). */
  assinaturas: React.ReactNode;
  /** Quantos participantes ainda estão sem assinatura no perfil: a validação espera por eles. */
  semAssinatura: number;
  /** Os materiais recomendados do serviço, só para consulta; nulo quando a OS não tem lista. */
  materiais?: React.ReactNode;
  /** Sem sinal: a APR não pode ser validada agora (só o servidor sabe o que bloqueia); é registrada neste aparelho e validada depois. */
  semSinal?: boolean;
}

function LinhaDaPergunta({ numero, texto, rotulo, aoPressionar }: { numero: number; texto: string; rotulo: string; aoPressionar: () => void }) {
  return (
    <View style={estilos.linhaDaPergunta}>
      <Text style={estilos.numero}>{numero}</Text>
      <Text style={estilos.textoDaPergunta}>{texto}</Text>
      <Botao titulo={rotulo} variante="secundario" bloco={false} aoPressionar={aoPressionar} />
    </View>
  );
}

/**
 * A revisão final antes de validar: o que falta (respostas, observações, assinaturas) e as observações gerais. A revisão não diz se a
 * APR vai passar: isso só se sabe ao validar, e quem diz é a `api`. O técnico não vê quais itens são eliminatórios. O botão de
 * validar não fica parado: faltando algo, a mensagem aparece acima dele e junto do que falta.
 */
export function Revisao({ rascunho, resumo, aoAbrir, aoVoltar, aoObservarGeral, aoValidar, assinaturas, semAssinatura, materiais, semSinal }: RevisaoProps) {
  const { perguntas, naSemObservacao, semResposta } = resumo;
  const indiceDe = (item: ItemDoModelo) => perguntas.indexOf(item);
  const nSemResposta = semResposta.length;
  const nNaSemObservacao = naSemObservacao.length;

  const esquema = useMemo(
    () =>
      z
        .object({ observacaoGeral: z.string(), semResposta: z.string().optional(), naSemObservacao: z.string().optional(), assinaturas: z.string().optional() })
        .superRefine((_, ctx) => {
          if (nSemResposta > 0) ctx.addIssue({ code: "custom", path: ["semResposta"], message: `Responda ${nSemResposta === 1 ? "a pergunta que falta" : `as ${nSemResposta} perguntas que faltam`}: a APR é respondida por inteiro.` });
          if (nNaSemObservacao > 0) ctx.addIssue({ code: "custom", path: ["naSemObservacao"], message: `Explique o motivo do NA em ${nNaSemObservacao === 1 ? "1 item" : `${nNaSemObservacao} itens`}.` });
          if (semAssinatura > 0) {
            ctx.addIssue({
              code: "custom",
              path: ["assinaturas"],
              message: `Falta a assinatura no perfil de ${semAssinatura} ${semAssinatura > 1 ? "participantes" : "participante"}: cadastre-a ou retire a pessoa da APR.`,
            });
          }
        }),
    [nSemResposta, nNaSemObservacao, semAssinatura],
  );
  const { form, enviar, enviando, erroEnvio } = useFormulario(esquema, { observacaoGeral: rascunho.observacaoGeral });
  useRevalidarQuando(form, esquema);
  const erros = form.formState.errors;
  const mensagens = [erros.semResposta?.message, erros.naSemObservacao?.message, erros.assinaturas?.message].filter((m): m is string => Boolean(m));

  return (
    <View style={estilos.revisao}>
      <Cartao>
        <TituloDeCartao>Revisão da APR</TituloDeCartao>
        <Text style={estilos.suave}>{`${resumo.respondidas} de ${perguntas.length} perguntas respondidas. Depois de validada, a APR não pode ser alterada; se reprovar, ela já fica registrada.`}</Text>
      </Cartao>

      {semResposta.length > 0 ? (
        <View style={estilos.bloco}>
          <Aviso tom="al" titulo={semResposta.length > 1 ? `${semResposta.length} perguntas sem resposta.` : "1 pergunta sem resposta."}>
            A APR é respondida por inteiro.
          </Aviso>
          {semResposta.map((item) => (
            <LinhaDaPergunta key={item.id} numero={indiceDe(item) + 1} texto={item.texto} rotulo="Responder" aoPressionar={() => aoAbrir(indiceDe(item))} />
          ))}
        </View>
      ) : null}

      {naSemObservacao.length > 0 ? (
        <View style={estilos.bloco}>
          <Aviso tom="al" titulo="NA exige observação.">{`Explique o motivo em ${naSemObservacao.length} ${naSemObservacao.length > 1 ? "itens" : "item"}.`}</Aviso>
          {naSemObservacao.map((item) => (
            <LinhaDaPergunta key={item.id} numero={indiceDe(item) + 1} texto={item.texto} rotulo="Abrir" aoPressionar={() => aoAbrir(indiceDe(item))} />
          ))}
        </View>
      ) : null}

      {materiais}

      <Cartao>
        <Campo rotulo="Observações (opcional)" placeholder="Algo mais que precise ficar registrado nesta APR" multiline numberOfLines={3} textAlignVertical="top" style={estilos.areaDeTexto} value={rascunho.observacaoGeral} onChangeText={aoObservarGeral} />
      </Cartao>

      {assinaturas}

      {mensagens.length > 0 ? (
        <Aviso tom="blq" titulo="Ainda não dá para validar a APR:">
          {mensagens.join(" ")}
        </Aviso>
      ) : null}
      {erroEnvio ? <Aviso tom="blq">{erroEnvio}</Aviso> : null}
      {semSinal ? (
        <Aviso tom="al" icone="cloud-offline-outline" titulo="Sem sinal: a APR não pode ser validada agora.">
          Ela é registrada neste aparelho e vale como assinada por todos os participantes que estão aqui com você. O servidor a valida quando o sinal voltar e, se ela reprovar, o supervisor é avisado.
        </Aviso>
      ) : null}

      <Botao titulo={enviando ? (semSinal ? "Registrando…" : "Validando…") : semSinal ? "Concluir e registrar sem sinal" : "Concluir e validar"} enviando={enviando} aoPressionar={() => void enviar(() => aoValidar())()} />
      <Botao titulo="Voltar" variante="secundario" aoPressionar={enviando ? () => undefined : aoVoltar} />
    </View>
  );
}

const estilos = StyleSheet.create({
  revisao: { gap: espaco.m },
  bloco: { gap: espaco.s },
  suave: { fontSize: 14, lineHeight: 20, color: cores.tinta3 },
  linhaDaPergunta: { gap: espaco.s, padding: espaco.m, borderRadius: raio.m, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.superficie },
  numero: { fontSize: 12, fontWeight: "700", color: cores.marca },
  textoDaPergunta: { fontSize: 14, lineHeight: 20, color: cores.tinta },
  areaDeTexto: { minHeight: 88, paddingTop: espaco.m },
});
