# Previsão do tempo — implementação de 21/10/2026

> O sistema consulta a previsão do tempo de um provedor externo e a mostra em três lugares: ao lado dos contadores do quadro de OS, na pergunta de clima da APR e no relatório que o supervisor lê antes de assinar. Quando a previsão indica risco e o técnico responde que o clima está favorável, o sistema avisa antes de aceitar a resposta; ele pode seguir, mas no risco extremo só com a foto do local, e o supervisor sabe na hora.
>
> **Situação:** implementado na `api`, na `web` e no app em 21/10/2026 (migração `0045_previsao_do_tempo_e_configuracoes`). A `api` tem 17 testes próprios (`api/test/clima.test.ts`). Falta a conferência visual das telas e rodar contra o provedor real (os testes usam um provedor em memória).

## 1. Decisões

| # | Pergunta | Decisão |
|---|---|---|
| 1 | Provedor | **Open-Meteo**: sem chave, previsão hora a hora no fuso de São Paulo, com trovoada (código WMO), chuva em mm/h, chance de chuva, rajada de vento, sensação térmica e índice UV. O plano gratuito é só para uso não comercial: serve para a demonstração; em produção comercial é preciso o plano pago (chave em `CLIMA_API_CHAVE`, endereço em `CLIMA_API_URL`). |
| 2 | Quem consulta | Só a `api`. Ela guarda a previsão em cache por quadrado de 0,1° (cerca de 11 km) e por dia, por 30 minutos, classifica o risco e escreve as frases; a web e o app mostram o mesmo texto. O provedor recebe só a posição arredondada, nunca a OS, a pessoa ou a equipe. |
| 3 | De onde vem a posição | O GPS do aparelho. Sem GPS (permissão negada, local coberto), a **cidade padrão**, que o admin escolhe em **Configurações → Sistema** (padrão inicial: Vitória, ES). A resposta diz de onde veio (`local.origem`: `aparelho` ou `padrao`). |
| 4 | Janelas | **Quadro de OS:** o que resta do expediente (da hora atual, nunca antes das 6h, até as 17h; passado das 17h, as próximas 4 horas). **APR e encerramento:** as próximas 4 horas (a hora atual e mais 3). Uma tempestade às 17h não impede um serviço às 8h. |
| 5 | Classificação | Regras fixas, sem IA (`api/src/dominio/clima.ts`, limites em `LIMITES_DO_CLIMA` do `shared/api/clima.ts`). O nível da janela é o da pior hora. |
| 6 | Níveis | **Sem risco**; **atenção** (dá para trabalhar com cuidado); **extremo** (o serviço externo não deve começar). |
| 7 | Frases | Dinâmicas, por causa e por faixa de horas: o motivo, o horário e o que fazer ("Chuva prevista das 14h às 17h. Prefira os serviços externos antes desse horário e leve capa e bota de PVC."). A causa mais grave dá o título e a orientação; outra causa de atenção entra como segunda dica. |
| 8 | Resposta "Sim" na pergunta de clima | A pergunta é "as condições climáticas estão favoráveis?": quem acha que não há risco responde **Sim**, e é aí que o aviso aparece, se a previsão indicar risco. Responder "Não" já bloqueia a APR sozinho e não pede aviso. O texto do aviso fala só do clima, nunca de "eliminatório" ou "bloqueio". |
| 9 | O que o aviso faz | **Atenção:** abre uma janela com as condições e a orientação; o técnico revisa a resposta ou confirma e segue. **Extremo:** a mesma janela, e para seguir o técnico anexa **uma foto do local**. Nenhum nível impede de seguir: a previsão é regional e é só uma probabilidade, e o provedor pode errar. |
| 10 | Aviso ao supervisor | No extremo, quando o técnico segue (aprovada, com "Sim"), o supervisor da equipe (ou o representante, ou os admins, conforme `destinatariosDaEquipe`) recebe **na hora** o aviso `clima_extremo`, no sino e por e-mail (categoria Segurança, que não desliga). Na atenção não há aviso. |
| 11 | A foto no extremo | É uma evidência de foto ligada ao próprio item de clima da APR. A `api` a exige **online** (`foto_do_clima_faltando`); sem sinal aceita (como as demais evidências) e a conferência vem depois. |
| 12 | Qual pergunta mostra a previsão | A que o admin marca no editor de modelos (campo `mostrar_clima`, "Mostrar a previsão do tempo nesta pergunta"). A migração e a carga inicial marcam as 8 perguntas "As condições climáticas estão favoráveis? …" que os modelos já tinham. |
| 13 | Sem previsão | Provedor fora do ar, aparelho sem sinal e sem cópia, ou campo de treino: a tela diz "Previsão do tempo indisponível" e **nada é avisado nem bloqueado**. A `api` usa uma previsão antiga do mesmo dia, se tiver. O app guarda a última resposta de cada janela para o modo sem sinal (só do mesmo dia). |
| 14 | Relatório | A previsão muda ao longo do dia, então o relatório guarda uma **cópia do que a pessoa viu**: na APR (as horas, o nível, a orientação e se confirmou apesar do aviso) e no encerramento (as condições daquela hora). Tabela `clima_registro`, uma linha por APR e uma por execução. O relatório do supervisor (web e PDF) tem a seção "Condições climáticas"; o PDF da OS continua igual à folha do SAP. |
| 15 | Encerramento | O clima do encerramento vai no `encerramento_assinado` (o passo único que existe em todos os caminhos: responsável, participante, execução compartilhada e sem sinal), não no clique de "Encerrar OS". |

## 2. Limites da classificação

| Nível | Quando (qualquer um) |
|---|---|
| **Extremo** | Trovoada (código WMO 95 a 99); rajada de **60 km/h** ou mais; chuva de **10 mm/h** ou mais |
| **Atenção** | Chuva de **2,5 a 10 mm/h**; chance de chuva de **60%** ou mais; rajada de **40 a 60 km/h**; sensação térmica de **35 °C** ou mais; índice UV **8** ou mais |
| **Sem risco** | Nada disso |

Os limites são constantes documentadas, não configurações: mudar um valor é decisão de segurança, que a Segurança do Trabalho deve validar. Se for preciso editar no sistema, o caminho é o mesmo das [configurações](configuracoes.md).

## 3. A `api`

- `GET /clima?latitude=&longitude=&janela=expediente|proximas_horas` (todo perfil liberado): a `PrevisaoDoTempo` de `shared/api/clima.ts`. Nunca falha por causa do provedor: devolve `disponivel: false`. Latitude e longitude vêm juntas ou nenhuma.
- `GET /clima/cidades?busca=` (admin): busca de cidades brasileiras no geocodificador do Open-Meteo, para escolher a cidade padrão.
- Os eventos `apr_concluida` e `encerramento_assinado` aceitam `clima` (`ClimaRegistrado`); `POST /aprs/avaliar` também. É só informativo: a `api` guarda o que veio e nunca recusa um evento por causa dele. A única regra é a foto do extremo (decisão 11).
- `GET /os/{id}` devolve `clima` em cada APR e em cada execução (`null` quando não houve).
- Alerta novo `clima_extremo` (categoria Segurança, alvo OS), tratado como os outros avisos de segurança (`ehDeSeguranca`: vermelho e urgente).

## 4. As telas

- **Quadro de OS:** os contadores à esquerda e o cartão "Previsão do tempo" à direita (horas, ícones, temperatura, chance de chuva, título e orientação); em tela estreita um embaixo do outro.
- **APR (web e app):** a pergunta de clima mostra a previsão das próximas 4 horas; "Sim" com risco abre a janela de confirmação (com a foto, no extremo).
- **Encerramento:** manda as condições daquela hora, sem pedir nada à pessoa.
- **Relatório e detalhe da OS:** a seção "Condições climáticas".

## 5. Conferência pendente

- Ver as telas (quadro, APR com a janela, relatório) na web e no app.
- Rodar contra o Open-Meteo de verdade (o ambiente de testes usa um provedor em memória).
- A Segurança do Trabalho validar os limites da seção 2 e as frases de orientação.
- Decidir o plano do provedor para produção comercial.
- Pontas que ficaram de fora de propósito: o Campo de treino não tem previsão fictícia (a rota responde 404 e o cartão some; a web pode pedir o GPS uma vez antes de sumir); a cópia offline do app (`/sync/pull`) não traz o clima das APRs e execuções já feitas, então sem sinal o detalhe da OS não mostra essa linha; no app, "Confirmar e continuar" no extremo sem foto não fica inerte, mostra "Tire a foto do local para continuar" (regra do app de que botão não fica desativado por campo faltando).
