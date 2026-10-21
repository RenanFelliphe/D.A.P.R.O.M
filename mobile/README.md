# mobile

Aplicativo de campo do SYNQ OS (Android). Funciona online no dia a dia e tem um modo offline de contingência para aplicar a APR e executar a OS onde não há sinal.

> **Em andamento (19/10/2026).** Feitas as [pendências 1 a 6](../pendencias.md): o esqueleto, o login, a lista e o detalhe das OS, a **APR e a execução**, a **assinatura, o perfil, os avisos, as ausências, a gamificação e a Vitória** (tudo **online**) e, agora, a **cópia da equipe e a fila em SQLite**: a APR, a execução e o encerramento **sem sinal** ficam guardados no aparelho e sobem quando o sinal volta. O caminho ler OS → APR → executar → PDF roda no app. O login sem sinal e o envio com o app fechado também estão no código, e o **APK sai de um Dockerfile** (pendência 7, ver "Gerar o APK"). Falta ver tudo num aparelho. O plano das 20 etapas e o andamento de cada uma estão em [funcionalidades/mobile.md](../funcionalidades/mobile.md).

Ver a [especificação](../base/.design/especificacao.md) para escopo, contratos e decisões técnicas.

## O que já funciona

- **Entrar** pelo e-mail institucional e a senha; a sessão continua aberta ao fechar e reabrir o app (tokens no `expo-secure-store`) e se renova sozinha (`POST /auth/refresh`).
- **Cada conta no destino certo** depois do `GET /me`: senha provisória → "Defina sua senha"; aguardando liberação → tela de espera; administrador → aviso de que a gestão é na web; liberado sem assinatura → tela da assinatura, onde ela é desenhada com o dedo; técnico → lista de OS. O ausente abre com a faixa "Ausente até DD/MM" e só consulta.
- **Lista de OS da equipe** por status, com busca, "puxar para atualizar", a faixa "APR aguardando a sua assinatura" e o atalho para a execução aberta.
- **Detalhe da OS**: dados do SAP, local com mapa, ciclo da preventiva, checklist de inspeção, instruções, materiais recomendados, APRs da OS e histórico do equipamento ou do local; o **botão certo** para cada situação (Nova APR, Assinar a APR, Iniciar a execução, Continuar a execução, Preencher o encerramento) ou o motivo no lugar dele; o PDF da OS encerrada abre no leitor do aparelho.
- **Quatro abas** (OS, Avisos, Pontos, Perfil) e o indicador "Online" / "Sem conexão" no cabeçalho.
- **Assinatura** (`src/assinatura/`): a caixa de desenho (600 × 180, como a da web), "Limpar" e "Salvar"; o PNG sobe por `PUT /arquivos/{id}` e vira a assinatura do perfil (`PUT /me/assinatura`, com o "+N pontos" da primeira vez). Aparece no primeiro acesso, no "Refazer" do perfil e no lugar do aviso "cadastre a assinatura" das janelas de ação e da tela de assinaturas faltando da APR.
- **Perfil**: os dados (só leitura), a assinatura e as linhas para **Minhas ausências**, **OS que encerrei** (60 dias, com o PDF), **Preferências de e-mail** (as categorias obrigatórias travadas) e **Trocar a senha**; o anonimato no ranking e o Sair.
- **Avisos** (o sino): `GET /alertas` com "Não lidos" e "Todos"; tocar num aviso o marca como lido e, se ele tem tela no app (a OS, as assinaturas da APR, as ausências), leva a ela; o número na aba se atualiza a cada minuto. Não há push, por decisão do projeto.
- **Ausências**: pedir (o supervisor titular registra a própria, assinando), acompanhar com a linha do tempo, cancelar o pedido, confirmar o que o supervisor aprovou, recusar as datas, pedir o fim antecipado e confirmar o retorno. As datas são digitadas como `dd/mm/aaaa`. As respostas do supervisor aos pedidos dos outros ficam na web.
- **Pontos** (`src/gamificacao/`): Minha pontuação (patente com a barra até a próxima, pontos, posição, últimas conquistas e o extrato por temporada), Ranking de pessoas e de equipes (por temporada ou geral, com a própria linha em destaque) e Conquistas (as obtidas e o progresso das que faltam); a janela "Parabéns!" de conquista e de nova patente. Os cadastros de pontos, patentes e conquistas ficam só na web.
- **Vitória** (`src/vitoria/`): o botão flutuante em todas as telas de campo e o painel de conversa, com as sugestões fixas da tela (sem IA), as respostas locais (saudação, agradecimento, "fique triste"), a mensagem à `api`, as figurinhas e o "Me leve lá" para a tela equivalente do app; o que só existe na web abre no navegador quando `EXPO_PUBLIC_WEB_URL` está definida. Os treinamentos de serviço continuam na web.

- **APR em três etapas** (`src/app/os/[id]/apr.tsx`, `checklist.tsx`, `aprovada.tsx`): a janela de escolha do modelo, com a "Opção recomendada" e o aviso para conferir; os participantes da equipe (mínimo de 2; ausente não entra) e os riscos; o checklist com todas as perguntas iguais (Sim, Não e NA com observação), a grade para ir a qualquer pergunta, "Trocar o modelo" (as respostas iguais continuam) e a revisão com os materiais recomendados; "Concluir e validar" (`POST /aprs/avaliar`). **Aprovada**, é registrada na hora e cada participante assina na própria conta (ou recusa, com motivo); a execução só é liberada com todas as assinaturas. **Bloqueada**, já fica registrada, as respostas travam e a tela pede a evidência de cada item reprovado (observação e foto ou PDF, conforme o item); o técnico só descobre o que é eliminatório ao validar. O rascunho fica no aparelho até a APR ser concluída.
- **Execução** (`src/app/os/[id]/execucao.tsx`): iniciar (número de pessoas e localização), o cronômetro calculado do início e das pausas (não depende do app aberto), pausar e continuar com o motivo, suspender com o motivo, interromper por risco (motivo, ao menos 1 foto e assinatura), cancelar por engano (até 10 minutos, sem pausa), a execução esquecida de outro dia (suspender com a hora real do fim) e o **encerramento em dois passos**: "Encerrar OS" para o tempo; depois o checklist de inspeção, a descrição, fotos e PDFs opcionais e a assinatura do responsável. Depois o supervisor assina na web; o PDF abre no app.
- **Câmera, galeria e PDF** (`src/campo/`): a foto é comprimida (lado maior de ~1600 px, qualidade 70%) e sobe por `PUT /arquivos/{id}` **antes** do evento que a referencia; se o envio falhar, a foto fica guardada e "Enviar a foto de novo" repete o mesmo envio (o id é o mesmo, não duplica). A foto leva a posição quando a permissão de localização já foi dada.
- **Localização** (`expo-location`) no início, na pausa, na suspensão, na interrupção e no encerramento; sem GPS ou sem permissão, o serviço segue "sem localização", sem bloquear.

- **Modo offline** (`src/offline/`): o banco SQLite do aparelho (`synqos.db`) guarda a **cópia da equipe** (`POST /sync/pull`: OS, APRs, execuções, locais, atividades, modelos de APR com a orientação e a equipe) e a **fila**. **Toda escrita de campo grava na fila antes de enviar:** com sinal, o envio é em seguida e a tela se comporta como sempre; sem sinal, o registro fica guardado e a tela segue em frente, lendo da cópia local (a OS vai a "em execução", a APR aparece "aguardando validação"). A **APR sem sinal** é registrada como concluída, com os participantes presentes assinando por este aparelho (`assinatura_presencial`); o servidor a valida quando o sinal voltar e, se ela reprovar, avisa o supervisor (a execução feita não se perde). Fotos e PDFs tirados sem sinal ficam guardados na pasta de documentos do app e sobem antes dos registros que os citam.
- **Sincronização:** sobe a fila (arquivos primeiro, depois os eventos em ordem), baixa a cópia nova e nunca apaga uma OS que ainda tem registro esperando. Roda ao abrir o app, quando o sinal volta, ao voltar para o app, de minuto em minuto enquanto houver pendência e no botão **Sincronizar** do perfil, que também mostra quantos registros esperam e a hora da cópia. O registro que o servidor adia (por exemplo, a assinatura de outro aparelho que ainda não chegou) espera sem travar as outras OS; o que ele recusa de vez fica na lista **Registros recusados**, com o motivo, para o técnico mostrar ao supervisor.

- **Entrar e abrir o app sem sinal** (`src/sessao/`): no login com sinal, o app guarda no armazenamento seguro o **hash salgado da senha** (PBKDF2-SHA256, 30 mil iterações, em JavaScript puro com `@noble/hashes`; nunca a senha) e, no banco do aparelho, o último `GET /me`. **Com a sessão aberta**, o app abre sem sinal pelo último `GET /me` guardado; **sem sessão** (depois do Sair), o login confere a senha com o hash. Em ambos vale a janela de **7 dias** desde a última vez que o servidor confirmou a conta (um login ou um `GET /me` com sinal); passado isso, "Conecte-se para entrar". Quem entra só pela senha guardada não tem token: trabalha pela cópia local, e quando o sinal volta o app **refaz o login sozinho** com a senha que a pessoa acabou de digitar (guardada só na memória) e a fila sobe. A senha trocada na web só vale no aparelho depois do próximo login com sinal (a trocada no app vale na hora); a conta que o servidor recusa (desativada, senha redefinida) deixa de entrar sem sinal.
- **Aviso de pendentes e Sair:** uma faixa no alto de toda tela de campo diz **"Sem conexão — N registros pendentes"** (ou "N registros pendentes" enquanto a fila sobe, ou o erro que a pessoa precisa resolver), e o indicador do cabeçalho mostra **"Sincronizado hh:mm"**. O **Sair é recusado enquanto houver registro na fila** (a janela oferece "Sincronizar agora"): sair apagaria a sessão, e sem ela a fila não sobe.

**Ainda não conferido:** as telas rodando num aparelho ou emulador (o desenho com o dedo e o PNG que ele gera, o WebP animado das figurinhas, o teclado do chat, o layout, o banco abrindo no aparelho, a câmera sem sinal, o modo avião de verdade e o tempo da derivação da senha no Hermes, que não foi medido: no Node 30 mil iterações levam ~160 ms, e a conta é assíncrona para a tela não congelar). A validação até aqui foi por código, sem aparelho.

**Envio com o app fechado (pendência 6):** a tarefa `synqos-envio-em-segundo-plano` (`src/offline/segundo-plano.ts`, a regra, e `segundo-plano-nativo.ts`, a ligação com o Android) roda pelo `expo-background-task` (WorkManager): no mínimo a cada **15 minutos**, só com rede, e por conta do Android (a economia de bateria do fabricante pode atrasá-la). Ela lê os tokens do armazenamento seguro e a pessoa do último `GET /me` guardado, sobe a fila e baixa a cópia nova; não faz nada se a fila está vazia, se o app está na frente ou se não há sessão. O perfil mostra a última passada ("Enviado com o app fechado às hh:mm"). Como a tarefa tem de existir antes de qualquer tela, o app tem entrada própria (`index.ts`, que importa a tarefa e depois o `expo-router/entry`). Para testar num build de desenvolvimento: guarde um registro sem sinal, ligue o sinal, feche o app pelo gerenciador de tarefas e espere; o perfil mostra a hora da passada.

## Pré-requisitos

- Node 24 e `pnpm` (o mesmo da `api` e da `web`).
- Para rodar no aparelho ou no emulador: Android Studio (SDK e um emulador) ou um celular Android com a depuração por USB. O app usa módulos nativos (armazenamento seguro, SQLite, câmera e, depois, o segundo plano), então **não roda no Expo Go**: precisa do *development build* (`pnpm android`).

## Como rodar

```bash
cd mobile
pnpm install
cp .env.example .env        # aponta o app para a api (veja abaixo)
pnpm android                # compila o development build e abre no aparelho ou no emulador
pnpm start                  # só o servidor do Metro, com o build já instalado
```

**O endereço da `api`** vem de `EXPO_PUBLIC_API_URL` (nada fixo no código). No emulador Android, a máquina é `10.0.2.2` (`http://10.0.2.2:3333`); num celular de verdade, use o IP da máquina na rede. `APP_PERMITIR_HTTP=true` libera `http://` no build de desenvolvimento; o APK de produção usa `https` e não define essa variável. **`EXPO_PUBLIC_WEB_URL`** (opcional) é o endereço da web: o "Me leve lá" da Vitória abre nele o que só existe na web; sem ela, a resposta fica só em texto.

**Sem Supabase:** `cd api && pnpm dev:local` sobe a `api` inteira em memória, com uma conta de cada perfil (senha `synqos123`): `tiago.tecnico@empresa.com.br`, `sandra.supervisora@empresa.com.br`, `admin@empresa.com.br`. Use `PORT=3399` se a `api` de desenvolvimento já estiver na 3333.

## Scripts

| Comando | O que faz |
|---|---|
| `pnpm typecheck` | `tsc --noEmit` (estrito) |
| `pnpm lint` | `expo lint` (ESLint com a regra do Expo e dos hooks) |
| `pnpm test` | testes de unidade (`node --test`, 245 casos; 8 são do comando do APK e do plugin de assinatura): a janela de 7 dias, as credenciais e o hash da senha, o `GET /me` guardado e o carregador do app sem sinal, a faixa de pendentes, o Sair com fila, o esquema, a fila, a cópia, a projeção, a leitura local e o sincronizador do modo offline (num SQLite de verdade, o `node:sqlite`), cliente da `api`, eventos, destino da conta, o botão de ação do detalhe, o rascunho da APR no aparelho, a equipe da APR, a situação e o cronômetro da execução, os motivos, a hora real do fim, as rotas, o desenho da assinatura, as ausências, o destino dos avisos, a barra e as conquistas da gamificação e a Vitória (tela atual, "Me leve lá" e o fluxo SSE) |
| `pnpm apk` | gera o APK pelo Docker (ver "Gerar o APK"); `--simular` só mostra o comando |
| `pnpm conferir:api` | roda o cliente do app contra uma `api` de verdade (`API_URL=http://localhost:3399`): login de cada tipo de conta, lista, detalhe, renovação do token e envio de evento. **Só contra a `api` local em memória** |
| `pnpm conferir:campo` | percorre o fluxo de campo contra uma `api` de verdade: o modelo, a APR validada e registrada, as assinaturas de duas contas, iniciar, pausar, continuar, encerrar em dois passos com foto e PDF, cancelar por engano, interromper por risco, a APR bloqueada e a evidência. Usa as mesmas funções de `shared/` e o mesmo cliente das telas. **Só contra a `api` local em memória** (reinicie a `api` antes de repetir: o script consome OS liberadas) |
| `pnpm conferir:offline` | confere o modo offline contra uma `api` de verdade, com duas contas e um SQLite: a cópia da equipe e a leitura local **iguais às da `api`** (lista, busca, detalhe, escolha do modelo, modelo, equipe), a APR, a execução, a pausa e o encerramento sem sinal (6 registros na fila), a subida ao voltar o sinal, o reenvio sem duplicar, o evento adiado até a assinatura de outro aparelho chegar, a APR sem sinal que o servidor bloqueia (a execução é aplicada, D1) e o registro recusado. **Só contra a `api` local em memória** (reinicie a `api` antes de repetir: o script consome OS liberadas) |
| `pnpm conferir:sem-sinal` | confere o login sem sinal contra uma `api` de verdade: o login com sinal guarda o hash e o `GET /me`; sem sinal (um `fetch` que não chega) a senha certa entra e abre pelo `GET /me` guardado, igual ao do servidor, e a errada e a conta desconhecida não entram; o sinal volta e o login refeito abre a sessão; passados 7 dias, "Conecte-se para entrar"; e o erro da `api` nunca cai para a cópia. **Só contra a `api` local em memória** |
| `pnpm conferir:perfil` | confere o que a pendência 3 usa: a assinatura enviada e gravada, os avisos, as preferências de e-mail, o anonimato, a troca de senha, o pedido e o cancelamento de uma ausência, a gamificação (pontuação, extrato, ranking, conquistas) e o fluxo SSE da Vitória. **Só contra a `api` local em memória** |

## Como o código está organizado

```
mobile/
  app.config.ts        nome SYNQ OS, pacote br.synqos.app, permissões, plugins
  src/app/             rotas (Expo Router): entrar, trocar-senha, aguardando, assinatura, somente-web, (abas)/*, os/[id] e, dentro dele, apr, checklist, aprovada, bloqueio e execucao
  src/api/             cliente da api (cliente.ts, puro e testado), erros, eventos e arquivos, tokens no SecureStore
  src/sessao/          SessaoProvider (login com e sem sinal, sair, GET /me) e destino.ts (a regra de para onde cada conta vai); credenciais.ts (o hash da senha e a janela de 7 dias, puro e testado), derivar-senha.ts, eu.ts (o GET /me com e sem sinal, puro e testado) e sair.ts
  src/os/              lista e detalhe das OS; detalhe/acao.ts decide o botão certo; rotas.ts leva cada botão à tela de campo
  src/apr/             a APR: escolha do modelo, participantes e riscos, checklist, revisão, evidência, assinaturas; armazem.ts (o rascunho no aparelho, puro e testado) e rascunho.ts (o disco do app)
  src/execucao/        a execução: iniciar, em andamento (cronômetro, pausa, suspensão, interrupção, cancelamento), encerramento e checklist de inspeção
  src/campo/           o que a APR e a execução dividem: câmera, galeria e PDF (arquivos.ts, Evidencias.tsx), GPS, a janela de assinatura e o tratamento das falhas (useAcao)
  src/estado/          TanStack Query e o indicador de conexão (NetInfo)
  src/offline/         o modo offline: banco (banco.ts, esquema.ts, banco-nativo.ts), fila (fila.ts), cópia da equipe (copia.ts), projeção das ações pendentes (projecao.ts), leitura local no formato da api (leitura.ts), sincronizador (sincronizar.ts), escrita com fila (envio.ts), o `GET /me` guardado (identidade.ts), a faixa de pendentes (faixa.ts), as instâncias do app (app.ts), o provider e o cartão "Sincronização". Tudo menos os arquivos `*-nativo(s)`, `app.ts` e os componentes é puro e testado
  src/assinatura/      o desenho da assinatura (caixa com `react-native-svg`, `ControleDoDesenho` puro e testado) e o envio (`salvar.ts`)
  src/avisos/          o sino: consultas, o cartão do aviso e para onde cada aviso leva no app (`destino.ts`)
  src/ausencia/        as ausências: regras puras (`regras.ts`), consultas, o cartão, as ações assinadas e o formulário do pedido
  src/gamificacao/     Minha pontuação, Ranking, Conquistas, o selo de patente e a janela "Parabéns!"
  src/vitoria/         a Vitória: o painel, o botão flutuante, a conversa (`useConversa`), a tela atual, o SSE e as figurinhas
  src/perfil/          o anonimato no ranking
  src/ui/              componentes base (botão, campo, cartão, selo, aviso, janela, formulário com RHF + Zod)
  src/tema/            as cores da web
  ../shared/           código que a web, a api e o app usam (importado como @shared/*)
```

- **Rotas protegidas:** cada situação da conta abre só as telas dela (`Stack.Protected`); o `index` leva ao destino quando a situação muda.
- **`shared/api/`** tem os tipos das respostas da `api` e as regras puras que a web e o app repetiriam (`tipos`, `os-app`, `apr`, `formatar`, `eventos`…). As telas ficam em cada lado, que é o que não dá para compartilhar entre o DOM e o React Native; `web/src/lib/<nome>.ts` só reexporta o de `shared/api/`.
- **Toda escrita de campo passa por `enviarEvento` e `enviarArquivo` de `@/offline/app`**, que gravam na fila do aparelho antes de enviar (o `criarEnvio` de `src/api/eventos.ts` é o envio sem fila, só do sincronizador e da assinatura do perfil). **Toda leitura de campo passa por `lerDeOndeDer`** (`src/os/consultas.ts`, `src/apr/consultas.ts`, `src/execucao/consultas.ts`): lê da `api` e cai para a cópia local.
- **O formulário nunca fica desativado por campo faltando** (só enquanto envia); a mensagem aparece junto do campo e o foco vai para o primeiro erro (`useFormulario`).

## Gerar o app

`pnpm android` compila o development build. O projeto nativo (`android/`) é gerado pelo `expo prebuild` e fica fora do git: nunca se edita à mão; o que for nativo entra no `app.config.ts` ou num plugin (`plugins/`).

## Gerar o APK

O APK de produção sai do [Dockerfile](Dockerfile) do `mobile` (Decisão-chave 1 da especificação; não é publicado no Coolify). A imagem traz o JDK 17, o Android SDK (as versões que o React Native pede, lidas do arquivo dele), o Node e o pnpm, roda o `expo prebuild` e o Gradle (`assembleRelease`) e entrega **um arquivo**, `synq-os.apk`, já assinado e conferido com o `apksigner`. Só precisa do **Docker com BuildKit** (o Docker Desktop já vem assim); nada de Android Studio. A primeira vez baixa o SDK, o NDK e as dependências do Gradle e demora bem mais que as seguintes, que aproveitam o cache.

**O endereço da `api` é gravado no APK na hora do build** (`EXPO_PUBLIC_API_URL`) e é obrigatório. O build recusa `http://` (o APK de produção só fala `https`), a menos que se peça `--http`, só para um teste com a `api` local.

```bash
# na pasta mobile/ (o contexto do build é a raiz do repositório, por causa do shared/)
pnpm apk --api https://api.exemplo.com.br                       # APK de demonstração, chave descartável
pnpm apk --api https://api.exemplo.com.br --web https://app.exemplo.com.br          --chave ../chaves/synqos.keystore --senha ../chaves/synqos.senha --versao 2   # APK com a chave da empresa
# resultado: mobile/apk/synq-os.apk
```

O `pnpm apk` só monta e roda o `docker build`; o mesmo comando, direto, na raiz do repositório:

```bash
docker build -f mobile/Dockerfile --target saida --output type=local,dest=./mobile/apk   --build-arg EXPO_PUBLIC_API_URL=https://api.exemplo.com.br   --secret id=chave,src=./chaves/synqos.keystore --secret id=chave_senha,src=./chaves/synqos.senha .
```

| Opção (`pnpm apk`) | `--build-arg` / segredo | O que faz |
|---|---|---|
| `--api` | `EXPO_PUBLIC_API_URL` | Endereço da `api` (obrigatório) |
| `--web` | `EXPO_PUBLIC_WEB_URL` | Endereço da web, para o "Me leve lá" da Vitória (opcional) |
| `--http` | `APP_PERMITIR_HTTP=true` | Libera `http://`; só teste com a `api` local |
| `--versao` | `APP_VERSION_CODE` | Número que cresce a cada APK distribuído; o Android só instala por cima um número maior (padrão 1) |
| `--arquiteturas` | `ARQUITETURAS` | Padrão `arm64-v8a,armeabi-v7a,x86_64`; `arm64-v8a` sozinho, para celulares atuais, acelera o build |
| `--chave` e `--senha` | segredos `chave` e `chave_senha` | O arquivo `.keystore` e um arquivo só com a senha (do arquivo e da chave; apelido `synqos`) |
| `--saida` | — | Pasta do APK (padrão `mobile/apk`) |

**A chave de assinatura.** Sem `--chave`, o build cria uma chave **descartável** de demonstração (o aviso aparece no log): serve para instalar e testar, mas cada build gera outra, e o Android não instala um APK por cima de outro assinado com chave diferente (desinstale o app antes). Para a demo e qualquer distribuição, gere a chave **uma vez** e guarde-a fora do repositório (o `.gitignore` e o `Dockerfile.dockerignore` já barram `*.keystore`); **perdê-la impede atualizar o app nos aparelhos que já o têm**:

```bash
keytool -genkeypair -keystore synqos.keystore -alias synqos -keyalg RSA -keysize 2048 -validity 10000
printf '%s' 'a-senha-escolhida' > synqos.senha      # a mesma senha para o arquivo e para a chave
```

A chave e a senha entram como **segredos do BuildKit**: existem só durante o passo do Gradle e não ficam na imagem nem no histórico dela. O `plugins/assinatura-android.js` (plugin do Expo) faz o Gradle ler a chave de variáveis de ambiente (`SYNQOS_KEYSTORE`, `SYNQOS_KEYSTORE_SENHA`); sem elas (`pnpm android`), o release continua com a chave de depuração do template. O Dockerfile e o script `docker/gerar-apk.sh` ficam com LF (`.gitattributes`): com CRLF o script quebra no Linux.

**Instalar:** `adb install synq-os.apk` (depuração USB ligada) ou copiar o arquivo para o aparelho e abri-lo (liberar "instalar apps desconhecidos" para o gerenciador de arquivos). Num celular com o app já instalado, use um `--versao` maior e a **mesma chave**.

**Gamificação:** o app recebe só as páginas de consulta (Minha pontuação, Ranking e Conquistas), o aviso "Conquista desbloqueada" e "Nova patente", o "+N pontos" nas telas de APR e de execução (o `pontos_ganhos` de `POST /eventos`) e a opção de anonimato no perfil, tudo feito. Os cadastros de pontos, patentes e conquistas ficam só na web. A `api` já serve tudo (`/gamificacao/*`); ver [gameficacao.md](../base/funcionalidades/gameficacao.md), seção 8.4. A conquista de sincronização offline, "Sem sinal, sem problema" (pendência 8), é concedida pela `api` quando chega da fila o primeiro evento de uma OS feita sem sinal (a `api` o reconhece pela regra dos 60 s; o app não precisa dizer nada); vale 0 ponto e o aviso sai como o das demais conquistas.

**O que o app herda das correções da Reunião 3 (18/10/2026):** a `api` e a `web` já aplicam estas regras ([correcoes-da-reuniao-3.md](../base/funcionalidades/correcoes-da-reuniao-3.md)); o app só as cumpre do lado dele.

- **Assinatura da APR por participante.** Online, cada participante assina a APR na própria conta (`apr_assinada`), vê o aviso "APR aguardando a sua assinatura" e o direito de recusa (`apr_recusada`, com motivo). No offline, que é contingência, o responsável registra a APR com `assinatura_presencial: true` no aparelho dele e as assinaturas dos perfis são copiadas na hora, marcadas como presenciais.
- **Localização nos cinco momentos.** O app envia `latitude` e `longitude` (as duas, ou nenhuma) no início da execução, na pausa, na suspensão, na interrupção e no encerramento. Sem GPS (permissão negada ou local coberto), o serviço não é bloqueado: fica "sem localização". A tela avisa o técnico que a localização é registrada nesses momentos.
- **Encerramento em dois passos.** O clique em "Encerrar OS", depois de uma confirmação, grava o fim (`execucao_encerrada`) e o tempo para; o preenchimento (descrição e fotos opcionais, checklist) e a assinatura do responsável vêm depois (`encerramento_assinado`) e não entram no tempo.
- **Motivo obrigatório na pausa e na suspensão**, escolhido numa lista (com o complemento em "aguardando" e "outro"). Lesão e enfermidade avisam o supervisor na hora.
- **Sincronização em segundo plano** (item 18 da Reunião 3). Com o app aberto, a fila é enviada assim que o sinal volta (**feito**, pendência 4). Com o app fechado (pendência 6, **feito**), é enviada no próximo intervalo que o Android libera para tarefas em segundo plano, por volta de 15 minutos. O `execucao_iniciada` que depende de uma assinatura dada em outro aparelho fica pendente na fila, em vez de ser recusado, até a assinatura chegar.
