import { useRouter } from "expo-router";
import { z } from "zod";
import { cliente } from "@/api/api";
import { useSessao } from "@/sessao/SessaoProvider";
import { Aviso } from "@/ui/Aviso";
import { mostrarAviso } from "@/ui/AvisoRapido";
import { Botao } from "@/ui/Botao";
import { CampoDeFormulario } from "@/ui/Campo";
import { Tela } from "@/ui/Tela";
import { useFormulario } from "@/ui/useFormulario";

/** As mesmas regras de senha da `api` (e da web): ao menos 8 caracteres, diferente da atual, e a confirmação igual. */
const esquema = z
  .object({
    senha_atual: z.string().min(1, "Informe a senha atual."),
    senha_nova: z.string().min(8, "A senha precisa ter ao menos 8 caracteres.").max(72, "A senha pode ter no máximo 72 caracteres."),
    confirmacao: z.string().min(1, "Repita a senha nova."),
  })
  .refine((v) => v.senha_nova === v.confirmacao, { path: ["confirmacao"], message: "A confirmação não confere com a senha nova." })
  .refine((v) => v.senha_atual !== v.senha_nova, { path: ["senha_nova"], message: "A senha nova precisa ser diferente da atual." });

/** Trocar a própria senha (`POST /auth/trocar-senha`), a partir do perfil. A do primeiro acesso é a tela `trocar-senha`. */
export default function Senha() {
  const router = useRouter();
  const { lembrarSenha } = useSessao();
  const { form, enviar, enviando, erroEnvio } = useFormulario(esquema, { senha_atual: "", senha_nova: "", confirmacao: "" });

  const salvar = enviar(async ({ senha_atual, senha_nova }) => {
    await cliente.chamar("/auth/trocar-senha", { corpo: { senha_atual, senha_nova } });
    void lembrarSenha(senha_nova);
    mostrarAviso("Senha trocada");
    router.back();
  });

  return (
    <Tela bordas={["bottom"]}>
      <Aviso tom="info">A senha nova precisa ter ao menos 8 caracteres e ser diferente da atual.</Aviso>
      <CampoDeFormulario control={form.control} nome="senha_atual" rotulo="Senha atual" secureTextEntry autoCapitalize="none" autoComplete="current-password" textContentType="password" returnKeyType="next" />
      <CampoDeFormulario control={form.control} nome="senha_nova" rotulo="Senha nova" secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" returnKeyType="next" />
      <CampoDeFormulario control={form.control} nome="confirmacao" rotulo="Repita a senha nova" secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" returnKeyType="go" onSubmitEditing={salvar} />
      {erroEnvio ? <Aviso tom="blq">{erroEnvio}</Aviso> : null}
      <Botao titulo={enviando ? "Salvando…" : "Trocar a senha"} enviando={enviando} aoPressionar={salvar} />
    </Tela>
  );
}
