## Funcionalidades

- assinatura quando aperta o botão 
- rastreabilifdade por região
- APR como formulário -> planilha
- uma vez que bloqueado ele não pode mudar 
- imagem e anotação quando Os não puder ser realizada
- botão de sincronismo 

- 1 APR para varias OS

## Fluxo

- fluxograma ( login ---> painel inicial com camban para avaliar como estão as coisas. Quando for designado um chamado pra esse usuario, vai cair diretamente pra ele no pda com o app aberto. E quando ele aceitar o documento que é utilizado como padrão ele vai ser designado automaticamente pra esse usuario e logo após isso ele deverá preencher em campo com validação de foto do local + assinatura no final da avaliação)

# Login 
- Armazenamento local de um token temporário para login offline.
- Sincronização 

# OS

# APR

# Configurações
- Registro

## Perguntas

O técnico sai no início do dia com a lista de ordens já fechada no celular, ou o sistema precisa estar pronto para receber chamados emergenciais que entram ao longo do dia (caso o celular pegue sinal em algum momento)?

--

Quando uma APR for reprovada e a ordem cancelada por risco, quem exatamente deve receber o e-mail? É o supervisor direto daquela equipe específica, a gerência da base ou o setor de segurança do trabalho (SESMT)?

--

Conteúdo Obrigatório do E-mail:

Para a tomada de decisão ser ágil, o que esse e-mail precisa conter obrigatoriamente?

Número da OM e endereço/cliente?

Nome da equipe/técnico?

Motivo textual do risco?

A foto da condição insegura anexada direto no corpo do e-mail?

--

Além de visualizar os dados no painel da web, o gestor precisa exportar relatórios? Se sim, em formato de planilha (Excel/CSV) ou é exigido gerar um documento em PDF (o espelho digital da folha de papel) para auditoria e fiscalização?

--
## Correções
- As OS não serão escritas/definidas através do sistema e sim, através do SAP. Nosso sistema deve, ler as OS do SAP (Por importação manual inicialmente) e renderizá-las na nossa plataforma para que o funcionário possa aplicar uma APR em cima dela.

## Questões
- O SAP, hoje, não possui uma API que exporta/envia as OS para serem lidas num outro sistema. Para automatizar o processo, seria interessante que o nosso sistema recebesse automaticamente do SAP as OS registradas através de um endpoint de GET, evitando que o supervisor precise importá-las manualmente.
Seria possível criar esta rota e fazer a leitura dela no nosso sistema?