# Questões em aberto

> Dúvidas que surgiram ao conferir o banco de dados com as OS e as APR de exemplo (`base/os-examples/` e `base/apr-examples/`). Cada uma traz o que os documentos mostram, a pergunta, a solução que o banco já adota e quem pode responder. Se a resposta for outra, o ajuste fica restrito ao que está citado.
>
> O detalhamento de cada questão e as demais questões do projeto estão em [pontos-a-validar.md](base/.design/pontos-a-validar.md) (os números abaixo são os mesmos).

| # | Questão | Quem responde | Impacto |
|---|---|---|---|
| 57 | Como é o formulário de inspeção das OS preventivas? | Iago | 🟡 MVP |
| 58 | Como ligar a OS ao modelo de APR? | Iago (respondida em 14/10/2026) | 🔴 Schema |
| 59 | Só as medidas dos riscos marcados são respondidas? | Mario | 🔴 Schema |
| 60 | Qual é a "função da atividade" nas APR 04, 05 e 09? | Mario | 🟢 Depois |
| 61 | O item de espaço confinado da APR 06 aceita "NA"? | Mario | 🟡 MVP |
| 62 | O horário de início e fim vale por executante? | Iago | 🟢 Depois |

**Impacto:** 🔴 muda tabelas ou contratos; 🟡 muda uma tela ou regra da demonstração; 🟢 não afeta a demonstração.

## 57. Como é o formulário de inspeção das OS preventivas?

**O que os documentos mostram:** a página 2 da OS 4019821 (preventiva, inspeção funcional de retificador) traz um "Checklist de Inspeção Técnica":

- leituras por semana (Sem 1 a Sem 5): data, horímetro, hora da coleta, tensão de entrada (Vac), tensão de saída (Vcc), tensão de shunt (mV) e técnico/inspetor;
- conformidade por componente: "Conforme / Não conforme" (vandalismo, limpeza, insetos, cabos, fusíveis, DPS), "Operante / Não operante" (display), "Funcional / Não funcional" (telemetria), "Executado / Não necessário / Aguardando parada" (reaperto de bornes) e "Íntegra / Comprometida / Sinais de umidade" (fixação do gabinete);
- um campo de observações por item e o quadro "Observações Gerais / Requisições de Ação Corretiva".

A OS corretiva 4023470 não tem nada disso. O texto parece vir da descrição longa da OS no SAP.

**Pergunta:** o sistema deve capturar esse formulário de forma estruturada (campos, valores e unidades)? Quais atividades têm formulário, e quem define os campos de cada uma?

**Adotado por enquanto:** o preenchimento fica em `execucao.dados_inspecao` (JSON), sem estrutura definida, e o texto do SAP continua aparecendo na OS.

## 58. Como ligar a OS ao modelo de APR?

**O que os documentos mostram:** a especificação supunha um código de atividade do SAP (como `8.7.1`) que escolheria o modelo. Nos exemplos ele não vem:

- a OS corretiva 4023470 ("DCV Desobstrução de caixa de valvula") não tem plano de manutenção;
- a OS preventiva 4019821 traz Plano de Manutenção `10573`, Item `10603` e o título "1.2 - Inspeção Funcional de Retificador", que não aparece em nenhuma lista das APR. A APR 02 lista "8.1.2 - Inspeção Elétrica no Retificador" e a APR 03 lista "8.2.1 - Leitura Retificador";
- as listas "Plano de manutenção e operação (SAP)" das APR 02 e 03 misturam códigos numéricos, faixas ("8.7.2/ 8.7.3/ 8.7.4/ 8.7.7/ 8.7.8") e nomes sem código ("CLB - Calibração PSV", "BOMBA EXTERNA – PÁTIO");
- as abas ocultas das planilhas listam atividades da ES Gás por APR (por exemplo, "Lavagem de Estação", "roçagem"), também sem código;
- o Iago comentou na Reunião 2 que o plano de manutenção está em revisão e os códigos vão mudar.

**Pergunta:** qual informação do SAP identifica a atividade de uma OS (plano, item, título, tipo de atividade)? Corretivas sem plano têm outra forma de indicar o modelo? Quando a nova tabela de tipos de manutenção × APR sai?

**Resposta do Iago (14/10/2026):** hoje o gasista escolhe a APR pelo serviço. As preventivas têm nome padrão, mas as corretivas não têm código padronizado, e o mesmo serviço pode pedir APRs diferentes conforme a situação no local (remover marimbondo com ou sem trabalho em altura).

**Decidido em 14/10/2026:** não há atribuição automática do modelo. A cada APR, o técnico escolhe entre os modelos publicados, e o sistema só orienta: mostra a descrição e os exemplos de cada modelo e recomenda o que mais combina com a OS, pelas palavras-chave achadas no título, no serviço do catálogo e na descrição. A recomendação nunca é aplicada sozinha. A ligação atividade → modelo saiu do banco (migração `0021`). A OS continua entrando sempre; `os.codigo_atividade` segue opcional e aponta só o serviço do catálogo (a lista de materiais); o plano e o item de manutenção ficam guardados na OS. Isso substitui o que estava adotado: o modelo vinha da atividade e, quando a OS não tinha atividade com modelo, o técnico o escolhia ao iniciar a APR.

## 59. Só as medidas dos riscos marcados são respondidas?

**O que os documentos mostram:** nas duas APR 03 preenchidas (OS 4023470 e OS 4019821), a equipe marca "( )" os riscos que existem na atividade (por exemplo, Veicular, Insolação, Insetos e animais) e responde Sim/Não só às medidas desses riscos. As medidas dos riscos sem marca (Áreas molhadas, Trabalho noturno, Roçagem, Pintura) ficam em branco. A especificação anterior dizia que todas as medidas são respondidas.

**Pergunta:** é isso mesmo, ou a Segurança do Trabalho espera que todas as medidas tenham resposta? Marcar nenhum risco é permitido?

**Adotado por enquanto:** o risco é parte do modelo, a equipe marca os que existem, e só as medidas desses riscos são exigidas. O PDF reproduz a marcação como no papel.

## 60. Qual é a "função da atividade" nas APR 04, 05 e 09?

**O que os documentos mostram:** as APR 01, 02, 03 e 06 têm uma linha de "Supervisor da Atividade" e até 9 de "Executor da Atividade", com nome e matrícula (ou assinatura). A APR 04 e a 05 têm as colunas Ord., Nome, "Função da atividade" e Assinatura, com cerca de 40 linhas. A APR 09 tem 3 linhas, com "Executor da atividade" e "Função na atividade". As instruções pedem para destacar o supervisor entre os nomes.

**Pergunta:** "Função da atividade" é o cargo ou o papel de trabalho (por exemplo, soldador, operador)? Há um limite de participantes por APR? Nesses modelos continua existindo um supervisor da atividade?

**Adotado por enquanto:** cada participante é `responsavel` (exatamente um) ou `executor`, sem limite de pessoas. A função de trabalho fica fora do MVP.

## 61. O item de espaço confinado da APR 06 aceita "NA"?

**O que os documentos mostram:** o item 11 da APR 06 é "Em caso de espaço confinado foi realizado o teste de explosividade". Só se aplica quando a atividade é em espaço confinado, mas a APR 06 não tem coluna NA (só as APR 04 e 05 têm). A APR 06 cobre trabalho em altura e espaço confinado.

**Pergunta:** quando a atividade é só em altura, como o item 11 é preenchido hoje? Deve ganhar a opção "NA"? O mesmo vale para outros itens condicionais?

**Adotado por enquanto:** esse item passa a aceitar "NA", com observação obrigatória.

## 62. O horário de início e fim vale por executante?

**O que os documentos mostram:** a página 2 da OS tem três blocos "Executante", cada um com Data, Hora (Início) e Hora (Fim). Na OS 4023470, os dois executantes registraram 11:09 a 12:18, os mesmos horários da linha da operação no SAP. A linha da operação também tem "N Pes", "Durac." e "HH" (homem-hora).

**Pergunta:** um executante pode chegar ou sair em horário diferente dos outros? O SAP precisa receber o homem-hora de cada pessoa, ou basta o total e o número de pessoas?

**Adotado por enquanto:** um início e um fim para a execução inteira, mais o número de pessoas. O horário individual fica fora do MVP.
