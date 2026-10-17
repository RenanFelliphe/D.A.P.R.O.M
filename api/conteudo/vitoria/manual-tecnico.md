# Manual da Vitória — técnico e supervisor

> Este manual é o que a Vitória usa para responder quem está logado como técnico (inclusive o supervisor, que é um
> técnico com uma equipe sob supervisão, e quem ainda aguarda a liberação do acesso). **Nunca mencione o que é um item
> eliminatório, o tipo de um item da APR ou qual resposta bloqueia a APR**: isso é regra de segurança do sistema, não
> apenas deste texto — quem descobre o que reprova a APR faz isso respondendo de verdade, em `POST /aprs/avaliar`,
> nunca lendo este manual ou perguntando à Vitória. Também não ensine normas de segurança de campo ("posso subir sem
> cinto?"): isso é da APR, do supervisor e dos treinamentos de serviço.
>
> Cada item termina com a chave do manifesto de destinos entre colchetes (`shared/vitoria/destinos.ts`); é por ela que
> a Vitória sabe levar a pessoa à tela certa ou destacar o botão.

## Quadro de OS

- O quadro mostra as OS da sua equipe. As cores indicam a situação: liberada, em execução, encerrada, pendente ou
  cancelada. Toque numa OS para abrir o detalhe. [quadro_os]
- As OS preventivas (as que seguem um ciclo, como inspeções periódicas) aparecem numa janela à parte, aberta pelo
  botão "OS preventivas" no topo do quadro. [preventivas]
- Use os filtros do quadro (status, urgência ou busca) para achar uma OS específica sem rolar a lista toda.
  [quadro_os]

## Detalhe da OS

- O detalhe de uma OS traz as instruções, o local, o equipamento, os materiais recomendados e as ações disponíveis
  (nova APR, iniciar execução) conforme a situação da OS. [os_detalhe]
- Os materiais recomendados são só uma lista de apoio (ferramentas, EPIs): não há conferência nem bloqueio por eles,
  e nada precisa ser registrado sobre eles. [os_detalhe]

## APR (Análise Preliminar de Risco)

- Antes de executar, é preciso preencher a APR: escolha o modelo sugerido (ou outro, se fizer mais sentido), marque
  os riscos da atividade e responda ao checklist. [apr_nova]
- Dá para trocar de modelo enquanto nenhuma pergunta foi respondida; depois de começar a responder, a troca não é
  mais oferecida.
- Cada participante da OS confirma a própria presença com a assinatura já cadastrada no perfil.
- Se alguma resposta do checklist pedir uma evidência (normalmente uma foto) ou um comentário, a APR só se completa
  com isso preenchido. A OS pode ficar pendente até o seu supervisor revisar o que foi registrado.

## Execução

- Com a APR aprovada, o botão para iniciar a execução aparece no detalhe da OS. [execucao]
- Durante a execução é possível registrar uma pausa (por exemplo, para almoço) e retomar depois.
- Para encerrar, é preciso descrever o que foi feito, anexar ao menos uma foto de evidência e confirmar a assinatura
  de quem participou.
- Interromper por risco e cancelar por engano também são assinados: o sistema abre a confirmação com a sua assinatura
  do perfil antes de concluir.
- Esqueceu de encerrar no mesmo dia? Ao abrir a OS de novo, o sistema pede a hora real em que o trabalho parou antes
  de deixar continuar.

## Meu perfil

- Em "Meu perfil" você vê seus dados, troca a assinatura cadastrada e consulta o histórico de OS já executadas.
  [perfil]
- A troca de senha e de assinatura valem a partir do momento em que são salvas; execuções anteriores não mudam.
- A assinatura é a primeira coisa a fazer depois do primeiro acesso e da liberação do admin: sem ela nenhuma outra
  tela abre. Ela valida o que você faz de importante no sistema (APR, encerramento, interrupção, ausência).

## Minha equipe

- A tela da sua equipe (ou "Minha equipe", se você é supervisor) mostra quem faz parte dela, o total de OS e quem é
  o supervisor. [equipe]
- Quem supervisiona pode cadastrar novos técnicos ali; quem não supervisiona só consulta.
- Quem supervisiona assina, com a assinatura do perfil, ao dar ciência numa OS encerrada, ao reprogramar uma OS e ao
  devolvê-la ao SAP; a assinatura da ciência vai para o PDF da OS.
- O representante da equipe é quem assume as tarefas do supervisor quando ele está ausente ou fica alguns dias sem
  usar o sistema — a equipe continua funcionando normalmente nesse meio-tempo.

## Busca

- A busca encontra pessoas, equipes e OS pelo número, nome ou matrícula. Abra-a pelo ícone de lupa, em qualquer
  tela. [busca]

## Dashboard

- "Meus resultados" mostra as OS que você executou e as APR em que participou, no período escolhido. [dashboard_meus]
- O filtro de período fica no topo: 7, 30 ou 90 dias, ou os últimos 12 meses.

## Catálogo de serviços

- O catálogo lista os serviços da empresa com os materiais recomendados para cada um. [catalogo_servicos]
- Um serviço com treinamento publicado mostra o botão "Treinar" no próprio cartão; quem já concluiu vê um selo.

## Treinamento de serviço

- O treinamento de um serviço tem duas partes: a Vitória explicando o procedimento e, depois, um jogo curto (quiz,
  decisão, separar os itens, ligar ou pôr em ordem). [treinar_servico]
- A nota e os pontos ganhos só valem na primeira vez que você conclui cada treinamento; refazer ajuda a revisar, mas
  não muda a pontuação.
- Encontrou algo que parece errado numa fase? O botão "Reportar problema" manda um aviso direto para quem administra
  o sistema.

## Gamificação

- "Como pontuar" lista tudo o que dá pontos: OS executadas, APR em dia, treinamentos de serviço concluídos e mais.
  [gamificacao_pontos]
- O ranking mostra sua posição entre pessoas ou entre equipes, geral ou por temporada. [gamificacao_ranking]
- As conquistas são metas que, ao serem alcançadas, dão pontos extras (por exemplo, concluir vários treinamentos).
  [gamificacao_conquistas]
- As patentes acompanham o total de pontos acumulado. [gamificacao_patentes]

## Campo de treino

- O Campo de treino é um ambiente fictício, com dados de mentira, para aprender o sistema sem afetar nenhuma OS de
  verdade. [treino_campo]
- Concluir o roteiro guiado do Campo de treino dá pontos reais, uma única vez.
- Para sair e voltar ao sistema real a qualquer momento, use "Sair do treino".

## Aguardando liberação

- Enquanto seu cadastro aguarda a liberação de um administrador, as telas de OS ficam fechadas; o Campo de treino e
  os treinamentos de serviço já publicados continuam abertos para você praticar. [aguardando]
- Não há um prazo fixo para a liberação; se estiver demorando, fale com seu supervisor.
