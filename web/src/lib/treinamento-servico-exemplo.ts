/**
 * O exemplo de procedimento da tela "Gerar com a Vitória": mostra ao admin o formato que funciona melhor (o que o serviço
 * usa, os passos na ordem, os cuidados e os números exatos). É fictício e serve só de modelo; o admin pode usá-lo para
 * conhecer o fluxo, mas o treinamento de verdade sai do procedimento oficial do serviço.
 */
export const EXEMPLO_DE_PROCEDIMENTO = `Serviço: troca do regulador de pressão no abrigo do cliente.

Materiais, ferramentas e EPIs
- Regulador de pressão novo, do modelo indicado na OS.
- Chave de boca de 32 mm e chave inglesa.
- Fita veda-rosca própria para gás.
- Detector de gás portátil, calibrado.
- Luvas de vaqueta, óculos de proteção e botina de segurança.

Passo a passo
1. Confira o endereço e o número do medidor com a OS antes de abrir o abrigo.
2. Avise o cliente que o gás será interrompido por cerca de 30 minutos.
3. Feche a válvula de bloqueio antes do medidor e confirme que o ponteiro do manômetro foi a zero.
4. Solte as conexões do regulador antigo com a chave de boca, sem forçar a tubulação.
5. Limpe as roscas e aplique a fita veda-rosca no sentido da rosca, com 3 voltas.
6. Instale o regulador novo com a seta do corpo apontando no sentido do fluxo do gás.
7. Abra a válvula de bloqueio devagar e teste todas as conexões com o detector de gás.
8. Confira a pressão de saída: ela deve ficar entre 1,8 e 2,2 kPa.

Cuidados
- Se o detector apontar vazamento, feche a válvula, não acione interruptores e afaste as pessoas a pelo menos 10 metros.
- Nunca use chama para procurar vazamento.
- Não deixe o abrigo aberto sem acompanhamento.`;

/** O que o texto do procedimento deve trazer, na ordem em que a tela de geração mostra. */
export const ORIENTACOES_DO_PROCEDIMENTO: { titulo: string; texto: string }[] = [
  { titulo: "O que o serviço usa", texto: "Materiais, ferramentas e EPIs. A Vitória cruza com a lista do serviço no catálogo para montar o Selecione com os materiais do serviço." },
  { titulo: "Os passos, na ordem", texto: "Um por linha, de preferência numerados, do jeito que o técnico faz em campo." },
  { titulo: "Os cuidados", texto: "O que nunca fazer e o que fazer quando algo dá errado (\"se houver vazamento…\"). Eles viram as fases de decisão." },
  { titulo: "Os números exatos", texto: "Pressões, distâncias, prazos e medidas. A Vitória só usa números que estão no texto; um número de fora vira pendência." },
];
