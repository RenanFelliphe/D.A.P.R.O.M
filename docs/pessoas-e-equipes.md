# Pessoas e equipes

Quem usa o SYNQ OS, como entra, como se organiza em equipes e como é avisado. Este documento diz **o que** o sistema faz e com que regras; **como** é construído está em [especificacao.md](especificacao.md), e o que falta ou está em aberto, em [../pendencias.md](../pendencias.md).

Documentos vizinhos: a APR, a execução e a OS em [operacao-de-campo.md](operacao-de-campo.md); o registro de funcionários simulado (o simulador, a leitura diária, o aviso de desligamento) em [integracoes-simuladas.md](integracoes-simuladas.md); pontos, conquistas e treinamentos de serviço em [gamificacao-e-treinamentos.md](gamificacao-e-treinamentos.md); a Vitória em [ia-e-vitoria.md](ia-e-vitoria.md).

## 1. Perfis e papéis

### 1.1 Perfis

Só existem dois perfis (`PERFIS`, em [`api/src/db/schema/usuarios.ts`](../api/src/db/schema/usuarios.ts)):

| Perfil | Quem é | O que faz |
|---|---|---|
| `tecnico` | quem está em campo | aplica APR, executa OS (web ou app, também sem sinal), pede ausência, joga os treinamentos |
| `admin` | quem cuida da plataforma | usuários e equipes, importação de OS, modelos de APR, critério de bloqueio, catálogo, gamificação, IA. **Não executa OS**: não aplica APR, não pede nem registra ausência, não joga nem aparece no ranking |

A Segurança do Trabalho e o analista não usam o sistema: o critério de bloqueio que a Segurança define é cadastrado pelo admin no editor de modelos.

### 1.2 Papéis derivados

Dois papéis não são perfis; saem dos dados da equipe e valem a cada chamada da `api`:

| Papel | Quem é | Onde está |
|---|---|---|
| **Supervisor** | quem a equipe aponta em `equipe.supervisor_id` (seção 4) | `UsuarioAutenticado.equipesSupervisionadas` |
| **Representante** | o membro da equipe que assume a supervisão quando o supervisor está ausente, parado ou falta (seção 6) | `UsuarioAutenticado.equipesRepresentadas`, que também entram em `equipesSupervisionadas` |

Toda permissão de supervisão passa por `equipesSupervisionadas` ([`api/src/http/autenticacao.ts`](../api/src/http/autenticacao.ts)): o papel `supervisor` de `exigirPerfil` casa com quem supervisiona ao menos uma equipe (`ehSupervisor`). Só o supervisor **titular** (não o representante) registra a própria ausência e designa o representante (`ehSupervisorTitular`).

O supervisor da equipe não se confunde com o `responsavel` que lidera a APR em campo (o "Supervisor da Atividade" do modelo em papel).

### 1.3 Quem faz o quê

| Ação | Técnico | Supervisor (nas equipes que supervisiona) | Admin |
|---|---|---|---|
| Aplicar APR e executar OS | sim | sim | não |
| Ver as OS e o quadro | própria equipe | própria equipe e as supervisionadas | todas |
| Reservar, devolver ao SAP e reprogramar OS | — | sim | reprogramar sim |
| Assinatura final na OS (a antiga "ciência") | — | sim | — |
| Responder ausências da equipe | — | sim | só consulta |
| Cadastrar técnicos | — | só técnicos de setor de equipe dele, que nascem pendentes | qualquer perfil, já liberado |
| Liberar ou recusar cadastro, editar perfil e equipe, desativar | — | — | sim |
| Criar e editar equipes, escolher o supervisor | — | — | sim |
| Designar o representante | — | o titular | sim |
| Página Validações (seção 5) | — | sim | — (`403`) |

As regras de cada ação de campo e de gestão da OS estão em [operacao-de-campo.md](operacao-de-campo.md).

### 1.4 Web e app

O perfil define o que a pessoa pode fazer; a plataforma não. Web e app aceitam qualquer perfil. O app tem as telas de campo (OS, APR, execução, avisos, pontos, perfil, ausências e Vitória); a gestão fica na web, e o admin que entra no app é avisado disso. A web é responsiva e funciona no navegador do celular.

## 2. Conta

### 2.1 Login pelo e-mail institucional

- **O login é o e-mail institucional**, sempre em minúsculas (`usuario.email`), o mesmo da conta no Supabase Auth e o destino dos e-mails de aviso.
- **A matrícula só identifica a pessoa** na empresa (PDF da OS, SAP). Não é login e não muda.
- **Senha provisória:** toda conta nasce com a senha inicial definida por quem cadastrou; no primeiro acesso a pessoa só consegue trocá-la (`403 senha_provisoria` no resto).
- **Esqueci a senha:** só pelo admin (`POST /usuarios/{id}/redefinir-senha`), que gera uma nova senha provisória; a pessoa recebe o aviso `senha_redefinida` (a senha nunca vai no aviso).
- **Recusas do login:** e-mail sem conta (`401 usuario_inexistente`), senha errada (`401 senha_incorreta`), cadastro recusado (`403 acesso_recusado`, com o motivo), conta desativada (`401 acesso_revogado`).
- **Sem sinal, no app:** quem já entrou no aparelho abre o app sem sinal por até 7 dias desde a última confirmação do servidor (`JANELA_SEM_SINAL_DIAS`, em `mobile/src/sessao/janela.ts`). O detalhe está em [especificacao.md](especificacao.md).
- **Sair:** `POST /auth/sair` derruba as sessões da conta; no app, é recusado enquanto houver registros na fila sem enviar.

### 2.2 Pedido de conta na tela de entrada

Quem trabalha na empresa e ainda não tem conta pede uma na tela de entrada da **web**: "Ainda não tem uma conta? **Solicite**" leva a `/app/entrar/solicitar`, aberta sem login. O app não tem o pedido.

- **O que se informa:** o nome completo, o e-mail institucional e, se quiser, a equipe ("Não sei ou prefiro não informar").
- **O pedido não cria a conta.** Ele só avisa quem cadastra; a conta nasce pelo cadastro de sempre (seção 2.3).
- **Quem é avisado** (`conta_solicitada`, no sino e por e-mail na categoria Equipe): todos os administradores ativos e, com a equipe informada, quem responde por ela (o supervisor ou o representante no comando: `destinatariosDaEquipe`). Cada pessoa recebe um aviso só.
- **A tela sempre responde "Pedido enviado"** (`202 {recebida: true}`), para ninguém descobrir pela tela de entrada quem tem conta. E-mail que já tem conta não gera pedido nem aviso.
- **Um pedido pendente por e-mail:** pedir de novo só atualiza o nome e a equipe, sem avisar outra vez.
- **Proteção contra enxurrada:** acima de `LIMITE_DE_PEDIDOS_POR_HORA` (30) pedidos novos na última hora, de todo mundo, a rota responde `429 muitos_pedidos`.
- **Onde se trata:** o painel "Pedidos de conta" em Equipes e usuários (`/app/usuarios#solicitacoes`). O admin vê todos; quem supervisiona, os que escolheram uma equipe dele. "Cadastrar" abre o cadastro com o e-mail preenchido (a matrícula vem do registro); "Descartar" pede confirmação e fica na auditoria (`usuario.descartar_pedido_de_conta`).
- **Como termina:** `atendida`, sozinho, quando alguém cadastra uma conta com o mesmo e-mail (`atenderSolicitacao`); ou `descartada`. Depois disso a pessoa pode pedir de novo.

Rotas: `GET /solicitacoes-conta/equipes` e `POST /solicitacoes-conta` (abertas); `GET /solicitacoes-conta` e `POST /solicitacoes-conta/{id}/descartar` (admin e quem supervisiona). Código em [`api/src/dominio/solicitacao-conta.ts`](../api/src/dominio/solicitacao-conta.ts).

### 2.3 Cadastro a partir do registro de funcionários

Só quem está no registro de funcionários vira usuário. O cadastro tem duas etapas:

1. **Consultar:** quem cadastra informa a matrícula e o e-mail; a web chama `GET /rh/funcionarios/{matricula}?email=` e mostra a prévia (nome, cargo, setor, CREA, situação, a equipe sugerida pelo setor e se a pessoa já tem conta, `conta_existente`).
2. **Confirmar:** `POST /usuarios` `{matricula, email, perfil?, equipe_id?, senha_inicial}`. **A `api` consulta o registro de novo** e grava o nome, o cargo e o registro profissional de lá; não confia na prévia.

| Quem cadastra | Perfil | Equipe | Liberação |
|---|---|---|---|
| Admin | escolhe (obrigatório) | sem `equipe_id`, a do setor; `null`, sem equipe; ou outra que escolher | nasce `liberado` |
| Supervisor | sempre `tecnico` (`403` se pedir `admin`) | sempre a do setor, que precisa ser de uma equipe dele | nasce `pendente` |

Recusas (na ordem): matrícula fora do registro `404 funcionario_nao_encontrado`; e-mail que não é o da matrícula `422 email_nao_confere` (sem revelar o certo); afastado ou desligado `409 funcionario_afastado` ou `409 funcionario_desligado`; supervisor e setor que não é dele `403 fora_da_supervisao`; registro fora do ar `503 registro_indisponivel`; matrícula ou e-mail já cadastrados `409 matricula_duplicada` ou `409 email_duplicado`.

Ao cadastrar, a pessoa recebe o aviso `conta_criada` (a senha provisória vem de quem cadastrou), o pedido de conta com o mesmo e-mail fica atendido e, se o cadastro é do supervisor, os administradores recebem `cadastro_pendente`. O registro em si está em [integracoes-simuladas.md](integracoes-simuladas.md).

### 2.4 Liberação do técnico cadastrado pelo supervisor

Os estados estão em `LIBERACOES` (`usuario.liberacao`):

| Estado | O que a pessoa faz |
|---|---|
| `pendente` | entra, troca a senha, faz o Campo de treino, joga os treinamentos de serviço, conversa com a Vitória e ajusta as preferências de e-mail. O resto responde `403 aguardando_liberacao`. Não aparece como colega, membro, na busca, no snapshot offline nem nos indicadores. A assinatura ainda não é cobrada |
| `liberado` | usa o sistema (depois de cadastrar a assinatura, seção 3) |
| `recusado` | não entra mais: no login `403 acesso_recusado` com o motivo; nas demais rotas `401 acesso_revogado` |

- **Só o admin libera ou recusa** (`POST /usuarios/{id}/liberar` e `/recusar` com `{motivo}` obrigatório), e só quem está `pendente` (senão `409 nao_pendente`). As duas decisões são assinadas (seção 3.2).
- **Avisos:** a pessoa recebe `acesso_liberado` ou `acesso_recusado` (este sai por e-mail mesmo com a conta sem acesso); o supervisor que cadastrou, `cadastro_liberado` ou `cadastro_recusado`; o `cadastro_pendente` sai do "não lido" de todos os admins.
- **O supervisor** vê os pendentes e recusados das equipes dele e só cancela (`DELETE`) o pendente que ele mesmo cadastrou. Não edita ninguém (`PATCH` é `403`) nem redefine senha. Se deixa de supervisionar a equipe, os pendentes dele ficam para o admin.
- **O recusado** é removido pelo admin com o `DELETE` comum, o que libera o e-mail e a matrícula para um novo cadastro.

### 2.5 Campo de treino

O Campo de treino é a interface inteira com dados fictícios, para aprender sem mexer em nada real.

- **Quem:** o técnico (o supervisor incluso, que é técnico). O admin não tem a tela de boas-vindas.
- **Primeiro acesso:** a tela "Bem-vindo ao Campo de Treino!" oferece **Direcionado** (tutorial com balões) e **Livre** (a interface liberada com os dados fictícios).
- **Saídas:** **Pular** grava `pulado` e a tela não volta; **Fazer depois** some nesta sessão e volta no próximo acesso.
- **Sempre acessível** pelo menu, com "Recomeçar treino". Um selo "TREINO" fica visível o tempo todo.
- **Os dados fictícios** ficam na web, por usuário; a `api` real nunca é chamada em modo treino. A `api` guarda só o estado (`usuario.treinamento_estado`: `nao_iniciado`, `concluido` ou `pulado`, por `PUT /me/treinamento`).
- **Quem aguarda a liberação** pode fazer o treino enquanto espera. A assinatura não é cobrada no treino: o técnico fictício já tem uma.
- **Concluir o treino pontua o técnico** uma vez por conta ([gamificacao-e-treinamentos.md](gamificacao-e-treinamentos.md)).

### 2.6 Edição, senha e remoção

- **Nome, e-mail, cargo e registro profissional não se editam:** vêm do registro. O admin usa "Atualizar do registro" (`POST /usuarios/{id}/atualizar-do-registro`), que copia os dados (trocar o e-mail troca também o login) e, se o registro diz que a pessoa saiu, desativa a conta.
- **O admin altera só o perfil, a equipe e se a conta está ativa** (`PATCH /usuarios/{id}`). Ativar e desativar só vale para quem já está liberado (`409 usuario_nao_liberado`). Ninguém se desativa nem se rebaixa (`422 auto_alteracao`).
- **Remover** (`DELETE /usuarios/{id}`) só vale para quem não deixou histórico (APR, execução, assinatura, evento, alerta ou equipe sob sua supervisão): senão `409 usuario_com_historico`, e a saída é desativar. A remoção apaga junto os pontos e os avisos da conta.

### 2.7 Desligamento e readmissão

**O automático só tira acesso; quem dá acesso é sempre uma pessoa.** O registro de funcionários avisa o desligamento na hora e uma leitura diária confere todo mundo ([integracoes-simuladas.md](integracoes-simuladas.md)). O efeito na conta (`aplicarConferencia`, em [`api/src/dominio/rh.ts`](../api/src/dominio/rh.ts)):

| Situação no registro | Efeito na conta |
|---|---|
| `ativo` | atualiza os dados, se mudaram |
| `afastado` | só grava a situação (não é a ausência da seção 7, e vice-versa) |
| `desligado` ou `fora_do_registro`, conta liberada e ativa | desativa, como a desativação pelo admin |
| `desligado` ou `fora_do_registro`, conta pendente | vira recusada, com o motivo "Desligado no registro de funcionários" |

- **Conta desativada:** a `api` recusa a pessoa na hora (`401 acesso_revogado`), menos o envio da fila offline pendente, que ainda sobe; depois a sessão é revogada.
- **O último admin ativo** nunca é desativado pela conferência: a situação é gravada e a decisão fica para uma pessoa.
- **Avisos:** a equipe recebe `membro_desativado` (com quantas OS continuam reservadas para a pessoa); o supervisor desativado deixa a equipe sem supervisor (seção 6.1).
- **Auditoria:** as ações da conferência entram com o ator "Registro de funcionários".
- **Readmissão:** quem volta a `ativo` no registro **continua com a conta desativada**. Os administradores recebem `funcionario_readmitido`, uma vez por readmissão, com o botão **"Reativar a conta"** no próprio aviso (reativação em um clique). Reativar (`PATCH` com `ativo: true`) consulta o registro de novo: desligado ou fora dele é `409 funcionario_desligado`; afastado, `409 funcionario_afastado`. Reativada, a pessoa recebe `acesso_liberado` e os avisos de readmissão saem do "não lido".
- **O cadastro recusado por desligamento** não é reativado: a pessoa readmitida é cadastrada de novo, depois de o recusado ser removido.

## 3. Assinatura

A assinatura é o desenho que a pessoa faz no perfil (com o mouse na web, com o dedo no app). Ela valida as ações importantes no lugar de um simples "confirmar" e vai impressa no PDF da OS. Não é certificado digital; a validade para auditoria está em [../pendencias.md](../pendencias.md).

### 3.1 Cadastro obrigatório depois da liberação

| Situação | O que acontece |
|---|---|
| Senha provisória | a troca de senha vem primeiro |
| Pendente de liberação | ainda não é cobrada |
| Liberada, sem assinatura | a `api` responde `403 assinatura_pendente` em tudo, menos `GET /me`, `PUT /me/assinatura`, o envio da imagem (`PUT /arquivos/{id}`, `GET /arquivos/{id}/url`), `POST /auth/sair` e `POST /auth/trocar-senha` (opção `permitirSemAssinatura`); a web leva a `/app/assinatura`, e o app, à tela de cadastro |
| Liberada, com assinatura | usa o sistema |

- Vale para **todos os perfis, inclusive o admin**. Quem já estava ativo sem assinatura cai na mesma tela no próximo acesso.
- A primeira assinatura do técnico pontua uma vez por conta (refazer não pontua de novo).
- O ausente não altera a assinatura do perfil (seção 7.5).

### 3.2 Ações assinadas

Cada ação abaixo copia a assinatura do perfil de quem age para o registro do ato. A janela mostra a imagem e pede a confirmação; a `api` copia a imagem sozinha (`assinaturaDoAto`, em [`api/src/dominio/assinatura.ts`](../api/src/dominio/assinatura.ts), ou o equivalente nos eventos de campo) e recusa com `assinatura_ausente` quem não tem assinatura.

| Ação | Quem | Onde fica a cópia |
|---|---|---|
| Assinar a APR (cada participante, na própria conta; sem sinal, a assinatura presencial no aparelho do responsável) | participantes da APR | `apr_participante.assinatura_path` |
| Assinar o encerramento da execução | quem encerrou (`encerramento_de_outro` recusa os demais) | `execucao_assinatura` |
| Interromper a execução por risco | participante da execução | `execucao.assinatura_do_resultado_path` |
| Cancelar a execução por engano (até 10 min do início) | o responsável pela execução | `execucao.assinatura_do_resultado_path` |
| Assinar a conferência da execução (quando ela pede assinatura, e não só ciência) | participantes que devem assinar | `conferencia_assinatura.assinatura_path` |
| Assinatura final do supervisor na OS (a antiga ciência; vai para o PDF) | supervisor ou representante da equipe | `os.ciencia_assinatura_path` |
| Reprogramar a OS | supervisor da equipe, admin | `reprogramacao.assinatura_path` |
| Devolver a OS ao SAP | supervisor da equipe | `os.devolvida_assinatura_path` |
| Cancelar a OS de apoio | admin | `os.cancelada_assinatura_path` |
| Liberar ou recusar um cadastro | admin | `usuario.liberacao_assinatura_path` |
| Atos da ausência (todos, menos o pedido inicial; seção 7.2) | técnico, supervisor | `ausencia_ato.assinatura_path` |
| Enviar um treinamento de serviço para validar | autor ou admin | `treinamento_servico_versao.validacao_assinatura_path` |
| Aprovar ou recusar um treinamento na validação | supervisor validador | `treinamento_servico_validador.assinatura_path` |
| Publicar um treinamento (pela validação ou direto, pelo admin, com termo) | validador que fecha o quórum, admin | `treinamento_servico_versao.assinatura_path` |
| Autorizar a leitura de dados reais por uma função de IA | admin | `ia_funcao.assinatura_path` |

As regras de cada ato estão no documento do assunto: APR, execução, conferência e OS em [operacao-de-campo.md](operacao-de-campo.md); treinamentos em [gamificacao-e-treinamentos.md](gamificacao-e-treinamentos.md); IA em [ia-e-vitoria.md](ia-e-vitoria.md).

### 3.3 Cópia e leitura

- **Cada ato guarda uma cópia da imagem usada.** Refazer a assinatura do perfil vale só para as próximas ações; as já assinadas não mudam.
- **Eventos de campo** (APR, encerramento, interrupção, cancelamento) podem vir da fila offline do app: a `api` usa a assinatura que a pessoa tem no perfil ao aplicar o evento.
- **Quem lê as imagens** (`GET /arquivos/{id}/url`): quem vê a equipe da OS lê as cópias ligadas à OS, à reprogramação e à execução; a da liberação, só o admin.

### 3.4 O que não é assinado

Pausar, retomar e suspender a execução no fim do expediente; reservar a OS e liberar a reserva; importação (planilha, PDF da OS); modelos de APR e critério de bloqueio; redefinição de senha; desativação de usuário; catálogo e gamificação; aceitar ou recusar sugestão de materiais.

## 4. Equipes e supervisor

### 4.1 A equipe

- **Campos:** nome, centro de trabalho (o código do SAP, único e fixo: é por ele que a leitura do SAP acha a equipe), supervisor e representante (`equipe`, em [`api/src/db/schema/usuarios.ts`](../api/src/db/schema/usuarios.ts)).
- **Só o admin** cria, edita e exclui equipes. Excluir só vale para a equipe que nunca teve gente nem OS (`409 equipe_com_historico`).
- **Cada pessoa tem no máximo uma equipe** (`usuario.equipe_id`). O técnico vê a própria equipe; o supervisor, também as que supervisiona; o admin, todas.
- **Funções de campo** (gazista, instrumentista, eletricista) não são perfil nem equipe: ficam no cargo, que vem do registro.

### 4.2 O supervisor

- **Supervisor é quem a equipe aponta** em `equipe.supervisor_id`. O admin escolhe na edição da equipe; a `api` aceita qualquer usuário ativo (`supervisor_invalido` se não for). Na prática é um técnico, porque o admin não executa OS.
- **Uma pessoa pode supervisionar mais de uma equipe**, inclusive uma que não é a dela.
- **O que ganha,** nas equipes que supervisiona: ver as OS e o quadro, receber os alertas da equipe, reservar, devolver e reprogramar OS, abrir OS de apoio, dar a assinatura final na OS, responder às ausências, cadastrar técnicos, designar o representante, avaliar sugestões de materiais e validar treinamentos. Em outras equipes, nada.
- **Quem recebe os alertas da equipe** (`destinatariosDaEquipe`, em [`api/src/dominio/alertas.ts`](../api/src/dominio/alertas.ts)): o supervisor ativo e, enquanto o representante está no comando, também ele. Sem supervisor, o representante. Sem nenhum dos dois, todos os administradores ativos.
- **Trocar o supervisor** muda na hora quem responde pela equipe (seção 6). Se o novo supervisor era o representante, a equipe ganha outro representante.

## 5. Validações do supervisor

A página **Validações** (`/app/validacoes`, na web) é a fila de tudo o que espera a decisão ou a assinatura do supervisor. Ela não decide nada: reúne o que já existia e leva cada item à tela onde a decisão é tomada, com a janela de assinatura de sempre.

- **Quem vê:** quem supervisiona uma equipe, titular ou representante no comando (`GET /me/validacoes`, só papel `supervisor`). O admin e o técnico sem equipe supervisionada recebem `403`.
- **O app** ainda não tem a página; a `api` e o contrato ([`shared/api/validacoes.ts`](../shared/api/validacoes.ts)) já servem a ele.
- **O selo do menu** "Validações" conta a fila inteira. O antigo endereço `/app/treinamentos/validar` redireciona para `/app/validacoes?tipo=treinamento`.

### 5.1 O que entra

| Tipo | Quando entra | Ação | Urgente quando |
|---|---|---|---|
| OS para assinar | OS da equipe em `aguardando_supervisor` | `assinar`; `aguardar_conferencia` enquanto a conferência da execução ainda compara os aparelhos | falta menos de 24 h para o fim das `HORAS_DA_CIENCIA` (72 h) desde o encerramento, ou já passou (a assinatura no prazo pontua) |
| Treinamentos | treinamento em validação em que a equipe dele é validadora e ele ainda não decidiu | `decidir` | nunca |
| Materiais | sugestão ou contestação de lista que ele pode avaliar | `decidir` | nunca |
| Conferências | só o que falta dele: escolher o resultado que divergiu, fechar com o que existe, dar ciência ou assinar | `decidir`, `fechar`, `ciencia`, `assinar` | já pode fechar (passaram 72 h; a confirmar; ver [../pendencias.md](../pendencias.md)) |
| Ausências | pedido de ausência ou de fim antecipado de alguém da equipe; ausência vencida sem retorno confirmado | `pedida`, `fim_pedido`, `vencida` | pedido que já começou; fim pedido para hoje ou antes; vencida sempre |

- **Ordem:** os urgentes primeiro; dentro de cada grupo, os mais antigos (`ordenarValidacoes`). Filtro por tipo no topo (`?tipo=`).
- **O pedido do próprio supervisor** não entra. **O supervisor ausente** recebe a fila de ausências vazia, porque não age pela equipe.
- Código em [`api/src/dominio/validacoes.ts`](../api/src/dominio/validacoes.ts) (`minhasValidacoes`), com o mesmo recorte do resumo diário (seção 8.4).

### 5.2 O que fica de fora

- **O que ele mesmo inicia** (reprogramar, devolver ao SAP, reservar a OS): não há fila de espera.
- **Alertas informativos** (preventiva atrasada, execução esquecida) e a ressalva de um participante numa conferência: ficam no sino e em "Precisa de atenção".
- **O que é do admin:** liberar cadastro, publicar treinamento direto, tratar as perguntas da Vitória.
- **Assinar em lote:** cada item pede leitura (o relatório da execução, as versões comparadas) e abre na sua tela.

## 6. Representante

Toda equipe com gente tem um **representante**: um membro dela que assume a supervisão sozinho, sem o supervisor designar ninguém na hora, e a devolve quando o motivo acaba. Código em [`api/src/dominio/representacao.ts`](../api/src/dominio/representacao.ts).

### 6.1 Quando assume

| Motivo (`MOTIVOS_DA_REPRESENTACAO`) | Começa | Termina |
|---|---|---|
| `ausencia` | a ausência confirmada do supervisor começou (0h do início, em São Paulo); a vencida também conta | o supervisor confirma o retorno ou encerra a ausência |
| `inatividade` | passaram `DIAS_SEM_ATIVIDADE` (3) dias corridos, 72 h, desde a última atividade do supervisor (a confirmar; ver [../pendencias.md](../pendencias.md)) | o supervisor usa o sistema de novo |
| `sem_supervisor` | a equipe não tem supervisor, ou o dela está desativado ou não liberado | o admin escolhe um supervisor ativo |

- **Atividade** é qualquer chamada autenticada, anotada no máximo a cada `INTERVALO_DA_ATIVIDADE_MIN` (5) minutos em `usuario.ultima_atividade_em`. O primeiro acesso do supervisor parado já devolve a equipe.
- **A ausência agendada** não põe o representante no comando antes do dia.
- **A permissão vale na hora:** é calculada a cada chamada (`representacoesEmVigor`). Os avisos e o "desde quando" são gravados na hora quando a ausência do supervisor muda, quando ele volta ou quando pessoas e equipes mudam, e pela tarefa de hora em hora nos demais casos (`atualizarSupervisaoDasEquipes`).
- **Equipe sem supervisor:** os administradores recebem `equipe_sem_supervisor` uma vez por ocorrência (só a equipe com gente avisa). Quando a equipe ganha um supervisor, o aviso sai do "não lido" e o representante recebe `representacao_encerrada`.

### 6.2 Quem é

- **Elegível:** técnico, ativo, liberado, da própria equipe e que não é o supervisor.
- **Escolha automática** (`garantirRepresentantes`): o técnico mais antigo (conta sem data de cadastro primeiro, depois pelo nome). Roda depois de cadastro, liberação, mudança de usuário, desligamento pelo registro, troca de supervisor e a cada hora.
- **Quando deixa de servir** (desativado, mudou de equipe, virou o supervisor), a equipe ganha outro; se ele estava no comando, o novo é avisado.
- **Quem designa:** o supervisor titular da equipe e o admin (`PUT /equipes/{id}/representante`); escolha inválida é `422 representante_invalido`. O representante no comando não troca o próprio representante.
- **Sem técnico elegível** (a equipe só com o supervisor), fica sem representante e ninguém assume; os alertas vão aos administradores.

### 6.3 O que pode e o que não pode

**Pode,** com a própria assinatura, tudo o que o supervisor faz pela equipe: responder e registrar ausências dos membros, reservar e devolver OS, dar a assinatura final, decidir impedimentos e alertas, cadastrar técnicos, ver o painel, a página Validações e o resumo diário dela.

**Não pode:**

- registrar a própria ausência como supervisor: o pedido dele segue o fluxo de qualquer técnico (ninguém responde ao próprio pedido; na equipe sem supervisor, `409 equipe_sem_supervisor`, com a orientação de falar com o admin);
- mexer na ausência do supervisor nem registrá-la por ele;
- designar o próprio representante nem trocar o supervisor.

Se o representante também está ausente, ninguém responde pela equipe até um dos dois voltar.

### 6.4 Avisos e telas

- `representacao_iniciada` e `representacao_encerrada` vão ao representante e ao supervisor (na equipe sem supervisor, só ao representante), com o motivo. Categoria de e-mail Equipe.
- A passagem de comando fica na auditoria (`equipe.representacao_iniciada`, `equipe.representacao_encerrada`, pelo "Sistema"); a designação, em `equipe.designar_representante`.
- Na web: a faixa "Você responde pela equipe X" para o representante no comando; o cartão "Representante" no perfil da equipe (quem é, desde quando e por quê, e a troca para o supervisor e o admin); o selo "Representante" na lista de membros.

## 7. Ausência

O ausente continua ativo e vê o sistema, mas não altera nada, não recebe reserva de OS e não entra em APR. A ausência é pedida pelo técnico ou registrada pelo supervisor, sempre assinada, e termina com a confirmação do retorno. Código em [`api/src/dominio/ausencia-atos.ts`](../api/src/dominio/ausencia-atos.ts) e [`api/src/dominio/ausencia.ts`](../api/src/dominio/ausencia.ts); contrato em [`shared/api/ausencia.ts`](../shared/api/ausencia.ts).

### 7.1 Onde

- **Web:** no perfil, "Minhas ausências"; na equipe (`/app/equipes/{id}#ausencias`), a seção do supervisor, com os pedidos a responder, os fins antecipados, as vencidas, as em curso e as agendadas, e "Registrar ausência" (geral e em cada membro). O admin vê a seção, sem botões.
- **App:** "Minhas ausências" no perfil (pedir, ou registrar a própria no caso do supervisor titular; confirmar, pedir o fim antecipado, confirmar o retorno). As respostas do supervisor aos pedidos dos outros ficam na web.

### 7.2 Quem faz o quê

| Ação | Quem | Assina |
|---|---|---|
| Pedir ausência | o técnico | não; assina ao confirmar |
| Aprovar (com ou sem ajuste das datas) ou recusar o pedido, com motivo | supervisor da equipe | sim |
| Confirmar a ausência aprovada, ou recusar o ajuste | o técnico | sim |
| Cancelar o pedido ainda não confirmado | o técnico | sim |
| Registrar a ausência de um técnico da equipe, sem pedido | supervisor da equipe | sim; nasce confirmada |
| Registrar a própria ausência | supervisor titular | sim; nasce confirmada |
| Pedir o fim antecipado | o ausente (não quem registrou a própria) | sim |
| Aprovar ou recusar o fim antecipado | supervisor da equipe | sim |
| Prorrogar, inclusive a vencida | supervisor da equipe | sim |
| Encerrar a qualquer momento | supervisor da equipe; o supervisor ausente, a própria (emergência) | sim |
| Confirmar o retorno, a partir da data de retorno | o ausente | sim |

- **O admin não pede, não registra e não aprova** ausência: só consulta (`403`).
- **A ausência do supervisor** é registrada só por ele mesmo e só ele a prorroga ou encerra; é ela que faz o representante assumir.
- **Ninguém responde ao próprio pedido** (`403`). O pedido do técnico vai ao supervisor ativo da equipe; na equipe sem supervisor, ao representante no comando; sem ninguém, `409 equipe_sem_supervisor`. Técnico sem equipe: `409 sem_equipe`.
- **Atos assinados** exigem `{ "assinar": true }` e a assinatura do perfil.

### 7.3 O período

- **Início:** hoje ou no futuro (`inicio_no_passado`). Começa à 0h desse dia, no fuso de São Paulo.
- **Fim:** informa-se **um dos dois**, dias corridos (1 a 365) ou a data de retorno, o primeiro dia de volta ao trabalho (`periodo_invalido` com os dois ou nenhum). "14 dias" a partir de 20/10 é a ausência de 20/10 a 02/11, com retorno em 03/11.
- **Limite:** `LIMITE_DE_DIAS` (365) por ausência; a prorrogação pode passar disso.
- **Motivo:** texto livre obrigatório, até 500 caracteres.
- **Uma por vez:** o período que se sobrepõe a outra ausência pedida, aprovada ou em curso da pessoa é recusado (`409 ausencia_sobreposta`); ausências vizinhas passam.

### 7.4 Os estados

| Situação | O que é |
|---|---|
| Pedida | o técnico pediu; aguarda o supervisor |
| Aguardando confirmação | o supervisor aprovou, talvez com as datas ajustadas; aguarda o técnico |
| Agendada | confirmada, com início no futuro; o técnico trabalha normalmente até lá |
| Em curso | entre o início e a véspera do retorno |
| Vencida | a data de retorno chegou e ninguém a encerrou |
| Encerrada | pelo retorno, pelo fim antecipado, pelo supervisor ou em emergência |
| Recusada | o supervisor recusou o pedido, ou o técnico recusou o ajuste |
| Cancelada | o técnico cancelou, ou a data de retorno chegou com o pedido ainda sem conclusão |

Agendada, em curso e vencida não são gravadas: saem das datas da ausência confirmada (`situacaoDaAusencia`).

### 7.5 Durante a ausência

**O ausente** vê tudo o que já via, com a faixa "Você está ausente até DD/MM". Toda rota que altera responde `403 usuario_ausente`, menos: sair e trocar a senha; marcar alertas e avisos como lidos; as preferências de e-mail; pedir o fim antecipado e confirmar o retorno; o supervisor, prorrogar ou encerrar a própria; a Vitória; e a fila offline do que foi feito **antes** do início (opção `permitirAusente`). APR, execução, Campo de treino, assinatura do perfil, assinatura final, reserva, devolução, importação e cadastros ficam bloqueados.

**Para os outros:**

- **Reserva:** no início, toda OS reservada ao ausente volta para a equipe toda, com "Reserva desfeita: ausência de <nome>" na linha do tempo. O ausente não pode ser escolhido como responsável (`responsavel_ausente`).
- **APR:** o ausente não aparece entre os participantes e é recusado se vier (`participante_ausente`).
- **Execução aberta** do ausente (em andamento ou em pausa): é suspensa pelo sistema no início, como no fim do expediente; a OS fica pendente e a equipe a retoma com uma APR nova. O supervisor é avisado na aprovação ou no registro.
- **Selos** "Ausente até DD/MM/AAAA" e "Ausência vencida desde DD/MM/AAAA" na equipe, nos usuários e no perfil.
- **Gamificação:** nada muda; o ausente continua no ranking e na média da equipe.
- **Resumo diário:** o ausente não recebe.

### 7.6 O fim

- **Antes da data de retorno**, só o supervisor encerra. O ausente pode pedir o fim antecipado para uma data de hoje até a véspera do retorno. Aprovado para hoje, a ausência termina na hora; para um dia à frente, a data de retorno passa a ser essa.
- **Na data de retorno** a ausência não termina sozinha: fica vencida, o supervisor recebe `ausencia_vencida` e o ausente continua só visualizando.
- **Retorno:** no primeiro acesso depois da data, o ausente vê "Sua ausência terminou em DD/MM. Confirmar retorno", com a assinatura; confirmado, a conta volta ao normal na hora.
- **Prorrogação:** o supervisor muda a data de retorno (depois de hoje e do início), em curso ou vencida, sem invadir a ausência seguinte da pessoa.

### 7.7 A tarefa de hora em hora

`conferirAusencias` (e na subida da `api`), idempotente: aplica o início das ausências que começaram (desfaz as reservas, suspende a execução aberta), avisa as que venceram e cancela os pedidos parados. A ausência confirmada com início hoje aplica o início na mesma chamada.

### 7.8 O supervisor ausente

Age só sobre a própria ausência; sobre a equipe, `403 usuario_ausente`. Quem responde pela equipe é o representante (seção 6), que aprova pedidos e fins antecipados, reserva e devolve OS e recebe os alertas.

## 8. Avisos e e-mails

### 8.1 O sino

- **Todo perfil tem o sino** (`GET /alertas`, `PATCH /alertas/{id}`), com os avisos endereçados a ele. Na web fica na barra; no app, na aba Avisos. A tela de alertas da gestão (`/web/alertas`) é do supervisor e do admin.
- **Os tipos de aviso**, o alvo de cada um, os rótulos, a categoria de e-mail de cada tipo e o destino do clique (`caminhoDoAviso`) estão em [`shared/notificacoes/avisos.ts`](../shared/notificacoes/avisos.ts).
- **Todo aviso passa por `criarAviso`** ([`api/src/dominio/alertas.ts`](../api/src/dominio/alertas.ts)), que grava o aviso e, se o tipo tem categoria de e-mail, enfileira o envio. `resolverAvisos` tira do "não lido" o que já foi feito (cadastro liberado, conta reativada, equipe com supervisor).
- **Não há push no celular, por decisão:** no app, "puxar para atualizar" traz o aviso novo, e o número na aba se atualiza sozinho.

### 8.2 As categorias de e-mail

Todo e-mail nasce de um aviso do sino (menos o resumo diário). Se o tipo tem categoria, o aviso também vai para o e-mail institucional de quem o recebe. Cada pessoa liga ou desliga as categorias no perfil (seção "E-mails", `/app/perfil#emails`; `PUT /me/emails`). Desligar tira só o e-mail; o aviso continua no sino.

| Categoria (`CATEGORIAS_DE_EMAIL`) | O que entra | Desliga? |
|---|---|---|
| Segurança | APR bloqueada, interrupção por risco, direito de recusa, lesão ou enfermidade, risco climático extremo | não |
| Sua conta | conta criada, acesso liberado ou recusado, senha redefinida | não |
| Ordens de serviço | reserva, assinatura final, OS aguardando assinatura, apoio encerrado, inspeção com pendência, conflitos | sim |
| Preventivas | ciclo próximo e vencido | sim |
| Ausências | todos os avisos da ausência | sim |
| Equipe | representação, membro desativado, cadastro liberado ou recusado, pedido de conta, sugestões de materiais, conferência da execução | sim |
| Treinamentos | treinamento novo, problema reportado, validação | sim |
| Sistema (só o admin vê) | falhas do SAP, do registro e do PDF, cadastro pendente, readmissão, equipe sem supervisor, Vitória sem IA | sim |
| Resumo diário | o e-mail da manhã | sim |

- **Obrigatórias:** `CATEGORIAS_OBRIGATORIAS` (Segurança e Sua conta). Tentar desligá-las é `422 categoria_obrigatoria`.
- **Avisos só no sino** (categoria `null`): os que valem por minutos ou avisam muita gente (pedido de ação na execução, APR para assinar, materiais atualizados).

### 8.3 O envio

A tarefa `email_alerta` ([`api/src/servicos/email-alerta.ts`](../api/src/servicos/email-alerta.ts)) decide na hora de enviar e termina sem enviar quando: o servidor de e-mail não está configurado; o tipo não tem categoria; a pessoa está desativada (menos no `acesso_recusado`, que é justamente o aviso de que ela não entra mais); a categoria está desligada.

- **O conteúdo** segue um modelo só ([`api/src/servicos/email-modelo.ts`](../api/src/servicos/email-modelo.ts)), em texto e HTML: assunto `[SYNQ OS] <aviso> — <alvo>`, o texto do sino, os dados do alvo, o botão "Abrir no SYNQ OS" e o rodapé que diz por que a pessoa recebe e como desligar.
- **O e-mail do bloqueio** traz os itens reprovados, as observações e os links das fotos e dos PDFs, válidos por 7 dias.
- **Reenvio não duplica** (`email_enviado_em`). A falha no envio tenta de novo como as outras tarefas.
- **Avisos que se repetem** não viram um e-mail por vez: a falha de importação só vai por e-mail quando é a leitura do SAP e o aviso é novo; a Vitória sem IA avisa uma vez por dia; o treinamento novo, só na primeira publicação.

### 8.4 O resumo diário

Um e-mail por pessoa por dia, a partir de `EMAIL_RESUMO_HORA` (padrão 7h, horário de São Paulo), só para quem tem alguma coisa esperando ([`api/src/servicos/email-resumo.ts`](../api/src/servicos/email-resumo.ts)).

- **Para quem:** ativo, liberado, com o resumo ligado e não ausente. `usuario.resumo_email_dia` garante um por dia, mesmo com reinício.
- **Conteúdo,** em seções de até 10 linhas, com "e mais N":
  - **quem supervisiona** (titular ou representante no comando): "OS aguardando a sua assinatura" (todas as OS da equipe em `aguardando_supervisor`, inclusive as que ele executou), os pedidos de ausência e de fim antecipado a responder e as ausências vencidas;
  - **o admin:** os cadastros aguardando liberação, as equipes sem supervisor, as OS devolvidas que ainda não saíram na planilha de baixa, as perguntas que a Vitória não soube responder e os problemas reportados nos treinamentos;
  - **todo mundo:** as OS reservadas para a pessoa e ainda não iniciadas e a ausência que espera a confirmação dela.
- O e-mail diz também quantos avisos não lidos a pessoa tem no sino.

### 8.5 O servidor de e-mail

**Pendente: o SMTP da empresa** (conta, remetente e SPF/DKIM do domínio; ver [../pendencias.md](../pendencias.md)). Sem ele, tudo funciona e os avisos ficam só no sino; a `api` sobe normalmente e avisa no log. As variáveis estão em [`api/src/config.ts`](../api/src/config.ts):

| Variável | O que é |
|---|---|
| `SMTP_URL` | o servidor (`smtp://usuario:senha@servidor:587` ou `smtps://…:465`); vazio, nada é enviado |
| `EMAIL_REMETENTE` | quem envia, por exemplo `"SYNQ OS <synqos@empresa.com.br>"` |
| `PAINEL_URL` | o endereço público da web, base de todos os links dos e-mails |
| `EMAIL_RESUMO_HORA` | a hora do resumo diário (padrão 7) |

Como testar a conexão e enviar um e-mail de teste está em [../api/README.md](../api/README.md).
