import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { ehSupervisor, iniciaisDe, rotuloDoPerfil } from "@shared/api/tipos";
import { useParaAvaliar } from "@/materiais/consultas";
import { MinhaAssinatura } from "@/assinatura/MinhaAssinatura";
import { CartaoDeSincronizacao } from "@/offline/CartaoDeSincronizacao";
import { useEstadoDaSincronizacao } from "@/offline/estado";
import { useSincronizar } from "@/offline/SincronizacaoProvider";
import { mensagemDeSairComFila } from "@/sessao/sair";
import { FaixaDeAusencia } from "@/os/FaixaDeAusencia";
import { OpcaoAnonimato } from "@/perfil/OpcaoAnonimato";
import { useSessao } from "@/sessao/SessaoProvider";
import { cores, espaco, raio } from "@/tema/tema";
import { Botao } from "@/ui/Botao";
import { Cartao } from "@/ui/Cartao";
import { Carregando } from "@/ui/Estados";
import { JanelaDeConfirmacao } from "@/ui/Janela";
import { LinhaDeNavegacao } from "@/ui/LinhaDeNavegacao";
import { Tela } from "@/ui/Tela";

/**
 * O perfil da pessoa logada: os dados (só leitura: nome, cargo e equipe vêm do registro de funcionários), a assinatura, o caminho para as
 * ausências, o histórico e as preferências de e-mail, o anonimato no ranking, a troca de senha e o Sair. Cada assunto tem a sua tela.
 */
export default function Perfil() {
  const router = useRouter();
  const { eu, recarregarEu, sair } = useSessao();
  const [atualizando, setAtualizando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [saindo, setSaindo] = useState(false);
  /** Por que o Sair foi recusado (ainda há registro de campo esperando para subir); `null` = vale a janela de confirmação normal. */
  const [semSair, setSemSair] = useState<string | null>(null);
  const { pendentes } = useEstadoDaSincronizacao();
  const sincronizar = useSincronizar();
  const paraAvaliar = useParaAvaliar(eu ? ehSupervisor(eu.usuario) : false);

  if (!eu) return <Carregando />;
  const u = eu.usuario;
  const supervisiona = eu.equipes_supervisionadas.map((e) => e.nome).join(", ");

  const atualizar = async () => {
    setAtualizando(true);
    try {
      await recarregarEu();
    } finally {
      setAtualizando(false);
    }
  };

  /** O toque em "Sair": com registro esperando, a janela explica que não dá; sem, pede a confirmação. */
  const pedirSaida = () => (pendentes > 0 ? setSemSair(mensagemDeSairComFila(pendentes)) : setConfirmando(true));

  const confirmarSaida = async () => {
    setSaindo(true);
    try {
      const recusa = await sair();
      if (recusa) setSemSair(recusa);
    } finally {
      setSaindo(false);
      setConfirmando(false);
    }
  };

  return (
    <Tela bordas={[]} aoAtualizar={() => void atualizar()} atualizando={atualizando}>
      <FaixaDeAusencia />
      <View style={estilos.identidade}>
        <View style={estilos.avatar}>
          <Text style={estilos.iniciais}>{iniciaisDe(u.nome)}</Text>
        </View>
        <Text style={estilos.nome}>{u.nome}</Text>
        <Text style={estilos.cargo}>{[u.cargo, rotuloDoPerfil[u.perfil]].filter(Boolean).join(" · ")}</Text>
      </View>

      <Cartao>
        <Dado rotulo="Matrícula" valor={u.matricula} />
        <Dado rotulo="E-mail institucional" valor={u.email ?? null} />
        <Dado rotulo="Equipe" valor={eu.equipe?.nome ?? null} />
        <Dado rotulo="Supervisor da equipe" valor={supervisiona || null} />
        <Dado rotulo="Registro profissional" valor={u.registro_profissional} />
      </Cartao>

      <MinhaAssinatura />

      {eu.equipe && u.perfil === "tecnico" ? <CartaoDeSincronizacao /> : null}

      <LinhaDeNavegacao icone="calendar-outline" titulo="Minhas ausências" detalhe="Pedir, acompanhar e confirmar o retorno" aoPressionar={() => router.push("/ausencias")} />
      <LinhaDeNavegacao icone="list-outline" titulo="Sugestões de materiais" detalhe="Sugerir e contestar as listas recomendadas dos serviços" selo={paraAvaliar.data ?? 0} aoPressionar={() => router.push("/materiais")} />
      <LinhaDeNavegacao icone="document-text-outline" titulo="OS que encerrei" detalhe="Os últimos 60 dias, com o PDF" aoPressionar={() => router.push("/historico")} />
      <LinhaDeNavegacao icone="mail-outline" titulo="Preferências de e-mail" detalhe="Quais avisos também vão para o seu e-mail" aoPressionar={() => router.push("/emails")} />
      <LinhaDeNavegacao icone="key-outline" titulo="Trocar a senha" aoPressionar={() => router.push("/senha")} />
      <OpcaoAnonimato />

      <Botao titulo="Sair" variante="secundario" icone="log-out-outline" aoPressionar={pedirSaida} />
      <Text style={estilos.versao}>{`SYNQ OS ${Constants.expoConfig?.version ?? ""}`}</Text>

      <JanelaDeConfirmacao
        visivel={confirmando}
        titulo="Sair do aplicativo?"
        mensagem="Você vai precisar entrar de novo com o e-mail e a senha."
        confirmar="Sair"
        perigo
        enviando={saindo}
        aoConfirmar={() => void confirmarSaida()}
        aoCancelar={() => setConfirmando(false)}
      />
      <JanelaDeConfirmacao
        visivel={semSair !== null}
        titulo="Ainda não dá para sair"
        mensagem={semSair ?? ""}
        confirmar="Sincronizar agora"
        cancelar="Fechar"
        aoConfirmar={() => {
          setSemSair(null);
          void sincronizar();
        }}
        aoCancelar={() => setSemSair(null)}
      />
    </Tela>
  );
}

/** Um dado do perfil; o que a pessoa não tem (cargo, registro) não aparece. */
function Dado({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <View style={estilos.dado}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <Text style={estilos.valor}>{valor}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  identidade: { alignItems: "center", gap: espaco.s, paddingVertical: espaco.l },
  avatar: { width: 72, height: 72, borderRadius: raio.pilula, backgroundColor: cores.marca, alignItems: "center", justifyContent: "center" },
  iniciais: { color: cores.branco, fontSize: 26, fontWeight: "700" },
  nome: { fontSize: 20, fontWeight: "700", color: cores.tinta, textAlign: "center" },
  cargo: { fontSize: 14, color: cores.tinta4, textAlign: "center" },
  dado: { gap: 2 },
  rotulo: { fontSize: 12, color: cores.tinta4 },
  valor: { fontSize: 15, color: cores.tinta },
  versao: { textAlign: "center", fontSize: 12, color: cores.tinta4 },
});
