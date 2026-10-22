/**
 * Confere a configuração do e-mail de ponta a ponta (`docs/pessoas-e-equipes.md`, seção 8.5): conecta no servidor de `SMTP_URL`,
 * autentica e envia, de `EMAIL_REMETENTE`, um e-mail de teste no mesmo modelo dos avisos. É o passo que falta depois de
 * preencher o `.env.local`: se este e-mail chega, os avisos e o resumo diário também chegam.
 *
 *   pnpm email:testar -- fulano@empresa.com.br    # conecta, autentica e envia o teste
 *   pnpm email:testar -- --so-conectar            # só conecta e autentica, sem enviar nada
 *
 * Lê só as variáveis do e-mail (não precisa do banco). Sai com código 1 se faltar a configuração ou o servidor recusar.
 */
import { EmailSmtp } from "../src/servicos/email";
import { montarEmail } from "../src/servicos/email-modelo";

const smtpUrl = (process.env.SMTP_URL ?? "").trim();
const remetente = (process.env.EMAIL_REMETENTE ?? "synqos@localhost").trim();
const painelUrl = (process.env.PAINEL_URL ?? "http://localhost:3000").replace(/\/$/, "");
const argumentos = process.argv.slice(2).filter((a) => a !== "--");
const soConectar = argumentos.includes("--so-conectar");
const para = argumentos.find((a) => !a.startsWith("--"));

/** O endereço sem a senha, para mostrar no terminal. */
function semSenha(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = "****";
    return u.toString();
  } catch {
    return "(SMTP_URL fora do formato smtp://usuario:senha@servidor:porta)";
  }
}

async function main() {
  if (!smtpUrl) {
    console.error("SMTP_URL está vazio. Preencha no .env.local, por exemplo: SMTP_URL=smtp://usuario:senha@smtp.empresa.com.br:587");
    process.exit(1);
  }
  if (!soConectar && !para) {
    console.error("Informe para quem enviar o teste: pnpm email:testar -- fulano@empresa.com.br (ou --so-conectar)");
    process.exit(1);
  }
  console.log(`Servidor: ${semSenha(smtpUrl)}`);
  console.log(`Remetente: ${remetente}`);
  const email = new EmailSmtp(smtpUrl, remetente);

  await email.verificar();
  console.log("Conectou e autenticou no servidor de e-mail.");
  if (soConectar) return;

  const { texto, html } = montarEmail({
    titulo: "Teste do e-mail do SYNQ OS",
    paragrafos: [
      "Se você está lendo isto, o servidor de e-mail está configurado: os avisos do sino e o resumo diário vão sair por e-mail para quem não os desligou no perfil.",
    ],
    itens: [
      { rotulo: "Remetente", valor: remetente },
      { rotulo: "Enviado em", valor: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) },
    ],
    botao: { texto: "Abrir o SYNQ OS", url: `${painelUrl}/app/lista` },
    rodape: "E-mail de teste enviado pelo comando pnpm email:testar.",
  });
  await email.enviar({ para: para!, assunto: "[SYNQ OS] Teste do e-mail", texto, html });
  console.log(`E-mail de teste enviado para ${para}. Confira a caixa de entrada (e o spam).`);
}

main().catch((erro) => {
  console.error("O servidor de e-mail recusou:", erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
