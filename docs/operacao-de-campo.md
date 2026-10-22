# Operação de campo

O que acontece com uma OS no campo e na gestão: a APR, os modelos e a escolha do modelo, a execução (inclusive a compartilhada), o encerramento, o relatório e o PDF, as preventivas, os materiais, a atribuição e a devolução, e o painel. Como cada parte é construída está em [especificacao.md](especificacao.md); perfis, equipes, assinatura do perfil e avisos estão em [pessoas-e-equipes.md](pessoas-e-equipes.md); a entrada e a saída das OS, em [integracoes-simuladas.md](integracoes-simuladas.md); a IA (recomendação do modelo, Vitória, digitalização), em [ia-e-vitoria.md](ia-e-vitoria.md); os pontos, em [gamificacao-e-treinamentos.md](gamificacao-e-treinamentos.md). O que está em aberto fica em [pendencias.md](../pendencias.md).

O catálogo de todos os avisos (sino e e-mail) é [`shared/notificacoes/avisos.ts`](../shared/notificacoes/avisos.ts). Este documento cita pelo nome os avisos de cada passo.

## 1. Caminho da OS

### 1.1 Do começo ao fim

1. **Entrada.** A OS vem do SAP simulado (leitura agendada ou "Ler agora"), da planilha, do PDF da OS ou da digitalização de OS antigas ([integracoes-simuladas.md](integracoes-simuladas.md)). Nenhuma OS é criada à mão; a única que nasce no sistema é a OS de apoio (seção 5.8). A OS chega para a equipe toda (a equipe sai do centro de trabalho).
2. **Reserva ou devolução (opcional).** O supervisor da equipe pode reservar a OS a uma pessoa ou devolvê-la ao SAP (seção 11).
3. **APR.** O técnico escolhe o modelo (seção 3), monta a APR e a envia para validação no servidor (seção 4). Bloqueada, a OS fica `pendente`. Aprovada, cada participante assina na própria conta.
4. **Execução.** Com todos assinados, a execução começa; pausa, suspensão, interrupção por risco e encerramento (seção 5). Todos os participantes acompanham e agem (seção 6).
5. **Encerramento.** O clique em "Encerrar OS" para o tempo; quem encerrou preenche e assina; o supervisor lê o relatório e assina por último (seção 7).
6. **Documentos e baixa.** O PDF da OS é gerado depois da assinatura do supervisor (seção 8) e a OS entra na planilha de baixa ([integracoes-simuladas.md](integracoes-simuladas.md)).
7. **Depois.** Dashboards, mapa de calor, alertas do ciclo das preventivas e pontos.

### 1.2 Estados da OS

O status é derivado no servidor a partir das APRs e execuções (`recalcularStatusOs` em [`status-os.ts`](../api/src/dominio/status-os.ts)); nenhum cliente o grava. A lista está em `OS_STATUS` ([`api/src/db/schema/sap.ts`](../api/src/db/schema/sap.ts)).

| Status | Quando |
|---|---|
| `liberada` | sem APR bloqueada nem execução em andamento ou terminada |
| `pendente` | a última tentativa não concluiu: APR bloqueada, execução interrompida ou suspensa |
| `em_execucao` | há execução em andamento |
| `encerrando` | alguém clicou em "Encerrar OS" e ainda não assinou o encerramento |
| `aguardando_supervisor` | o encerramento foi assinado; falta a assinatura final do supervisor |
| `encerrada` | o supervisor assinou: a OS está concluída |
| `cancelada` | cancelada pelo SAP (na leitura) ou, a OS de apoio, pelo admin |
| `devolvida` | devolvida ao SAP pelo supervisor (seção 11) |

```text
liberada ──APR bloqueada──▶ pendente ──APR nova──▶ …
liberada/pendente ──iniciar──▶ em_execucao ──suspender/interromper──▶ pendente
em_execucao ──Encerrar OS──▶ encerrando ──quem encerrou assina──▶ aguardando_supervisor ──supervisor assina──▶ encerrada
```

`encerrando` e `aguardando_supervisor` não aceitam APR nem execução nova.

### 1.3 Regras de base

| Regra | Origem |
|---|---|
| **Uma APR vale para uma só OS** e ampara uma só execução. Toda tentativa exige APR nova; as respostas nunca são pré-preenchidas nem copiadas de outra APR. | Reunião 2 |
| **Validação no fim.** O checklist é respondido por inteiro e só então o servidor valida; não se bloqueia no primeiro "não". | Reunião 2 |
| **Evidência por item reprovado.** Todos os itens reprovados são listados, cada um com a sua evidência. | Reunião 2 |
| **OS pendente, sem duplicar.** A tentativa que não conclui deixa a OS `pendente`, com o histórico de todas as APRs; qualquer pessoa da equipe a retoma com APR nova, sem esperar o supervisor (que é avisado e pode reprogramar ou abrir OS de apoio). A OS pendente nunca é duplicada. | Reunião 2 |
| **Atividade de vários dias.** Cada retomada é uma execução nova, com APR nova. Suspender (o serviço não continua hoje) é diferente de interromper por risco. | Reunião 2 |
| **Cronômetro.** Iniciar, pausar, continuar e encerrar, com tempo de pausa e tempo líquido; o número de pessoas é informado ao iniciar. O tempo é calculado a partir do início, então corre com o celular bloqueado ou o app fechado. | Reuniões 2 e 3 |
| **Conflito vira alerta.** Um evento de campo que chega depois de o planejamento mudar (outra equipe, outra data, reserva) é aplicado mesmo assim e gera o alerta `conflito_planejamento` ao supervisor. | Especificação |

### 1.4 Online primeiro

Todo registro de campo (APR, assinaturas, execução, pausas, fotos, pedidos) entra por `POST /eventos`, com id gerado no aparelho; reenviar não tem efeito. Online, o servidor recusa o que conflita. Sem sinal (contingência, só no app), o evento vai para a fila e é aplicado quando o sinal volta; o que conflita vira alerta ou versão para a conferência (seção 6.5), nunca é descartado. O desenho da sincronização está em [especificacao.md](especificacao.md).

## 2. Modelos de APR

### 2.1 O que é um modelo

O modelo é o formulário da APR que a Segurança do Trabalho homologa. A Segurança não usa o sistema: o **admin** cadastra no editor de modelos (`/web`, seção APR, abas Modelos e Atividades) o que ela define. A carga inicial traz os 8 modelos de `base/apr-examples/` (APR 01 a 07 e 09).

| Parte | O que é |
|---|---|
| Itens de verificação | perguntas gerais da atividade |
| Riscos | os riscos da planilha, agrupados por classificação; a equipe marca os que existem na atividade |
| Medidas preventivas | perguntas ligadas a um risco; só as dos riscos marcados são respondidas |
| Contatos de emergência (PAE) | o bloco da planilha, mostrado no app e na APR do PDF |
| `participantes_com_assinatura` | a folha de participantes tem a coluna "Assinatura" (APR 04, 05 e 06) |

Cada item define, além do texto:

| Campo | Valores | Efeito |
|---|---|---|
| `tipo` | `eliminatorio` \| `alerta` | o eliminatório reprova a APR; o alerta só fica marcado no PDF e no painel do admin |
| `resposta_bloqueante` | `sim` \| `nao` \| nulo | a resposta que reprova (ou marca o alerta) |
| `evidencia` | `foto` (padrão) \| `texto` \| `pdf` | o que o item reprovado exige (seção 4.5) |
| `permite_na` | sim ou não | se o item aceita "NA" |
| `mostrar_clima` | sim ou não | a pergunta mostra a previsão do tempo (seção 4.7) |

### 2.2 Critério de bloqueio, por item

- **Quem define é a Segurança do Trabalho, item por item:** quais perguntas existem, qual resposta é a correta e quais são eliminatórias (nem toda pergunta bloqueia no "Não"). O admin cadastra.
- **A carga inicial é provisória.** As planilhas não dizem o critério, então ela usa um ponto de partida até a Segurança validar: todo item de verificação é `eliminatorio` e bloqueia no "Não", menos "O serviço requer uso de iluminação auxiliar?" (`alerta`, marca no "Sim") e "Existe algum impedimento para executar a atividade?" (`eliminatorio`, bloqueia no "Sim"); toda medida preventiva é `alerta`, sem resposta que avise.
- **Evidência:** `texto` só na pergunta de condição psicológica (não se comprova com foto, e a NR 01 dá o direito de recusa); os demais, `foto`. O admin pode pedir `pdf` onde a prova é um papel (laudo, certificado vencido).
- **NA:** só nos itens com `permite_na` (todos os das APR 04 e 05, que têm a coluna, e o teste de explosividade da APR 06), sempre com observação.

### 2.3 Versões

| Ação do admin | Resultado |
|---|---|
| Editar um modelo publicado | cria o rascunho da versão seguinte; a publicada nunca muda |
| Publicar o rascunho | vira a versão das APRs novas; a anterior fica só para leitura |
| Publicar sem item eliminatório | recusado: `sem_item_eliminatorio` |
| Publicar com item de verificação sem resposta bloqueante | recusado: `verificacao_sem_resposta_bloqueante` |
| Criar modelo novo | rascunho em branco ou copiado da versão em uso de outro modelo |
| Excluir modelo nunca publicado | apagado, com a orientação |
| Excluir modelo publicado | arquivado: sai das listas, da escolha e da cópia offline; as versões ficam (APRs e PDFs apontam para elas) |
| Restaurar | volta às listas e à escolha, com a orientação que tinha |

Toda APR aponta para a versão exata que respondeu. Uma APR feita sem sinal numa versão anterior é aceita com a versão que usou. As regras do esquema do modelo estão em [`modelo-apr-esquema.ts`](../api/src/dominio/modelo-apr-esquema.ts).

### 2.4 Orientação para o técnico

Na tela do modelo, a seção "Orientação para o técnico" guarda a descrição dos serviços que o modelo atende, exemplos e palavras-chave. Vale na hora para todas as versões, sem publicar, e entra na auditoria (`modelo_apr.orientacao`). A carga inicial traz a orientação dos 8 modelos, escrita a partir das planilhas; é ponto de partida para o admin revisar com a Segurança e a operação.

### 2.5 Atividades (o serviço)

A atividade é o código do plano de manutenção que a OS traz do SAP (`os.codigo_atividade`). Ela é o **serviço do catálogo** (a lista de materiais, seção 10) e entra na recomendação do modelo, mas **não escolhe o modelo**. O admin edita código, descrição e a marca de provisório na aba Atividades. A carga inicial entra toda como provisória, à espera dos códigos reais.

## 3. Escolha do modelo

### 3.1 O técnico escolhe

- **Não há atribuição automática.** A cada APR o técnico escolhe entre os modelos publicados. O mesmo serviço pode pedir APRs diferentes conforme a situação no local (remover marimbondo com ou sem trabalho em altura), e as corretivas não têm código padronizado (Iago, 14/10/2026).
- **Janela "Escolha o modelo da APR"** (web e app): todos os modelos publicados, cada um com título, descrição dos serviços, o que foi encontrado na OS e "Selecionar". O recomendado vem no topo, sob "Opção recomendada", com o aviso para conferir se é esse mesmo (a recomendação vem da leitura da OS, não do local). Os demais vêm sob "Outros modelos de APR". Sem recomendação, um aviso diz que nenhum modelo se destacou ou que mais de um combina.
- **A janela não mostra as palavras-chave nem os exemplos**, só o que foi achado na OS.
- **Quem decide o resultado é o servidor:** `POST /aprs/avaliar` e `apr_concluida` aceitam qualquer modelo publicado.
- **Sem sinal,** o app usa a escolha que veio na cópia da equipe.

### 3.2 A recomendação

O sistema procura as palavras-chave de cada modelo no título da OS, na descrição do serviço e na descrição da OS, e recomenda o de maior soma; empate no topo ou nada achado não recomenda nenhum. A recomendação de cada OS fica guardada (primeiro pelas palavras-chave, depois pela IA, se a função estiver ligada) e **nunca é aplicada sozinha**. Os pesos, a guarda por OS e a parte da IA estão em [ia-e-vitoria.md](ia-e-vitoria.md).

### 3.3 Troca do modelo

- Na etapa 1 ("Trocar modelo") e no checklist ("Trocar o modelo"), enquanto a APR não foi registrada como bloqueada.
- O técnico confere os riscos (os de mesmo nome já vêm marcados) e vê quantas respostas continuam e quantas perguntas ficam em branco.
- Pergunta igual (mesma seção e mesmo texto, sem acento, maiúsculas e pontuação; na medida preventiva, também o mesmo risco) guarda a resposta e a observação. "NA" só passa se o modelo novo aceita NA. As demais ficam em branco, e o checklist volta para a primeira pergunta em branco.
- As regras estão em `trocarModelo` e `riscosEquivalentes` ([`web/src/lib/apr.ts`](../web/src/lib/apr.ts)).

## 4. Preenchimento e avaliação da APR

### 4.1 Etapas

1. **Modelo, participantes e riscos.** A APR começa numa OS `liberada` ou `pendente` da equipe. OS em execução ou encerrada é recusada (`os_em_execucao`, `os_encerrada`).
2. **Checklist,** respondido por inteiro, em qualquer ordem, com volta para corrigir até concluir. Nenhuma resposta vem preenchida.
3. **Revisão,** com os materiais recomendados como lembrete (seção 10) e a observação geral (opcional, vai ao PDF).
4. **Validação no servidor** (`POST /aprs/avaliar`).

O rascunho fica no aparelho (SQLite no app, navegador na web) e nada é enviado até concluir.

### 4.2 Participantes

- **Ao menos 2 participantes, sem máximo** (`MIN_PARTICIPANTES` em [`apr-assinaturas.ts`](../api/src/dominio/apr-assinaturas.ts); `participantes_insuficientes`). Ninguém trabalha sozinho (Reuniões 1 e 3).
- **Exatamente um responsável** (`responsavel`; no papel, "Supervisor da Atividade"; não confundir com o supervisor da equipe). Os demais são `executor`. O técnico logado é sempre participante e, por padrão, o responsável.
- **Quem pode entrar** (`conferirApr` em [`eventos-apr.ts`](../api/src/dominio/eventos-apr.ts)): pessoa ativa e liberada, da equipe da OS (ou da equipe de quem preenche), com a assinatura cadastrada no perfil. O ausente e o desligado não entram (`participante_ausente`, `participante_inativo`).
- **OS reservada:** o responsável da APR tem de ser a pessoa designada (`responsavel_reservado`); os colegas entram como participantes (seção 11).

### 4.3 O técnico não sabe o que é eliminatório

- O modelo que o técnico recebe (tela e cópia offline) vem **sem** `tipo`, `resposta_bloqueante` e `evidencia`. Todas as perguntas têm a mesma aparência e nada pede evidência durante as respostas. Se ele soubesse, bastaria responder "certo" nesses itens.
- Responder a resposta bloqueante num item eliminatório **não muda nada na tela**; num item `alerta`, o técnico também não é avisado.
- Só o admin vê e define o que é eliminatório. Rankings e o detalhe da OS também escondem isso dos demais perfis: o técnico vê apenas o que reprovou.

### 4.4 Validação (`POST /aprs/avaliar`)

- Recebe a APR inteira, menos as fotos.
- **Confere tudo antes de dizer o resultado:** OS da equipe, participantes (mínimo, assinatura no perfil, ausência), riscos e respostas do modelo, respostas completas, "NA" só onde é permitido e com observação. A recusa nunca depende de a APR reprovar, para não revelar o que é eliminatório.
- **Item reprovado** = `tipo` `eliminatorio` com a resposta igual à `resposta_bloqueante`.
- **Aprovada:** nada é gravado na validação. A APR segue para o registro (`apr_concluida`), **sem assinaturas**.
- **Bloqueada:** registrada na hora, na própria validação, com **todos** os itens reprovados. A OS fica `pendente`, e o supervisor recebe o alerta `bloqueio` (sino e e-mail, com os itens e as observações). Descartar o rascunho e refazer não apaga a bloqueada; a nova é outra APR. A APR bloqueada é imutável.

### 4.5 Evidência dos itens reprovados

Só depois da validação o técnico vê quais itens reprovaram. As respostas ficam travadas e falta a evidência de **cada** item, que chega no `apr_concluida` da mesma APR:

| `evidencia` do item | O que se exige |
|---|---|
| `foto` | observação e ao menos 1 foto; um PDF a mais é aceito, mas não substitui a foto |
| `texto` | só a justificativa em texto (condição psicológica, direito de recusa); foto e PDF opcionais |
| `pdf` | observação e ao menos 1 PDF; a foto é opcional |

Online, falta de evidência é recusada (`evidencia_faltando`). Na fila offline, a APR vai inteira e sem a evidência (o aparelho não pôde perguntar ao servidor). O técnico vê "Atividade impedida — supervisor será avisado".

### 4.6 Assinaturas e direito de recusa

- **Cada participante assina na própria conta, só no começo** (Reunião 3). Registrada a APR aprovada, os demais recebem o aviso `apr_para_assinar` (só no sino) e a faixa na lista de OS, e assinam com a assinatura do perfil (`apr_assinada`). As APRs que esperam a pessoa estão em `GET /me/aprs-para-assinar`. Só a APR do dia se assina.
- **A execução só começa quando todos os que ficaram na APR assinaram** (`apr_sem_assinaturas`, com quem falta).
- **Direito de recusa** (`apr_recusada`, motivo obrigatório): o participante sai da APR, não assina e fica registrado; o supervisor recebe `direito_de_recusa` (sino e e-mail obrigatório). Só vale antes de a execução começar e para quem ainda não assinou. Se sobrarem menos de 2, ou se quem recusou foi o responsável, é preciso uma APR nova.
- **Sem sinal (contingência, no app):** os presentes assinam no aparelho do responsável (`assinatura_presencial`), e as assinaturas dos perfis são copiadas, marcadas como presenciais.
- **A APR pontua** quando todos assinaram (a bloqueada, quando chega a evidência). Ver [gamificacao-e-treinamentos.md](gamificacao-e-treinamentos.md).

### 4.7 Previsão do tempo na APR

A pergunta que o admin marca com `mostrar_clima` ("As condições climáticas estão favoráveis?" nos 8 modelos da carga) mostra a previsão das **próximas 4 horas** (a hora atual e mais 3).

- **Risco e "Sim":** quem responde que o clima está favorável quando a previsão indica risco vê uma janela com as condições e a orientação. O texto fala só do clima, nunca de "eliminatório" ou "bloqueio". Responder "Não" já é tratado pelo próprio item, sem janela.
- **Atenção:** o técnico revisa a resposta ou confirma e segue.
- **Extremo:** para seguir, anexa **uma foto do local**, ligada ao item de clima. Online, sem a foto, `foto_do_clima_faltando`; sem sinal, é aceita. Se a APR for aprovada assim, o supervisor (ou quem responde pela equipe) recebe na hora o aviso `clima_extremo` (sino e e-mail, categoria Segurança).
- **Nenhum nível impede de seguir:** a previsão é regional e é só uma probabilidade.
- **Sem previsão** (provedor fora do ar, sem sinal e sem cópia, Campo de treino): "Previsão do tempo indisponível", e nada é avisado nem exigido.
- **O que a pessoa viu é guardado** (`clima_registro`, uma linha por APR) e vai ao relatório: as horas, o nível, a orientação e se confirmou apesar do aviso.

**Classificação** (regras fixas, sem IA; `LIMITES_DO_CLIMA` em [`shared/api/clima.ts`](../shared/api/clima.ts), aplicadas em [`api/src/dominio/clima.ts`](../api/src/dominio/clima.ts)). O nível da janela é o da pior hora.

| Nível | Quando (qualquer um) |
|---|---|
| Extremo | trovoada (código WMO 95 a 99); rajada de 60 km/h ou mais; chuva de 10 mm/h ou mais |
| Atenção | chuva de 2,5 a 10 mm/h; chance de chuva de 60% ou mais; rajada de 40 a 60 km/h; sensação térmica de 35 °C ou mais; índice UV 8 ou mais |
| Sem risco | nada disso |

Os limites são constantes, não configurações: mudá-los é decisão da Segurança do Trabalho. As frases citam a causa mais grave, o horário e o que fazer ("Chuva prevista das 14h às 17h. Prefira os serviços externos antes desse horário e leve capa e bota de PVC.").

**De onde vem a previsão.** Só a `api` consulta o provedor (Open-Meteo; endereço e chave em `CLIMA_API_URL` e `CLIMA_API_CHAVE`), com cache de 30 minutos por quadrado de 0,1° (cerca de 11 km) e por dia. O provedor recebe só a posição arredondada, nunca a OS, a pessoa ou a equipe. A posição é o GPS do aparelho; sem GPS, a cidade padrão (seção 13). `GET /clima` nunca falha por causa do provedor: devolve `disponivel: false`. O plano gratuito do Open-Meteo é para uso não comercial.

### 4.8 Validade

- A APR vale para **uma** execução, **no dia** em que foi concluída. A de outro dia, ou já usada, não ampara execução nova (`apr_vencida`, `apr_ja_usada`).
- O cancelamento por engano devolve a APR para uso no mesmo dia (seção 5.7).

## 5. Execução

### 5.1 Iniciar

- Exige a APR aprovada, do dia, da própria OS, ainda não usada e assinada por todos os que ficaram nela (`execucao_iniciada` em [`eventos-execucao.ts`](../api/src/dominio/eventos-execucao.ts)).
- Informa o número de pessoas (padrão: os participantes da APR que ficaram) e grava o início e a localização. A OS fica `em_execucao`.
- **Quem inicia é o responsável pela execução** (`execucao.executor_id`), não necessariamente o responsável da APR: se o aparelho dele descarregou e a equipe seguiu com outro participante, quem inicia é o responsável.
- Com uma OS reservada, só o responsável designado inicia (`os_reservada`).

### 5.2 As quatro ações

| Botão | Quando usar | O que acontece |
|---|---|---|
| **Pausar** | parada curta; a equipe volta ao mesmo serviço no mesmo dia | motivo obrigatório e localização; só o tempo líquido para; "Continuar" retoma com a mesma APR, no mesmo dia |
| **Suspender** | o serviço não continua hoje | motivo obrigatório e localização; encerra esta execução; a OS fica `pendente` e a retomada pede APR nova |
| **Interromper por risco** | apareceu um risco ou impedimento | motivo, ao menos 1 foto (até 10, e até 5 PDFs) e a assinatura de quem interrompe, e a localização; a OS fica `pendente` e o supervisor recebe o alerta `bloqueio` |
| **Encerrar** | o serviço terminou | confirmação; o tempo para, a localização é gravada; seguem o preenchimento e as assinaturas (seção 7) |

"Continuar" noutro dia não existe (`continuar_invalido`): a execução é suspensa e a retomada pede APR nova. Interromper por risco pontua como encerrar: a segurança nunca custa pontos.

### 5.3 Motivos da pausa e da suspensão

Os motivos estão em [`shared/api/execucao-motivos.ts`](../shared/api/execucao-motivos.ts) (Reunião 3, itens 6 e 7).

| Motivo | Pausa | Suspensão | Complemento |
|---|---|---|---|
| Almoço | sim | — | — |
| Aguardando | sim | — | obrigatório: o que ou quem |
| Descanso | sim | — | — |
| Condição climática | sim | sim | — |
| Enfermidade | sim | sim | opcional: o que aconteceu (a confirmar; ver pendencias.md) |
| Lesão | sim | sim | opcional: o que aconteceu (a confirmar; ver pendencias.md) |
| Fim de expediente | — | sim | — |
| Falta de material ou equipamento | — | sim | — |
| Outro | sim | sim | obrigatório: descrição |

Recusas: `motivo_obrigatorio`, `complemento_obrigatorio`.

### 5.4 Lesão e enfermidade

Na pausa ou na suspensão, avisam o supervisor **na hora** com `lesao_ou_enfermidade` (sino e e-mail obrigatório, categoria Segurança; `avisarSaude` em [`execucao-acoes.ts`](../api/src/dominio/execucao-acoes.ts)) e constam no relatório, na seção "Ocorrências de saúde". A lesão no trabalho, mesmo leve, é acidente de trabalho e a empresa precisa registrá-la. Um participante machucado **pausa o serviço todo**: não existe sair da execução.

### 5.5 Localização

- Gravada em cinco momentos: **início, pausa, suspensão, interrupção e encerramento** (o clique). Na assinatura da APR, não.
- Sem GPS (permissão negada, local coberto), o serviço não é bloqueado: fica "sem localização".
- A tela avisa que a localização é registrada nesses momentos (LGPD).
- No notebook, a posição vem da rede e é aproximada; no celular, do GPS.
- A OS só tem o endereço em texto: o relatório mostra o ponto (coordenadas e link do mapa no PDF; mapa embutido no detalhe) ao lado do endereço, sem calcular a distância.
- As fotos também guardam a posição, quando há GPS.

### 5.6 Tempos

- **Tempo total:** do início ao fim. **Tempo pausado:** a soma das pausas. **Tempo líquido:** total menos pausado. A conta está em [`shared/api/execucao-tempo.ts`](../shared/api/execucao-tempo.ts).
- O preenchimento do encerramento não entra no tempo (seção 7.1).

### 5.7 Cancelar por engano e execução esquecida

- **Cancelar por engano:** só o responsável pela execução (`so_o_responsavel`), até **10 minutos** depois do início (`CANCELAR_ATE_MS`), sem pausa nem foto, com a assinatura dele. A execução fica `cancelada`, a APR volta a poder ser usada no mesmo dia e a OS volta ao status anterior.
- **Execução esquecida:** quem tem execução aberta de outro dia precisa suspendê-la, informando a hora real do fim, antes de iniciar outra (`execucao_esquecida`). Ninguém encerra a execução de outro e nada é encerrado sozinho. O painel destaca execuções abertas há mais de 12 h.

### 5.8 Impedimento: OS pendente, reprogramação e OS de apoio

| Situação | O que acontece |
|---|---|
| APR bloqueada ou interrupção por risco | OS `pendente`; alerta `bloqueio` ao supervisor da equipe (sino e e-mail com o nº da OS, local, técnico, itens, observações e links das fotos); sem supervisor, aos admins |
| Suspensão | OS `pendente`; sem alerta (salvo lesão ou enfermidade) |
| Nova tentativa | qualquer pessoa da equipe inicia uma APR nova, a qualquer hora, sem autorização |
| Reprogramar | o supervisor da equipe ou o admin muda a data ou a equipe, com justificativa obrigatória; o status não muda; a OS pendente que passa da data conta como atrasada **justificada** |
| OS de apoio | quando é preciso outra equipe antes (caixa de válvula cheia d'água: a civil drena), o supervisor da equipe ou o admin abre a OS de apoio para qualquer equipe, ligada à original, que continua `pendente`. A OS de apoio não tem número SAP e sai na aba "Sem ordem SAP" da planilha |
| OS de apoio encerrada | a original continua `pendente`; o supervisor dela recebe `apoio_encerrado` |
| Cancelar | só a OS de apoio, só pelo admin, com justificativa e com a OS `liberada` ou `pendente`; a OS do SAP é cancelada pelo SAP |

Reprogramar e abrir OS de apoio ficam no detalhe da OS e no alerta.

## 6. Execução compartilhada

Todos os participantes de uma execução a acompanham e agem sobre ela, sem depender do aparelho do responsável (conversa de 19/10/2026). O que foi feito sem sinal em aparelhos diferentes é conferido e assinado depois.

### 6.1 Quem é quem

- **Responsável** é quem iniciou a execução (`execucao.executor_id`).
- **Participante** é quem está na APR da execução e não recusou (`participaDaApr` em [`execucao-acoes.ts`](../api/src/dominio/execucao-acoes.ts)). Quem não participa, ou recusou, não age (`execucao_de_outro`).
- O participante ausente (usuário ausente) só visualiza ([pessoas-e-equipes.md](pessoas-e-equipes.md)).

### 6.2 O que cada um pode fazer

A regra está em um só lugar: `pedeAprovacaoDoResponsavel` ([`shared/api/execucao-pedidos.ts`](../shared/api/execucao-pedidos.ts)).

| Ação | Responsável | Outro participante, com sinal | Sem sinal (qualquer um) |
|---|---|---|---|
| Pausar (qualquer motivo) | na hora | na hora, com aviso ao responsável (a confirmar; ver pendencias.md) | na hora |
| Continuar | na hora | na hora; depois de pausa por lesão ou enfermidade, com confirmação reforçada (a confirmar; ver pendencias.md) | na hora |
| Interromper por risco | na hora | na hora | na hora |
| Suspender por lesão ou enfermidade | na hora | na hora | na hora |
| Suspender por outro motivo | na hora | **pedido de 2 minutos** | na hora |
| Encerrar a OS | na hora | **pedido de 2 minutos** | na hora |
| Cancelar por engano | na hora (seção 5.7) | não | não |

- Com sinal, o participante que manda encerrar ou suspender por motivo comum direto é recusado com `pedido_necessario`.
- Interromper e suspender por saúde pedem foto (a interrupção), motivo e a assinatura **de quem as faz**.
- O que o participante faz chega ao responsável pelo aviso `acao_de_participante` (só no sino).

### 6.3 Os pedidos de 2 minutos

- **Prazo:** `PRAZO_DO_PEDIDO_MS` (2 minutos), contado no relógio da `api` desde que ela recebeu o pedido (`expira_em`). O relógio do aparelho não entra.
- **Estados:** `aberto` → `aprovado` (pelo responsável), `aprovado_por_prazo` (2 minutos sem resposta), `recusado`, `cancelado` (quem pediu desistiu) ou `obsoleto` (o responsável agiu antes, ou a execução acabou).
- **O silêncio aprova.** O responsável recebe `pedido_de_acao`; sem resposta, o pedido é aprovado sozinho e os dois são avisados (`pedido_decidido`, `acao_de_participante`). Se o aparelho dele está fechado ou sem sinal, o pedido vence e aprova, que é o resultado pretendido.
- **Um pedido aberto por execução.** Quem quer pedir com um aberto pode **apoiá-lo** (`pedido_apoiado`; fica registrado que concordou) e não abre outro (`pedido_aberto_existente`).
- **Quem decide primeiro vale:** a decisão do responsável e o vencimento disputam a mesma linha; a segunda recebe `pedido_ja_decidido`.
- **Recusar** aceita um motivo curto, que o solicitante lê. Saúde e risco nunca são pedidos.
- **A ação vale no instante do clique** de quem pediu, não no da aprovação; a espera aparece no relatório. Aprovado, o pedido é aplicado em nome do solicitante: ele é o autor e, se for o encerramento, é quem assina o encerramento (seção 7.2). Recusado, a execução continuou correndo.
- **Pausa no meio da espera:** a pausa que um colega abriu enquanto o pedido esperava fecha no próprio início, sem duração, e a execução termina no início dela, nunca antes.
- **O pedido chega ao servidor em duas camadas:** a tarefa `pedido_prazo`, agendada para `expira_em`, e o fechamento dos vencidos antes de qualquer leitura ou ação sobre a execução ([`pedidos-execucao.ts`](../api/src/dominio/pedidos-execucao.ts)). A tela nunca mostra como aberto um pedido vencido.
- **Pedir, recusar ou apoiar não pontua nem custa pontos.**

### 6.4 Acompanhar e responder

Não há push no celular; o aviso é por consulta periódica, só com a tela aberta e em primeiro plano.

| Quem | O que vê | Atualização |
|---|---|---|
| Participante | "Acompanhando [nome]": cronômetro, pausa atual com o motivo, quem está na execução e quem é o responsável; as mesmas ações do responsável; o pedido aberto com a contagem, "Cancelar o pedido" (de quem pediu) e "Apoiar o pedido" (dos outros) | a cada 10 s |
| Responsável | o pedido no topo da tela de execução, com a contagem, "Aprovar" e "Recusar"; o app vibra | a cada 5 s (3 s com pedido aberto) |
| Responsável, em outra tela | a faixa "[nome] pediu para encerrar — 1:42" (`GET /me/pedidos-abertos`), que leva à execução | a cada 10 s |
| Supervisor | no detalhe da OS: quem encerrou, quem pausou e retomou, os pedidos com o resultado | ao abrir |

Sem sinal, o app mostra a última cópia, com a faixa "Dados de HH:MM".

### 6.5 Sem sinal: versões de outros aparelhos

- Sem sinal, nenhum pedido é feito: a ação vale na hora no aparelho de quem a fez. O `pedido_aberto` que chega da fila offline aplica a ação direto.
- O participante sem sinal pode **registrar a execução no próprio aparelho** (o "Iniciar a execução" da cópia offline). Se a APR já amparou a execução de outro, o `execucao_iniciada` dele vira **versão** da mesma execução, e os eventos seguintes dele chegam à execução certa.
- **Nada da fila offline é recusado por conflito:** pausa com outra aberta, fim depois de outro fim, pausa depois do fim e o encerramento assinado de quem encerrou num aparelho cujo fim ficou como versão viram versão. As fotos de todos os aparelhos **somam**, e a descrição preenche o que está em branco. Com sinal, os conflitos continuam recusados.

### 6.6 A conferência

O desenho está em [`conferencia-execucao.ts`](../api/src/dominio/conferencia-execucao.ts) e [`conferencia-comparacao.ts`](../api/src/dominio/conferencia-comparacao.ts).

1. **Nasce** quando a execução termina e algum evento dela veio sem sinal ou ficou como versão. Tudo online, nada a conferir.
2. **Espera a sincronização** (`aguardando_sincronizacao`): cada participante da APR que não recusou, está ativo e já usou o app precisa ter sincronizado depois do fim, com a fila daquela OS vazia. Quem nunca usou o app não tem fila e já está em dia.
3. **Monta** uma versão por autor (início, pausas, fim, resultado). Valores dentro da tolerância de **5 minutos** (`TOLERANCIA_MS` em [`shared/api/conferencia-execucao.ts`](../shared/api/conferencia-execucao.ts)) valem como o mesmo; pausas se casam por sobreposição; fotos somam.
4. **Resultado:**
   - **`resumo`:** tudo bate. "Isto é o que foi registrado" e **ciência** (um toque, sem assinatura).
   - **`com_divergencia`:** as versões lado a lado, cada diferença destacada ("fim: 14:15 (Ana) · 15:00 (João)"), com o **padrão sugerido**: o início e o fim mais antigos, o resultado de quem concluiu primeiro, a pausa do responsável. A pausa que só um aparelho registrou sem sinal pede "aceitar" ou "descartar".
5. **Quem decide** (`aguardando_responsavel`): o **responsável da conferência** decide horários e pausas; o **supervisor** decide o resultado quando ele diverge (um suspendeu, outro encerrou), porque muda o status da OS (a confirmar; ver pendencias.md). O responsável da conferência é quem iniciou primeiro, se começou mais de 5 minutos antes do que a execução tem gravado; dentro da tolerância, quem a execução já tem (a confirmar; ver pendencias.md). Ao aplicar, ele passa a ser o `executor_id`.
6. **Aplica** a escolha nas tabelas da execução, guarda o que valia antes (auditoria) e recalcula o status da OS.
7. **Assinaturas** (`aguardando_assinaturas`): todos os participantes menos o responsável dão ciência (no resumo) ou assinam com a assinatura do perfil (na divergência), com **ressalva** opcional, que não trava e avisa o supervisor e o responsável.
8. **Conclui** quando todos assinaram, ou fecha com o que existe (seção 6.7).

- **A assinatura final do supervisor espera a conferência montar:** `POST /os/{id}/ciencia` recusa com `conferencia_pendente` enquanto ela está em `aguardando_sincronizacao` ou `aguardando_responsavel`; as ciências e assinaturas não a seguram. Os pontos e o encerramento do responsável não esperam.
- **A conferência compara início, fim, resultado e pausas.** A descrição, o checklist e as fotos de outros aparelhos ficam guardados no evento (as fotos somam); não são comparados.
- **O evento que chega depois** de a conferência montar fica guardado como "chegou tarde" e não altera o que foi decidido.
- **Trocar o resultado** pela conferência não recalcula os pontos já dados, e quem passa a ser "quem encerrou" assina o encerramento de novo.
- **Telas:** web (`/app/os/{id}/conferencia`) e app, só online ("Conecte-se para conferir"); cartão "Para conferir" no perfil, faixa na lista e no detalhe da OS; a Vitória explica a conferência na primeira vez. Rotas: `GET /me/conferencias`, `GET /conferencias/{id}`, `POST /conferencias/{id}/decidir`, `/assinar` e `/fechar`.
- **Avisos** (sino e e-mail, categoria Equipe): `conferencia_aberta`, `conferencia_cobranca`, `conferencia_para_decidir`, `conferencia_para_assinar`, `conferencia_ressalva` e `conferencia_tempo_esgotado`.

### 6.7 Prazos da conferência

Constantes em [`shared/api/conferencia-execucao.ts`](../shared/api/conferencia-execucao.ts); a tarefa de hora em hora (`conferirConferencias`) confere os prazos.

| Prazo | Constante | O que acontece |
|---|---|---|
| 24 h e 48 h | `AVISAR_FALTANTES_EM_HORAS` | aviso a quem falta (sincronizar, escolher ou assinar) e ao responsável |
| 72 h | `LIBERAR_FECHAMENTO_EM_MS` | o responsável ou o supervisor ganha "Fechar com o que existe", que segue sem quem falta e registra quem faltou; o supervisor também passa a decidir no lugar do responsável que não sincronizou |
| 7 dias | `LIMITE_DA_CONFERENCIA_MS` | a conferência fecha sozinha: monta, aplica o padrão sugerido, fecha sem quem faltou e avisa o supervisor |

Os prazos de 72 h e 7 dias são do código e ainda não foram confirmados (a confirmar; ver pendencias.md).

## 7. Encerramento e assinatura final

### 7.1 Dois passos

1. **"Encerrar OS"** (`execucao_encerrada`): uma janela pede a confirmação, avisando que o tempo para e que a execução não pode ser retomada. Ao confirmar, grava o fim, a localização e quem encerrou. A OS fica `encerrando`.
2. **Preenchimento e assinatura** (`encerramento_assinado`):
   - o checklist de inspeção, nas preventivas cujo plano tem checklist (seção 9);
   - a descrição da atividade, **opcional** (em branco, o PDF e a planilha trazem "Executado conforme a OS, sem ocorrências", `DESCRICAO_SEM_OCORRENCIAS`);
   - fotos (até 10) e PDFs (até 5), **opcionais**;
   - a assinatura do perfil de quem encerrou;
   - as condições do tempo daquela hora, enviadas sem pedir nada à pessoa (vão ao relatório).

   Esse preenchimento não entra no tempo. A OS fica `aguardando_supervisor`, o supervisor recebe `os_para_assinar` e a execução pontua.

Sem o clique em "Encerrar OS", o preenchimento é recusado (`execucao_nao_encerrada`). Enquanto a OS está `encerrando`, a tela leva quem encerrou de volta ao preenchimento; os demais veem "[nome] está preenchendo o encerramento".

### 7.2 Quem encerrou assina

- O responsável encerra na hora; outro participante, com sinal, pede (seção 6.3); sem sinal, encerra na hora.
- **Quem encerrou assina o encerramento**, mesmo que não seja o responsável: `quemEncerrou` ([`execucao-acoes.ts`](../api/src/dominio/execucao-acoes.ts)) devolve `execucao.finalizada_por` (ou o responsável, nas execuções anteriores a essa coluna). Os demais são recusados com `encerramento_de_outro`.
- Os demais participantes não assinam de novo: já assinaram a APR, no começo.
- Duas execuções encerradas na mesma OS (fila offline) são guardadas, com o alerta `execucao_duplicada`; vale a primeira encerrada e assinada, e só ela pontua.

### 7.3 Assinatura final do supervisor

- O supervisor da equipe da OS lê o relatório da execução (seção 8.1) e assina por último (`POST /os/{id}/ciencia`), **mesmo que tenha participado do serviço**. Com o supervisor ausente, assina o representante que está no comando (a confirmar; ver pendencias.md). Quem pode assinar está em [pessoas-e-equipes.md](pessoas-e-equipes.md); a página Validações reúne as OS que esperam a assinatura dele.
- Só com a OS `aguardando_supervisor` (`os_nao_aguardando_supervisor`; `ciencia_ja_dada`) e com a conferência, se houver, já montada (`conferencia_pendente`).
- A OS passa a `encerrada` (concluída), o PDF é gerado em segundo plano (tarefa `pdf_os`) e a OS entra na planilha de baixa. Quem executou recebe `os_ciencia`.
- A assinatura dentro do prazo pontua o supervisor ([gamificacao-e-treinamentos.md](gamificacao-e-treinamentos.md)).
- Essa assinatura é a antiga "ciência" (Reunião 3); o nome `ciencia` ficou nas rotas e colunas.

## 8. Relatório da execução e PDF da OS

### 8.1 Relatório da execução

Documento à parte do PDF, como um anexo, gerado na hora a partir do banco ([`relatorio-execucao.ts`](../api/src/servicos/relatorio-execucao.ts)). `GET /os/{id}/relatorio-execucao`: só o supervisor da equipe e o admin (`403` para os demais, `404` fora do escopo, `409` `os_sem_execucao` sem execução finalizada). O detalhe da OS mostra o mesmo conteúdo na tela.

Traz tudo o que o SYNQ OS acrescenta ao papel:

| Seção | Conteúdo |
|---|---|
| Ocorrências de saúde | lesão e enfermidade, na pausa ou na suspensão |
| Tempo | total (com as pausas), pausado e líquido |
| Pausas | início, fim, motivo, complemento e localização de cada uma |
| Suspensões e interrupções | motivo e localização |
| Ações dos participantes | pausas e retomadas de quem não é o responsável, quem finalizou, cada pedido com o resultado, quem decidiu, quanto esperou e quem apoiou |
| Conferência da execução | o que cada aparelho registrou, o que valeu e por quem, ciências, assinaturas, ressalvas e quem faltou |
| Localização | do início e do encerramento, ao lado do endereço da OS |
| Fotos e documentos anexados | as fotos e os PDFs da execução |
| Checklist de inspeção | o das preventivas (seção 9.4) |
| Condições climáticas | o que a pessoa viu na APR e as condições no encerramento |
| Assinaturas da APR | cada participante, com a hora (presencial ou na própria conta) |
| Assinaturas do encerramento | quem assinou o encerramento |

### 8.2 PDF da OS

- **Reproduz os documentos originais, sem nada a mais** (Reunião 3, item 14): a página da APR e as duas folhas da OS do SAP. Tempos, pausas, localização, fotos, PDFs anexados, checklist de inspeção e as assinaturas da APR com a hora **não vão para o PDF**: estão no relatório.
- **Só existe depois da assinatura final do supervisor** (`GET /os/{id}/pdf`; `os_nao_encerrada` antes). Se o arquivo ainda não foi guardado, é gerado na hora. Uma falha na geração deixa "PDF pendente" no painel e é tentada de novo.
- **A APR** é a da execução que encerrou, como o modelo em papel: cabeçalho (ordem, instalação ou local, data, hora, descrição do serviço), participantes com função, nome e matrícula (a coluna "Assinatura" só nos modelos com `participantes_com_assinatura`: APR 04, 05 e 06), todos os itens com a resposta e as observações, os alertas destacados, a observação geral, o PAE, o código, a versão e a data do documento. Cada página é reduzida até 45% para caber numa A4; só uma APR que não caiba nem assim segue em outra folha.
- O código está em [`pdf-paginas.ts`](../api/src/servicos/pdf-paginas.ts) e [`pdf-dados.ts`](../api/src/servicos/pdf-dados.ts).

### 8.3 A folha da OS do SAP

Conferida nos exemplos de `base/os-examples/` (`folhaDaOrdem` e `folhaDaExecucao` em [`pdf-paginas.ts`](../api/src/servicos/pdf-paginas.ts)):

| Parte da folha | O que o SYNQ OS põe |
|---|---|
| Cabeçalho, objetos técnicos e planejamento da ordem | os dados do SAP |
| Caixa do logotipo | o texto "SYNQ OS", no lugar do logotipo da empresa (a confirmar; ver pendencias.md) |
| Operações: N Pes, data e hora de início e de fim (a linha de baixo, que se preenchia à mão) | o número de pessoas, o início (o mais antigo entre a execução que encerrou e as suspensas ou interrompidas antes dela) e o clique em "Encerrar OS" |
| Descrição da atividade | a descrição do encerramento, ou "Executado conforme a OS, sem ocorrências" |
| "Atesto que os serviços acima foram executados satisfatoriamente", com 3 blocos de executante | o nome, a data, os horários e a assinatura que cada um deu na APR; ninguém assina de novo. Com mais de 3, os extras seguem em novas linhas de blocos iguais |
| Responsável - Manutenção | a assinatura de quem encerrou |
| Supervisor | a assinatura final do supervisor |
| Solicitante da Manutenção | em branco, como no papel |
| "Houve desvio?" e "Tempo parada" | em branco, como no papel |

Ficam em aberto, com o cliente: preencher "Houve desvio?" e "Tempo parada"; mais de 3 executantes ([pendencias.md](../pendencias.md)).

### 8.4 Planilha de baixa

A baixa no SAP é por planilha, gerada pelo admin, com as abas Encerradas, Sem ordem SAP, Impedimentos e Devolvidas. As colunas e as regras de exportação estão em [integracoes-simuladas.md](integracoes-simuladas.md).

## 9. Preventivas e checklist de inspeção

### 9.1 Ciclo das preventivas

- **O plano é a chave plano + item de manutenção** (`plano_preventiva`), criado na entrada da primeira OS preventiva dele. Toda OS preventiva com a mesma chave é um ciclo.
- **O sistema não cria OS:** conta o tempo até o próximo ciclo e avisa. As OS continuam vindo do SAP.
- **Próximo ciclo** = referência + intervalo (`n` dias, semanas, quinzenas, meses, bimestres, trimestres, semestres ou anos). A referência é o dia do encerramento da última OS (padrão; enquanto ela não é executada, "aguardando execução") ou a data programada dela (calendário fixo).
- **Alertas:** `preventiva_proxima` dentro da antecedência (padrão 7 dias) e `preventiva_vencida` quando vence sem OS nova, uma vez por vencimento, ao supervisor da equipe da última OS (sem supervisor, aos admins). Só no sino. Conferidos na subida, a cada 60 minutos, depois de cada entrada de OS e de cada edição do plano.
- **Quem edita:** o admin e o supervisor da equipe, no editor do ciclo (botão "OS preventivas" do quadro). O intervalo também vem da planilha, da Periodicidade do PDF ou da conferência da importação.
- Regras e contagens em [`preventivas.ts`](../api/src/dominio/preventivas.ts).

### 9.2 O checklist do plano

- **Cada plano tem o seu checklist,** definido no editor do ciclo, na seção "Checklist de inspeção", pelas mesmas pessoas que editam o ciclo.
- **Lista de perguntas,** cada uma uma caixa de marcar: até `MAX_PERGUNTAS_DO_CHECKLIST` (50) perguntas, com até `MAX_TEXTO_DA_PERGUNTA` (300) caracteres ([`shared/api/checklist-inspecao.ts`](../shared/api/checklist-inspecao.ts)). Adicionar, editar, remover e reordenar.
- **Leituras com valor** (tensão, horímetro) e opções além de marcado ou não vão na observação.
- **Plano sem checklist:** o encerramento segue sem ele.
- **Auditoria:** `plano_preventiva.checklist`, com o antes e o depois.

### 9.3 Como o técnico preenche

- **Antes de sair:** o detalhe da OS preventiva mostra o cartão "Checklist de inspeção".
- **No encerramento** (passo 2, seção 7.1), antes da descrição, das fotos e da assinatura: cada pergunta é uma caixa; "Marcar todos" marca tudo; o item **não marcado** pede observação (até `MAX_OBSERVACAO_DO_ITEM`, 500 caracteres); o marcado aceita observação opcional.
- **Item não marcado não bloqueia:** a OS encerra, e o supervisor da equipe (ou os admins) recebe `inspecao_com_pendencia` no sino, com a OS, o plano e cada item com a observação.
- **Só no encerramento:** interrupção, suspensão e cancelamento não pedem o checklist.
- **O servidor decide** (`conferirInspecao` em [`eventos-execucao.ts`](../api/src/dominio/eventos-execucao.ts)): confere as respostas com o checklist atual do plano. Online, falta de resposta é `checklist_incompleto`; item não marcado sem observação é `observacao_obrigatoria` (também na fila offline). Da fila offline, a pergunta que o aparelho não conhecia fica como "não respondida" (`marcado: null`, sem alerta). Resposta a pergunta removida é ignorada.

### 9.4 O que fica registrado

- **Na execução:** `execucao.dados_inspecao` = `{ itens: [{ pergunta, marcado, observacao }] }`, gravado no `encerramento_assinado`. A pergunta é copiada como estava: mudar o checklist depois não altera execuções antigas.
- **No detalhe da OS:** o histórico da execução mostra o checklist, com os itens não marcados em destaque.
- **No relatório da execução** (não no PDF da OS): a seção "Checklist de inspeção", com `[X]` (marcado), `[  ]` (não marcado) e `[?]` (não respondida), a pergunta e a observação.
- **Pontos:** preencher o checklist não dá bônus (é obrigatório para encerrar); a preventiva concluída vale o dobro da corretiva ([gamificacao-e-treinamentos.md](gamificacao-e-treinamentos.md)).

## 10. Materiais

### 10.1 Lista recomendada, só para consulta

- **Cada serviço (atividade) tem uma lista** de materiais, ferramentas e EPIs, com quantidade prevista por execução (vazia = conforme a necessidade) e observação. O admin cadastra os materiais e monta a lista no Catálogo (`/app/catalogo`, abas Serviços e Materiais), aberto a todos para leitura.
- **Onde aparece:** o cartão "Materiais recomendados" no detalhe da OS e na revisão da APR, só leitura, agrupado em materiais, ferramentas e EPIs. OS sem serviço, ou serviço sem lista: "Esta OS não tem serviço do catálogo", e valem as instruções do SAP.
- **Sem estoque, sem foto, sem bloqueio** (decisão de 15/10/2026). Não há item obrigatório, resposta "Levei" ou "Não levei", foto do item nem bloqueio da APR por material: como o técnico escolhe o modelo e a situação no local varia, exigir a prova barraria o serviço sem ganho de segurança, e uma resposta que ninguém confere vira clique automático. A APR só bloqueia por item eliminatório reprovado. Se um item for indispensável, ele entra como pergunta do modelo de APR.
- **Fora do escopo:** estoque, saldo, empréstimo e devolução (trabalho do SAP e do almoxarifado), material fora da lista, cadastro de cada unidade (patrimônio, série, calibração) e os materiais no PDF.
- **Catálogo:** material com o mesmo código do SAP, ou a mesma descrição na mesma unidade, é recusado (`material_duplicado`); material desativado sai das escolhas, mas continua nos serviços que já o listam; material em uso num serviço ou numa sugestão não é excluído (`material_em_uso`, `material_em_sugestao`).
- A lista real de cada serviço depende da ES Gás ([pendencias.md](../pendencias.md)).

### 10.2 Sugestão e contestação

Qualquer funcionário que não seja administrador pode **sugerir** uma lista para um serviço (a partir da atual ou do zero) ou **contestar** a recomendada (19/10/2026). O admin não envia: edita a lista direto no catálogo. Código em [`sugestao-materiais.ts`](../api/src/dominio/sugestao-materiais.ts); tipos e a diferença entre listas (`diferencaDeListas`) em [`shared/api/sugestao-materiais.ts`](../shared/api/sugestao-materiais.ts).

| | Sugestão | Contestação |
|---|---|---|
| Lista | obrigatória (`lista_obrigatoria`); igual à atual é recusada (`sem_mudanca`) | opcional |
| Motivo | opcional | obrigatório, ao menos `MIN_CARACTERES_DO_MOTIVO` (10) caracteres |

- **Itens:** um material do catálogo ou "Não achei" (descrição, unidade, categoria). O item digitado igual a um material do catálogo (mesma descrição e unidade, sem diferenciar maiúsculas) já vira o material; os demais ficam como digitados até o avaliador ligá-los a um material ou cadastrá-los.
- **Uma pendente por pessoa e serviço** (`sugestao_pendente`); para enviar outra, a pessoa retira a anterior.
- **Onde:** no detalhe da OS (cartão de materiais) e no catálogo, dentro de "Ver materiais"; a aba "Sugestões" tem "Minhas" e "Para avaliar". No app, só com sinal: a sugestão não entra na fila offline.

### 10.3 Quem avalia: a equipe responsável

- **Equipes do serviço:** as que têm OS dele, sem contar as canceladas e as devolvidas.
- **A responsável** é a de mais OS; no empate, a de mais pontos gerais; se ainda empatar, a ordem alfabética. A equipe é gravada no envio e não muda depois.
- **Quem avalia:** o supervisor da equipe responsável (ou o representante no comando), **menos as próprias**; o admin avalia qualquer uma. Se o autor é o supervisor da responsável, ou o serviço não tem OS, só os admins avaliam.
- O catálogo mostra "Equipes do serviço", com a responsável em destaque.

### 10.4 Avaliação

- **Aceitar:** a lista da proposta passa a ser a do serviço. O avaliador pode ajustar antes ("Ajustar e aceitar"; fica marcada "com ajustes"). A contestação sem lista só é aceita com a lista que passa a valer.
- **Recusar:** motivo obrigatório (ao menos 10 caracteres), que chega ao autor.
- **A lista pode ter mudado desde o envio:** a tela avisa e mostra a lista base e a de agora; a diferença é sempre calculada sobre a de agora. Várias pendentes do mesmo serviço são permitidas, e o avaliador decide cada uma.
- **Aceitar é atômico;** duas pessoas ao mesmo tempo: só uma vence (`sugestao_ja_avaliada`).
- **Auditoria:** `sugestao_materiais.aceitar`, `sugestao_materiais.recusar` e `atividade.materiais`.
- **Pontos:** o autor pontua quando a sugestão ou a contestação é aceita (uma vez por pessoa e serviço a cada `DIAS_ENTRE_PONTUACOES`, 30 dias), e o avaliador ao aceitar ou recusar; enviar não pontua. Valores em [gamificacao-e-treinamentos.md](gamificacao-e-treinamentos.md) (a confirmar; ver pendencias.md).

### 10.5 Avisos

| Aviso | Quem recebe | E-mail |
|---|---|---|
| `sugestao_materiais_nova`, `contestacao_materiais_nova` | quem avalia (sem ninguém, os admins) | sim, categoria Equipe |
| `sugestao_materiais_aceita`, `sugestao_materiais_recusada` | o autor | sim, categoria Equipe |
| `materiais_atualizados` | todos os membros e supervisores das equipes do serviço, menos quem mudou e o autor | só no sino |

O `materiais_atualizados` sai de qualquer mudança da lista (sugestão aceita ou edição do admin), com o resumo da mudança ("+ Detector; − Fita; ~ Luva (2 par → 3 par)"). Salvar a mesma lista não avisa.

## 11. Atribuição individual e devolução ao SAP

Decidida em 15/10/2026. A OS chega para a equipe toda, e qualquer pessoa dela inicia a APR (é assim que a operação funciona). A reserva é um diferencial, para o supervisor garantir quem faz uma OS. Regras em [`atribuicao-os.ts`](../api/src/dominio/atribuicao-os.ts) e `conferirReserva` ([`eventos-base.ts`](../api/src/dominio/eventos-base.ts)).

### 11.1 Reservar

- **Só o supervisor da equipe da OS** reserva, troca o responsável ou libera ("Liberar para a equipe toda"), no painel "Quem faz esta OS" do detalhe. Nem o admin faz isso (`403`; quem não vê a equipe recebe `404`). Na equipe sem supervisor, o representante assume ([pessoas-e-equipes.md](pessoas-e-equipes.md)).
- **Quem pode ser responsável:** técnico ativo e liberado da equipe da OS, que não esteja ausente (`responsavel_invalido`, `responsavel_ausente`).
- **Quando:** com a OS `liberada` ou `pendente` (`status_invalido_para_reservar`), até ela começar. Reservar de novo a mesma pessoa não muda nada.
- **A OS continua no quadro da equipe,** com o selo "Reservada para [nome]" ("para você", ao responsável), e o detalhe diz quem reservou e que só o responsável inicia. O responsável recebe `os_reservada`; quem perdeu a reserva, `os_reserva_desfeita`.
- **Só o responsável aplica a APR e inicia a execução** (`os_reservada`). Ele é o responsável da APR; os colegas entram como participantes.
- **Da fila offline,** o evento de quem não era o responsável é aplicado e o supervisor recebe `conflito_planejamento`.
- A leitura do SAP e a planilha não mexem na reserva. Desativar a conta do responsável ou trocá-lo de equipe não desfaz a reserva: só o supervisor a libera, ou o início de uma ausência dele.
- **Limite conhecido:** se alguém iniciar a APR antes da reserva, a OS não pode mais ser reservada a outra pessoa sem refazer a APR. O "atraso na entrega" (a OS aparecer primeiro só para o supervisor) foi descartado: atrasaria todas as OS, inclusive as urgentes.

### 11.2 Devolver

- **O supervisor da equipe devolve a OS `liberada`, ainda não iniciada,** com justificativa obrigatória (`justificativa_obrigatoria`). A pendente ou em execução segue pelos impedimentos (`status_invalido_para_devolver`). A OS de apoio não se devolve: o admin a cancela (`os_apoio`).
- **A OS vira `devolvida`,** perde a reserva e sai do quadro (link "Ver devolvidas", com a contagem), da cópia offline, das contagens de OS programadas dos dashboards e do ciclo das preventivas.
- **Não aceita mais APR nem execução:** online, `os_devolvida`; da fila offline, o evento vira alerta.
- **O apêndice:** a justificativa fica na OS, com quem devolveu e quando (faixa no topo do detalhe e linha na linha do tempo).
- **A baixa:** a devolução sai uma vez na aba Devolvidas da planilha; uma pessoa lê a aba e corrige a ordem no SAP. O SYNQ OS não escreve no SAP.
- **A volta:** quando o SAP traz a ordem de novo como liberada (leitura ou planilha; o PDF impresso não conta), a OS volta `liberada`, sem a devolução, e a justificativa antiga fica na auditoria.
- **Auditoria:** `os.reservar`, `os.liberar_reserva` e `os.devolver`.

## 12. Painel e dashboards

### 12.1 Quadro de OS

- **Colunas:** `liberada`, `pendente`, `em_execucao`, "Aguardando assinaturas" (`encerrando` e `aguardando_supervisor`) e `encerrada`; as devolvidas ficam no link "Ver devolvidas". Filtros por equipe, tipo, criticidade, período e status; ordem por prioridade (padrão) ou por data limite.
- **Escopo:** o técnico vê a própria equipe; o supervisor, a própria e as que supervisiona; o admin, todas.
- **Destaques:** local crítico (selo "Crítico" e filtro "Crítica"; desempata a ordem), reserva, execução aberta há mais de 12 h.
- **Previsão do tempo:** ao lado dos contadores, o cartão "Previsão do tempo" com o que resta do expediente (da hora atual, nunca antes das 6h, até as 17h; passado das 17h, as próximas 4 horas): horas, ícones, temperatura, chance de chuva, título e orientação. Em tela estreita, um embaixo do outro.
- **Botão "OS preventivas"** (admin e supervisor): o ciclo de cada plano (seção 9.1).

### 12.2 Detalhe da OS

Dados do SAP, o serviço e os materiais recomendados (seção 10), o ciclo e o checklist da preventiva, o histórico do local e do equipamento, **todas as APRs** (bloqueadas e aprovadas, com participantes, assinaturas, itens reprovados e evidências), execuções e pausas, tempos, localização, fotos, pedidos e conferências, clima, alertas, reprogramações, reserva, devolução, linha do tempo, o PDF (depois da assinatura final) e o relatório da execução (supervisor e admin). Reprogramar, abrir OS de apoio, reservar e devolver ficam ali, para quem pode.

### 12.3 Dashboards

A seção Dashboard (`/app/dashboard`) tem as mesmas telas para todos, cada uma no escopo de quem olha (`abasDoDashboard` em [`web/src/components/web/indicadores/secao.ts`](../web/src/components/web/indicadores/secao.ts)). **Não há aba Geral** (saiu em 21/10/2026): as pendências foram para o topo do dashboard de OS.

| Aba | Para quem | O que mostra |
|---|---|---|
| Meus resultados | técnico e supervisor (abre aqui) | o desempenho da própria pessoa (`GET /indicadores/meus`; o admin recebe `403`) |
| OS | todos (o admin abre aqui) | "Precisa de atenção", o mapa de calor, as preventivas (ciclos e programadas) e os resultados do período: encerradas, tempo, pausas por motivo, OS com mais pausa, interrupções por risco e reprogramações; para o admin, também a entrada de OS e a baixa no SAP (`GET /indicadores/os`) |
| APR | todos | respondidas e bloqueadas, alertas, itens que mais bloqueiam, APRs por modelo e por equipe (`GET /aprs/resumo`) |
| Equipes e usuários ("Minha equipe" para o técnico) | todos | por equipe e por técnico (preventivas, execuções, APRs, bloqueios, interrupções, tempos); o técnico que não supervisiona vê a própria equipe, sem nada por pessoa; o estado do cadastro só para o admin (`GET /indicadores/equipes`) |

**Filtro comum:** período (`?periodo=` 7, 30 ou 90 dias, 12 meses ou um mês fechado `AAAA-MM`, comparado com o período anterior de mesmo tamanho) e equipe (`?equipe_id=`; só o admin escolhe qualquer uma, pedir fora do escopo é `403`). O nome de quem executou só aparece para quem acompanha a equipe. As regras de escopo estão em [`dashboards.ts`](../api/src/dominio/dashboards.ts).

### 12.4 "Precisa de atenção"

No topo do dashboard de OS, contagens de agora, cada uma com o atalho para resolver ([`PrecisaDeAtencao.tsx`](../web/src/components/web/indicadores/PrecisaDeAtencao.tsx)); a linha zerada fica apagada.

| Linha | Para quem | Atalho |
|---|---|---|
| OS pendentes, à espera de uma APR nova | todos | quadro |
| Preventivas atrasadas sem justificativa no período | todos | bloco das preventivas |
| Execuções abertas há mais de 12 h | todos | quadro |
| OS aguardando a assinatura do supervisor | supervisor e admin | supervisor: "Assinar" na página Validações; admin: quadro |
| OS encerradas à espera da baixa no SAP | admin | exportação |
| Alertas não lidos | supervisor e admin | alertas |

**Atraso das preventivas:** atrasada justificada é a `pendente`, ou com reprogramação, depois da data; sem justificativa é a `liberada` depois da data, sem reprogramação. O atraso conta de `data_fim_prog`, ou de `data_inicio_prog` sem ela.

### 12.5 Mapa de calor

O destaque do dashboard de OS, logo depois de "Precisa de atenção": onde as OS foram executadas no período, sobre as ruas do OpenStreetMap ([`MapaDoDashboard.tsx`](../web/src/components/web/indicadores/MapaDoDashboard.tsx), [`MapaDeCalor.tsx`](../web/src/components/web/os/MapaDeCalor.tsx); `GET /os/mapa-calor`, [`mapa-calor.ts`](../api/src/dominio/mapa-calor.ts)). Só na web.

| Regra | Como é |
|---|---|
| Posição | o GPS do início da execução; sem ele, o do fim. Cada OS entra uma vez, pela execução mais recente no período (filtrado pelo início da execução) |
| Privacidade | a `api` nunca devolve a posição exata: agrupa em células de 0,01° (cerca de 1 km, `CELULAS_POR_GRAU`) e devolve o centro e a contagem por situação |
| Quem vê | todo perfil, no escopo de sempre; técnico sem equipe vê o mapa vazio |
| Filtros | o período e a equipe do painel, mais a situação atual da OS (`?status=`; padrão: todas) |
| Intensidade | pelo volume da área mais movimentada, em cinco níveis (muito baixa a muito alta), nas cores azul, verde, amarelo, laranja e vermelho |
| Camadas | "Radiação" (brilho que se funde com o das vizinhas) e "Pontos", independentes e ligadas por padrão; "Preto e branco / Colorido" tira a cor só do mapa-base (preto e branco por padrão) |
| OS sem GPS | entram na contagem "Sem localização" e na linha de cobertura, mas não no mapa |
| Lateral | "Áreas com mais OS": as cinco maiores; tocar numa leva o mapa até ela |

O navegador baixa as imagens das ruas da região vista; nenhum dado da OS vai ao OpenStreetMap. A roda do mouse só dá zoom depois de um clique no mapa.

### 12.6 Indicadores de tempo

Por equipe, técnico e OS: tempo total médio, líquido médio, pausa média, proporção de pausa, execuções com pausa e pausas por execução; o tempo em pausa por motivo (os sete motivos e `sem_motivo`) e as OS com mais pausa. Só de execuções `encerrada` iniciadas no período.

## 13. Configurações do sistema

A página `/app/configuracoes` tem a aba **Minha conta** (todos: assinatura, e-mails, senha, anonimato no ranking; ver [pessoas-e-equipes.md](pessoas-e-equipes.md)) e a aba **Sistema** (só o admin; a `api` recusa os demais com `403`). As chaves estão em `CONFIGURACOES_CHAVES` ([`api/src/db/schema/clima.ts`](../api/src/db/schema/clima.ts)) e as definições, com rótulo, faixa e padrão, em [`configuracoes.ts`](../api/src/dominio/configuracoes.ts).

| Configuração | Faixa | Onde está a regra |
|---|---|---|
| Cidade padrão da previsão do tempo | busca de cidades brasileiras (`GET /clima/cidades`); padrão Vitória, ES | seção 4.7; vale só para quem está sem GPS |
| Intervalo da leitura do SAP | 5 a 1440 minutos | [integracoes-simuladas.md](integracoes-simuladas.md) |
| Hora da leitura diária do registro de funcionários | 0 a 23 | [integracoes-simuladas.md](integracoes-simuladas.md) |
| Hora do resumo diário por e-mail | 0 a 23 | [pessoas-e-equipes.md](pessoas-e-equipes.md) |
| Controle da IA e limites de uso da Vitória e do rascunho de treinamento | por chave | [ia-e-vitoria.md](ia-e-vitoria.md) |

- **Padrão e valor do admin:** cada valor tem um padrão (o do ambiente, ou o de fábrica); o que o admin muda fica por cima, na tabela `configuracao`, e "Voltar ao padrão" apaga a linha.
- **Vale na hora,** sem reiniciar (a exceção é o tamanho máximo da resposta da Vitória, que vale na próxima subida).
- **Fora da faixa:** `422` com a faixa na mensagem; um valor guardado que ficou fora dela é ignorado.
- **Auditoria:** `configuracao.alterar` e `configuracao.restaurar`, com o antes e o depois.
- **O que não entra:** endereços, chaves e tokens (SAP, RH, SMTP, IA, provedor do tempo) ficam no ambiente, fora do alcance de uma tela.
- **No app,** a tela Configurações (aberta pelo Perfil) tem só as preferências pessoais; a aba Sistema é só da web.
