import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useWatch } from "react-hook-form";
import { z } from "zod";
import type { ConferenciaDaApi } from "@shared/api/conferencia-execucao";
import { JanelaDeAssinatura } from "@/campo/JanelaDeAssinatura";
import { useAcao } from "@/campo/useAcao";
import { cores, espaco, raio } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { mostrarAviso } from "@/ui/AvisoRapido";
import { Botao } from "@/ui/Botao";
import { CampoDeFormulario } from "@/ui/Campo";
import { JanelaDeConfirmacao } from "@/ui/Janela";
import { JanelaDeFormulario } from "@/ui/JanelaDeFormulario";
import { useFormulario } from "@/ui/useFormulario";
import { chamarConferencia, useAtualizarDepoisDaConferencia } from "./consultas";
import { camposParaEscolher, conferenciaEmAberto, corpoDeAssinar, corpoDeDecidir, EXPLICACAO_DE_FECHAR, resumoDaEscolha, rotuloDoBotaoDeAssinar, textosDeAssinar } from "./regras";

interface AcoesDaConferenciaProps {
  c: ConferenciaDaApi;
  /** A versão marcada em cada campo que a pessoa escolhe (o que ela mexeu, por cima do padrão sugerido). */
  escolhas: Record<string, string>;
  /** As escolhas foram para a `api`: a tela limpa o que a pessoa tinha marcado. */
  aoDecidir: () => void;
}

type Janela = "decidir" | "assinar" | "fechar" | null;

/** O tamanho máximo da ressalva que a `api` aceita. */
const MAX_DA_RESSALVA = 1000;
const esquemaDaRessalva = z.object({ ressalva: z.string().trim().max(MAX_DA_RESSALVA, `No máximo ${MAX_DA_RESSALVA} caracteres.`) });
type ValoresDaRessalva = z.infer<typeof esquemaDaRessalva>;

/**
 * O que a pessoa faz na conferência, conforme a `api` diz que ela pode (`eu`): confirmar as escolhas (responsável ou supervisor), dar a
 * ciência ou assinar (os demais) e fechar com o que existe (depois de 72 horas). Cada ação importante passa por uma janela de confirmação.
 * Tudo exige sinal; a conferência não vai na fila do aparelho.
 */
export function AcoesDaConferencia({ c, escolhas, aoDecidir }: AcoesDaConferenciaProps) {
  const [janela, setJanela] = useState<Janela>(null);
  const atualizarDepois = useAtualizarDepoisDaConferencia();
  const direta = useAcao();
  const fechando = useAcao();
  if (!conferenciaEmAberto(c)) return null;

  const paraEscolher = camposParaEscolher(c);
  const corpo = corpoDeDecidir(c, escolhas);
  const textos = textosDeAssinar(c.tipo);

  /** A ciência do resumo é um toque só, sem janela: não há o que desfazer nem assinatura para pedir. */
  const darCiencia = () =>
    void direta.executar(async () => {
      await atualizarDepois(await chamarConferencia(c.id, "assinar", {}));
      mostrarAviso("Ciência registrada");
    });

  const fechar = () =>
    void fechando
      .executar(async () => {
        await atualizarDepois(await chamarConferencia(c.id, "fechar"));
        mostrarAviso("Conferência fechada com o que existe");
      })
      .then(() => setJanela(null));

  const temAcao = paraEscolher.length > 0 || c.eu.deve_assinar || c.eu.pode_fechar;
  if (!temAcao) return null;
  return (
    <View style={estilos.acoes}>
      {direta.erro ? <Aviso tom="blq">{direta.erro.mensagem}</Aviso> : null}
      {fechando.erro && janela === null ? <Aviso tom="blq">{fechando.erro.mensagem}</Aviso> : null}

      {paraEscolher.length > 0 ? <Botao titulo={`Confirmar escolhas (${paraEscolher.length})`} icone="checkmark" aoPressionar={() => setJanela("decidir")} /> : null}

      {c.eu.deve_assinar ? (
        c.tipo === "resumo" ? (
          <>
            <Botao titulo={textos.botao} icone="checkmark" enviando={direta.ocupado} aoPressionar={darCiencia} />
            <Botao titulo="Dar ciência com ressalva" variante="texto" aoPressionar={() => setJanela("assinar")} />
          </>
        ) : (
          <Botao titulo={textos.botao} icone="create-outline" aoPressionar={() => setJanela("assinar")} />
        )
      ) : null}

      {c.eu.pode_fechar ? (
        <Botao
          titulo="Fechar com o que existe"
          variante="secundario"
          icone="lock-closed-outline"
          aoPressionar={() => {
            fechando.limparErro();
            setJanela("fechar");
          }}
        />
      ) : null}

      {janela === "decidir" ? <JanelaDeEscolhas c={c} escolhas={corpo.escolhas} aoConcluir={aoDecidir} aoFechar={() => setJanela(null)} /> : null}
      {janela === "assinar" ? <JanelaDeAssinarConferencia c={c} aoFechar={() => setJanela(null)} /> : null}
      <JanelaDeConfirmacao
        visivel={janela === "fechar"}
        titulo="Fechar com o que existe?"
        mensagem={EXPLICACAO_DE_FECHAR}
        confirmar="Fechar a conferência"
        enviando={fechando.ocupado}
        aoConfirmar={fechar}
        aoCancelar={fechando.ocupado ? () => undefined : () => setJanela(null)}
      />
    </View>
  );
}

/** A confirmação das escolhas: cada campo com a versão que vai valer. Os campos que ficam para o supervisor seguem esperando. */
function JanelaDeEscolhas({ c, escolhas, aoConcluir, aoFechar }: { c: ConferenciaDaApi; escolhas: { campo: string; escolha: string }[]; aoConcluir: () => void; aoFechar: () => void }) {
  const atualizarDepois = useAtualizarDepoisDaConferencia();
  const { ocupado, erro, executar } = useAcao();
  const confirmar = () =>
    void executar(async () => {
      const nova = await chamarConferencia(c.id, "decidir", { escolhas });
      aoConcluir();
      await atualizarDepois(nova);
      mostrarAviso("Escolhas registradas");
      aoFechar();
    });
  return (
    <JanelaDeFormulario titulo="Confirmar as escolhas" aoFechar={ocupado ? () => undefined : aoFechar}>
      <Text style={estilos.texto}>Estas versões passam a valer na execução. Depois, a equipe confere e assina.</Text>
      {escolhas.map((e) => {
        const campo = c.campos.find((x) => x.campo === e.campo);
        return (
          <View key={e.campo} style={estilos.linhaDaEscolha}>
            <Text style={estilos.rotulo}>{campo?.rotulo ?? e.campo}</Text>
            <Text style={estilos.texto}>{campo ? resumoDaEscolha(campo, e.escolha) : e.escolha}</Text>
          </View>
        );
      })}
      {erro ? <Aviso tom="blq">{erro.mensagem}</Aviso> : null}
      <Botao titulo={ocupado ? "Enviando…" : "Confirmar escolhas"} icone="checkmark" enviando={ocupado} aoPressionar={confirmar} />
      <Botao titulo="Voltar" variante="texto" aoPressionar={ocupado ? () => undefined : aoFechar} />
    </JanelaDeFormulario>
  );
}

/**
 * A ciência com ressalva (resumo, sem assinatura) ou a assinatura da conferência (com divergência), com a assinatura do perfil e a
 * ressalva opcional. A ressalva não trava nada: vai ao supervisor e ao relatório da execução.
 */
function JanelaDeAssinarConferencia({ c, aoFechar }: { c: ConferenciaDaApi; aoFechar: () => void }) {
  const atualizarDepois = useAtualizarDepoisDaConferencia();
  const { form } = useFormulario<ValoresDaRessalva>(esquemaDaRessalva, { ressalva: "" });
  const ressalva = useWatch({ control: form.control, name: "ressalva" }) ?? "";
  const textos = textosDeAssinar(c.tipo);
  return (
    <JanelaDeAssinatura
      titulo={textos.janela}
      osId={c.os.id}
      resumo={textos.resumo}
      rotuloConfirmar={rotuloDoBotaoDeAssinar(c.tipo, ressalva)}
      semAssinatura={c.tipo === "resumo"}
      aoConfirmar={async () => {
        await atualizarDepois(await chamarConferencia(c.id, "assinar", corpoDeAssinar(form.getValues("ressalva"))));
        mostrarAviso(c.tipo === "resumo" ? "Ciência registrada" : "Assinatura registrada");
      }}
      aoFechar={aoFechar}
    >
      <CampoDeFormulario
        control={form.control}
        nome="ressalva"
        rotulo="Ressalva (opcional)"
        placeholder="Ex.: cheguei depois do almoço e não vi a pausa"
        multiline
        numberOfLines={3}
        maxLength={MAX_DA_RESSALVA}
        textAlignVertical="top"
        ajuda="Escreva só se discordar de algo. Ela vai ao supervisor e ao relatório."
        style={estilos.area}
      />
    </JanelaDeAssinatura>
  );
}

const estilos = StyleSheet.create({
  acoes: { gap: espaco.s },
  texto: { fontSize: 15, lineHeight: 22, color: cores.tinta2 },
  rotulo: { fontSize: 13, fontWeight: "700", color: cores.tinta },
  linhaDaEscolha: { gap: 2, padding: espaco.m, borderRadius: raio.s, backgroundColor: cores.superficie2 },
  area: { minHeight: 80, paddingTop: espaco.m },
});
