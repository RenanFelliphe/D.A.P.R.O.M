# Correções da Reunião 2

> Resumo das correções que a Reunião 2 (10/10/2026, Iago Raich e Mario Stevan) e as decisões do time trouxeram. Todas já estão aplicadas na [especificação](especificacao.md), no [DesignDoc](../../DesignDoc.md) e no protótipo em `src/`. A origem de cada uma está na [transcrição](../reunioes/Transcrição_Reuniao2.docx).

## APR

1. **APR 1:1 com a OS.** Uma APR vale para uma só OS; a seção "OS cobertas por esta APR" e a tabela `apr_os` saem. Toda tentativa exige APR nova, e as respostas nunca são pré-preenchidas nem copiadas.
2. **Validação no fim.** O checklist é respondido por inteiro, e só ao concluir o sistema valida. Não se bloqueia mais no primeiro "não".
3. **Evidência por item reprovado.** Todos os itens eliminatórios reprovados são listados. Cada um leva observação e, quando o item pede, foto; condição psicológica pede só justificativa em texto (direito de recusa).
4. **Participantes vêm da equipe da OS.** A OS já traz a equipe definida pelo SAP; o papel de campo passa a se chamar "responsável".
5. **Modelo de APR pela atividade.** O modelo sai do código do plano de manutenção da OS, numa tabela editável pela Segurança do Trabalho, e não mais da equipe.

## OS e execução

6. **OS pendente.** A OS com APR bloqueada, interrompida ou suspensa fica "pendente" (o status "bloqueada" some), com o histórico de todas as APRs. Qualquer pessoa da equipe a retoma com APR nova, sem esperar o supervisor, que é avisado e pode reprogramar ou abrir OS de apoio.
7. **Quem executa encerra.** Nenhum usuário encerra a OS de outro e a OS pendente não é duplicada.
8. **Cronômetro.** Iniciar, pausar, continuar e encerrar, com tempo de pausa e tempo líquido; o número de pessoas é informado ao iniciar.
9. **Atividade de vários dias.** Cada retomada é uma nova Execução com APR nova; suspender (fim do expediente) é diferente de interromper por risco.
10. **Assinaturas.** Todos os participantes assinam o encerramento, confirmando a assinatura cadastrada no perfil; o supervisor dá ciência no painel.

## PDF

11. **PDF de 2 páginas por OS.** Página 1, a APR; página 2, a OS no modelo do SAP, com todos os executantes, o responsável, o supervisor (ciência) e o solicitante.

## Integração e stack

12. **Fonte das OS.** Leitura pela API do SAP, simulada com dados fictícios no mesmo contrato da real (trocar a API muda só o endereço e as credenciais), com a planilha como alternativa. Nunca dados reais no protótipo.
13. **Stack.** Web em .NET 10, mobile em React Native, back-end em Node, banco, autenticação e armazenamento no Supabase (acessado só pelo back-end); PDF e e-mail no back-end. Monorepo em `/backend`, `/frontend` e `/mobile`, com Dockerfile em cada um, hospedado no Coolify.

## Telas e painel

14. **Perfil e histórico** no app, com a assinatura cadastrada e as OS do próprio técnico.
15. **Equipes e usuários** no painel: o administrador cria as contas, sem autocadastro.
16. **Indicadores de tempo** (líquido, pausa e produtividade por equipe, técnico e OS) e **histórico de APRs** no detalhe da OS.

## Fora desta rodada

- Ideias reservadas para a apresentação final (catálogo de serviço, escaneamento de papéis antigos, intervalo das preventivas, chatbot, gamificação): ficam fora do MVP.
- O encerramento da OS não atualiza o status no SAP por API; a baixa segue por planilha.
