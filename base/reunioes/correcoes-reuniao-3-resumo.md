# Correções da Reunião 3

> O que a Reunião 3 (17/10/2026, apresentação do SYNQ OS ao Mario Stevan, com o mentor na sala) levantou e as soluções que o time decidiu em 18/10/2026. A situação de cada item está no quadro abaixo; o que foi feito está em [funcionalidades/correcoes-da-reuniao-3.md](../../funcionalidades/correcoes-da-reuniao-3.md). A origem de cada ponto está na [transcrição](Transcricao_Reuniao3.md). A transcrição automática junta várias pessoas da sala em "Falante 1"; por isso cada ponto diz se veio do Mario ou da sala. Os textos de "Hoje" abaixo descrevem o sistema **antes** de 18/10/2026.

## Situação em 18/10/2026

| Itens | Situação |
|---|---|
| 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 13 e 14 | Implementados em 18/10/2026 na `api` e na `web` ([correcoes-da-reuniao-3.md](../../funcionalidades/correcoes-da-reuniao-3.md)). |
| 12 | Já funcionava assim; nada a fazer. |
| 16 | Implementado nos formulários tocados por esta rodada; o restante ficou registrado ([correcoes-da-reuniao-3.md](../../funcionalidades/correcoes-da-reuniao-3.md), seção 6). |
| 4, 17 e 18 | Registrados, não implementados: dependem do ZapSign, do token ou do gov.br (item 4), da conta Microsoft com segundo fator (item 17) e do app mobile (item 18), que ainda não existem. |
| 15 | Fora desta rodada: será feito à parte. |

## Assinaturas

1. **Todos assinam a APR, cada um na própria conta (feito em 18/10/2026).**
   - **Levantado:** pelo Mario ("todos têm que assinar a APR", "todos têm que estar de acordo") e pela sala (cada um avalia se está bem, inclusive emocionalmente, antes de assinar).
   - **Hoje:** o responsável confirma a assinatura de todos no aparelho dele.
   - **Solução:** depois da validação da APR, cada participante assina na própria conta, e a execução só começa quando todos assinarem. Quem não concorda recusa (direito de recusa) e sai da APR. No modo offline, que é contingência, a assinatura no aparelho do responsável continua, marcada como presencial.
   - A assinatura de todos acontece **só no começo**, para não repetir assinaturas.
2. **No fim, assinam o responsável e, por último, o supervisor (feito em 18/10/2026).**
   - **Levantado:** no próprio fluxo apresentado, a OS só está encerrada quando o técnico e o supervisor validaram.
   - **Solução:** ao encerrar, só o responsável assina. A OS segue para o supervisor, que lê o relatório da execução (item 13) e assina por último, mesmo que tenha participado do serviço. Só então a OS está concluída. A ciência de hoje vira essa assinatura. Com o supervisor ausente, assina o representante, como já acontece.
   - A OS ganha status intermediários entre o fim da execução e a conclusão.
   - Ausente e desligado não chegam a essa etapa: não podem ser participantes.
3. **Mínimo de 2 participantes por APR (feito em 18/10/2026).**
   - **Levantado:** pela sala ("nunca é só um"). Já tinha sido dito na Reunião 1: a prática da empresa é que ninguém trabalhe sozinho.
   - **Hoje:** a APR aceita 1 participante.
   - **Solução:** a APR exige ao menos 2 participantes, sem limite de máximo.
4. **Assinatura com validade jurídica (pendência, se sobrar tempo; registrado, não implementado).**
   - **Levantado:** o Mario contou que a empresa usa o ZapSign; a sala citou token e gov.br.
   - **Solução:** o protótipo mostra como funcionaria o fluxo. Se sobrar tempo, integramos o ZapSign ou uma das outras ferramentas citadas. Ligada à questão 38 do [Questoes.md](../../Questoes.md).

## Execução

5. **A diferença entre os botões (feito em 18/10/2026).**

   | Botão | Quando usar | O que acontece |
   |---|---|---|
   | Pausar | Parada curta; a equipe volta ao mesmo serviço no mesmo dia | Só o tempo líquido para; "Continuar" retoma com a mesma APR |
   | Suspender | O serviço não continua hoje | Encerra esta execução; a OS fica pendente e a retomada pede APR nova |
   | Interromper por risco | Apareceu um risco ou impedimento | Pede motivo, ao menos 1 foto e assinatura; a OS fica pendente e o supervisor é avisado |
   | Encerrar | O serviço terminou | Para o tempo e segue para as assinaturas (itens 2 e 9) |

6. **Motivo obrigatório na pausa (feito em 18/10/2026).**
   - **Levantado:** pela sala, a partir do SICO/PDA, em que o técnico informa o motivo da parada (almoço, aguardando cliente, peça ou outra equipe). O Mario aprovou: "depois no relatório já sai tudo detalhado".
   - **Hoje:** o motivo é opcional, só almoço, descanso ou outro, e "outro" não tem texto.
   - **Solução:** ao pausar, abre uma janela com a lista, e o motivo é obrigatório:
     - Almoço
     - Aguardando: abre um campo para escrever o que ou quem
     - Descanso
     - Condição climática
     - Enfermidade
     - Lesão
     - Outro: abre um campo de descrição obrigatório
7. **Motivo obrigatório ao suspender (feito em 18/10/2026).**
   - **Levantado:** na reunião o time disse que o suspender pedia motivo, mas hoje ele não pede.
   - **Solução:** a mesma janela da pausa, com motivos mais críticos:
     - Enfermidade
     - Lesão
     - Fim de expediente
     - Condição climática
     - Falta de material ou equipamento
     - Outro: abre um campo de descrição obrigatório
8. **Lesão e enfermidade avisam o supervisor na hora (feito em 18/10/2026).**
   - **Por quê:** a lesão no trabalho, mesmo leve, é acidente de trabalho, e a empresa precisa registrá-la.
   - **Solução:** na pausa e no suspender, esses dois motivos geram um aviso no sino e por e-mail ao supervisor, além de constarem no relatório da execução.
   - **Interromper** não muda: o motivo já é obrigatório, com ao menos 1 foto e a assinatura.
9. **O tempo para no clique em "Encerrar OS", depois de uma confirmação (feito em 18/10/2026).**
   - **Levantado:** pela sala. Esperavam que o tempo parasse no botão de encerrar, sugeriram uma confirmação e lembraram que o tempo geral conta as pausas.
   - **Hoje:** o botão só abre o formulário, e o tempo para quando o formulário é enviado. O envio não pede confirmação.
   - **Solução:**
     1. O técnico clica em "Encerrar OS".
     2. Uma janela simples pede a confirmação, avisando que o tempo para e que a execução não pode ser retomada.
     3. Ao confirmar, o sistema grava o fim e a localização.
     4. Depois vêm a descrição e as fotos, opcionais, e a assinatura do responsável. Esse preenchimento não entra no tempo.
10. **Descrição e fotos do encerramento opcionais (feito em 18/10/2026).**
    - **Levantado:** o Mario perguntou se a foto era obrigatória, porque no sistema parecia que sim, e disse que exigir sempre não faria sentido.
    - **Hoje:** a descrição e de 1 a 10 fotos são obrigatórias, tanto na tela quanto na `api` ([especificação](../.design/especificacao.md), fatia Execução).
    - **Solução:** as duas ficam opcionais, porque só são necessárias quando aconteceu algo. Com a descrição em branco, o PDF e a planilha de baixa trazem "Executado conforme a OS, sem ocorrências". A foto da interrupção continua obrigatória, porque é a prova do risco.
11. **Localização (GPS) em cinco momentos (feito em 18/10/2026).**
    - **Levantado:** pela sala. A ideia é registrar onde a pessoa pausou ou encerrou, ver no mapa e comparar com o endereço da OS ("se pausou de casa").
    - **Hoje:** só as fotos guardam a localização.
    - **Solução:** o sistema grava a localização no início da execução, na pausa, na suspensão, na interrupção e no encerramento. No momento da assinatura da APR, não.
    - **Cuidados:**
      - sem GPS (permissão negada ou local coberto), o serviço não é bloqueado: fica registrado "sem localização";
      - a tela avisa o técnico que a localização é registrada nesses momentos (LGPD);
      - no notebook, a posição vem da rede e é aproximada; no celular, vem do GPS;
      - a OS só tem o endereço em texto, então o relatório mostra o ponto no mapa ao lado do endereço. Calcular a distância sozinho exigiria converter o endereço em coordenadas por um serviço externo e fica para depois.
12. **O cronômetro não depende do app aberto.** Já funciona assim: o tempo é calculado a partir do início, então continua correndo com o celular bloqueado ou o app fechado.

## PDF e relatório da execução

13. **Relatório da execução, à parte do PDF, para o supervisor (feito em 18/10/2026).**
    - **Levantado:** pelo Mario e pela sala. Querem o histórico das pausas (quem pausou, por quê, quando voltou, quantas vezes) para o relatório.
    - **Solução:** um documento separado do PDF da OS, como um anexo. O supervisor o lê antes de assinar (item 2), e ele fica no detalhe da OS para o supervisor e o admin. Traz tudo o que o SYNQ OS acrescenta ao papel:
      - tempo total (com as pausas), tempo pausado e tempo líquido;
      - cada pausa, com início, fim, motivo, complemento e localização;
      - suspensões e interrupções, com motivo e localização;
      - a localização do início e do encerramento, ao lado do endereço da OS;
      - as fotos e os PDFs da execução;
      - o checklist de inspeção das preventivas;
      - as assinaturas da APR, com a hora de cada uma, quando o modelo não tem onde mostrá-las.
14. **O PDF da OS fica idêntico aos documentos originais (feito em 18/10/2026).**
    - **Decisão:** o PDF reproduz a folha da OS do SAP e a APR como são, sem nada a mais. O que hoje o PDF traz além disso (tempos e pausas, fotos, lista de PDFs anexados e checklist de inspeção) sai dele e vai para o relatório.
    - **A folha do SAP**, conferida nos exemplos de [`base/os-examples`](../os-examples/), e como cada parte é preenchida:

      | Parte da folha | O que o SYNQ OS põe |
      |---|---|
      | Cabeçalho, objetos técnicos e planejamento da ordem | Os dados do SAP, como hoje |
      | Operações: N Pes, data e hora de início e de fim (à mão, na linha de baixo) | O número de pessoas, o início e o clique em "Encerrar OS" |
      | Descrição da atividade | A descrição do encerramento, ou "Executado conforme a OS, sem ocorrências" |
      | "Atesto que os serviços acima foram executados satisfatoriamente", com até 3 blocos de executante | O nome, a data, os horários e a assinatura que cada um deu na APR. Ninguém assina de novo |
      | Responsável - Manutenção | A assinatura do responsável no encerramento |
      | Supervisor | A assinatura final do supervisor. No exemplo, o supervisor assinou 9 dias depois da execução, como no fluxo do item 2 |
      | Solicitante da Manutenção | Em branco, como no papel |

    - **A APR** segue o modelo. A APR 03, por exemplo, só tem nome e matrícula dos participantes, sem coluna de assinatura. Nesse caso as assinaturas da APR aparecem só no relatório. As APR 04 e 05 têm a coluna.

## Importação e digitalização

15. **Duas entradas por PDF, com uma pergunta antes (fora desta rodada; será feito à parte).**
    - **Levantado:** pela sala. As sugestões foram:
      - escanear o acervo em lote, porque um scanner passa milhares de folhas por hora;
      - aproveitar o formato fixo da folha;
      - começar por uma etapa sem custo;
      - treinar um modelo próprio com umas 50 APRs antigas já transcritas.
    - **Hoje:**
      - a importação por PDF só lê texto digitado;
      - o PDF só com imagem é recusado (`pdf_sem_texto`);
      - a digitalização por foto é só protótipo.
    - **Solução:**
      - Antes de abrir o seletor de arquivos, a tela pergunta se a OS já foi concluída no papel ou se é para liberar no sistema, com uma explicação curta de cada caminho.
      - **Para liberar:** o PDF padrão, como hoje.
      - **Já concluída (PDF digitalizado, em lote):**
        - o OCR local lê o que consegue;
        - a Vitória (IA) entra só nos campos que o OCR não lê, como a parte escrita à mão. Como a folha do SAP tem formato fixo, vão para a IA só os recortes desses campos, o que custa menos e envia menos dados ao fornecedor;
        - assinaturas e rubricas ficam como imagem, sem transcrição;
        - a OS entra como histórico (encerrada), e o admin confere o que foi lido antes de registrar.
      - **Digitalização por foto:** continua, para 1 ou 2 folhas avulsas. É mais rápido do que ir à impressora, escanear e importar.
      - **Leitura do SAP:** não muda.
    - **Descartado:** treinar um modelo próprio. Exigiria centenas de folhas reais transcritas, o que esbarra na LGPD, e a IA de visão já lê texto à mão sem treino.
    - O desenho detalhado está na seção 10 do [vitoria.md](../../funcionalidades/vitoria.md), que precisa ser ajustada a esta decisão.

## Pendências registradas

16. **Validação dos campos e retorno de erro com Zod e React Hook Form (feito nos formulários tocados; o resto registrado).**
    - **Levantado:** pelo Mario. Quando a pessoa tenta salvar e o sistema não deixa, uma mensagem tem que dizer por quê.
    - **Hoje:** o botão fica desativado, com um "Falta: …" em letra pequena que passou despercebido na apresentação.
    - **Pendência:** uma varredura completa nos formulários, com Zod e React Hook Form.
17. **Login corporativo, se sobrar tempo (registrado, não implementado).**
    - **Levantado:** pela sala, o login pela conta Microsoft (Teams) da empresa, com segundo fator.
    - **Hoje:** o registro de funcionários simulado garante que só funcionário tenha conta, mas o login usa a senha do SYNQ OS.
    - **Pendência:** login corporativo pela conta Microsoft, com segundo fator.
18. **Sincronização em segundo plano no app (registrado no plano do app).**
    - **Levantado:** pelo próprio time, ao responder o Mario: a fila offline precisa ser enviada quando o sinal volta, mesmo sem abrir o app.
    - **Pendência:** com o app aberto, a fila é enviada assim que o sinal volta. Com o app fechado, é enviada no próximo intervalo que o Android libera para tarefas em segundo plano (por volta de 15 minutos). Entra no plano do app ([mobile/README.md](../../mobile/README.md)).

## Já atendido

- O cronômetro continua correndo com o celular bloqueado ou o app fechado (item 12).
- A assinatura guarda a data e a hora.
- O supervisor pode ser trocado quando há rotatividade: é o técnico que a equipe aponta.
- A leitura do SAP a cada 15 minutos foi bem recebida.
- A logo da tela de login já foi corrigida.

## Em aberto

- **A devolução pelo supervisor.** Fica para discutir se o supervisor pode devolver a OS ao responsável em vez de assinar, já que isso, na prática, é mandar refazer o serviço.
- **"Houve desvio?" e "Tempo parada" na folha do SAP:** o SYNQ OS preenche esses campos (por exemplo, com a interrupção ou a suspensão) ou os deixa como no papel? Pergunta para o Iago.
- **Mais de 3 executantes:** a folha do SAP tem só 3 blocos de executante.
- **Equipe com só 1 pessoa disponível:** com o mínimo de 2 participantes, ela não consegue executar. Hoje os participantes vêm da equipe da OS (Reunião 2), e o Campo de treino precisa ganhar um segundo técnico fictício.
