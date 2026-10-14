# API do SAP: tela do simulador — decisões de 14/10/2026

> Registro do desenho da tela do simulador do SAP: o CRUD das ordens de manutenção no lado do "SAP", com criação manual e aleatória e alteração em massa, para demonstrar como as OS chegam ao DAPROM e como ele reage a cada mudança. A estrutura é a mesma da tela de funcionários ([apifuncionarios.md](apifuncionarios.md)).
>
> **Situação:** implementado em 14/10/2026 (`api` e `web`). O simulador guarda as ordens no banco e tem a tela `/simulador/ordens`. As diferenças entre o que se decidiu e o que ficou estão na seção 14.
>
> Fontes: a conversa de 14/10/2026; a seção Integração SAP da [especificação](base/.design/especificacao.md); o simulador atual ([`api/src/rotas/sap-simulado.ts`](api/src/rotas/sap-simulado.ts)) e as suas ordens de exemplo ([`api/fixtures/sap/ordens.json`](api/fixtures/sap/ordens.json)).

## Resumo

- **O DAPROM não cria OS, assim como não cria funcionário.** A única exceção é a OS de apoio. As OS vêm do SAP, e o DAPROM só as lê e mostra. A tela fica do lado do SAP: é nela que se criam, editam, liberam, encerram e excluem ordens, e que se vê o DAPROM reagir.
- **A leitura do DAPROM não muda.** Ficam como estão o contrato, a leitura a cada 15 minutos, o "Ler agora" e as regras da tabela de estados. A tela só alimenta o simulador e mostra o resultado.
- **As ordens do simulador saem da memória e passam para uma tabela no banco.** As 11 ordens de exemplo viram a carga inicial.
- **A tela fica em `/simulador/ordens`, só para o admin.** Tem contador, criação manual e aleatória, tabela com seleção, ações em massa, "ver mais", editar e excluir. Para a demonstração, tem também a coluna "No DAPROM" e um cartão de sincronização.

---

## 1. O que a tela demonstra: a sincronização de hoje

- **Quando o DAPROM lê:** a cada `SAP_LEITURA_INTERVALO_MIN` minutos (padrão 15) ou quando alguém usa o "Ler agora". Ele chama `GET /ordens?alteradas_desde=` a partir da última leitura bem-sucedida.
- **O DAPROM nunca escreve no SAP.** A baixa vai por planilha, pela exportação do Painel.
- **O que acontece com cada ordem lida** (tabela de estados da especificação, resumida):

| No SAP | No DAPROM |
|---|---|
| Ordem nova com `LIB` no status | Cria a OS `liberada`. A equipe sai do centro de trabalho, a atividade do código e o local do código do local de instalação (o local é criado se ainda não existe). |
| Ordem nova sem `LIB` | Ignorada: "Status SAP diferente de liberada". |
| Ordem já lida, alterada | Atualiza só o planejamento. Nunca duplica. |
| Ordem já lida que perdeu o `LIB` | Vira `cancelada`. Se houver execução em andamento, a execução segue e sai um alerta `conflito_planejamento`. |
| Ordem reprogramada no DAPROM, com outra data no SAP | Ignorada: "Reprogramada no sistema". A reprogramação vence. |
| Centro de trabalho sem equipe | Ignorada, com o motivo. |
| Atividade sem modelo de APR | A OS entra, com o aviso "Atividade sem modelo de APR". |
| OS já encerrada ou cancelada no DAPROM | O SAP só acompanha: o status e a execução não mudam. |

## 2. Decisões

| Pergunta | Decisão |
|---|---|
| Onde fica a tela | Em `/simulador/ordens`, na mesma área "Sistemas da empresa · simulados" da tela de funcionários, como outra aba. Só para o admin. |
| Onde ficam os dados | Na tabela `ordem_sap_simulada`. Na memória não serve: as OS do DAPROM ficam no Postgres, e um reinício apagaria as ordens criadas pela tela. |
| Excluir uma ordem que o DAPROM já leu | Não pode. No SAP real uma ordem não some: ela é encerrada. A tela orienta a tirar o `LIB` do status, e o DAPROM cancela a OS na próxima leitura. A ordem que o DAPROM nunca leu, ou que ele ignorou, pode ser excluída. É a mesma regra do registro de funcionários: o que já está no DAPROM não se apaga. |
| Ações em massa | Mudar o status SAP, mudar o centro de trabalho, reprogramar as datas e excluir. |
| Sincronização em tempo real? | Não. O SAP real não avisa o DAPROM. A demonstração usa o "Ler agora" da própria tela, e a leitura automática continua a cada 15 minutos. |
| As rotas `POST` e `PATCH` atuais do simulador | Passam para as rotas de gestão. O contrato fica só com as leituras, que é o que o SAP real oferece. |

## 3. A ordem

### 3.1 Campos

São os campos do contrato (`OrdemSap`).

| Campo | Na tela | Observação |
|---|---|---|
| `numero_ordem` | Número da ordem | Obrigatório e único. Não muda depois de criado. A tela sugere o próximo livre. |
| `numero_nota` | Nota | |
| `tipo_ordem` | Tipo | Obrigatório: `YBA1` (corretiva) ou `YBA2` (preventiva). |
| `tipo_atividade` | Tipo de atividade | Texto do SAP, por exemplo `Z01-Manutenção Corretiva`. |
| `codigo_atividade` | Atividade | O código que o DAPROM liga a um modelo de APR. |
| `titulo` | Título | Obrigatório. |
| `descricao` | Descrição | Instruções, materiais e ferramentas. |
| `centro_trabalho` | Centro de trabalho | Obrigatório. Define a equipe no DAPROM. |
| `local_instalacao` | Local de instalação | Obrigatório. Tem código, endereço, plus code e cliente. |
| `equipamento` | Equipamento | |
| `prioridade` | Prioridade | Por exemplo, `Muito alto`. |
| `data_inicio_prog` · `data_fim_prog` | Início e fim programados | O início é obrigatório. |
| `status_sap` | Status SAP | Lista de códigos (seção 3.2). |
| `solicitante` · `criado_por` · `criada_em` | Solicitante, criado por, criada em | `criada_em` é preenchido na criação. |
| `plano_manutencao` · `item_manutencao` · `intervalo_ciclo` | Plano, item e intervalo entre ciclos | Só nas preventivas. |

Colunas da tabela: caixa de seleção, número da ordem, título, tipo, centro de trabalho, início programado, status SAP, "No DAPROM", "Ver mais" e o menu de três pontos. O resto fica no "ver mais".

### 3.2 Status SAP

- **A regra do DAPROM** é procurar o código `LIB` na lista: com `LIB`, a ordem está liberada; sem ele, não.
- **A tela oferece opções prontas**, com os códigos das ordens de exemplo: Criada (`CRTD`), Liberada (`LIB`), Liberada e impressa (`LIB IMPR`), Liberada, impressa e com custos (`LIB IMPR CAPC`) e Encerrada (`ENCE`).
- **Também aceita texto livre,** para testar outros casos.

## 4. A coluna "No DAPROM"

É o que torna a sincronização visível. Cada ordem mostra uma destas situações:

- **"Ainda não lida":** a ordem não existe no DAPROM e nenhuma leitura a ignorou.
- **"Ignorada" com o motivo:** a última leitura que passou pela ordem a ignorou. O motivo vem de `importacao.detalhe_ignoradas`.
- **O status da OS no DAPROM:** Liberada, Pendente, Em execução, Encerrada ou Cancelada.

Junto dela aparece o selo **"Alterada depois da última leitura"** quando a ordem mudou no simulador depois da última leitura sem erro. Esse selo mostra o que o DAPROM vai pegar na próxima leitura.

Para montar essa coluna, as rotas de gestão consultam as tabelas `os` e `importacao` do DAPROM. É um atalho de demonstração: o SAP real não sabe nada do DAPROM.

## 5. O cartão de sincronização

- **Estado da leitura:** a última leitura sem erro, se a leitura automática está ligada, o intervalo e a próxima leitura prevista. Vem de `GET /sap/sincronizacao`.
- **Botão "Ler agora":** chama `POST /sap/leituras`. Quando a leitura termina, o cartão mostra o resultado: OS criadas, OS atualizadas, ordens ignoradas com o motivo e avisos. O resultado vem de `GET /importacoes`, e a coluna "No DAPROM" se atualiza.
- **Link para a Importação do DAPROM,** onde fica o histórico completo.

Todas essas rotas já existem.

## 6. Criação

**O botão "Nova ordem"** abre um menu com duas opções, e cada uma abre uma janela.

### 6.1 Manual

- Todos os campos da seção 3.1. O número vem sugerido e o status começa em `LIB IMPR`.
- **Centro de trabalho:** escolhido numa lista.
- **Local de instalação:** escolhido num catálogo de locais ou digitado.
- **Atividade:** escolhida numa lista que diz quais atividades têm modelo de APR no DAPROM, ou digitada.

### 6.2 Aleatória

- **Linhas de lote,** com o botão "Adicionar linha". Cada linha tem:
  - quantidade;
  - tipo (corretiva ou preventiva);
  - centro de trabalho;
  - status (liberada ou criada);
  - atividade: com modelo, sem modelo ou qualquer uma.
- **Início programado** sorteado nos próximos N dias (padrão 14).
- **Limite:** no máximo 200 ordens por envio.

Assim, "10 preventivas liberadas para Serviços Especiais e 5 corretivas criadas para Instrumentação" sai num envio só.

### 6.3 O gerador

- **Número da ordem:** sequencial, depois do maior número existente.
- **Serviços:** um catálogo fixo de serviços fictícios (título, descrição, tipo e prefixo do equipamento), no estilo das ordens de exemplo.
- **Locais:** um catálogo fixo de locais de instalação (código, endereço, plus code e cliente), que inclui os das ordens de exemplo.
- **Atividades:**
  - "com modelo" sorteia entre as atividades da tabela `atividade` do DAPROM que têm modelo, para a APR abrir com o modelo certo;
  - "sem modelo" usa códigos inventados, para mostrar o aviso "Atividade sem modelo de APR".
- **Preventivas:** recebem plano e item de manutenção e, às vezes, intervalo entre ciclos.
- **Prioridade e "criado por":** sorteados; "criado por" sai de uma lista de usuários fictícios do SAP.
- **Sorteio injetável,** para que os testes sejam reproduzíveis.

## 7. Edição, exclusão e o efeito no DAPROM

**Editar** muda qualquer campo, menos o número da ordem. Antes de salvar, a janela explica o que vai acontecer no DAPROM, pelas regras que já existem:

| Situação no DAPROM | O que a janela avisa |
|---|---|
| OS em execução | Só o planejamento muda. Tirar o `LIB` gera um alerta de conflito, e a execução segue. |
| OS reprogramada | Uma data diferente faz a próxima leitura ignorar a ordem. |
| OS encerrada ou cancelada | O SAP só acompanha. Nada muda no DAPROM. |
| OS liberada ou pendente | Tirar o `LIB` cancela a OS na próxima leitura. |

**Excluir** só vale para ordens que o DAPROM não tem. Para as outras, a resposta é "Esta ordem já está no DAPROM. No SAP, uma ordem não é apagada: encerre-a."

## 8. Lista, seleção e ações em massa

- **Contador:** total de ordens, com a divisão por "No DAPROM" (não lidas, ignoradas e por status).
- **Busca e filtros:** busca por número, título, equipamento ou local, e filtros por tipo, centro de trabalho e "No DAPROM". A lista é paginada.
- **"Selecionar todos"**, no cabeçalho da tabela, marca a página. Uma faixa oferece "Selecionar as N da busca".
- **Barra de ações em massa:**
  - **Mudar status SAP:** usa as opções prontas, como liberar ou encerrar várias de uma vez;
  - **Mudar centro de trabalho;**
  - **Reprogramar:** desloca as datas em N dias ou define uma data nova;
  - **Excluir:** exclui as que o DAPROM não tem e lista as recusadas.
- **Confirmação:** antes de aplicar, informa quantas das ordens selecionadas já estão no DAPROM e o efeito nelas, pelo resumo da seção 7.

## 9. Dados (proposta)

**`ordem_sap_simulada`:**

- `numero_ordem`, como chave primária;
- uma coluna para cada campo do contrato;
- o local de instalação em quatro colunas: `local_codigo`, `local_endereco`, `local_plus_code` e `local_cliente`;
- `intervalo_ciclo` em `jsonb`, porque pode ser texto ou `{quantidade, unidade}`;
- `alterada_em`, que é o que o `alteradas_desde` filtra.

**Carga inicial:**

- Ao subir com `SAP_SIMULADO=true` e a tabela vazia, a `api` carrega as ordens de `fixtures/sap/ordens.json`. O modo local recomeça igual a cada subida, como hoje.
- **Demonstração:** a carga de demonstração (`pnpm demo:popular`, em `db/seed/demo.ts`) cria OS com origem `sap` direto no banco. Ela passa a gravar essas ordens também no simulador, com um status coerente (com `LIB` nas ativas e sem ele nas canceladas). Assim, o SAP e o DAPROM concordam desde o início. As OS de apoio ficam de fora, porque não existem no SAP.

## 10. Rotas (proposta)

**Contrato** (com o token `SAP_API_TOKEN`; o formato não muda, só a origem dos dados passa a ser a tabela): `GET /sap-simulado/ordens` `?alteradas_desde&pagina&tamanho` e `GET /sap-simulado/ordens/{numero_ordem}`.

**Saem do contrato:** `POST /sap-simulado/ordens` e `PATCH /sap-simulado/ordens/{numero_ordem}`, substituídas pelas rotas de gestão.

**Gestão** (com o admin logado no DAPROM; servem à tela):

| Rota | O que faz |
|---|---|
| `GET /sap-simulado/gestao/ordens` `?busca&tipo&centro_trabalho&no_daprom&pagina&tamanho` | Lista com `total` e, em cada ordem, `no_daprom` e `alterada_depois_da_leitura`. |
| `GET /sap-simulado/gestao/catalogo` | Centros de trabalho, locais, atividades (dizendo quais têm modelo), serviços, opções de status e o próximo número livre. |
| `POST /sap-simulado/gestao/ordens` | Cria uma ordem (manual) → `201`. |
| `POST /sap-simulado/gestao/ordens/aleatorias` `{lotes: [{quantidade, tipo?, centro_trabalho?, status?, atividade?}], dias?}` | Gera em lotes → `201` `{criadas}`. No máximo 200 por envio. |
| `PATCH /sap-simulado/gestao/ordens/{numero_ordem}` | Edita. O número não muda. |
| `DELETE /sap-simulado/gestao/ordens/{numero_ordem}` | Exclui (seção 7). |
| `POST /sap-simulado/gestao/ordens/em-massa` `{numeros[] ou todos_da_busca, acao, valor}` | `acao`: `mudar_status`, `mudar_centro`, `reprogramar` ou `excluir`. Devolve `{afetadas, recusadas: [{numero_ordem, motivo}]}`. |

**Rotas do DAPROM que a tela usa (já existem):** `POST /sap/leituras`, `GET /sap/sincronizacao` e `GET /importacoes`.

**Ponte da web:** como na tela de funcionários, passa a liberar só o `/sap-simulado/gestao`. O contrato continua bloqueado.

## 11. Testes

- **Contrato:**
  - o mesmo formato e a mesma paginação de hoje;
  - o `alteradas_desde` filtra pela `alterada_em` da tabela;
  - o teste do simulador em `test/sap.test.ts` muda junto.
- **Gestão:** criação manual com número único; gerador (quantidade, filtros, atividades com e sem modelo, limite de 200); edição com número fixo; exclusão recusada para ordem que o DAPROM tem; ações em massa com recusadas.
- **Coluna "No DAPROM":** ordem não lida, ignorada (com motivo), cada status de OS e o selo "Alterada depois da última leitura".
- **De ponta a ponta:**
  1. criar ordens aleatórias, ler e ver as OS criadas;
  2. tirar o `LIB` de uma ordem, ler e ver a OS cancelada;
  3. fazer o mesmo com uma OS em execução e ver o alerta de conflito.

## 12. Ordem de implementação

Esta tela vem depois da tela de funcionários ([apifuncionarios.md](apifuncionarios.md), seção 11), porque reaproveita os componentes de lá.

1. **Simulador na `api`:** tabela, carga das ordens de exemplo e da demonstração, contrato lendo do banco, rotas de gestão, gerador e coluna "No DAPROM", com testes.
2. **Tela `/simulador/ordens`.**
3. **Documentação:** a seção Integração SAP da especificação (as rotas só do simulador mudam), o `api/README.md` e o [funcionalidades.md](funcionalidades.md).

## 13. Pontos em aberto

- **`ENCE LIB` entra como liberada.** A ordem de exemplo `4031236` tem o status `ENCE LIB`, e a regra só procura o `LIB`. É preciso confirmar com o Iago se uma ordem encerrada no SAP mantém o `LIB`. Se mantiver, a regra também precisa olhar o `ENCE`, senão uma ordem encerrada continua liberada no DAPROM.
- **Código de cancelamento:** o código de status de uma ordem cancelada no SAP (diferente de encerrada) não está confirmado. A tela oferece os códigos das ordens de exemplo e aceita texto livre.
- **Fora do escopo:**
  - o simulador receber a planilha de baixa que o DAPROM exporta, o que fecharia o ciclo DAPROM → SAP na demonstração;
  - um aviso em tempo real do SAP, que o SAP real não tem.

## 14. Como ficou a implementação

O que foi feito segue as seções acima. Estes pontos, que o desenho deixava abertos ou que mudaram ao implementar, valem daqui em diante:

- **Tabela e carga:** `ordem_sap_simulada` (migração `0020`). Na subida com `SAP_SIMULADO=true` e a tabela vazia, entram as 11 ordens de `fixtures/sap/ordens.json` (cada uma com `alterada_em` igual à sua `criada_em`); com ordens já lá, nada é tocado. No modo local a carga é a da subida. A demonstração grava também as OS que cria, no fim da carga, com `LIB IMPR` nas liberadas, pendentes e em execução, `ENCE` nas encerradas e `CRTD` nas canceladas.
- **Contrato:** só leitura, como o do SAP real. `POST` e `PATCH /sap-simulado/ordens` saíram (respondem `404`). A `criada_em` sai sempre em UTC (ISO).
- **Coluna "No DAPROM":** `no_daprom: {situacao, motivo?, aviso?}`. A `situacao` é `nao_lida`, `ignorada` (o `motivo` vem da leitura mais recente, entre as últimas 100 sem erro, que ignorou a ordem) ou o status da OS. Quando a OS existe e a atividade dela não tem modelo de APR, vem também o `aviso` "Atividade sem modelo de APR", que é o aviso que a leitura dá ao criar a OS. O selo `alterada_depois_da_leitura` compara a `alterada_em` com o início da última leitura sem erro; sem nenhuma leitura, toda ordem conta como alterada.
- **Lista:** os filtros `tipo`, `centro_trabalho` e `no_daprom` e a busca (sem acento) valem juntos; `contagem` traz todas as ordens por situação no DAPROM, sem os filtros. Com o filtro `no_daprom`, a lista é filtrada antes de paginar.
- **Catálogo:** os centros de trabalho são os do catálogo do simulador do RH (`SERV_ESP`, `INSTRUM`, `LAB_QUI` e três sem equipe) mais os das equipes que o admin criar, cada um dizendo a equipe que tem no DAPROM. As atividades vêm da tabela `atividade` com `com_modelo`.
- **Gerador:** o sorteio de atividade "qualquer" usa as com modelo ou as inventadas; "com modelo" é `422` `sem_atividade_com_modelo` se o DAPROM não tiver nenhuma. Preventivas sempre levam plano e item e, em cerca de 60%, o intervalo. O `dias` (padrão 14) vai de 0 a 365.
- **Edição:** o número da ordem é recusado (`422`), como a data fim antes do início (`422` `datas_invalidas`). O aviso do efeito no DAPROM é montado pela tela, a partir da situação da ordem (seção 7).
- **Excluir:** `409` `ordem_no_daprom` quando a OS existe, em qualquer status. Ordem nunca lida ou ignorada pode ser excluída.
- **Ações em massa:** `reprogramar` recebe `dias` (desloca início e fim; aceita negativo) ou `data` (novo início; o fim mantém a duração), um dos dois. `todos_da_busca` aceita `busca`, `tipo`, `centro_trabalho` e `no_daprom`. A confirmação da tela conta quantas das selecionadas estão no DAPROM e o efeito nelas.
- **Cartão de sincronização:** usa `GET /sap/sincronizacao`, `POST /sap/leituras` e `GET /importacoes`. A leitura pedida termina quando a última sem erro alcança o início dela (ou quando ela traz erro). Mostra OS criadas, atualizadas e as ignoradas com o motivo. **Os avisos da leitura não aparecem aí:** a `api` não os guarda; o aviso de cada OS está na coluna "No DAPROM".
- **Ponte da web:** libera o `/sap-simulado/gestao` (o contrato continua bloqueado).
- **Testes:** `api/test/sap-simulado.test.ts` (gestão, gerador, coluna "No DAPROM", selo, exclusão, ações em massa e os três cenários de ponta a ponta mais a reprogramação), e o teste do simulador em `api/test/sap.test.ts` mudou junto.
