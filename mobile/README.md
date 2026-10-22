# mobile

Aplicativo de campo do SYNQ OS (Android), em Expo SDK 58 com React Native e TypeScript. Funciona online no dia a dia e tem um modo offline de contingência para aplicar a APR e executar a OS onde não há sinal. É um cliente: as regras ficam na [`api`](../api/README.md), que é a mesma da [`web`](../web/README.md); o app mostra, coleta e envia.

**Situação:** o app está feito no código (app online, modo offline, login sem sinal, envio com o app fechado e conquista de sincronização offline). O APK sai do EAS Build e abriu num aparelho em 22/10/2026 (versão 0.2.0); falta passar por cada tela no aparelho e o roteiro da demonstração. O resto foi validado por código (`tsc`, ESLint, testes de unidade e os scripts `conferir:*` contra a `api` local).

Regras de negócio: [docs/](../docs) (campo em [operacao-de-campo.md](../docs/operacao-de-campo.md)); o app sem sinal, a fila e a cópia local: [docs/especificacao.md](../docs/especificacao.md), seções 6.5 a 6.7.

## O que o app faz

- **Entrar** pelo e-mail institucional; a sessão continua aberta entre aberturas (tokens no `expo-secure-store`) e se renova sozinha. Depois do `GET /me`, cada conta vai ao seu destino ([`src/sessao/destino.ts`](src/sessao/destino.ts)): senha provisória → "Defina sua senha"; aguardando liberação → espera; admin → aviso de que a gestão é na web; sem assinatura → desenho da assinatura; técnico → lista de OS. O ausente só consulta.
- **Abas** OS, Avisos, Pontos e Perfil, com o indicador "Online" / "Sem conexão" / "Sincronizado hh:mm".
- **Lista e detalhe da OS:** filtros por status, busca, a faixa "APR aguardando a sua assinatura", o atalho para a execução aberta, o cartão de previsão do tempo; no detalhe, dados do SAP, local, ciclo da preventiva, materiais recomendados, APRs, histórico e o botão certo para cada situação ([`src/os/detalhe/acao.ts`](src/os/detalhe/acao.ts)); o PDF da OS concluída abre no leitor do aparelho.
- **APR:** escolha do modelo com a recomendação, participantes (mínimo 2) e riscos, checklist com todas as perguntas iguais, troca do modelo, "Concluir e validar" (`POST /aprs/avaliar`), evidência dos reprovados, assinatura ou recusa de cada participante na própria conta.
- **Execução:** iniciar, cronômetro calculado do início e das pausas, pausar e suspender com motivo, interromper por risco, cancelar por engano, a execução esquecida de outro dia e o encerramento em dois passos com checklist de inspeção e assinatura. GPS nos cinco momentos, sem bloquear quando falta.
- **Execução compartilhada:** quem participa da APR e não iniciou acompanha a execução ([`src/execucao/Acompanhando.tsx`](src/execucao/Acompanhando.tsx)); pausar, continuar, interromper e suspender por saúde valem na hora; encerrar e suspender por outro motivo, com sinal, viram pedido de 2 minutos ao responsável, que aprova ou recusa ([`PedidoParaResponder.tsx`](src/execucao/PedidoParaResponder.tsx); a faixa de pedidos pergunta a cada 10 s). Regras: [operacao-de-campo.md](../docs/operacao-de-campo.md), seção 6.
- **Conferência da execução** ([`src/conferencia/`](src/conferencia), rota `os/[id]/conferencia`): o que a equipe registrou sem sinal em aparelhos diferentes, campo a campo e por pessoa; o responsável escolhe, os demais dão a ciência ou assinam. Uma faixa discreta lembra quando é a vez da pessoa. Regras: [operacao-de-campo.md](../docs/operacao-de-campo.md), seções 6.6 e 6.7.
- **Câmera, galeria e PDF:** foto comprimida (lado maior ~1600 px, qualidade 70%) que sobe por `PUT /arquivos/{id}` antes do evento que a cita; reenviar usa o mesmo id e não duplica.
- **Previsão do tempo** ([`src/clima/`](src/clima), `GET /clima`): o cartão do expediente na lista de OS; na APR, a pergunta marcada mostra a previsão e, com risco previsto, pede confirmação (no extremo, a foto do local); no encerramento, a previsão vai com o evento. A posição é a do aparelho só se a permissão já foi dada; senão, a cidade padrão. A última previsão do dia vale sem sinal; sem nenhuma, a tela some e nada é bloqueado. Regras: [operacao-de-campo.md](../docs/operacao-de-campo.md), seção 4.7.
- **Sugestão de materiais** (rotas `materiais/`): sugerir ou contestar a lista de um serviço em etapas, acompanhar as minhas e, para quem supervisiona, avaliar. Regras: [operacao-de-campo.md](../docs/operacao-de-campo.md), seção 10.2.
- **Perfil e Configurações:** dados (só leitura), Validações (só quem supervisiona; a fila do `GET /me/validacoes`, com o selo da contagem), Minhas ausências, Sugestões de materiais, OS que encerrei (60 dias, com o PDF), Registros recusados e Sincronizar; em Configurações, a assinatura, as preferências de e-mail, a troca de senha e o anonimato no ranking. O que é do sistema todo (cidade padrão, controle da IA) fica só na web.
- **Avisos** (o sino), **ausências** do próprio técnico (pedir, acompanhar, confirmar, pedir o fim, confirmar o retorno), **Pontos** (Minha pontuação, Ranking, Conquistas e a janela "Parabéns!") e a **Vitória** (botão flutuante, conversa, figurinhas e "Me leve lá" para a tela do app, ou para a web quando `EXPO_PUBLIC_WEB_URL` está definida). **Notificações push** ([`src/notificacoes/`](src/notificacoes)): o app registra o aparelho na `api` ao abrir (pede a permissão do sistema), o toque abre a tela do aviso e Configurações › Notificações neste aparelho liga e desliga; sem os serviços do Google o aparelho não recebe e os avisos seguem no sino. Para o push chegar de verdade, o build precisa do `google-services.json` (`GOOGLE_SERVICES_JSON`) e das credenciais do FCM na conta da Expo (`eas credentials`); a biblioteca é nativa, então o app passou para a versão 0.2.0 e pede um APK novo. Regras: [pessoas-e-equipes.md, seção 8.6](../docs/pessoas-e-equipes.md).
- **Botão de emergência** ([`src/emergencia/`](src/emergencia)): sempre à vista na execução; a janela abre pelos contatos para ligar (o PAE cadastrado pelo admin e o SAMU e os Bombeiros, guardados no aparelho para a hora sem sinal) e avisa o supervisor e os administradores com a posição pela fila de campo (sem sinal, sobe quando o sinal volta). Regras: [operacao-de-campo.md, seção 5.9](../docs/operacao-de-campo.md).
- **Convites para a APR** ([`src/convites/`](src/convites)): quem foi convidado aceita ou recusa (com o motivo) numa faixa em toda tela de campo e em Perfil › Convites para a APR; quem convida, na etapa dos participantes, convida os marcados, vê a resposta de cada um ao vivo e só começa o checklist quando todos os convidados aceitam (só com sinal). Regras: [operacao-de-campo.md, seção 4.9](../docs/operacao-de-campo.md).

**Fica na web:** as telas de gestão (reservar e devolver OS, a assinatura final do supervisor, o relatório da execução, quadro e dashboards, responder ausências dos outros; as Validações do app abrem a web para o que só ela decide), os cadastros da gamificação, o Campo de treino e os treinamentos de serviço.

### Modo offline

- **Cópia e fila em SQLite** ([`src/offline/`](src/offline), banco `synqos.db`): a cópia da equipe vem de `POST /sync/pull`; **toda escrita de campo grava na fila antes de enviar** (`enviarEvento` e `enviarArquivo` de `@/offline/app`), e com sinal o envio é em seguida. **Toda leitura de campo passa por `lerDeOndeDer`**, que lê da `api` e cai para a cópia. A cópia nunca apaga uma OS com registro esperando.
- **APR sem sinal:** registrada como concluída, com os presentes assinando por este aparelho (`assinatura_presencial`), sem a validação na hora; a execução segue, e o servidor valida quando o sinal volta.
- **Sincronização:** arquivos primeiro, depois os eventos em ordem; o adiado espera sem travar as outras OS; o recusado vai para "Registros recusados", com o motivo. Roda ao abrir, quando o sinal volta, ao voltar ao app, de minuto em minuto com pendência e no botão Sincronizar.
- **Entrar sem sinal** ([`src/sessao/`](src/sessao)): o hash salgado da senha (PBKDF2-HMAC-SHA256, `@noble/hashes`) fica no armazenamento seguro, nunca a senha. Vale por 7 dias desde a última confirmação da conta pelo servidor (`JANELA_SEM_SINAL_DIAS`); depois, "Conecte-se para entrar". Quando o sinal volta, o app refaz o login com a senha digitada (só na memória).
- **Faixa e Sair:** "Sem conexão — N registros pendentes" no alto das telas de campo; o Sair é recusado enquanto houver fila (oferece "Sincronizar agora").
- **Com o app fechado:** a tarefa `synqos-envio-em-segundo-plano` ([`segundo-plano.ts`](src/offline/segundo-plano.ts), `segundo-plano-nativo.ts`) roda pelo `expo-background-task`, no mínimo a cada 15 minutos e só com rede, quando o Android libera. Por isso o app tem entrada própria ([`index.ts`](index.ts)), que registra a tarefa antes do Expo Router. Para testar num build de desenvolvimento: guarde um registro sem sinal, ligue o sinal, feche o app e espere; o perfil mostra "Enviado com o app fechado às hh:mm".

## Decisões do app

| # | Decisão | No código |
|---|---|---|
| D1 | **APR sem sinal não perde a execução.** O aparelho não valida a APR (só o servidor sabe o que é eliminatório). Se ela chega bloqueada pela fila, a `api` aplica a execução mesmo assim e avisa o supervisor com um alerta de bloqueio; online, a execução sem APR aprovada continua recusada (`apr_invalida`) | `bloqueadaSemSinal` em `api/src/dominio/eventos-execucao.ts` |
| D2 | **Sem telas de gestão no app.** O supervisor usa a web, que funciona no navegador do celular; o app mostra a reserva e a devolução, mas não as faz | — |
| D3 | **Conta aguardando liberação** vê a espera, com o aviso de fazer o Campo de treino pela web, e nenhuma tela de campo | `src/app/aguardando.tsx` |
| D4 | **Treinamentos de serviço** (os jogos) ficam na web | — |
| D5 | **Um registro por pessoa no aparelho:** cada pessoa tem o seu hash de senha, o seu `GET /me` guardado, a sua cópia e a sua fila; outra pessoa entrar não apaga o da anterior | `src/sessao/credenciais.ts`, `src/offline/identidade.ts` |
| D6 | **APK pelo EAS Build, instalado pelo link do Expo** nos aparelhos da demonstração; sem loja. O JavaScript novo chega pelo ar (EAS Update) | `eas.json`, perfil `preview` |

Outras escolhas que valem: o modelo da APR vem de `GET /modelos-apr/{codigo}/versoes/publicada`, como na web; a assinatura é desenhada sobre `react-native-svg` (caixa de 600 × 180, a mesma da web), e o PNG sobe como arquivo; a janela de 7 dias conta desde a última confirmação do servidor (login ou `GET /me` com sinal), não só desde o login; a data da ausência e a hora da execução esquecida são digitadas (`dd/mm/aaaa`, `hh:mm`), sem seletor nativo.

## Pré-requisitos

- Node 24 e `pnpm` (os mesmos da `api` e da `web`).
- Para rodar no aparelho ou no emulador: Android Studio (SDK e emulador) ou um celular Android com depuração por USB. O app usa módulos nativos (armazenamento seguro, SQLite, câmera, segundo plano), então **não roda no Expo Go**: precisa do *development build* (`pnpm android`).

## Como rodar

```bash
cd mobile
pnpm install
cp .env.example .env        # aponta o app para a api
pnpm android                # compila o development build e abre no aparelho ou no emulador
pnpm start                  # só o Metro, com o build já instalado
```

| Variável | O que faz |
|---|---|
| `EXPO_PUBLIC_API_URL` | endereço da `api` (nada fixo no código). No emulador, a máquina é `10.0.2.2` (`http://10.0.2.2:3333`); no celular, o IP da máquina na rede |
| `APP_PERMITIR_HTTP` | `true` libera `http://` no build de desenvolvimento; o APK de produção usa `https` e não a define |
| `EXPO_PUBLIC_WEB_URL` | opcional: o endereço da web, para o "Me leve lá" da Vitória abrir o que só existe lá |

**Sem Supabase:** `cd api && pnpm dev:local` sobe a `api` inteira em memória, com as contas de exemplo do [README da raiz](../README.md). Use `PORT=3399` se outra `api` já estiver na 3333.

## Scripts

Os `conferir:*` rodam o mesmo cliente das telas contra uma `api` de verdade (`API_URL=http://localhost:3399`), **só a local em memória**: criam APRs e execuções. Reinicie a `api` antes de repetir os que consomem OS liberadas.

| Comando | O que faz |
|---|---|
| `pnpm typecheck` | `tsc --noEmit` (estrito) |
| `pnpm lint` | `expo lint` |
| `pnpm test` | testes de unidade (`node --test`; o SQLite de verdade pelo `node:sqlite`) das partes puras: cliente, sessão e janela sem sinal, fila, cópia, projeção, sincronizador, APR, execução, ausências, avisos, gamificação, Vitória |
| `pnpm apk` | gera o APK no EAS Build, perfil `preview` (ver "Gerar o APK e atualizar") |
| `pnpm atualizar --message "..."` | publica o JavaScript atual pelo ar no canal `preview`, com os endereços do `eas.json` |
| `pnpm conferir:api` | login de cada tipo de conta, lista, detalhe, renovação do token e envio de evento |
| `pnpm conferir:campo` | o fluxo de campo: modelo, APR validada, assinaturas de duas contas, iniciar, pausar, encerrar em dois passos com foto e PDF, cancelar, interromper, APR bloqueada e evidência |
| `pnpm conferir:perfil` | assinatura, avisos, e-mails, anonimato, senha, ausência, gamificação e o fluxo SSE da Vitória |
| `pnpm conferir:offline` | a cópia e a leitura local iguais às da `api`, a APR e a execução sem sinal, a subida, o reenvio sem duplicar, o evento adiado, a APR sem sinal que o servidor bloqueia (D1) e o registro recusado |
| `pnpm conferir:sem-sinal` | o login sem sinal: hash e `GET /me` guardados, senha certa e errada, login refeito quando o sinal volta, a janela de 7 dias |
| `pnpm conferir:conferencia` | dois aparelhos registram a mesma execução sem sinal, com horários diferentes, sobem as filas em momentos diferentes; a conferência aparece com divergência, o responsável escolhe, o outro assina com ressalva e ela termina |

## Como o código está organizado

```
mobile/
  index.ts             entrada: registra a tarefa de segundo plano e carrega o expo-router/entry
  app.config.ts        nome SYNQ OS, pacote br.synqos.app, versão, permissões, plugins, versionCode, EAS Update
  eas.json             o perfil preview do EAS Build: APK, canal, endereços da api e da web, versionCode
  scripts/             pnpm atualizar e os conferir:*
  src/app/             rotas (Expo Router), abaixo
  src/api/             cliente da api (puro e testado), erros, eventos e arquivos, tokens no SecureStore
  src/sessao/          SessaoProvider, destino da conta, credenciais e hash da senha, janela de 7 dias, GET /me com e sem sinal, sair
  src/os/              lista e detalhe das OS; detalhe/acao.ts decide o botão certo
  src/apr/             escolha do modelo, participantes e riscos, checklist, revisão, evidência, assinaturas, rascunho, clima da APR
  src/execucao/        iniciar, em andamento, acompanhar (execução compartilhada), pedidos, encerramento, checklist de inspeção
  src/conferencia/     a conferência da execução: tela, faixa, regras
  src/campo/           o que a APR e a execução dividem: câmera, galeria, PDF, GPS, janela de assinatura, useAcao, previsão guardada
  src/clima/           previsão do tempo: cartões, janela da APR, usePrevisao, regras
  src/materiais/       sugestão e contestação da lista de materiais
  src/offline/         banco, fila, cópia, projeção, leitura local, sincronizador, envio, identidade, faixa, segundo plano
  src/assinatura/      o desenho (react-native-svg) e o envio
  src/avisos/          o sino e para onde cada aviso leva
  src/ausencia/        regras, consultas, cartão, ações e formulário
  src/gamificacao/     Minha pontuação, Ranking, Conquistas, selo de patente, "Parabéns!"
  src/vitoria/         painel, botão flutuante, conversa, SSE, figurinhas
  src/perfil/          o anonimato no ranking
  src/validacoes/      a fila de Validações do supervisor (consulta, destino de cada item, cartão)
  src/notificacoes/    o push: registro do aparelho, toque na notificação e a opção das Configurações
  src/emergencia/      o botão de emergência: contatos (com cópia no aparelho), lista para ligar e a janela do acionamento
  src/convites/        o convite para a APR: consultas, faixa, cartão de resposta e as contas
  src/estado/          TanStack Query e o indicador de conexão (NetInfo)
  src/ui/              componentes base (botão, campo, cartão, selo, aviso, janela, formulário RHF + Zod)
  src/tema/            as cores da web (ver o "Sistema visual" do README da web)
  src/config.ts        EXPO_PUBLIC_API_URL e EXPO_PUBLIC_WEB_URL
  src/polyfills.ts     crypto do expo-crypto no Hermes (ids gerados no aparelho)
  ../shared/           código comum à web, à api e ao app (importado como @shared/*)
```

**Rotas** (`src/app/`): `index` (leva ao destino da conta), `entrar`, `trocar-senha`, `aguardando`, `assinatura`, `somente-web`; as abas `(abas)/lista`, `avisos`, `pontos` e `perfil`; `os/[id]` e, dentro dele, `apr`, `checklist`, `aprovada`, `bloqueio`, `execucao` e `conferencia`; `materiais/index`, `materiais/nova` e `materiais/[id]`; `validacoes`, `convites`, `ausencias`, `historico`, `recusados`, `configuracoes`, `emails` e `senha`. Cada situação da conta abre só as telas dela (`Stack.Protected`).

- **`shared/api/`** tem os tipos das respostas e as regras puras que a web e o app repetiriam; as telas ficam em cada lado. `web/src/lib/<nome>.ts` só reexporta o de `shared/api/`.
- **O formulário nunca fica desativado por campo faltando** (só enquanto envia): a mensagem aparece junto do campo e o foco vai ao primeiro erro (`useFormulario`).

## Gerar o app

`pnpm android` compila o development build. O projeto nativo (`android/`) é gerado pelo `expo prebuild` e fica fora do git: nunca se edita à mão; o que for nativo entra no `app.config.ts` (ou num plugin de configuração).

## Gerar o APK e atualizar

O app de verdade sai de dois serviços da Expo, na conta `renanfelliphe9` (projeto `synq-os`): o **EAS Build** monta o APK nos servidores da Expo, e o **EAS Update** (`expo-updates`) entrega o JavaScript novo aos aparelhos que já têm o APK. Nada é montado na máquina, e o app não é publicado como serviço (nem no Coolify nem no Render) nem em loja.

### APK (EAS Build)

```bash
cd mobile
pnpm apk        # pnpm dlx eas-cli build --platform android --profile preview
```

- **O perfil `preview` do [`eas.json`](eas.json)** gera um APK de distribuição interna no canal `preview` e grava no build `EXPO_PUBLIC_API_URL` (a `api` oficial, `https`), `EXPO_PUBLIC_WEB_URL` e `APP_VERSION_CODE`. O `.env` da máquina não entra no build ([`.easignore`](../.easignore)).
- **O que sobe:** a pasta do repositório como está no disco, commitada ou não, menos o que o `.easignore` tira (`api`, `web`, documentos, dependências e o que é gerado); o que importa é `mobile/` e `shared/`. Commite antes, para o build ter um commit que o identifique.
- **Tempo:** no plano gratuito o build espera numa fila, que pode levar horas; a montagem em si leva uns 10 a 20 minutos. O andamento e o link ficam em [expo.dev](https://expo.dev/accounts/renanfelliphe9/projects/synq-os/builds).
- **Instalar:** abrir o link do build no Android (ou o QR code que o comando mostra) e liberar "instalar apps desconhecidos".
- **A chave de assinatura** é guardada pela Expo, nas credenciais do projeto (`eas credentials`), e é a mesma em todo build: o APK novo instala por cima do anterior sem desinstalar. Ela nunca vem ao repositório.
- **Push:** sem `GOOGLE_SERVICES_JSON` (o caminho do `google-services.json` do Firebase) o APK sai sem notificações push; o resto funciona.

### Atualização pelo ar (EAS Update)

```bash
cd mobile
pnpm atualizar --message "o que mudou"
```

- O app procura atualização ao abrir (`checkAutomatically: "ON_LOAD"`, em [`app.config.ts`](app.config.ts)) e a aplica **na abertura seguinte**.
- **O [`scripts/atualizar.ts`](scripts/atualizar.ts) usa os endereços do `eas.json`**, os mesmos do APK. O `eas update` monta o JavaScript na máquina e gravaria o `EXPO_PUBLIC_API_URL` do `.env`, que no desenvolvimento aponta para a `api` local; chamado direto, mandaria os aparelhos para lá.
- A atualização só chega aos APKs com o **mesmo `version`** (`runtimeVersion` com a política `appVersion`).

### Quando é preciso um APK novo

| Mudou | O que fazer |
|---|---|
| Telas, textos, regras do app, chamadas à `api`, imagens importadas pelo código (`src/`, `shared/`) | `pnpm atualizar` |
| Biblioteca com código nativo, plugin, permissão, ícone, nome, `google-services.json`, endereço da `api`, versão do Expo SDK | subir o `version` no `app.config.ts` **e** o `APP_VERSION_CODE` no `eas.json`, e rodar `pnpm apk` |

Subir o `version` separa as atualizações: as publicadas depois dele só chegam a quem instalar o APK novo, e os aparelhos com o APK antigo deixam de recebê-las. Sem subir, um JavaScript que conta com algo nativo que o APK antigo não tem quebra o app nesses aparelhos. Na dúvida, gere o APK.

## Ainda não conferido

As telas rodando num aparelho ou emulador: o desenho da assinatura com o dedo e o PNG gerado, o WebP animado das figurinhas, o teclado do chat, o layout, o banco abrindo no aparelho, a câmera sem sinal, o modo avião de verdade, o Android acordando o app fechado (a economia de bateria do fabricante pode adiar a tarefa) e o tempo da derivação da senha no Hermes (o custo está em `ITERACOES_DA_SENHA`; no Node leva ~160 ms).
