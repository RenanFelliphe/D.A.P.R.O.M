# Funcionalidades — situação em 13/10/2026

> Registro de duas análises feitas em 13/10/2026: o estado das funcionalidades essenciais (o que a especificação exige para a demo) e o das funcionalidades extras (ideias do time e dos mentores, fora do MVP). Para cada uma, diz o que está pronto, o que falta e o que vale fazer primeiro.
>
> Fontes: [especificação](base/.design/especificacao.md), [DesignDoc](DesignDoc.md), [pontos a validar](base/.design/pontos-a-validar.md), [resumo da Reunião 2](base/reunioes/correcoes-reuniao-2-resumo.md), a [transcrição da Reunião 2](base/reunioes/Transcricao_Reuniao2.md) e o registro da [entrega de 13/10](Entrega-2026-10-13.md).

## Resumo

- A `api` e a `web` cobrem o fluxo inteiro **online**: ler a OS → APR → executar → PDF, com painel, alertas, indicadores e auditoria.
- O que falta das essenciais é o **app `mobile`** (Android), e com ele o **modo offline**. A especificação exige os dois no critério de sucesso da demo.
- Das extras, as três ligadas ao fluxo já estavam prontas (OS de apoio, assinatura no perfil, equipe automática). As demais não tinham começado.
- **Decisão de 13/10/2026:** antes do app, implementar três extras: a **evidência em PDF**, o **catálogo de serviço com os materiais** e o **intervalo entre ciclos das preventivas**. As três foram feitas no mesmo dia (seção 3). O próximo passo das essenciais continua sendo o app.

---

## 1. Funcionalidades essenciais

### 1.1 Estado por fatia da especificação

Na ordem de implementação da especificação.

| Fatia | Situação |
|---|---|
| Plataforma | **Pronta.** Monorepo, Dockerfiles, `docker-compose`, migrações, buckets privados, fila de tarefas e modo local sem Supabase (`pnpm dev:local`) |
| Usuário e Equipe | **Pronta.** Login pelo e-mail institucional, troca de senha no primeiro acesso, perfis `tecnico` e `admin`, supervisor apontado pela equipe, cadastro de técnico pelo supervisor com liberação do admin, Campo de treino, assinatura no perfil e auditoria |
| Integração SAP | **Pronta com o simulador**, a planilha e o PDF da OS. Falta o contrato da API real (questão 43, do Iago). A digitalização pela câmera ainda é só protótipo |
| Modelo de APR | **Pronta.** 8 modelos da carga inicial, versões imutáveis, editor, tabela de atividades e arquivamento |
| Eventos | **Pronta na `api`.** `POST /eventos` idempotente, `POST /sync/pull` (snapshot da equipe) e tolerância à fila offline. Hoje só a web usa |
| APR | **Pronta na web.** Checklist inteiro, validação no servidor (`POST /aprs/avaliar`), evidência pedida só depois e APR bloqueada registrada na validação |
| Execução | **Pronta na web.** Pausa com motivo, suspender, interromper por risco, cancelar por engano, assinaturas e PDF de 2 páginas |
| Impedimento | **Pronta.** OS pendente, alerta no painel e por e-mail, reprogramação e OS de apoio |
| Painel | **Pronta.** Quadro, detalhe da OS, ciência, 4 dashboards (com o tempo de execução), exportação para baixa no SAP e busca global |
| **App mobile e modo offline** | **Não iniciados.** A pasta [`mobile/`](mobile/) só tem o README |

Validação registrada na entrega de 13/10: 366 testes da `api`, `tsc`, `eslint` e `next build` sem erros.

### 1.2 Lista "Funcionalidades essenciais" do DesignDoc

| Funcionalidade | Situação |
|---|---|
| Validar a permissão de executar a OS depois da análise da APR | **Pronta** (`api` e web) |
| Documentação comprobatória do obstáculo (imagem, PDF…) por item reprovado | **Pronta.** Era parcial (só foto ou texto); o PDF foi feito em 13/10/2026 (seção 3) |
| Sincronização automática e manual dos dados offline | **Só na `api`.** Falta o cliente: o app com a fila local |
| Token temporário guardado no aparelho para o login offline | **Não feito.** Depende do app |
| Ler a equipe definida na OS (atribuição automática) | **Pronta.** A equipe sai do centro de trabalho da OS |

### 1.3 As essenciais estão prontas?

**No navegador, sim.** O caminho ler OS → APR → executar → PDF funciona de ponta a ponta.

**Pelo critério da especificação, não.** A seção "Sucesso" pede esse caminho "no app Android e no navegador" e, como contingência, "num Android em modo avião". Essa parte está em 0%.

### 1.4 Próxima funcionalidade essencial: o app mobile, começando pelo modo online

Por quê:

1. **É a única fatia sem código** e faz parte do critério de sucesso. Sem o app não há demo de campo, nem online nem sem sinal.
2. **A `api` já está pronta para ele.** O envio idempotente, o snapshot da equipe, a regra dos 60 s para a fila offline e o envio da fila por usuário desativado estão feitos e testados. O app é basicamente um cliente.
3. **É o maior risco de prazo**, como a própria especificação diz. O contrato dos eventos é a decisão mais difícil de desfazer, e um cliente de verdade, com fila, o prova enquanto ainda não existe aparelho com fila pendente.
4. **As outras frentes dependem de terceiros:** a API real do SAP espera o contrato do Iago, a leitura do PDF real espera um exemplo com texto e a regra da OS sem atividade espera uma decisão do time.

Ordem sugerida:

1. Esqueleto React Native para Android, login pelo e-mail e lista e detalhe das OS da equipe. Primeira escolha: Expo (recomendado: câmera, SQLite, armazenamento seguro e APK gerado localmente) ou React Native puro.
2. APR e execução online, com os mesmos `POST /aprs/avaliar` e `POST /eventos` da web, câmera e assinatura nativas. As telas `/app/*` da web são a referência de layout.
3. Modo offline: fila em SQLite, `POST /sync/pull`, login de contingência e o aviso "N registros pendentes".
4. Dockerfile que gera o APK.

### 1.5 Pendências pequenas, antes ou em paralelo

- **Decidir o modelo da APR para OS sem atividade.** Hoje o técnico escolhe o modelo, e o time já considerou isso errado. Se o app nascer assim, repete o problema. Precisa estar decidido antes da etapa 2 do app.
- **Documentação desatualizada.**
  - O [README](README.md) ainda diz que as telas "não são módulos funcionais conectados" e que a arquitetura "não está implementada".
  - Também diz que o cadastro pelo supervisor e o Campo de treino estão "planejados", e os dois já foram feitos.
  - A seção "Situação" da [especificação](base/.design/especificacao.md) diz que só a `web` tem código.
- **Carga de demonstração:** o `popularDemo` quebra entre meia-noite e 2h. Só importa se a demo for preparada nesse horário.

---

## 2. Funcionalidades extras

Ideias do [DesignDoc](DesignDoc.md) ("Prioridades" e "Extras") e sugestões da Reunião 2. Nenhuma é exigida pela especificação: a questão 45 e o resumo da Reunião 2 as deixam fora do MVP, guardadas para a apresentação final.

### 2.1 O que está pronto

| Ideia | Origem | Situação |
|---|---|---|
| OS de apoio | DesignDoc (prioridades) | **Pronta** |
| Assinatura cadastrada no perfil (rubrica ou por extenso) | DesignDoc (prioridades) | **Pronta.** Desenhada no perfil, confirmada a cada uso e impressa no PDF. Não há certificado digital (ICP-Brasil); falta o Iago dizer se a assinatura desenhada vale para auditoria (questão 38) |
| Equipe atribuída automaticamente | DesignDoc (essenciais) | **Pronta.** A equipe sai do centro de trabalho da OS |
| Evidência em PDF, além de foto ou texto | DesignDoc (essenciais) | Não feita na análise (adiada na questão 46). **Implementada nesta rodada** (seção 3) |
| Catálogo de serviço com os materiais | DesignDoc (prioridades) | Não feito na análise: os materiais chegavam só como texto na descrição da OS. **Implementado nesta rodada** (seção 3) |
| Escaneamento de OS e APR antigas | DesignDoc (prioridades) | **Não feito.** A "Digitalização" da tela de importação só abre a câmera: não lê o texto nem grava |
| Intervalo entre ciclos das preventivas | DesignDoc (prioridades) | Não feito na análise: só existia o indicador mensal (preventivas encerradas e atrasadas, com ou sem justificativa). **Implementado nesta rodada** (seção 3.3) |
| Chatbot de consulta | Iago, na Reunião 2 | **Não feito.** Os exemplos dele ("o que eu executei em maio", "tudo o que a equipe X executou em 2025") já se respondem por filtro, em "Meus resultados" e na exportação do dashboard de OS |
| Gamificação | Time, na Reunião 2 | **Não feita.** Os rankings atuais são de itens reprovados e de locais, não de pessoas |
| API de funcionários para cadastro rápido | DesignDoc (extras) | **Não feita.** As contas são criadas uma a uma, pelo admin ou pelo supervisor |

### 2.2 Vale a pena fazer antes do app?

**A recomendação da análise foi não**, por três motivos:

1. **Já estava decidido.** A questão 45 e o resumo da Reunião 2 deixam essas ideias fora do MVP, e o app faz parte do critério de sucesso.
2. **Metade depende de algo que o time não tem:**
   - catálogo: a lista de materiais por serviço, e o Iago disse que os códigos do plano vão mudar;
   - escaneamento: leitura de texto em imagem (OCR), e os exemplos de OS são só imagem;
   - API de funcionários: não existe sistema de RH nem contrato;
   - assinatura certificada: a resposta da questão 38.
3. **O app é o maior risco de prazo.** Cada semana em extras sai do tempo dele.

O time decidiu, mesmo assim, implementar já as duas da seção 3.

### 2.3 Depois do app, as que valem

- **Chatbot: a melhor escolha.** É a única pedida pelo cliente e roda sobre a web pronta. Antes, decidir quem fornece a IA: no protótipo, mandar dados fictícios a um serviço externo não tem problema, mas no piloto a empresa precisa aprovar (LGPD). O chatbot deve consultar pelas mesmas rotas da `api`, com o token de quem pergunta: herda as permissões, e o técnico não descobre por ele o que é eliminatório.
- **Intervalo das preventivas:** feito em 13/10/2026 (seção 3.3). O risco que continua é a mudança nos códigos do plano: o plano novo começa sem histórico e sem intervalo, e aparece na Importação para definir.
- **Gamificação: com cuidado.** Premiar a quantidade de OS empurra a equipe a apressar a APR, o contrário do que o sistema protege. Se entrar, deve premiar o cumprimento das regras (APR completa, evidências, ciência), não o volume.

A ordem só se inverteria se a próxima apresentação aos mentores caísse antes de o app ter algo para mostrar: aí o chatbot seria a vitrine mais rápida.

---

## 3. Extras implementadas nesta rodada

### 3.1 Evidência em PDF

**Estado:** em implementação.

### 3.2 Catálogo de serviço com os materiais

**Estado:** em implementação.

### 3.3 Intervalo entre ciclos das preventivas

**Estado:** feito em 13/10/2026. Detalhes na [especificação](base/.design/especificacao.md#ciclo-das-preventivas); a pergunta ao Iago é a questão 66 dos [pontos a validar](base/.design/pontos-a-validar.md).

**A regra:** o sistema **não cria OS preventiva** a cada ciclo. As OS continuam vindo do SAP; o sistema conta o tempo até o próximo ciclo de cada plano de manutenção (plano + item) e **avisa** quem planeja:

- **ciclo próximo** (`preventiva_proxima`): quando o vencimento entra na antecedência do plano (7 dias por padrão);
- **ciclo vencido** (`preventiva_vencida`): quando vence sem OS nova do plano.

Cada alerta sai uma vez por vencimento, para o supervisor da equipe da última OS (sem supervisor, os admins), e aparece nas notificações com o detalhe do ciclo. A OS do ciclo seguinte que chega do SAP reinicia a contagem.

**Intervalo:** `n` dias, semanas, quinzenas (15 dias), meses, bimestres, trimestres, semestres ou anos. O próximo ciclo conta do **encerramento** da última OS (padrão) ou da **data programada** dela (calendário fixo).

**Onde aparece:**

| Lugar | O que tem |
|---|---|
| Quadro de OS, botão **OS preventivas** (admin e supervisor) | janela com a contagem regressiva de cada preventiva ("Faltam 12 dias", "Vencido há 3 dias"), a barra do ciclo, os totais por situação (vencido, vence em breve, aguardando execução, em dia), a busca, o histórico de cada plano e a edição do ciclo. O botão mostra quantas pedem atenção |
| Importação: coluna da planilha | `Intervalo` ou `Periodicidade` ("3 meses", "30 dias", "trimestral"); valor que não dá para entender vira aviso, e a OS entra |
| Importação: conferência do PDF | campo "Intervalo entre ciclos" na preventiva com plano, preenchido pela Periodicidade impressa ou pelo que o plano já tem |
| Importação: resultado e seção "Intervalo das preventivas" | as preventivas que entraram sem intervalo, com o campo para definir ali mesmo |
| API do SAP (e o simulador) | campo opcional `intervalo_ciclo` na ordem |
| Notificações | os dois alertas de ciclo, com a situação do plano agora e o atalho para a janela |
| Detalhe da OS preventiva | cartão "Ciclo da preventiva": intervalo, próximo ciclo e, se a OS é de um ciclo anterior, qual é a última |
| Dashboard de OS | bloco "Ciclo das preventivas" na carteira de agora |
| Auditoria | quem definiu, mudou, pausou ou retomou o ciclo |

**O que veio junto, para o ciclo ficar completo:**

1. **Histórico do plano:** cada ciclo (OS) com a data programada, o vencimento que o ciclo anterior marcou, o encerramento e o atraso; o cumprimento (ciclos no prazo e com atraso) e o intervalo real médio contra o definido.
2. **Próximas datas:** os 6 próximos ciclos projetados.
3. **Pausa do ciclo:** sem contagem nem alertas (equipamento fora de operação, plano suspenso no SAP), com observação.
4. **Antecedência por plano:** quantos dias antes o aviso sai.
5. **Permissões:** todos veem o próprio escopo (a equipe da última OS); só o admin e o supervisor da equipe definem o ciclo.
6. **Carga:** a migração cria os planos das OS preventivas que já existiam (sem intervalo); a demonstração traz planos em todas as situações e um plano com dois ciclos.

**Validação:** 16 testes novos na `api` (cálculo, situações, alertas, edição, importação pela API, planilha e PDF, fuso do encerramento), o teste do schema e o da demonstração atualizados; `tsc`, `eslint` e `next build` da `web` sem erros.
