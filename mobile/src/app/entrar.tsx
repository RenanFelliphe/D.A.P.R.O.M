import { Image, StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { useSessao } from "@/sessao/SessaoProvider";
import { cores, espaco, raio } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { CampoDeFormulario } from "@/ui/Campo";
import { Tela } from "@/ui/Tela";
import { useFormulario } from "@/ui/useFormulario";

const esquema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail.").pipe(z.email("Informe um e-mail válido, como nome.sobrenome@empresa.com.br.")),
  senha: z.string().min(1, "Informe a senha."),
});

/** Login pelo e-mail institucional e senha. A matrícula só identifica a pessoa no sistema; não entra aqui. */
export default function Entrar() {
  const { entrar, aviso } = useSessao();
  const { form, enviar, enviando, erroEnvio } = useFormulario(esquema, { email: "", senha: "" });

  return (
    <Tela centralizada>
      <View style={estilos.topo}>
        <Image source={require("../../assets/marca.png")} style={estilos.logo} resizeMode="contain" accessibilityLabel="SYNQ OS" />
        <Text style={estilos.subtitulo}>Campo: APR e execução das ordens de serviço</Text>
      </View>

      <View style={estilos.formulario}>
        <Text style={estilos.titulo}>Entrar</Text>
        {aviso ? <Aviso tom="al" titulo={aviso} /> : null}
        <CampoDeFormulario control={form.control} nome="email" rotulo="E-mail institucional" placeholder="nome.sobrenome@empresa.com.br" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="username" textContentType="username" returnKeyType="next" />
        <CampoDeFormulario control={form.control} nome="senha" rotulo="Senha" secureTextEntry autoCapitalize="none" autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={enviar(({ email, senha }) => entrar(email, senha))} />
        {erroEnvio ? <Aviso tom="blq" titulo={erroEnvio} /> : null}
        <Botao titulo={enviando ? "Entrando…" : "Entrar"} enviando={enviando} aoPressionar={enviar(({ email, senha }) => entrar(email, senha))} />
      </View>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  topo: { backgroundColor: cores.escuro, borderRadius: raio.l, padding: espaco.xl, alignItems: "center", gap: espaco.m },
  logo: { width: 220, height: 48 },
  subtitulo: { color: "#C4CDD5", fontSize: 13, textAlign: "center" },
  formulario: { backgroundColor: cores.superficie, borderRadius: raio.l, borderWidth: 1, borderColor: cores.linha, padding: espaco.xl, gap: espaco.l },
  titulo: { fontSize: 20, fontWeight: "700", color: cores.tinta },
});
