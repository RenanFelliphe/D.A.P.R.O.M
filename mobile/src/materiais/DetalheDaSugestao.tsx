import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { dataHora } from "@shared/api/formatar";
import { diferencaDeListas, type Sugestao } from "@shared/api/sugestao-materiais";
import { AvisoDePontos } from "@/campo/AvisoDePontos";
import { Recolhivel } from "@/os/detalhe/Blocos";
import { cores } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Cartao, TituloDeCartao } from "@/ui/Cartao";
import { Selo } from "@/ui/Selo";
import { Tela } from "@/ui/Tela";
import { AcoesDaSugestao, type DesfechoDaAvaliacao } from "./AcoesDaSugestao";
import { AjusteDoAvaliador } from "./AjusteDoAvaliador";
import { SelosDaSugestao } from "./CartaoDaSugestao";
import type { RespostaDaAvaliacao } from "./consultas";
import { DiferencaDeListas, ListaSimples } from "./Diferenca";
import type { Resolucoes } from "./lista";
import { ResolverItensDigitados } from "./ResolverItensDigitados";

interface Resultado {
  desfecho: DesfechoDaAvaliacao;
  resposta: RespostaDaAvaliacao;
}

function textoDoResultado({ desfecho, resposta }: Resultado): string {
  if (desfecho === "recusada") return "Sugestão recusada. O autor recebeu o seu motivo.";
  if (desfecho === "retirada") return "Sugestão retirada. Você pode enviar outra para este serviço.";
  return resposta.lista_mudou ? "Sugestão aceita. A lista do serviço foi atualizada e quem faz o serviço foi avisado." : "Sugestão aceita. A lista do serviço já estava assim, então nada mudou.";
}

/**
 * A sugestão por inteiro: quem enviou, para qual equipe, o motivo, a resposta, o que a lista proposta muda e, para quem avalia, as
 * ações (aceitar, ajustar e aceitar, recusar). A diferença da sugestão pendente é sobre a lista **de agora**; se a lista mudou desde o
 * envio, a tela diz e mostra a lista de base e a de agora. Depois de avaliada, a diferença é sobre a lista da época do envio, que é o
 * que ela mudou (sobre a de agora tudo ficaria "igual").
 */
export function DetalheDaSugestao({ sugestao: s, aoAtualizar, atualizando }: { sugestao: Sugestao; aoAtualizar: () => void; atualizando: boolean }) {
  const [ajustando, setAjustando] = useState(false);
  const [resolucoes, setResolucoes] = useState<Resolucoes>({});
  const [pendencia, setPendencia] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  if (ajustando) {
    return (
      <AjusteDoAvaliador
        sugestao={s}
        resolucoes={resolucoes}
        aoCancelar={() => setAjustando(false)}
        aoAceitar={(resposta) => {
          setAjustando(false);
          setResultado({ desfecho: "aceita", resposta });
        }}
      />
    );
  }

  const pendente = s.estado === "pendente";
  const comparadaCom = pendente ? s.lista_atual : s.lista_base;
  const mudancas = s.tem_lista ? diferencaDeListas(comparadaCom, s.itens) : [];

  return (
    <Tela bordas={["bottom"]} aoAtualizar={aoAtualizar} atualizando={atualizando}>
      {resultado ? (
        <>
          <Aviso tom="ok">{textoDoResultado(resultado)}</Aviso>
          <AvisoDePontos resposta={resultado.resposta} />
        </>
      ) : null}

      <Cartao>
        <SelosDaSugestao tipo={s.tipo} estado={s.estado} />
        <Text style={estilos.servico}>{`${s.atividade_codigo} — ${s.atividade_descricao}`}</Text>
        <Dado rotulo="Enviada por" valor={`${s.autor_nome} em ${dataHora(s.criada_em)}`} />
        <Dado rotulo="Equipe responsável" valor={s.equipe_responsavel_nome ?? "Administração (nenhuma equipe faz este serviço)"} />
        {s.avaliada_por_nome && s.avaliada_em ? <Dado rotulo="Avaliada por" valor={`${s.avaliada_por_nome} em ${dataHora(s.avaliada_em)}`} /> : null}
        {s.ajustada ? <Selo tom="al">Aceita com ajustes</Selo> : null}
      </Cartao>

      {s.resposta ? (
        <Aviso tom={s.estado === "recusada" ? "blq" : "ok"} titulo={`Resposta${s.avaliada_por_nome ? ` de ${s.avaliada_por_nome}` : ""}:`}>
          {s.resposta}
        </Aviso>
      ) : null}

      <Cartao>
        <TituloDeCartao>{s.tipo === "contestacao" ? "Motivo da contestação" : "Motivo"}</TituloDeCartao>
        <Text style={estilos.texto}>{s.motivo ?? "O autor não informou o motivo."}</Text>
      </Cartao>

      {pendente && s.desatualizada ? (
        <>
          <Aviso tom="al" icone="time-outline" titulo="A lista mudou desde o envio.">
            A lista do serviço foi alterada depois que esta sugestão chegou. A diferença abaixo é sobre a lista de agora.
          </Aviso>
          <Recolhivel titulo="Lista quando foi enviada" resumo={`${s.lista_base.length} item(ns)`}>
            <ListaSimples itens={s.lista_base} />
          </Recolhivel>
          <Recolhivel titulo="Lista de agora" resumo={`${s.lista_atual.length} item(ns)`}>
            <ListaSimples itens={s.lista_atual} />
          </Recolhivel>
        </>
      ) : null}

      <Cartao>
        <TituloDeCartao>{s.tem_lista ? "O que a lista proposta muda" : "Lista proposta"}</TituloDeCartao>
        {s.tem_lista ? (
          <>
            <Text style={estilos.nota}>{pendente ? "Em relação à lista de agora do serviço." : "Em relação à lista do serviço na época do envio."}</Text>
            <DiferencaDeListas mudancas={mudancas} />
          </>
        ) : (
          <Text style={estilos.texto}>O autor só contestou: não propôs uma lista nova.{s.posso_avaliar ? " Para aceitar, informe a lista que passa a valer." : ""}</Text>
        )}
      </Cartao>

      {s.posso_avaliar ? <ResolverItensDigitados itens={s.itens} resolucoes={resolucoes} aoMudar={setResolucoes} pendencia={pendencia} /> : null}

      <AcoesDaSugestao
        sugestao={s}
        resolucoes={resolucoes}
        aoFaltarDecisao={setPendencia}
        aoAjustar={() => setAjustando(true)}
        aoConcluir={(desfecho, resposta) => setResultado({ desfecho, resposta })}
      />
    </Tela>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={estilos.dado}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <Text style={estilos.valor}>{valor}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  servico: { fontSize: 16, fontWeight: "700", color: cores.tinta, lineHeight: 22 },
  texto: { fontSize: 14, color: cores.tinta2, lineHeight: 21 },
  nota: { fontSize: 12, color: cores.tinta4 },
  dado: { gap: 2 },
  rotulo: { fontSize: 12, color: cores.tinta4 },
  valor: { fontSize: 14, color: cores.tinta },
});
