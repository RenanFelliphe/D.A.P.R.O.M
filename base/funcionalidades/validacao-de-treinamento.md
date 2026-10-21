# Validação do treinamento pelos supervisores — implementação de 20/10/2026

> Em vez de só o admin publicar, o treinamento de um serviço é **validado pelos supervisores das 3 equipes que mais fazem aquele serviço**. Supervisores também passam a **criar** treinamentos, e aí quem valida são as outras equipes: nunca a do autor.
>
> **Situação:** implementado na `api` e na `web` em 20/10/2026 (migração `0044_validacao_de_treinamento`). A conferência visual da `web` ainda não foi feita. Pontos na gamificação por criar ou validar **não entraram**: ficam para discutir.

## 1. Decisões

| # | Pergunta | Decisão |
|---|---|---|
| 1 | Quem valida | As **3 equipes que mais fazem o serviço, sem a equipe do autor**, uma pessoa por equipe (o supervisor ou, no lugar dele, o representante no comando). O ranking é o de `equipesDoServico` (mais OS, depois mais pontos, depois ordem alfabética). |
| 2 | Autor no 1º lugar | Valida o 2º, 3º e 4º. É a regra geral: o admin como autor é validado pelo 1º, 2º e 3º; o autor do 7º lugar, também pelo 1º, 2º e 3º. |
| 3 | Mesma pessoa em duas equipes | Ocupa uma vaga só; a segunda equipe dela dá lugar à próxima da fila. Só entram equipes que têm quem responda por elas. |
| 4 | Quantos assinam | **2 dos 3.** Com 2 validadores possíveis assinam os 2; com 1, o 1. Fechou o quórum, o treinamento é **publicado sozinho**. |
| 5 | Recusa | Qualquer validador recusa, com **motivo obrigatório**. O rascunho volta ao autor, que ajusta e reenvia (nova rodada, com as assinaturas zeradas e os validadores de agora). |
| 6 | O grupo é fixo | Os validadores são fixados ao enviar: o ranking muda, e o grupo não pode trocar no meio da rodada. |
| 7 | Rascunho enviado | Fica **travado**: nem salvar nem pedir à IA. O autor (ou o admin) pode "retirar da validação" para editar. |
| 8 | Quem cria | O **admin** e o **supervisor (ou representante no comando) de equipe que já faz o serviço** (tem OS dele, fora as canceladas e as devolvidas). Técnico e supervisor de equipe que nunca fez o serviço ficam de fora. |
| 9 | Dono do rascunho | Quem o criou. Só ele e o admin editam; outro supervisor vê "O rascunho deste treinamento é de {nome}". Há um rascunho por serviço, como antes. |
| 10 | Admin publica direto | Continua podendo, como **exceção**: com a validação possível (já em validação, ou haveria validadores), a **justificativa é obrigatória** e fica na versão e na auditoria. Sem ninguém para validar (ex.: serviço sem OS), publica sem justificar. |
| 11 | Quem assina o quê | O **autor** assina ao enviar (a assinatura do perfil). Cada **validador** assina ao aprovar o mesmo termo de revisão de antes. A versão publicada guarda a assinatura de quem fechou o quórum; as de todos ficam em `treinamento_servico_validador`. |
| 12 | Avisos | `treinamento_para_validar` (a quem valida), `treinamento_devolvido` (ao autor, com o motivo) e `treinamento_validado` (ao autor, ao publicar), todos na categoria de e-mail **Treinamentos**. A primeira publicação continua avisando os técnicos. |
| 13 | Pontos | **Não entram agora.** A pergunta fica para a gamificação (se criar e validar treinamento pontuam, como a sugestão de materiais aceita). |
| 14 | IA | O interruptor da função continua só do admin. Os limites do rascunho por IA (3 treinamentos, 4 rodadas) seguem globais, feitos para a demonstração; com mais autores talvez precisem ser por pessoa. |

## 2. O caminho de um treinamento

1. **Criar:** o admin ou o supervisor do serviço abre o editor e monta explicação e fases (à mão ou com a Vitória).
2. **Enviar para validação:** exige o mesmo que publicar (conteúdo completo, sem pendências) e a assinatura do autor. Sem nenhuma equipe que possa validar: `409 sem_validadores` (o admin publica direto).
3. **Validar:** cada validador vê o treinamento com as respostas certas, testa o jogo e aprova (assinando) ou recusa (com motivo).
4. **Publicar:** com 2 dos 3, sai sozinho. A versão no ar mostra quem assinou, de que equipe e quando. Editar depois cria um rascunho a partir da versão no ar, que passa pela validação de novo.

## 3. Rotas

| Rota | Quem | O que faz |
|---|---|---|
| `GET /treinamentos/meus-servicos` | todos | `{admin, servicos[]}`: os serviços que a pessoa monta (o admin, todos). |
| `GET /treinamentos/para-validar` | todos | os treinamentos que esperam a decisão de quem pede |
| `GET /treinamentos/{codigo}/validacao` | admin, autor, validador | a rodada (validadores, decisões, quórum), quem validaria se enviasse agora, o histórico de recusas, os botões possíveis e o rascunho para rever |
| `POST /treinamentos/{codigo}/validacao/enviar` | autor, admin | envia (assinatura do perfil) |
| `POST .../validacao/retirar` | autor, admin | destrava o rascunho |
| `POST .../validacao/aprovar` | validador | aprova com a assinatura do perfil; fechando o quórum devolve `{publicada: true, versao}` |
| `POST .../validacao/recusar` `{motivo}` | validador | recusa e devolve ao autor |
| `POST /treinamentos/{codigo}/publicar` `{arquivo_id, justificativa?}` | admin | a publicação direta; `422 justificativa_obrigatoria` quando a validação era possível |
| `GET/PUT .../rascunho`, `.../rascunho/gerar`, `.../ajustar` | admin; supervisor do serviço (dono do rascunho) | o editor; `409 em_validacao` com o rascunho travado; `403 rascunho_de_outra_pessoa` |
| `GET .../versoes` | admin; supervisor do serviço | agora com `via` (`validacao` ou `direta`), `assinaturas` e `justificativa` |
| `POST .../rascunho/pre-visualizar/tentativas` | admin, autor, validador da rodada | testar o jogo antes de publicar |

## 4. Banco e código

- **Migração `0044_validacao_de_treinamento`:** em `treinamento_servico_versao`, `autor_id`, `validacao_enviada_em` / `_por` / `assinatura_path`, `rodada_de_validacao` e `publicacao_direta_justificativa`; a tabela `treinamento_servico_validador` (a vaga de cada equipe por rodada: a decisão, quem decidiu, quando, o motivo e a cópia da assinatura); os três tipos de aviso novos.
- `api/src/dominio/treinamento-servico-validacao.ts` (escolha dos validadores, envio, decisão, listas e permissões), `treinamento-servico.ts` (`publicarRascunho` agora é usada pela validação e pela publicação direta) e `rotas/treinamentos.ts`.
- **Testes:** `api/test/treinamento-servico-validacao.test.ts` (17 casos: quem cria, quem valida com e sem equipe do autor, o quórum, a recusa e a nova rodada, o rascunho travado, a publicação direta com justificativa e o registro das assinaturas).

## 5. Pontos para discutir

- **Pontos na gamificação:** criar treinamento e validar pontuam? Se sim, quanto, e valem só na aprovação ou também na recusa (como a sugestão de materiais, para a fila não parar)?
- **Supervisor ausente:** o representante no comando valida no lugar dele, como no resto do sistema. Se ninguém responde pela equipe, ela sai da fila de validadores.
- **Validação parada:** não há prazo. Se um treinamento ficar esperando, o admin pode publicar direto (com justificativa). Um prazo (por exemplo, 7 dias, como nas conferências) pode entrar depois.
- **Reportes dos técnicos:** continuam chegando só ao admin. Poderiam chegar também à equipe responsável.
- **Cota da IA por pessoa:** ver a decisão 14.
