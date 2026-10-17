# Assinatura nas ações importantes — decisões e implementação de 17/10/2026

> A assinatura deixa de ser um item opcional do perfil e passa a ser a primeira coisa que a pessoa faz depois de liberada. As ações importantes do sistema passam a ser validadas por ela, em vez de um simples botão de confirmar.
>
> **Situação:** implementado em 17/10/2026 na `api` e na `web`. O app `mobile` ainda não existe e vai herdar as mesmas regras (o bloqueio e as cópias da assinatura são da `api`).
>
> Fontes: o pedido de 17/10/2026; o que já existia em [ausencia.md](ausencia.md) (atos assinados com a assinatura do perfil); o código em [`assinatura.ts`](../api/src/dominio/assinatura.ts), [`autenticacao.ts`](../api/src/http/autenticacao.ts) e [`JanelaDeAssinatura.tsx`](../web/src/components/ausencia/JanelaDeAssinatura.tsx).

## Resumo

- **A assinatura vem antes de tudo.** Depois do primeiro login (e da troca da senha provisória) e da liberação do admin, a pessoa só vê a tela "Cadastre a sua assinatura". Sem ela, nenhuma outra tela nem rota da `api` abre. Vale para **todos os perfis, inclusive o admin**.
- **A ciência do supervisor é assinada.** O botão "Dar ciência" virou "Assinar e dar ciência": abre a janela com a assinatura do perfil, e a imagem usada vai para o PDF da OS.
- **As ações importantes são assinadas:** liberar e recusar cadastro, reprogramar, cancelar (OS de apoio) e devolver OS, interromper por risco e cancelar a execução por engano. Somam-se às que já eram assinadas (APR, encerramento da execução, atos da ausência e publicação de treinamento).
- **Cada ato guarda uma cópia da imagem usada.** Refazer a assinatura do perfil vale só para as próximas ações; as já assinadas não mudam.

## 1. O bloqueio depois da liberação

| Situação da pessoa | O que acontece |
|---|---|
| Senha provisória | A troca de senha vem primeiro (como sempre). |
| Cadastro pendente (aguarda o admin) | **Ainda não é cobrada.** Segue na tela de espera e no Campo de treino. |
| Liberada, sem assinatura | A `api` responde `403 assinatura_pendente` em tudo, menos nas rotas abaixo; a `web` leva a `/app/assinatura`. |
| Liberada, com assinatura | Usa o sistema normalmente. |

- **Rotas que passam sem assinatura:** `GET /me`, `PUT /me/assinatura`, `PUT /arquivos/{id}` (subir a imagem), `GET /arquivos/{id}/url`, `POST /auth/sair` e `POST /auth/trocar-senha`.
- **Quem já estava ativo sem assinatura** cai na mesma tela no próximo acesso.
- **A tela** (`/app/assinatura`, fora da casca com menu) tem o quadro para desenhar e o botão "Sair". Ao salvar, vai para o quadro de OS. A primeira assinatura do técnico continua pontuando (uma vez por conta).
- **No Campo de treino** o bloqueio não vale: o técnico fictício já tem uma assinatura cadastrada.

## 2. Ações assinadas

Todas usam a assinatura do perfil de quem age, na janela `JanelaDeAssinatura` (a mesma da ausência): mostra a imagem, pede a confirmação ("Confirmo esta ação e a assino…") e só então chama a `api`.

| Ação | Quem | Onde fica a cópia da imagem |
|---|---|---|
| Dar ciência na OS encerrada | supervisor da equipe | `os.ciencia_assinatura_path` (vai para o PDF da OS) |
| Reprogramar a OS | supervisor da equipe, admin | `reprogramacao.assinatura_path` |
| Cancelar a OS de apoio | admin | `os.cancelada_assinatura_path` |
| Devolver a OS ao SAP | supervisor da equipe | `os.devolvida_assinatura_path` |
| Liberar ou recusar um cadastro | admin | `usuario.liberacao_assinatura_path` |
| Interromper a execução por risco | técnico da execução | `execucao.assinatura_do_resultado_path` |
| Cancelar a execução por engano | técnico da execução | `execucao.assinatura_do_resultado_path` |

- **A `api` copia a assinatura do perfil sozinha** (como já fazia na ausência): a confirmação é da tela. `assinaturaDoAto` devolve a imagem ou recusa com `assinatura_ausente` (defesa; o bloqueio da seção 1 já cobre).
- **Interrupção e cancelamento por engano são eventos de campo** (`POST /eventos`), que podem vir da fila offline do app. A `api` usa a assinatura que a pessoa tem no perfil ao aplicar o evento; sem ela, o evento é rejeitado com `assinatura_ausente`.
- **A ciência antiga** (dada antes desta mudança) não tem cópia: o PDF continua mostrando a assinatura atual do perfil do supervisor.
- **Quem lê as imagens:** quem vê a equipe da OS lê as cópias ligadas à OS, à reprogramação e à execução (`GET /arquivos/{id}/url`); a da liberação só o admin.

## 3. O que ficou de fora

- **Ações do técnico dentro da OS que não mudam o estado** (pausar, retomar, suspender no fim do expediente) seguem sem assinatura.
- **Reserva da OS a uma pessoa e liberação da reserva** não foram assinadas.
- **Importação (planilha, PDF da OS), modelos de APR e critério de bloqueio, redefinição de senha, desativação de usuário, catálogo e gamificação** não foram assinados. Estão nas opções que o usuário não marcou em 17/10/2026; entram se ele pedir.
- **Certificado digital (ICP-Brasil)** continua fora: a assinatura é o desenho do perfil, e a validade dela para auditoria segue na questão 38.

## 4. Mudanças no código

- **Migração** [`0029_assinatura_nas_acoes_importantes.sql`](../api/db/migrations/0029_assinatura_nas_acoes_importantes.sql): seis colunas novas, todas nulas (as ações anteriores não têm cópia).
- **`api`:** o bloqueio `assinatura_pendente` no `autenticar` (opção `permitirSemAssinatura`); `assinaturaDoAto` em [`assinatura.ts`](../api/src/dominio/assinatura.ts); a gravação da cópia em cada ação; a leitura das cópias em `arquivos.ts`; o PDF da ciência lendo a cópia.
- **`web`:** a tela `/app/assinatura`; o redirecionamento na casca e em `lib/api.ts`; o contexto `useMinhaAssinatura` (a casca o preenche); e a janela de assinatura em `BotaoCiencia`, `CartaoReprogramar`, `CancelarOs`, `DevolverOs`, `liberacao.tsx`, `FormularioInterromper` e no cancelamento de `ExecucaoEmAndamento`.
- **Testes:** `assinatura.test.ts` (o bloqueio, o admin, a senha provisória e o pendente) e as verificações da cópia gravada nos testes de cada ação. Sete testes que criavam usuário sem assinatura foram ajustados ao bloqueio.
- **Vitória:** os manuais do técnico e do admin passaram a citar a assinatura obrigatória e as ações assinadas.
