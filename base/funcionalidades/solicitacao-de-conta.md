# Pedido de conta na tela de entrada — implementação de 20/10/2026

> Quem trabalha na empresa e ainda não tem conta no SYNQ OS pede uma na tela de entrada: "Ainda não tem uma conta? Solicite". Informa só o nome completo, o e-mail institucional e, se quiser, a equipe. Os administradores recebem um aviso e, quando a equipe foi informada, quem responde por ela também.
>
> **Situação:** implementado na `api` e na `web` em 20/10/2026 (migração `0042_pedido_de_conta`). O app não muda: o aviso abre na web.

## 1. Decisões

| # | Pergunta | Decisão |
|---|---|---|
| 1 | O pedido cria a conta? | Não. A conta continua nascendo pelo cadastro de sempre (`POST /usuarios`), que confere a matrícula e o e-mail no registro de funcionários. O pedido só avisa quem cadastra. |
| 2 | Quem recebe | Todos os administradores ativos e, com a equipe, quem responde por ela (o supervisor e, quando ele está ausente ou falta, o representante: `destinatariosDaEquipe`). Cada pessoa recebe um aviso só. |
| 3 | O que a tela responde | Sempre "Pedido enviado". Ela não revela se o e-mail já tem conta ou já pediu, para ninguém descobrir quem tem conta pela tela de entrada. |
| 4 | E-mail que já tem conta | Não gera pedido nem aviso. |
| 5 | Pedir de novo | Um pedido pendente por e-mail: pedir de novo só atualiza o nome e a equipe, sem avisar outra vez. Descartado ou atendido, a pessoa pode pedir de novo. |
| 6 | Proteção contra enxurrada | Acima de 30 pedidos novos na última hora (de todo mundo), a rota responde `429` por um tempo. A `api` não tem outro limite por endereço hoje. |
| 7 | A lista de equipes na tela aberta | Só o id e o nome das equipes. |
| 8 | Como o pedido termina | Atendido sozinho quando alguém cadastra uma conta com o mesmo e-mail; ou descartado (pessoa que não é funcionária, pedido por engano), com registro na auditoria (`usuario.descartar_pedido_de_conta`). |
| 9 | Categoria do e-mail | Equipe (o supervisor não vê a categoria Sistema nas preferências). |

## 2. A tela de entrada

- Embaixo do botão "Entrar": "Ainda não tem uma conta? **Solicite**", que leva a `/app/entrar/solicitar` (aberta sem login, como a própria entrada; o `proxy.ts` libera os dois endereços).
- O formulário pede o nome completo, o e-mail institucional e a equipe (opcional, "Não sei ou prefiro não informar"). Sem a lista de equipes (a `api` fora do ar), o pedido segue sem o campo.
- Enviado, a tela confirma e explica o que acontece: alguém confere os dados no registro de funcionários e cria a conta; a senha provisória chega por quem a criar.

## 3. Quem cadastra

- **Aviso `conta_solicitada`** ("Pedido de conta"): no sino e por e-mail, com o nome, o e-mail e a equipe. Leva a Equipes e usuários, no painel dos pedidos (`/app/usuarios#solicitacoes`); na tela de alertas do admin, o atalho "Abrir os pedidos de conta". No app, fica só no sino (abre na web).
- **Painel "Pedidos de conta"** em Equipes e usuários, acima dos pendentes de liberação: o admin vê todos; quem supervisiona, os que escolheram uma equipe dele. Cada pedido tem "Cadastrar", que abre o cadastro de sempre com o e-mail já preenchido (falta a matrícula, que vem do registro), e "Descartar", com confirmação.
- O supervisor cadastra como sempre: só técnico, só de setor de equipe dele, e a conta nasce pendente de liberação.

## 4. Rotas

| Rota | Quem | O que faz |
|---|---|---|
| `GET /solicitacoes-conta/equipes` | aberta | `{equipes: [{id, nome}]}`, por nome |
| `POST /solicitacoes-conta` `{nome, email, equipe_id?}` | aberta | `202` `{recebida: true}` em todo caso; `422` dado inválido ou equipe inexistente (`equipe_inexistente`); `429` `muitos_pedidos` |
| `GET /solicitacoes-conta` | admin e quem supervisiona | os pedidos pendentes que a pessoa vê, dos mais antigos aos mais novos |
| `POST /solicitacoes-conta/{id}/descartar` | admin e quem supervisiona a equipe do pedido | descarta; `404` se não está pendente, `403` se não é de equipe dele |

`POST /usuarios` atende o pedido pendente com o mesmo e-mail (estado `atendida`, com a conta criada e quem cadastrou).

## 5. Banco e código

- **Migração `0042_pedido_de_conta`:** a tabela `solicitacao_conta` (nome, e-mail, equipe, estado `pendente` → `atendida` ou `descartada`, quando e por quem foi resolvida, a conta criada; um pendente por e-mail) e a coluna `alerta.solicitacao_conta_id`, o alvo novo do aviso (`solicitacao_conta` em `shared/notificacoes/avisos.ts`).
- `api`: `dominio/solicitacao-conta.ts`, `rotas/solicitacoes-conta.ts`, `db/schema/solicitacao-conta.ts`, `rotas/usuarios.ts` (atende o pedido) e o manual do admin da Vitória.
- `web`: `app/app/entrar/solicitar/page.tsx`, `components/app/entrar/FormularioSolicitarConta.tsx`, `lib/acoes-solicitacao.ts` (a ação do servidor que chama a `api` sem login), o link na entrada, `components/web/usuarios/PainelPedidosDeConta.tsx`, o e-mail inicial em `FormularioUsuario.tsx`, o atalho do aviso e o `proxy.ts`.
- **Testes:** `api/test/solicitacao-conta.test.ts` (8 casos: as equipes sem login, quem é avisado com e sem equipe, a resposta que não revela nada, as recusas, quem vê o quê, o descarte, o cadastro que atende e o limite por hora). A suíte inteira da `api` passa (1019 testes), e o `tsc` da `api`, da `web` e do app e o `eslint` da `web` estão limpos. A conferência visual ainda não foi feita.

## 6. Pontos para discutir

- A matrícula não vem no pedido: quem cadastra a procura no registro de funcionários. Se o registro ganhar a consulta por e-mail, o "Cadastrar" poderia já trazer a pessoa.
- Não há verificação de que o e-mail é da própria pessoa (nenhum código por e-mail). O risco é baixo: o pedido só avisa, e a conta depende do registro e de quem cadastra.
