import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { cliente } from "@/api/api";
import { useSessao } from "@/sessao/SessaoProvider";
import { cores, espaco, raio } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { CampoDeFormulario } from "@/ui/Campo";
import { Tela } from "@/ui/Tela";
import { useFormulario } from "@/ui/useFormulario";

/** As mesmas regras de senha da `api` (e da web): ao menos 8 caracteres, diferente da atual, e a confirmação igual. */
const esquema = z
  .object({
    senha_atual: z.string().min(1, "Informe a senha provisória."),
    senha_nova: z.string().min(8, "A senha precisa ter ao menos 8 caracteres.").max(72, "A senha pode ter no máximo 72 caracteres."),
    confirmacao: z.string().min(1, "Repita a senha nova."),
  })
  .refine((v) => v.senha_nova === v.confirmacao, { path: ["confirmacao"], message: "A confirmação não confere com a senha nova." })
  .refine((v) => v.senha_atual !== v.senha_nova, { path: ["senha_nova"], message: "A senha nova precisa ser diferente da atual." });

/** "Defina sua senha": no primeiro acesso, ou depois de o admin redefinir, só a troca de senha está liberada. */
export default function TrocarSenha() {
  const { recarregarEu, sair, lembrarSenha } = useSessao();
  const { form, enviar, enviando, erroEnvio } = useFormulario(esquema, { senha_atual: "", senha_nova: "", confirmacao: "" });

  const salvar = enviar(async ({ senha_atual, senha_nova }) => {
    await cliente.chamar("/auth/trocar-senha", { corpo: { senha_atual, senha_nova } });
    void lembrarSenha(senha_nova);
    // A conta deixa de ter senha provisória: o `index` leva ao destino seguinte (aguardando, assinatura ou a lista de OS).
    await recarregarEu();
  });

  return (
    <Tela centralizada>
      <View style={estilos.formulario}>
        <Text style={estilos.titulo}>Defina sua senha</Text>
        <Aviso tom="info">Você entrou com uma senha provisória. Escolha uma senha nova (mínimo de 8 caracteres) para continuar.</Aviso>
        <CampoDeFormulario control={form.control} nome="senha_atual" rotulo="Senha provisória" secureTextEntry autoCapitalize="none" autoComplete="current-password" textContentType="password" returnKeyType="next" />
        <CampoDeFormulario control={form.control} nome="senha_nova" rotulo="Senha nova" secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" returnKeyType="next" />
        <CampoDeFormulario control={form.control} nome="confirmacao" rotulo="Repita a senha nova" secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={salvar} />
        {erroEnvio ? <Aviso tom="blq" titulo={erroEnvio} /> : null}
        <Botao titulo={enviando ? "Salvando…" : "Salvar senha"} enviando={enviando} aoPressionar={salvar} />
        <Botao titulo="Sair" variante="texto" aoPressionar={() => void sair()} />
      </View>
    </Tela>
  );
}

const estilos = StyleSheet.create({
  formulario: { backgroundColor: cores.superficie, borderRadius: raio.l, borderWidth: 1, borderColor: cores.linha, padding: espaco.xl, gap: espaco.l },
  titulo: { fontSize: 20, fontWeight: "700", color: cores.tinta },
});
