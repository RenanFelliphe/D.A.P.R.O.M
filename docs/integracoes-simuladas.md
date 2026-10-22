# Integrações simuladas: SAP e registro de funcionários

O SYNQ OS conversa com dois sistemas da empresa: o **SAP**, de onde vêm as ordens de manutenção, e o **registro de funcionários (RH)**, de onde vêm as pessoas. Este documento descreve os dois simuladores, como as OS entram e saem do sistema e como o registro controla quem tem conta.

Como o sistema é construído (tabelas, contratos completos, tarefas) está em [especificacao.md](especificacao.md). O cadastro de contas a partir do registro está em [pessoas-e-equipes.md](pessoas-e-equipes.md). A digitalização de OS antigas está em [ia-e-vitoria.md](ia-e-vitoria.md).

## 1. Visão

- **Os simuladores são o produto.** O SAP e o registro de funcionários são simulados de propósito, dentro da própria `api`, para mostrar o fluxo final funcionando dentro da empresa. O SYNQ OS fala com eles só por clientes HTTP, com endereço e token configuráveis (`servicos/sap-http.ts`, `servicos/rh-http.ts`). O adaptador não sabe que do outro lado há um simulador.
- **O SYNQ OS não cria OS nem funcionário.** As OS vêm do SAP. A única exceção é a OS de apoio, aberta a partir de um impedimento ([operacao-de-campo.md](operacao-de-campo.md)). As pessoas vêm do registro.
- **O SYNQ OS nunca escreve no SAP.** A baixa sai por planilha (seção 4).
- **O que está no SYNQ OS não se apaga no simulador.** Uma ordem que o SYNQ OS já tem é encerrada, não excluída. Um funcionário que tem conta é desligado, não excluído.
- **Telas dos simuladores:** `/simulador/ordens` e `/simulador/funcionarios`, só para o admin, fora do menu do SYNQ OS. Têm cabeçalho próprio ("Sistemas da empresa · simulados"), as abas Funcionários e Ordens do SAP e um link de volta. A tabela com seleção, a barra de ações em massa, o botão com menu de criação e a janela "ver mais" são os mesmos nas duas (`web/src/components/simulador`).
- **Ponte da web** (`web/src/app/api/[...caminho]/route.ts`): o navegador só alcança a gestão dos simuladores (`/sap-simulado/gestao` e `/rh-simulado/gestao`, que exigem o admin logado). Os contratos dos simuladores e o `/rh/avisos`, que usam token de sistema, ficam bloqueados.

## 2. SAP simulado

### 2.1 A tela `/simulador/ordens`

É o CRUD das ordens do lado do "SAP", para criar, editar, liberar, encerrar e excluir ordens e ver o SYNQ OS reagir.

- **Contador:** total de ordens, dividido pela coluna "No SYNQ OS" (seção 2.4).
- **Busca e filtros:** busca sem acento por número, título, equipamento ou local; filtros por tipo, centro de trabalho e "No SYNQ OS". Todos valem juntos. A lista é paginada (até 200 por página).
- **Colunas:** seleção, número da ordem, título, tipo, centro de trabalho, início programado, status SAP, "No SYNQ OS", "Ver mais" e o menu de três pontos (Editar e Excluir). O resto fica no "Ver mais", que também diz se a atividade está cadastrada no SYNQ OS.
- **Seleção:** "Selecionar todos" marca a página; uma faixa oferece "Selecionar as N da busca".
- **Cartão de sincronização** (seção 2.8).

### 2.2 A ordem

Os campos são os do contrato `OrdemSap` (`api/src/servicos/sap.ts`), validados por `esquemaOrdem` (`api/src/dominio/importacao-ordens.ts`).

| Campo | Regra |
|---|---|
| `numero_ordem` | Obrigatório e único. Não muda depois de criado. A tela sugere o próximo livre: o maior número mais um, a partir de `4000001` (`proximoNumero`). |
| `numero_nota` | Opcional. |
| `tipo_ordem` | Obrigatório: `YBA1` (corretiva) ou `YBA2` (preventiva). |
| `tipo_atividade` | Texto do SAP, como `Z01-Manutenção Corretiva`. Só exibição. |
| `codigo_atividade` | O serviço do catálogo no SYNQ OS (a lista de materiais). Não escolhe o modelo de APR: o técnico escolhe a cada APR. |
| `titulo` | Obrigatório. |
| `descricao` | Instruções, materiais e ferramentas. |
| `centro_trabalho` | Obrigatório. Define a equipe no SYNQ OS (`equipe.centro_trabalho`). |
| `local_instalacao` | Obrigatório: `{codigo, endereco, plus_code, cliente}`. O código é obrigatório. |
| `equipamento`, `prioridade`, `solicitante`, `criado_por` | Opcionais. |
| `data_inicio_prog` · `data_fim_prog` | O início é obrigatório; o fim não pode ser anterior ao início (`422 datas_invalidas`). |
| `status_sap` | Lista de códigos separados por espaço (seção 2.3). |
| `criada_em` | Preenchido na criação. Sai sempre em UTC (ISO). |
| `plano_manutencao` · `item_manutencao` · `intervalo_ciclo` | Só nas preventivas. O intervalo é texto ("3 meses", "trimestral") ou `{quantidade, unidade}`. |

### 2.3 Status SAP

- **A regra do SYNQ OS:** a ordem está liberada se a lista de códigos contém `LIB` (`statusLiberada`). Sem `LIB`, não está.
- **Opções prontas na tela** (`STATUS_PRONTOS` em `api/src/dominio/sap-simulado.ts`): Criada (`CRTD`), Liberada (`LIB`), Liberada e impressa (`LIB IMPR`), Liberada, impressa e com custos (`LIB IMPR CAPC`) e Encerrada (`ENCE`). A tela também aceita texto livre.

### 2.4 A coluna "No SYNQ OS"

Torna a sincronização visível. Cada ordem mostra uma situação (`situacoesNoSynqOs`):

| Situação | Quando |
|---|---|
| Ainda não lida | A ordem não existe no SYNQ OS e nenhuma leitura a ignorou. |
| Ignorada, com o motivo | O motivo vem da leitura sem erro mais recente (entre as últimas 100) que ignorou a ordem. |
| Liberada, Pendente, Em execução, Encerrando, Aguardando o supervisor, Encerrada, Cancelada, Devolvida ao SAP | O status da OS no SYNQ OS. |

- **Selo "Alterada depois da última leitura":** a ordem mudou no simulador depois do início da última leitura sem erro. Sem nenhuma leitura, toda ordem conta como alterada. Mostra o que o SYNQ OS vai pegar na próxima leitura.
- **Atalho de demonstração:** para montar a coluna, a gestão consulta as tabelas `os` e `importacao`. O contrato não faz isso.

### 2.5 Criação

O botão "Nova ordem" abre um menu com duas opções.

- **Manual:** todos os campos da seção 2.2. O número vem sugerido e o status começa em `LIB IMPR`. O centro de trabalho é escolhido numa lista; o local, num catálogo ou digitado; a atividade, numa lista das atividades do SYNQ OS (código e descrição) ou digitada. Número repetido: `409 ordem_duplicada`.
- **Aleatória:** linhas de lote com quantidade, tipo (corretiva ou preventiva), centro de trabalho, status (liberada ou criada) e atividade. "10 preventivas liberadas para Serviços Especiais e 5 corretivas criadas para Instrumentação" sai num envio só.

**O gerador** (`gerarOrdens`):

- **Limite:** no máximo 200 ordens por envio, somando os lotes (`LIMITE_POR_ENVIO`).
- **Início programado** sorteado nos próximos `dias` (padrão 14, de 0 a 365); o fim, de 0 a 3 dias depois.
- **Número** sequencial, depois do maior existente.
- **Serviços e locais** de catálogos fixos de dados fictícios (`SERVICOS` e `LOCAIS`), no estilo das ordens de exemplo.
- **Centros de trabalho:** os do catálogo de setores do registro simulado (seção 5.4) mais os das equipes que o admin criar. Centro desconhecido: `422 centro_inexistente`.
- **Atividade:** `cadastrada` (sorteada entre as da tabela `atividade`; sem nenhuma, `422 sem_atividade_cadastrada`), `nova` (um código inventado, que a leitura cadastra) ou `qualquer` (uma das duas, por sorteio).
- **Preventivas** sempre levam plano e item e, em cerca de 60%, o intervalo entre ciclos.
- **Prioridade e "criado por"** são sorteados; o status liberado sorteia entre `LIB`, `LIB IMPR` e `LIB IMPR CAPC`, e o criado é `CRTD`.
- **O sorteio é injetável**, para os testes serem reproduzíveis.

### 2.6 Edição e exclusão

- **Editar** muda qualquer campo, menos o número da ordem (`422`). Toda edição atualiza `alterada_em`, o que o contrato filtra.
- **Antes de salvar,** a janela explica o efeito no SYNQ OS, montado pela tela a partir da situação da ordem (`efeitoDaEdicao`). A regra que vale é a da leitura (seção 3.2).
- **Excluir** só vale para ordem "Ainda não lida" ou "Ignorada". Para as outras, `409 ordem_no_synq_os`: "Esta ordem já está no SYNQ OS. No SAP, uma ordem não é apagada: encerre-a (tire o LIB do status) e o SYNQ OS a cancela na próxima leitura."

### 2.7 Ações em massa

A barra aparece quando há seleção (`agirEmMassaNasOrdens`):

| Ação | O que faz |
|---|---|
| Mudar status SAP | Aplica uma das opções prontas, como liberar ou encerrar várias de uma vez. |
| Mudar centro de trabalho | Troca o centro das selecionadas. |
| Reprogramar | `dias` desloca início e fim (aceita negativo) ou `data` define o novo início, e o fim mantém a duração. Um dos dois. |
| Excluir | Exclui as que o SYNQ OS não tem e devolve as demais como recusadas, com o motivo. |

A seleção é por números ou por "todos da busca", com os mesmos filtros da lista. Antes de aplicar, a confirmação diz quantas das selecionadas estão no SYNQ OS e o efeito nelas. A resposta é `{afetadas, recusadas: [{numero_ordem, motivo}]}`.

### 2.8 O cartão de sincronização

- **Estado:** a última leitura sem erro, se a leitura automática está ligada, o intervalo e a próxima prevista (`GET /sap/sincronizacao`).
- **"Ler agora":** pede uma leitura (`POST /sap/leituras`). Quando ela termina, o cartão mostra as OS criadas e atualizadas, as ignoradas com o motivo e os avisos (o intervalo entre ciclos não reconhecido), e a coluna "No SYNQ OS" se atualiza.
- **Link para a Importação** do SYNQ OS, onde fica o histórico completo.

### 2.9 Contrato e rotas

- **Contrato** (só leitura, com `Authorization: Bearer {SAP_API_TOKEN}`): `GET /sap-simulado/ordens?alteradas_desde&pagina&tamanho` e `GET /sap-simulado/ordens/{numero_ordem}`. O `alteradas_desde` filtra pela `alterada_em` da tabela `ordem_sap_simulada`.
- **Gestão** (admin logado): `/sap-simulado/gestao/ordens` (lista, criação, edição, exclusão), `/gestao/ordens/aleatorias`, `/gestao/ordens/em-massa` e `/gestao/catalogo` (centros com a equipe que cada um tem no SYNQ OS, locais, atividades, serviços, status prontos e o próximo número). Detalhe em `api/src/rotas/sap-simulado.ts` e na [especificação](especificacao.md).
- **Só existem com `SAP_SIMULADO=true`.**

### 2.10 Carga inicial

- **Primeira subida:** com `SAP_SIMULADO=true` e a tabela vazia, entram as 11 ordens de `api/fixtures/sap/ordens.json`, cada uma com `alterada_em` igual à `criada_em` (`carregarOrdensDeExemplo`). Com ordens já lá, nada é tocado.
- **Demonstração** (`pnpm demo:popular`): grava no simulador as OS que cria com origem `sap`, com status coerente: `LIB IMPR` nas ativas, `ENCE` nas encerradas e `CRTD` nas canceladas (`espelharOsDoSapNoSimulador`). As OS de apoio ficam de fora, porque não existem no SAP.

## 3. Entrada de OS

### 3.1 Os caminhos

| Caminho | Quem | Como a OS entra |
|---|---|---|
| Leitura do SAP | automática, ou o admin em "Sincronizar agora" | Liberada, pela regra da seção 3.2. |
| Planilha `.xlsx` exportada do SAP | admin | O mesmo processamento da leitura (seção 3.4). |
| PDF da OS gerado pelo SAP (com texto) | admin | Conferido campo a campo antes de registrar (seção 3.5). |
| Digitalização de OS antigas (PDF escaneado ou foto) | admin | Encerrada, como histórico. Ver [ia-e-vitoria.md](ia-e-vitoria.md). |
| OS de apoio | supervisor da equipe ou admin | Nasce no sistema, a partir de um impedimento. Ver [operacao-de-campo.md](operacao-de-campo.md). |

A importação pelo supervisor ficou fora ([pendencias.md](../pendencias.md)). Nenhum caminho cria OS manual: `POST /os` só aceita a OS de apoio.

### 3.2 O que acontece com cada ordem

A leitura, a planilha e o PDF usam o mesmo processamento (`processarOrdens`, em `api/src/dominio/importacao-ordens.ts`). Cada ordem é independente: uma ordem inválida vira linha ignorada e não derruba as outras.

| Situação | No SYNQ OS |
|---|---|
| Ordem nova com `LIB` | Cria a OS `liberada`. A equipe sai do centro de trabalho, a atividade do código e o local do código do local de instalação. O local é criado se ainda não existe: é só assim que um local entra no sistema. |
| Ordem nova sem `LIB` | Ignorada: "Status SAP diferente de liberada". |
| Centro de trabalho sem equipe | Ignorada: "Centro de trabalho sem equipe cadastrada". |
| Linha sem número de ordem | Ignorada: "Linha sem número de ordem". |
| Ordem fora do formato | Ignorada: "Ordem inválida: campo: motivo". |
| Atividade que o SYNQ OS não conhece | A OS entra, e o código é cadastrado em `atividade`, com o título da ordem como descrição; o admin monta a lista de materiais depois. Sem código, a OS fica sem atividade até uma leitura seguinte trazer uma. |
| Ordem já lida, com `LIB` | Atualiza só o planejamento (título, descrição, local, datas, prioridade, equipamento, plano, item, nota, status SAP). Nunca duplica, nunca muda a equipe, a execução, a assinatura, o PDF nem a reserva. A atividade só entra se a OS ainda não tinha. |
| Ordem reprogramada no SYNQ OS, com outra data no SAP | Ignorada: "Reprogramada no sistema". A reprogramação vence. |
| Ordem já lida que perdeu o `LIB`, OS `liberada`, `pendente` ou `devolvida` | A OS vira `cancelada`. |
| Ordem que perdeu o `LIB`, OS com execução em andamento | A execução segue; só o status SAP é guardado, e sai o alerta `conflito_planejamento` (um por situação, sem repetir). |
| Ordem que perdeu o `LIB`, OS `encerrando`, `aguardando_supervisor`, `encerrada` ou `cancelada` | O SAP só acompanha: só o status SAP é guardado, sem alerta. |
| OS `devolvida` que o SAP traz de novo com `LIB` | A OS volta `liberada`, sem a devolução, e pode ser devolvida outra vez. A justificativa antiga fica na trilha de auditoria. O PDF não a traz de volta. |
| Preventiva com plano | O plano é criado na primeira OS dele, com o intervalo se a ordem trouxer. Intervalo que não dá para entender não muda o plano e vira aviso. Ver [operacao-de-campo.md](operacao-de-campo.md). |

### 3.3 A leitura do SAP

- **Quando:** a cada `SAP_LEITURA_INTERVALO_MIN` minutos (padrão 15), se `SAP_API_URL` estiver configurada; o admin muda o intervalo em `/app/configuracoes` (de 5 a 1440 minutos), e vale na hora. Também quando o admin clica em **"Sincronizar agora"** (cartão Sincronização da Importação) ou em "Ler agora" (simulador): os dois chamam `POST /sap/leituras`, que responde `202` e enfileira a tarefa `leitura_sap`.
- **O que lê:** `GET /ordens?alteradas_desde=` a partir do início da última leitura sem erro, de 200 em 200, até o fim (no máximo 500 páginas). Todas as ordens são processadas numa única transação.
- **Falha** (API fora do ar, resposta inválida, erro ao gravar): nenhuma OS é criada, alterada ou removida. A leitura fica no histórico com o erro, e sai o alerta `falha_importacao` para quem pediu (na leitura agendada, para os admins ativos). A leitura seguinte retoma do mesmo ponto.
- **Alerta repetido:** uma nova falha do mesmo método com o alerta anterior ainda não lido reaproveita esse alerta, que sobe para o topo, em vez de empilhar.
- **Tempo real:** não existe. O SAP não avisa o SYNQ OS; a demonstração usa o "Sincronizar agora".

### 3.4 Planilha

- **Arquivo:** `.xlsx`, até 10 MB, primeira aba. A linha de cabeçalho é a que casar mais colunas entre as 10 primeiras; maiúsculas, acentos e pontuação não importam.
- **Colunas obrigatórias:** ordem, tipo de ordem, título, centro de trabalho, local de instalação e início programado. Sem alguma delas, a importação inteira é recusada (`422` "Colunas obrigatórias ausentes: …"). Os cabeçalhos aceitos estão em `CAMPOS` (`api/src/dominio/importacao-planilha.ts`) e aparecem na tela.
- **Status:** a coluna é opcional. Sem ela, todas as linhas valem como liberadas, porque a planilha exportada traz as ordens a executar. Com ela, a linha precisa ter `LIB`, e uma OS existente sem `LIB` é cancelada como na leitura.
- **Datas:** célula de data, número de série do Excel, `AAAA-MM-DD` ou `DD/MM/AAAA`.
- **Falha** (vazia, grande demais, não é `.xlsx`, fora do formato, erro ao gravar): nenhuma OS muda; o arquivo e a importação com o erro ficam no histórico, e sai o alerta `falha_importacao` para quem enviou.
- **O mapeamento é provisório** até chegar a planilha de OS de 2025 ([pendencias.md](../pendencias.md)).

### 3.5 PDF da OS

Dois passos, para a pessoa conferir antes de gravar.

1. **Leitura** (`POST /importacoes/pdf/leitura`): a `api` lê o texto do PDF e não grava nada. Cada folha vai para a OS do número no cabeçalho ("Ordem de Manutenção"); a folha sem número continua a anterior. Os campos saem dos rótulos impressos (o mapeamento está em `api/src/dominio/importacao-pdf.ts`). O tipo vem do tipo de ordem ou, sem ele, do tipo de atividade (Z01 corretiva, Z02 preventiva). Sem status impresso, a OS vale como liberada. A tela mostra, ao lado do PDF, cada OS com os campos para conferir e corrigir, os obrigatórios que faltaram, o que foi deduzido, se a OS já existe, a equipe do centro de trabalho e a atividade cadastrada que casou com o título.
2. **Registro** (`POST /importacoes/pdf`): o PDF vai de novo com as OS conferidas. A `api` relê o PDF e recusa a OS cujo número não está nele (`ordem_fora_do_pdf`) ou repetida: o número vem sempre do documento, nunca digitado. Depois é o processamento da seção 3.2, com origem `pdf`.

- **O PDF nunca cancela uma OS** e nunca traz de volta uma devolvida: é a foto de quando foi impresso. Status sem `LIB` vira ignorada.
- **Limites:** até 10 MB e 60 folhas; no máximo 60 OS por PDF.
- **Recusas sem gravar nada:** `pdf_invalido` (não é PDF), `pdf_sem_texto` (folha digitalizada: vai para a Digitalização), `pdf_sem_ordem`, `pdf_protegido`.
- **Falha ao registrar:** nenhuma OS muda; o PDF e a importação com o erro ficam no histórico, com o alerta `falha_importacao`.

### 3.6 A tela de Importação

Fica em `/web/os/importacao`, só para o admin, com três cartões (`web/src/components/web/importacao/EntradasDeOs.tsx`):

- **Sincronização (API):** a última sincronização, se a automática está ligada e o intervalo, e o botão "Sincronizar agora".
- **Importação (arquivo):** recebe planilha ou PDF, por clique ou arrastando. **Antes de escolher o arquivo, a tela pergunta o que ele é** (`PerguntaDaImportacao`):
  - **"Para liberar no sistema":** a OS ainda vai ser executada. Planilha `.xlsx` ou PDF gerado pelo SAP, conferido antes de registrar.
  - **"Já foi concluída no papel":** PDF escaneado de folhas já executadas, que entram encerradas, só como histórico, sem pontos e fora dos indicadores de tempo ([ia-e-vitoria.md](ia-e-vitoria.md)).
- **Digitalização (câmera):** fotos de folhas avulsas de OS já concluídas no papel ([ia-e-vitoria.md](ia-e-vitoria.md)).

Abaixo ficam o resultado da última entrada, as colunas que o sistema reconhece e o histórico (`GET /importacoes`, com as linhas ignoradas e os avisos de cada uma, inclusive as que falharam). Reimportar não duplica OS nem reabre as encerradas.

O diagnóstico da entrada de OS (OS registradas por dia, semana ou mês e por origem, leituras com e sem falha, motivos das ignoradas, comparação com o período anterior) fica no dashboard de OS (`GET /importacoes/resumo`; ver [operacao-de-campo.md](operacao-de-campo.md)).

### 3.7 Pontos em aberto

- **`ENCE LIB` entra como liberada.** A ordem de exemplo `4031236` tem o status `ENCE LIB`, e a regra só procura o `LIB`. Falta confirmar se uma ordem encerrada no SAP mantém o `LIB`; se mantiver, a regra também precisa olhar o `ENCE` ([pendencias.md](../pendencias.md)).
- **Código de cancelamento:** o código de uma ordem cancelada no SAP (diferente de encerrada) não está confirmado. A tela oferece os códigos das ordens de exemplo e aceita texto livre.

## 4. Saída de OS

### 4.1 Planilha de baixa

O SYNQ OS não escreve no SAP: quem dá a baixa é uma pessoa, a partir da planilha. Só o admin a gera, no dashboard de OS (`POST /exportacoes/sap`, `exportarParaSap` em `api/src/dominio/painel-exportacao.ts`).

| Aba | O que traz |
|---|---|
| Encerradas | As OS `encerradas` (com a assinatura final do supervisor) que ainda não saíram: número da ordem, datas e horas de início e fim, tempo líquido e de pausa em minutos, número de pessoas, executantes (matrículas), descrição da atividade, link do PDF e a assinatura final do supervisor. |
| Sem ordem SAP | As mesmas colunas, com título e equipe no lugar do número: as OS de apoio, que ainda não existem no SAP. |
| Impedimentos | Todas as OS `pendente` no momento, com o motivo e desde quando. Não depende de exportação anterior. |
| Devolvidas | As OS devolvidas ainda não exportadas: número, título, equipe, justificativa, quem devolveu e quando. |

- **Cada OS sai uma vez:** a exportação marca `os.exportada_sap_em` (e `os.devolucao_exportada_em` nas devolvidas) na mesma transação; duas exportações simultâneas não repetem OS.
- **Sem OS nova,** a resposta continua sendo um arquivo válido, com as abas só de cabeçalho (menos Impedimentos), e a tela avisa "Nenhuma OS nova para exportar".
- **OS digitalizadas** já entram marcadas como exportadas: o SAP as baixou no papel.
- **Fora do escopo:** o simulador receber a planilha de baixa.

### 4.2 Devolução ao SAP

O supervisor da equipe devolve ao SAP uma OS com erro, com uma justificativa; a regra está em [operacao-de-campo.md](operacao-de-campo.md). Do lado da integração: a justificativa sai na aba Devolvidas da planilha de baixa, uma pessoa corrige a ordem no SAP, e a OS volta `liberada` quando a leitura ou a planilha a trazem de novo com `LIB` (seção 3.2). No simulador, a ordem aparece como "Devolvida ao SAP".

## 5. Registro de funcionários simulado

### 5.1 Regras gerais

- **Só funcionário da empresa vira usuário.** O cadastro informa a matrícula e o e-mail institucional, e a `api` copia do registro o nome, o e-mail, o cargo e o registro profissional, que não são editados no SYNQ OS. O SYNQ OS decide só o perfil, a equipe, a liberação, se a conta está ativa e a senha. O fluxo do cadastro está em [pessoas-e-equipes.md](pessoas-e-equipes.md).
- **O automático só tira acesso; quem dá acesso é sempre uma pessoa.**
- **Com o registro fora do ar ou não configurado, o cadastro para** (`503 registro_indisponivel`): é melhor recusar do que deixar entrar alguém que não foi conferido.
- **Dados fictícios e sem CPF:** o SYNQ OS não usa CPF, e ele chama atenção na LGPD.

### 5.2 Situações e o efeito no SYNQ OS

| Situação no registro | Cadastro novo | Reativar a conta | Conta que já existe |
|---|---|---|---|
| ativo | permitido | permitido | nada muda |
| afastado | `409 funcionario_afastado` | `409 funcionario_afastado` | Só grava a situação. O afastamento é temporário (férias, licença). |
| desligado | `409 funcionario_desligado` | `409 funcionario_desligado` | Conta liberada e ativa é desativada; conta pendente vira recusada. |
| fora do registro (a matrícula sumiu) | `404 funcionario_nao_encontrado` | `409 funcionario_desligado` | Tratada como desligada. |

**Readmissão:** quem volta a ficar ativo no registro não tem a conta reativada sozinha. Os administradores recebem o aviso `funcionario_readmitido`, com o botão "Reativar a conta", e a reativação só passa se o registro disser que a pessoa está ativa.

### 5.3 Campos

Matrícula (única, não muda: é o vínculo com o SYNQ OS), nome completo, e-mail institucional (único, em minúsculas; é o login), cargo (impresso sob a assinatura na OS), setor (código do centro de trabalho e nome, que casa com `equipe.centro_trabalho`), registro profissional (opcional), situação, datas de admissão e nascimento, telefone corporativo, gestor imediato (matrícula de outro funcionário, sem chave estrangeira) e lotação. Ficam na tabela `funcionario_simulado`.

### 5.4 Setores e cargos

Lista fixa em `SETORES` (`api/src/dominio/rh-simulado.ts`): os três centros das equipes de demonstração (`SERV_ESP`, `INSTRUM`, `LAB_QUI`) e três sem equipe no SYNQ OS (`MAN_ELE`, `MAN_MEC`, `ADMIN`), que mostram o caso "sem equipe correspondente". Cada setor tem os seus cargos. Só os cargos de engenharia têm registro profissional (CREA).

### 5.5 Contrato

- **Consulta** (o SYNQ OS chama o registro com `Authorization: Bearer {RH_API_TOKEN}`): `GET {RH_API_URL}/funcionarios/{matricula}` → o funcionário ou `404`; `GET {RH_API_URL}/funcionarios?pagina&tamanho` → `{funcionarios[], proxima_pagina?}`. Mesmo estilo do contrato do SAP (`snake_case`, paginação por `proxima_pagina`). Formato em `api/src/servicos/rh.ts`.
- **Aviso** (o registro chama o SYNQ OS com `Authorization: Bearer {RH_AVISO_TOKEN}`): `POST /rh/avisos {matriculas[]}` → `202 {enfileiradas}`. Aceita até 1000 matrículas. **O aviso não traz decisão, só a lista do que conferir:** o SYNQ OS consulta cada matrícula e age pelo que o registro responder, então um aviso falso não desativa ninguém. Sem `RH_AVISO_TOKEN` configurado, ninguém consegue avisar.

### 5.6 Desligamento em tempo real

1. No simulador, um funcionário passa a desligado (pela edição ou por uma ação em massa).
2. O simulador chama `RH_AVISO_URL` (por padrão, o próprio `/rh/avisos`) com as matrículas, depois de gravar a mudança. Só avisa quando alguém passa a desligado de verdade: repetir o desligamento, afastar ou reativar não avisa. Se o envio falhar, fica só no log, e a leitura diária cobre.
3. O SYNQ OS enfileira uma tarefa `conferencia_rh` para cada matrícula que tem conta (matrícula sem conta é ignorada; uma conferência que já espera para a mesma pessoa não é repetida).
4. O executor de tarefas consulta o registro e aplica a conferência (seção 5.8). Com o registro fora do ar, a tarefa tenta de novo depois de 1, 5, 15 e 15 minutos (`ESPERAS_MIN` em `api/src/servicos/tarefas.ts`).

### 5.7 Leitura diária

- **Quando:** uma vez por dia, a partir das `RH_LEITURA_HORA` horas de São Paulo (padrão 3). O admin muda a hora em `/app/configuracoes`. O executor confere a cada minuto se já é hora; a coluna `leitura_rh.dia`, única nas leituras agendadas, garante uma por dia mesmo com reinício.
- **O que lê:** o registro inteiro, de 200 em 200, e confere todos os usuários do SYNQ OS pela matrícula. Lê tudo, e não só os alterados, para pegar quem sumiu do registro.
- **"Ler agora":** o admin pede uma leitura fora de hora (`POST /rh/leituras`), no cartão "Registro de funcionários" da tela de usuários ou no cartão do simulador.
- **Estado:** `GET /rh/sincronizacao` traz a última leitura (conferidos, atualizados, desativados, erro) e a situação: `concluida`, `falhou`, `tentando_de_novo` ou `em_andamento`.
- **Novas tentativas:** a falha de rede tenta de novo como as demais tarefas, gravando o erro a cada tentativa. Esgotadas as tentativas, sai o aviso `rh_leitura_falhou` (no sino e por e-mail) para quem pediu ou para os administradores.
- **Trava da metade:** se a leitura fosse desativar mais da metade dos usuários ativos (ativos e não recusados), não aplica nada, termina com erro e avisa (`rh_leitura_falhou`). Não tenta de novo. Protege contra um registro vazio ou mal configurado.

### 5.8 O que a conferência faz com cada usuário

O aviso, a leitura diária e o "Atualizar do registro" do admin fazem a mesma conferência (`aplicarConferencia`, em `api/src/dominio/rh.ts`):

- **Dados:** atualiza nome, e-mail (e o login junto), cargo e registro profissional, se mudaram. Um e-mail que já é de outra conta não é copiado.
- **Situação:** grava `usuario.situacao_registro` e `usuario.registro_conferido_em`.
- **Desligado ou fora do registro, conta liberada e ativa:** desativa a conta, como a desativação pelo admin. A `api` recusa a pessoa na hora (`401 acesso_revogado`); o app ainda envia a fila offline pendente e, depois, a sessão é revogada. A equipe recebe o aviso `membro_desativado`, com as OS que continuam reservadas para a pessoa.
- **Desligado ou fora do registro, conta pendente:** vira recusada, com o motivo "Desligado no registro de funcionários", e quem cadastrou recebe `cadastro_recusado`.
- **Afastado:** só grava a situação.
- **Último admin ativo:** nunca é desativado; a conferência grava a situação e deixa a decisão para uma pessoa.
- **Supervisão:** quem perde o acesso deixa de ser representante, e a equipe cujo supervisor saiu passa a ser coberta pelo representante ([pessoas-e-equipes.md](pessoas-e-equipes.md)).
- **Auditoria:** tudo entra com o ator "Registro de funcionários" (`ator_id` nulo): `usuario.atualizar_do_registro`, `usuario.desativar`, `usuario.recusar`, `usuario.situacao_registro` (mudou sem efeito no acesso) e `usuario.conferencia_bloqueada` (último admin, ou e-mail já usado). O "Atualizar do registro" do admin entra com o nome dele, e o "Ler agora", como `rh.leitura`.

Na tela de usuários, o selo "Desligado no registro" ou "Afastado" aparece na tabela e no perfil.

**Fora do escopo:** mudar a equipe no SYNQ OS quando o setor muda no registro (o setor só sugere a equipe no cadastro) e reativar a conta sozinho na readmissão.

### 5.9 A tela `/simulador/funcionarios`

- **Contador:** total de funcionários, por situação.
- **"Novo funcionário"** (e não "novo usuário", para não confundir com as contas do SYNQ OS) abre um menu com três opções:
  - **Rápido** (a primeira): nome completo, e-mail institucional e, opcionalmente, a equipe do SYNQ OS (a lista mostra os setores que têm equipe). Sem escolha, o setor é sorteado entre todos, inclusive os sem equipe. O resto sai do gerador: a próxima matrícula, o cargo do setor, CREA só na engenharia, datas, telefone, gestor (um ativo do mesmo setor, se houver) e lotação; a situação é sempre "ativo". Ao criar, o aviso traz a matrícula, o cargo e o setor sorteados, que é o que o cadastro no SYNQ OS pede. `409 email_duplicado` se o e-mail já está no registro; `422 setor_inexistente` se o setor não está no catálogo (`criarRapido`).
  - **Manual:** todos os campos; a matrícula vem sugerida, e setor e cargo são escolhidos em listas (o cargo aceita texto livre).
  - **Aleatório:** linhas de quantidade, setor, cargo e situação. "10 mecânicos e 5 eletricistas" sai num envio só.
- **Busca** por nome, e-mail ou matrícula, com paginação.
- **Tabela:** seleção, nome (com os selos Afastado, Desligado e "No SYNQ OS"), e-mail, matrícula, setor, "Ver mais" (todos os campos e a conta no SYNQ OS) e o menu Editar/Excluir.
- **Ações em massa:** mudar setor, mudar situação e excluir. A confirmação diz quantos dos selecionados têm conta no SYNQ OS e o que acontece com eles; desligar desativa a conta na hora.
- **Cartão "Sincronização com o SYNQ OS":** a última leitura diária e o "Ler agora".

**Regras do simulador:**

- **Matrícula:** não muda (`422` na edição). A sugerida é a maior matrícula numérica mais um, a partir de `100001`. Matrícula repetida: `409 matricula_duplicada`.
- **E-mail:** único (`409 email_duplicado`). O gerador segue `nome.sobrenome@empresa.com.br`, com número quando houver homônimos.
- **Excluir:** só quem não tem conta no SYNQ OS. Quem tem deve ser desligado: `409 funcionario_com_conta` ("Desligue o funcionário em vez de excluir"). Na exclusão em massa, os demais voltam como recusados.
- **Gerador:** nomes brasileiros de listas fixas, cargo coerente com o setor, admissão nos últimos 20 anos (nunca antes dos 18 anos da pessoa), idade entre 20 e 60 anos, situação "ativo" a não ser que o lote peça outra, no máximo 200 por envio. O sorteio é injetável.

**Rotas** (só com `RH_SIMULADO=true`, em `/rh-simulado`): o contrato (`/funcionarios`, com `RH_API_TOKEN`) e a gestão com o admin logado (`/gestao/funcionarios`, `/gestao/funcionarios/rapido`, `/gestao/funcionarios/aleatorios`, `/gestao/funcionarios/em-massa`, `/gestao/catalogo`). Detalhe em `api/src/rotas/rh-simulado.ts` e na [especificação](especificacao.md).

### 5.10 Carga inicial

- **Modo local e demonstração:** cada usuário criado ganha o seu funcionário, com a mesma matrícula, nome, e-mail e cargo, o setor da equipe e a situação ativo, mais uns 30 funcionários aleatórios sem conta para demonstrar o cadastro (a demonstração com o elenco de contas reais não cria os aleatórios).
- **Banco publicado:** `pnpm rh:carga-inicial` (`api/scripts/carregar-registro-rh.ts`) cria um funcionário para cada usuário que ainda não tem o seu. **Precisa rodar antes de a conferência ser ligada;** sem isso, a primeira leitura trataria todo mundo como fora do registro (a trava da metade impede o estrago, mas a leitura falharia todos os dias). Pode rodar de novo sem duplicar.

## 6. Configuração

Variáveis de ambiente lidas em `api/src/config.ts`. Endereços e tokens ficam só no ambiente; o intervalo da leitura do SAP e a hora da leitura do RH são o valor inicial e podem ser mudados pelo admin em `/app/configuracoes`.

| Variável | O que é | Com o simulador ligado |
|---|---|---|
| `SAP_SIMULADO` | Liga o SAP simulado. | — |
| `SAP_API_URL` · `SAP_API_TOKEN` | Endereço e token da API do SAP. Sem endereço, a leitura agendada não roda. | `http://127.0.0.1:{PORT}/sap-simulado` e um token de desenvolvimento |
| `SAP_LEITURA_INTERVALO_MIN` | Intervalo da leitura (padrão 15). | — |
| `RH_SIMULADO` | Liga o registro simulado. | — |
| `RH_API_URL` · `RH_API_TOKEN` | Endereço e token do registro. Sem endereço, o cadastro responde `503` e a leitura diária não roda. | `http://127.0.0.1:{PORT}/rh-simulado` e um token de desenvolvimento |
| `RH_AVISO_TOKEN` | Token que o registro usa para avisar o SYNQ OS. | token de desenvolvimento |
| `RH_AVISO_URL` | Para onde o simulador manda os avisos. | `http://127.0.0.1:{PORT}/rh/avisos` |
| `RH_LEITURA_HORA` | Hora da leitura diária, de 0 a 23 (padrão 3). | — |
